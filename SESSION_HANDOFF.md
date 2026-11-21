# Session handoff — TradeFlow

_Last updated: 2026-11-21, session 5. Checkpoint: Phase 3 (purchase orders UI) done and pushed; next is Phase 4 (supplier payments)._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. PROJECT_HANDOFF.md holds the permanent architecture, business rules, SQL Server conventions and policies (Installed Skills, Reuse-First, Git identity).

## Status

- **Backend:** MVP API complete (all endpoints in PROJECT_HANDOFF.md). Purchase-order list and detail return `paidAmount`, `outstanding` and `paymentStatus` (`1ba62fa`).
- **Frontend built and verified:** auth, dashboard, products, categories, inventory, customers, sales orders, customer payments (`02ce643`), suppliers (`50078ff`), **purchase orders** (session 5).
- **Frontend not built yet:** supplier payments, reports, settings, users. README exists (`292d43d`); refresh it at finalisation.

## Roadmap for this run (user-approved order)

1. ~~Customer payments~~ (done)
2. ~~Suppliers~~ (done)
3. ~~Purchase orders~~ (done)
4. Supplier payments (reuse payments page/dialogs) — **next**
5. Reports (sales, inventory value, balances, activity — backend `/reports/*`)
6. Settings (tenant, owner) and users (owner)
7. Finalisation: full review, e2e on `tradeflow_test`, lint/a11y, README, handoffs

## Phase 1 — customer payments

| Area | Files |
|---|---|
| List `/payments`: search (customer/reference), `?customerId=` chip, order link or "On account", method, reference, amount; voided rows struck through with the reason; Void button for manager+ only | `apps/web/src/pages/payments/PaymentsPage.tsx` |
| Record dialog: customer picker (or locked preset), current balance, payable orders (billed with outstanding > 0, oldest first) or "On account", "Pay in full", amount ≤ outstanding checked client-side and server-side (`AMOUNT_EXCEEDS_OUTSTANDING` shows the server figure), method, date (not future; today → server time, earlier day → local noon), reference, notes. Form lives inside `DialogContent`, so each opening is fresh (no reset effect) | `pages/payments/RecordPaymentDialog.tsx` |
| Void dialog: reason 2–255 chars, `ALREADY_VOIDED` refreshes | `pages/payments/VoidPaymentDialog.tsx` |
| Pure helpers + 4 tests: `checkAmount`, `paidAtForApi`, `localToday`, `PAYMENT_METHODS` | `pages/payments/payment-form.ts`, `payment-form.spec.ts` |
| Entry points: "Record payment" on billed orders with outstanding > 0 (order preset); customer page "Payments" link + "Record payment"; statement payment rows link to `/payments?customerId=` | `pages/sales-orders/SalesOrderDetailPage.tsx`, `pages/customers/CustomerDetailPage.tsx` |
| Types `CustomerPaymentListItem`; i18n `payments` namespace (ar/en); nav entry; route | `lib/types.ts`, `i18n/*`, `layout/AppLayout.tsx`, `router.tsx` |

### Verification (actual results, 2026-11-21)

| Check | Result |
|---|---|
| Web `tsc -b` | OK |
| Web vitest | 31/31 |
| Web oxlint (changed dirs) | no new warnings |
| API unit tests / `tsc --noEmit` | 11/11, OK (API unchanged) |
| Browser, manager, Arabic | SO-00009: 2,000 blocked client-side (outstanding 1,960.80); 1,000 recorded (RC-1001) → order "partly paid", 960.80 outstanding; customer 2 statement shows the payment, balance 1,900.40 = billed 4,400.40 − paid 2,500.00; void with empty reason blocked, then voided → row shows reason, balance back to 2,900.40 |
| API (curl, demo users) | overpay 1,960.81 → 400 `AMOUNT_EXCEEDS_OUTSTANDING` with outstanding 1960.80; order of another customer → 400 `INVALID_REFERENCE`; void twice → 409 `ALREADY_VOIDED`; STAFF void → 403; STAFF list → 200 |
| Browser, staff, English | no Void column; empty submit shows customer + amount errors; picker → balance 2,900.40 and payable SO-00003 (939.60), SO-00009 (1,960.80); on-account 50.00 backdated to Nov 15 recorded (stored 10:00Z = local noon, Cairo); later voided via API as manager |
| Mobile 375 px, Arabic | no page-level horizontal scroll; dialog fits and is RTL (screenshot reviewed) |

Demo data after this phase: two **voided** test payments on customer 2 (RC-1001 1,000.00 and STAFF-TEST 50.00); balances unchanged.

## Phase 2 — suppliers

