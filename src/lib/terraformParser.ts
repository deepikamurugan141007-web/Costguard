/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ExtractedResource,
  TerraformAction,
  TerraformPlanJson,
  TerraformResourceChange,
} from '../types/costguard.ts';

// Known non-billable resources that should be cleanly skipped
const NON_BILLABLE_TYPES = new Set([
  'azurerm_resource_group',
  'azurerm_virtual_network',
  'azurerm_subnet',
  'azurerm_network_security_group',
  'azurerm_network_security_rule',
  'azurerm_route_table',
  'azurerm_route',
  'azurerm_network_interface',
  'azurerm_network_interface_security_group_association',
  'azurerm_subnet_network_security_group_association',
  'azurerm_subnet_route_table_association',
  'azurerm_virtual_network_peering',
  'azurerm_role_assignment',
  'azurerm_management_lock',
  'azurerm_private_dns_zone',
  'azurerm_private_dns_zone_virtual_network_link',
  'azurerm_private_endpoint',
  'azurerm_nat_gateway_association',
  'azurerm_ssh_public_key',
  'random_password',
  'random_string',
  'random_pet',
  'random_id',
  'null_resource',
  'local_file',
  'tls_private_key',
]);

/**
 * Determine high-level action from raw Terraform action array
 */
function resolveAction(actions: string[]): TerraformAction {
  if (!actions || actions.length === 0) return 'no-op';
  if (actions.includes('no-op') || actions.includes('read')) return 'no-op';

  if (actions.length === 1) {
    if (actions[0] === 'create') return 'create';
    if (actions[0] === 'delete') return 'delete';
    if (actions[0] === 'update') return 'update';
  }

  // Handle replacements
  if (
    (actions.includes('delete') && actions.includes('create')) ||
    (actions[0] === 'create' && actions[1] === 'delete') ||
    (actions[0] === 'delete' && actions[1] === 'create')
  ) {
    return 'replace';
  }

  return 'update';
}

/**
 * Normalize region strings (e.g., "East US" -> "eastus")
 */
