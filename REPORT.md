# COSTGUARD: Azure Infrastructure Cost Impact Predictor
## Hackathon Engineering & Verification Report

---

### 1. WHAT WE BUILT

1. CostGuard is a pre-deployment developer financial firewall that intercepts compiled Terraform Plan JSON before infrastructure changes are applied to Microsoft Azure.
2. The core engine parses resource changes, isolates billable infrastructure from free grouping resources, and extracts normalized Azure SKUs and regions.
3. Pricing is retrieved in real-time from the official Azure Retail Prices API using targeted OData consumption queries while filtering out Spot and Low Priority rates.
4. An embedded SQLite pricing cache indexes hourly rates using a composite key (`SKU + Region + Currency`) to eliminate redundant remote network calls and optimize CI/CD pipeline latency.
5. Monthly costs are computed using the industry-standard 730 hours/month consumption model, and an automated budget guardrail issues a deterministic deployment verdict (`PASSED` with exit code `0` or `FAILED` with exit code `1`).

---

### 2. DETECTION & EXTRACTION LOGIC

CostGuard parses the standard Terraform plan JSON structure (`resource_changes[]`) produced by `terraform show -json tfplan.binary`:

- **Resource Address & Type**: Extracted from `item.address` (e.g., `azurerm_linux_virtual_machine.app_server`) and `item.type` (e.g., `azurerm_linux_virtual_machine`, `azurerm_managed_disk`, `azurerm_resource_group`).
- **Action Determination**: Evaluated from `item.change.actions`:
  - `["create"]`: New billable resource. Previous cost is `$0.00`, proposed cost is the new monthly cost, delta is `+new cost`.
  - `["delete"]`: Decommissioned resource. Previous cost is the active monthly cost, proposed cost is `$0.00`, delta is `-old cost` (savings).
  - `["update"]`: In-place modification. Compares before state with after state. Delta is `new cost - old cost`. If only tags or security rules change, delta is `$0.00`.
  - `["delete", "create"]` or `["create", "delete"]`: Resource replacement. Compares destroyed and created configurations.
  - `["no-op"]` or `["read"]`: Skipped automatically.
- **SKU Extraction**:
  - Virtual Machines: Extracted from `item.change.after.size` or `item.change.after.vm_size` (e.g., `Standard_B1s`, `Standard_D2s_v3`, `Standard_D8s_v5`).
  - Managed Disks: Extracted from `storage_account_type` (`Premium_LRS`) and `disk_size_gb` to determine standard disk tiers (`P10` for 128GB, `P20` for 512GB).
- **Region Normalization**: Extracted from `location` (e.g., `East US` or `eastus`) and normalized to Azure ARM format (e.g., `eastus`) by converting to lowercase and stripping whitespace and hyphens.
- **Non-Billable Isolation**: Structural resources such as `azurerm_resource_group`, `azurerm_virtual_network`, `azurerm_subnet`, and `azurerm_network_security_group` are classified as non-billable and skipped without triggering unnecessary API requests.

---

### 3. METHODS TABLE

| Capability | Implementation Strategy | Rationale & Tradeoffs |
|---|---|---|
| **Pricing Retrieval** | Official Azure Retail Prices API (`https://prices.azure.com/api/retail/prices`) | Ensures real on-demand Azure billing rates instead of outdated static mocks. |
| **OData Filter** | `serviceName eq 'Virtual Machines' and armRegionName eq '<region>' and armSkuName eq '<sku>' and priceType eq 'Consumption'` | Narrow server-side query filters reduce payload size from megabytes to targeted JSON meters. |
| **Meter Filtering** | Strips meters containing `Spot`, `Low Priority`, and `Reservation` | Guarantees standard on-demand consumption pricing baseline. |
| **Cache Architecture** | Embedded SQLite (`DatabaseSync` / `node:sqlite`) with table `pricing_cache` | Local composite index (`sku + region + currency`) reduces subsequent lookup latency to sub-millisecond. |
| **Consumption Multiplier** | `Monthly Cost = Hourly Retail Price × 730` | Matches Microsoft Azure official pricing calculator standard (365 days × 24 hours / 12 months = 730 hours). |
| **Policy Guardrail** | `Net Monthly Impact <= Maximum Allowed Monthly Increase` | Deterministic binary gate: `PASSED` (exit code `0`) vs `FAILED` (exit code `1`). |

---

### 4. RESULTS MATRIX

| Test Plan | Scenario Description | Resources | Prior Total | Projected Total | Net Impact | Budget | Verdict | Exit Code |
|---|---|---|---|---|---|---|---|---|
| **Demo Spec Plan** | `Standard_B1s` $\to$ `Standard_D2s_v3` upgrade + `P10` disk | 4 (2 billable, 2 skipped) | $7.59 | $89.79 | +$82.20 | $50.00 | **FAILED (Blocked)** | `1` |
| **Plan 1: Net-New VM** | New `Standard_B2s` VM creation | 1 billable | $0.00 | $30.37 | +$30.37 | $50.00 | **PASSED** | `0` |
| **Plan 2: VM Deletion** | Deletion of legacy `Standard_D4s_v5` VM | 1 billable | $140.16 | $0.00 | -$140.16 | $50.00 | **PASSED (Savings)** | `0` |
| **Plan 3: In-Place Upgrade** | `Standard_B1s` $\to$ `Standard_B2s` upgrade | 1 billable | $7.59 | $30.37 | +$22.78 | $50.00 | **PASSED** | `0` |
| **Plan 4: Hostile Non-Billable** | 8 non-billable network resources + 1 `Standard_B1s` VM | 9 (1 billable, 8 skipped) | $0.00 | $7.59 | +$7.59 | $50.00 | **PASSED** | `0` |

---

### 5. LIMITATIONS & NEXT STEPS

- **Complex Variable Storage Disks**: Burst metrics and dynamic IOPS tiers beyond standard LRS managed disks are currently estimated at their base provisioned capacity.
- **Enterprise Discount Agreements (EA)**: Currently uses public Azure Retail Prices; custom EA enterprise price sheet ingestion via OAuth credentials is planned for Future Scope.
- **Multi-Cloud Integration**: Expanding parser adapters for AWS CloudFormation/Terraform AWS provider and Google Cloud Billing catalog.

---

### 6. HOW TO RUN IT

#### Local Web Dashboard & API Server:
```bash
# Install dependencies
npm install

# Start full-stack CostGuard server on port 3000
npm run dev

# Open in browser
http://localhost:3000
```

#### CLI Execution & Pipeline Simulation:
```bash
# Standard pipeline execution with pipe:
terraform show -json tfplan.binary | npx tsx cli.ts --max-increase 50

# Direct file execution:
npx tsx cli.ts --plan ./test-plans/costguard-demo-plan.json --max-increase 50
```
