/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TerraformPlanJson } from '../types/costguard.ts';

/**
 * Specification Demo Plan (Section 5):
 * 1. Azure Linux VM update:
 *    azurerm_linux_virtual_machine.app_server
 *    before: size = Standard_B1s, location = East US
 *    after: size = Standard_D2s_v3, location = East US
 *    action: ["update"]
 * 2. Managed disk creation:
 *    azurerm_managed_disk.data_disk
 *    action: ["create"]
 * 3. Resource group:
 *    azurerm_resource_group.rg
 *    action: ["no-op"]
 * 4. Virtual network:
 *    azurerm_virtual_network.vnet
 *    action: ["no-op"]
 */
export const DEMO_PLAN_SPEC: TerraformPlanJson = {
  format_version: '1.2',
  terraform_version: '1.8.5',
  resource_changes: [
    {
      address: 'azurerm_linux_virtual_machine.app_server',
      mode: 'managed',
      type: 'azurerm_linux_virtual_machine',
      name: 'app_server',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['update'],
        before: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-app-prod',
          resource_group_name: 'rg-costguard-prod',
          size: 'Standard_B1s',
          tags: { environment: 'production' },
        },
        after: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-app-prod',
          resource_group_name: 'rg-costguard-prod',
          size: 'Standard_D2s_v3',
          tags: { environment: 'production', upgraded: 'true' },
        },
      },
    },
    {
      address: 'azurerm_managed_disk.data_disk',
      mode: 'managed',
      type: 'azurerm_managed_disk',
      name: 'data_disk',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['create'],
        before: null,
        after: {
          create_option: 'Empty',
          disk_size_gb: 128,
          location: 'East US',
          name: 'disk-app-data',
          resource_group_name: 'rg-costguard-prod',
          storage_account_type: 'Premium_LRS',
          tier: 'P10',
        },
      },
    },
    {
      address: 'azurerm_resource_group.rg',
      mode: 'managed',
      type: 'azurerm_resource_group',
      name: 'rg',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['no-op'],
        before: {
          location: 'East US',
          name: 'rg-costguard-prod',
        },
        after: {
          location: 'East US',
          name: 'rg-costguard-prod',
        },
      },
    },
    {
      address: 'azurerm_virtual_network.vnet',
      mode: 'managed',
      type: 'azurerm_virtual_network',
      name: 'vnet',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['no-op'],
        before: {
          address_space: ['10.0.0.0/16'],
          location: 'East US',
          name: 'vnet-costguard-prod',
        },
        after: {
          address_space: ['10.0.0.0/16'],
          location: 'East US',
          name: 'vnet-costguard-prod',
        },
      },
    },
  ],
};

/**
 * TEST PLAN 1: Net-New VM Creation
 * Expected: Positive delta (+$30.37)
 */
export const TEST_PLAN_1_NEW_VM: TerraformPlanJson = {
  format_version: '1.2',
  terraform_version: '1.8.5',
  resource_changes: [
    {
      address: 'azurerm_linux_virtual_machine.worker',
      mode: 'managed',
      type: 'azurerm_linux_virtual_machine',
      name: 'worker',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['create'],
        before: null,
        after: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-worker-eastus',
          size: 'Standard_B2s',
          tags: { role: 'background-worker' },
        },
      },
    },
  ],
};

/**
 * TEST PLAN 2: VM Deletion
 * Expected: Negative delta / savings (-$140.16)
 */
export const TEST_PLAN_2_VM_DELETION: TerraformPlanJson = {
  format_version: '1.2',
  terraform_version: '1.8.5',
  resource_changes: [
    {
      address: 'azurerm_linux_virtual_machine.legacy_db',
      mode: 'managed',
      type: 'azurerm_linux_virtual_machine',
      name: 'legacy_db',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['delete'],
        before: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-legacy-database',
          size: 'Standard_D4s_v5',
        },
        after: null,
      },
    },
  ],
};

/**
 * TEST PLAN 3: In-Place VM Upgrade
 * Expected: Partial positive delta (+$22.78)
 */
export const TEST_PLAN_3_VM_UPGRADE: TerraformPlanJson = {
  format_version: '1.2',
  terraform_version: '1.8.5',
  resource_changes: [
    {
      address: 'azurerm_linux_virtual_machine.web',
      mode: 'managed',
      type: 'azurerm_linux_virtual_machine',
      name: 'web',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['update'],
        before: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-web-frontend',
          size: 'Standard_B1s',
        },
        after: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-web-frontend',
          size: 'Standard_B2s',
        },
      },
    },
  ],
};

/**
 * TEST PLAN 4: Hostile Plan Containing Many Non-Billable Resources
 * Expected: 8 non-billable resources skipped cleanly without crashing, 1 VM priced
 */
export const TEST_PLAN_4_HOSTILE_NON_BILLABLE: TerraformPlanJson = {
  format_version: '1.2',
  terraform_version: '1.8.5',
  resource_changes: [
    {
      address: 'azurerm_resource_group.rg1',
      mode: 'managed',
      type: 'azurerm_resource_group',
      name: 'rg1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { location: 'East US', name: 'rg-hostile-1' } },
    },
    {
      address: 'azurerm_virtual_network.vnet1',
      mode: 'managed',
      type: 'azurerm_virtual_network',
      name: 'vnet1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { location: 'East US', name: 'vnet-hostile-1', address_space: ['10.0.0.0/16'] } },
    },
    {
      address: 'azurerm_subnet.subnet1',
      mode: 'managed',
      type: 'azurerm_subnet',
      name: 'subnet1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { name: 'snet-1', address_prefixes: ['10.0.1.0/24'] } },
    },
    {
      address: 'azurerm_subnet.subnet2',
      mode: 'managed',
      type: 'azurerm_subnet',
      name: 'subnet2',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { name: 'snet-2', address_prefixes: ['10.0.2.0/24'] } },
    },
    {
      address: 'azurerm_network_security_group.nsg1',
      mode: 'managed',
      type: 'azurerm_network_security_group',
      name: 'nsg1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { location: 'East US', name: 'nsg-hostile-1' } },
    },
    {
      address: 'azurerm_network_security_rule.rule1',
      mode: 'managed',
      type: 'azurerm_network_security_rule',
      name: 'rule1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { name: 'allow-ssh', priority: 100, direction: 'Inbound' } },
    },
    {
      address: 'azurerm_route_table.rt1',
      mode: 'managed',
      type: 'azurerm_route_table',
      name: 'rt1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { location: 'East US', name: 'rt-hostile-1' } },
    },
    {
      address: 'azurerm_network_interface.nic1',
      mode: 'managed',
      type: 'azurerm_network_interface',
      name: 'nic1',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: { actions: ['create'], before: null, after: { location: 'East US', name: 'nic-hostile-1' } },
    },
    {
      address: 'azurerm_linux_virtual_machine.bastion',
      mode: 'managed',
      type: 'azurerm_linux_virtual_machine',
      name: 'bastion',
      provider_name: 'registry.terraform.io/hashicorp/azurerm',
      change: {
        actions: ['create'],
        before: null,
        after: {
          admin_username: 'azureuser',
          location: 'East US',
          name: 'vm-bastion',
          size: 'Standard_B1s',
        },
      },
    },
  ],
};

// Aliases for compatibility
export const DEMO_PLAN_PRIMARY_BREACH = DEMO_PLAN_SPEC;
export const DEMO_PLAN_WITHIN_BUDGET = TEST_PLAN_3_VM_UPGRADE;
export const DEMO_PLAN_SAVINGS = TEST_PLAN_2_VM_DELETION;