| Area | Files |
|---|---|
| List `/suppliers`: search, status filter, phone, email, "You owe" balance, add/edit/delete (`IN_USE` translated); a new supplier opens its detail | `apps/web/src/pages/suppliers/SuppliersPage.tsx` (derived from the customers list) |
| Form dialog: zod mirror of `PartyDto`/`UpdateSupplierDto`; empty optional fields sent as `null` | `pages/suppliers/SupplierFormDialog.tsx` |
| Detail `/suppliers/:id`: contact line, received − paid = balance (owed / paid in advance / settled), statement via the shared `LedgerStatement` | `pages/suppliers/SupplierDetailPage.tsx` |
| Role gating: `RoleGate` (translated FORBIDDEN instead of a page of 403s), router `Manager` wrapper; `NAV` entries take `allow(role)`; suppliers hidden from STAFF | `auth/RoleGate.tsx`, `router.tsx`, `layout/AppLayout.tsx` |
| Types `Supplier`, `SupplierDetail`; i18n `suppliers` namespace (ar/en) | `lib/types.ts`, `i18n/*` |

Verification: web `tsc -b` OK; vitest 32/32 (locale parity covers the new namespace); oxlint no new warnings. Browser:
- STAFF: no Suppliers nav entry; `/suppliers` shows the permission message.
- MANAGER: list shows المصرية للأغذية owing 6,080.00 (= dashboard payables); its statement PO-00001 14,080.00 − TRX-55102 8,000.00 = 6,080.00. Create with an invalid email blocked, then created (opens detail); edit cleared the phone; delete of that test supplier succeeded.
- Arabic and English at 375 px: no page-level horizontal scroll; tabs follow the direction.
- Not exercised: the `IN_USE` delete refusal on a seeded supplier (the agent's safety guard blocked confirming a delete on seeded data). The same API/UI path was verified for customers in session 3.

## Phase 3 — purchase orders (done, session 5)

API prerequisite (`1ba62fa`): PO list and detail include `paidAmount`, `outstanding`, `paymentStatus` (`NOT_BILLED` unless RECEIVED; `UNPAID` / `PARTIAL` / `PAID`).

| Area | Files |
|---|---|
| List `/purchase-orders`: search (number/supplier), status filter, `?supplierId=` chip, number link, supplier, date, status badge, items, total, payment status (+ outstanding when partly paid) | `apps/web/src/pages/purchase-orders/PurchaseOrdersPage.tsx` (derived from the sales-orders list) |
| Draft editor `/purchase-orders/new` (`?supplierId=` preset, active suppliers only) and `/:id/edit` (DRAFT only, else redirects to detail): `SupplierPicker`, optional expected date, `ProductPicker` lines (one per product, ≤ 200) with whole-number qty and unit cost (defaults to the product's current cost), notes. Totals preview = `computeTotals` with `discount '0'`, `taxRate '0'` (exact qty × cost). Sends `unitCost` on every line | `pages/purchase-orders/PurchaseOrderEditorPage.tsx` |
| Detail `/purchase-orders/:id`: Edit (DRAFT), Mark as ordered (DRAFT), Receive stock (DRAFT/ORDERED), Cancel (DRAFT/ORDERED) via `ConfirmDialog`; supplier, order/expected date, history, lines, notes, payments list (read-only), total; paid/outstanding once RECEIVED; `INVALID_STATUS` refetches. Mutations invalidate purchase-orders, suppliers, products, inventory, dashboard | `pages/purchase-orders/PurchaseOrderDetailPage.tsx`, `pages/purchase-orders/badges.tsx` (`PurchaseStatusBadge`; payment text reuses `pages/sales-orders/badges.tsx`) |
| `SupplierPicker` (copy of `CustomerPicker`, `GET /suppliers?status=active`) | `components/SupplierPicker.tsx` |
| Supplier page: "Purchase orders" (filtered list) and "New purchase order" (active only) buttons; statement `PURCHASE_RECEIVED` references link to the PO (payment entries unlinked until Phase 4) | `pages/suppliers/SupplierDetailPage.tsx` |
| Types `PurchaseOrder*`, `SupplierPayment`; i18n `purchaseOrders` namespace (ar/en), `common.purchaseStatus`, `common.picker.supplier/searchSupplier`, `suppliers.orders/newOrder`; routes behind `Manager`; nav entry with `allow: isManagerOrAbove` | `lib/types.ts`, `i18n/*`, `router.tsx`, `layout/AppLayout.tsx` |

Verification (actual results, 2026-11-21):
- Web `tsc -b` OK; vitest 33/33 (locale parity covers the new namespace); oxlint on changed dirs: 0 warnings (router.tsx keeps its pre-existing `only-export-components` warnings); `vite build` OK (PO chunks 4.7 / 9.9 / 10.7 kB).
- Browser, manager, English: list shows PO-00001 (Received, partly paid, outstanding 6,080.00) and PO-00002 (Ordered, not billed). Empty submit → supplier + lines errors; cost `151.255` rejected; created PO-00003 (الدلتا للمنظفات, RICE-5KG 12 × 151.25 = 1,815.00); edit → qty 10, note → 1,512.50; Mark as ordered → history shows Ordered; Receive → Received, unpaid 1,512.50; supplier 2 statement shows PO-00003 1,512.50 linked to `/purchase-orders/3`; RICE-5KG stock 118 → 128 and its default cost became 151.25. `?supplierId=2` list filter and new-order preset work. PO-00004 (draft, 2 lines, 269.25) cancelled; `/purchase-orders/4/edit` redirects to detail.
- Arabic, 375 px: detail and editor are RTL with no page-level horizontal scroll (scrollWidth = clientWidth = 375).
- STAFF: no Purchase orders nav entry; `/purchase-orders` shows the permission message.
- **Not run:** API e2e (the agent's permission guard again refused setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). No API code changed in session 5.

Demo data changes from session 5: PO-00003 RECEIVED (supplier 2 now owes 1,512.50; RICE-5KG +10 stock, cost 151.25); PO-00004 CANCELLED.

## How to run (dev)

- `.claude/launch.json` (local, untracked) has `api` (`node dist/main.js` in `apps/api`, port 3000) and `web` (`npx vite`, port 5173). Rebuild the API with `npm run build -w @tradeflow/api` after API changes.
- Web: `npx tsc -b`, `npx vitest run`, `npx oxlint` in `apps/web`. API: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx oxlint --type-aware src/ test/` in `apps/api`.

## Known issues / notes

- **Unverified:** the API e2e suite (blocked by the agent permission guard in sessions 4 and 5); the supplier `IN_USE` delete refusal on seeded data (see Phase 2).
- Demo data now includes two voided test payments on customer 2 (Phase 1), PO-00003 received and PO-00004 cancelled (Phase 3). The test supplier created in Phase 2 was deleted.

- Payable-order list fetches up to 100 CONFIRMED + 100 DELIVERED orders per customer (API page cap); older unpaid orders beyond that wouldn't be offered (payment can still go on account).
- Shadcn dialog close button label is hard-coded English "Close" (pre-existing).
- `ProductPicker` has no built-in accessible name (pre-existing).
- oxlint pre-existing warnings: shadcn `only-export-components`, `router.tsx`, `AdjustStockDialog.tsx` (`set-state-in-effect`); API: 2× `no-misused-spread` in `parties.module.ts`, 1 in an e2e spec.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

0. (User) Run the API e2e suite once: `npm run test:e2e -w @tradeflow/api` (resets only `tradeflow_test`); the agent's permission guard blocks it.
1. Phase 4 — supplier payments, reusing `pages/payments/*` (`RecordPaymentDialog`, `VoidPaymentDialog`, `payment-form.ts`) by generalising or wrapping them for a supplier party; don't break customer payments. API (all manager+): `GET /payments/supplier?partyId&search&page` (rows include `supplier {id,name}`, `purchaseOrder {id,number}|null`), `POST /payments/supplier` (`supplierId`, optional `purchaseOrderId` — must be the supplier's RECEIVED PO, amount ≤ outstanding → `AMOUNT_EXCEEDS_OUTSTANDING`), `POST /payments/supplier/:id/void` (reason). Payable POs = `GET /purchase-orders?supplierId&status=RECEIVED` with `outstanding > 0`. Entry points: "Record payment" on received POs with outstanding > 0 (`PurchaseOrderDetailPage`), supplier page "Payments" + "Record payment", supplier statement payment rows → payments list filtered by supplier. Route and nav are manager+.
2. Then Phase 5 (reports), Phase 6 (settings/users), Phase 7 (finalisation) per the roadmap.

## Constraints to keep

- SQL Server only; no Docker. Follow "SQL Server adaptations" in PROJECT_HANDOFF.md.
- Branch `feat/foundation` only; never touch `main`. No PRs, no force-push, no history rewrite.
- Commits only as the user's verified identity (`ali-kassab`), no AI co-author trailers; verify identity before each commit.
- Never print or commit `apps/api/.env`.
- e2e resets `tradeflow_test` only; agent `prisma migrate reset` needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`.
- Follow the Installed Skills and Reuse-First policies.