export function normalizeRegion(region?: string): string {
  if (!region) return 'eastus';
  return region.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Extract disk SKU tier from disk size and storage type
 * Standard Azure managed disk sizes:
 * <= 32GB: P4, <= 64GB: P6, <= 128GB: P10, <= 256GB: P15, <= 512GB: P20, <= 1024GB: P30
 */
function resolveDiskTier(sizeGb?: number, tierHint?: string): string {
  if (tierHint && tierHint.toUpperCase().startsWith('P')) {
    return tierHint.toUpperCase();
  }
  const size = Number(sizeGb) || 128;
  if (size <= 32) return 'P4';
  if (size <= 64) return 'P6';
  if (size <= 128) return 'P10';
  if (size <= 256) return 'P15';
  if (size <= 512) return 'P20';
  if (size <= 1024) return 'P30';
  if (size <= 2048) return 'P40';
  if (size <= 4096) return 'P50';
  return 'P10';
}

/**
 * Check if the change only touched non-billable metadata (tags, descriptions, etc.)
 */
function checkIsMetadataOnly(
  type: string,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): boolean {
  if (!before || !after) return false;

  // Billable fields by resource category
  const billableKeysByType: Record<string, string[]> = {
    azurerm_linux_virtual_machine: ['size', 'vm_size', 'location'],
    azurerm_windows_virtual_machine: ['size', 'vm_size', 'location'],
    azurerm_virtual_machine: ['vm_size', 'location'],
    azurerm_managed_disk: ['storage_account_type', 'disk_size_gb', 'tier', 'location'],
    azurerm_service_plan: ['sku_name', 'os_type', 'location'],
    azurerm_app_service_plan: ['sku', 'location'],
    azurerm_mssql_database: ['sku_name', 'max_size_gb', 'location'],
    azurerm_postgresql_server: ['sku_name', 'storage_mb', 'location'],
    azurerm_public_ip: ['sku', 'allocation_method', 'location'],
  };

  const keys = billableKeysByType[type] || ['sku', 'size', 'sku_name', 'location'];
  const hasBillableFieldChange = keys.some((key) => {
    const b = before[key];
    const a = after[key];
    if (b === undefined && a === undefined) return false;
    return JSON.stringify(b) !== JSON.stringify(a);
  });

  return !hasBillableFieldChange;
}

/**
 * Parse a Terraform plan JSON and extract structured resource changes
 */
export function parseTerraformPlan(plan: TerraformPlanJson): ExtractedResource[] {
  const resourceChanges: TerraformResourceChange[] = plan?.resource_changes || [];
  const results: ExtractedResource[] = [];

  for (const rc of resourceChanges) {
    const rawActions = rc.change?.actions || [];
    const action = resolveAction(rawActions);

    if (action === 'no-op') {
      continue;
    }

    const before = rc.change?.before || null;
    const after = rc.change?.after || null;
    const stateObj = after || before || {};

    const rawRegion = (stateObj.location as string) || (before?.location as string) || 'eastus';
    const region = normalizeRegion(rawRegion);

    // 1. Check non-billable list
    if (NON_BILLABLE_TYPES.has(rc.type)) {
      results.push({
        address: rc.address,
        type: rc.type,
        name: rc.name,
        action,
        rawActions,
        region,
        isBillable: false,
        skipReason: 'Non-billable resource skipped',
        serviceCategory: 'network',
        rawDetails: { before, after },
      });
      continue;
    }

    // 2. Check metadata-only changes
    const isMetadataOnly = action === 'update' && checkIsMetadataOnly(rc.type, before, after);

    // 3. Extract SKUs based on resource type
    let beforeSku: string | undefined;
    let afterSku: string | undefined;
    let serviceCategory: ExtractedResource['serviceCategory'] = 'other';

    if (
      rc.type === 'azurerm_linux_virtual_machine' ||
      rc.type === 'azurerm_windows_virtual_machine' ||
      rc.type === 'azurerm_virtual_machine'
    ) {
      serviceCategory = 'compute';
      beforeSku = (before?.size as string) || (before?.vm_size as string) || undefined;
      afterSku = (after?.size as string) || (after?.vm_size as string) || undefined;
    } else if (rc.type === 'azurerm_managed_disk') {
      serviceCategory = 'storage';
      const beforeType = (before?.storage_account_type as string) || 'Premium_LRS';
      const afterType = (after?.storage_account_type as string) || 'Premium_LRS';
      const beforeSize = Number(before?.disk_size_gb) || 128;
      const afterSize = Number(after?.disk_size_gb) || 128;
      const beforeTierHint = (before?.tier as string) || (before?.sku_name as string);
      const afterTierHint = (after?.tier as string) || (after?.sku_name as string);

      beforeSku = before ? resolveDiskTier(beforeSize, beforeTierHint) : undefined;
      afterSku = after ? resolveDiskTier(afterSize, afterTierHint) : undefined;
    } else if (rc.type === 'azurerm_service_plan' || rc.type === 'azurerm_app_service_plan') {
      serviceCategory = 'compute';
      beforeSku = (before?.sku_name as string) || (before?.sku as Record<string, unknown>)?.name as string;
      afterSku = (after?.sku_name as string) || (after?.sku as Record<string, unknown>)?.name as string;
    } else if (rc.type === 'azurerm_mssql_database' || rc.type === 'azurerm_postgresql_server') {
      serviceCategory = 'database';
      beforeSku = (before?.sku_name as string) || undefined;
      afterSku = (after?.sku_name as string) || undefined;
    } else if (rc.type === 'azurerm_public_ip') {
      serviceCategory = 'network';
      beforeSku = (before?.sku as string) || 'Standard';
      afterSku = (after?.sku as string) || 'Standard';
    } else {
      // Generic billable fallback extraction
      beforeSku =
        (before?.sku as string) ||
        (before?.sku_name as string) ||
        (before?.size as string) ||
        (before?.tier as string) ||
        undefined;
      afterSku =
        (after?.sku as string) ||
        (after?.sku_name as string) ||
        (after?.size as string) ||
        (after?.tier as string) ||
        undefined;
    }

    results.push({
      address: rc.address,
      type: rc.type,
      name: rc.name,
      action,
      rawActions,
      region,
      isBillable: true,
      isMetadataOnlyChange: isMetadataOnly,
      beforeSku,
      afterSku,
      serviceCategory,
      rawDetails: { before, after },
    });
  }

  return results;
}
