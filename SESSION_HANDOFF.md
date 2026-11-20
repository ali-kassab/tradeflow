# Session handoff — TradeFlow

_Last updated: 2026-11-21, end of session 4 (safe shutdown). Checkpoint: Phase 2 (suppliers) done; Phase 3 (purchase orders) started with one backend prerequisite committed, no PO UI yet._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. PROJECT_HANDOFF.md holds the permanent architecture, business rules, SQL Server conventions and policies (Installed Skills, Reuse-First, Git identity).

## Status

- **Backend:** MVP API complete (all endpoints in PROJECT_HANDOFF.md). One additive change this session: purchase-order list and detail now return `paidAmount`, `outstanding` and `paymentStatus` (see Phase 3 below).
- **Frontend built and verified:** auth, dashboard, products, categories, inventory, customers, sales orders, customer payments (`02ce643`), **suppliers**.
- **Frontend not built yet:** purchase orders, supplier payments, reports, settings, users. README missing.

## Roadmap for this run (user-approved order)

1. ~~Customer payments~~ (done)
2. ~~Suppliers~~ (done)
3. Purchase orders (list, draft editor, order / receive / cancel, detail) — **in progress**: API payment summary done; UI not started
4. Supplier payments (reuse payments page/dialogs)
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

## Phase 3 — purchase orders (started; stopped at the user's shutdown request)

Done and committed:
- `apps/api/src/modules/purchase-orders/purchase-orders.module.ts`: list and detail now include `paidAmount`, `outstanding`, `paymentStatus` (`NOT_BILLED` unless RECEIVED; `UNPAID` / `PARTIAL` / `PAID`), computed like sales orders (`paidByOrder` groupBy over non-voided supplier payments + module-level `paymentSummary`). Detail previously returned `paidAmount`/`outstanding` only; the shape is additive. Needed by the PO list's payment column and by supplier payments (payable POs) in Phase 4.

Verification of that change: API `tsc --noEmit` OK; unit tests 11/11; oxlint no warnings in the module; live API (rebuilt `dist`): PO-00001 RECEIVED 14,080 → paid 8,000.00, outstanding 6,080.00, PARTIAL (= supplier balance); PO-00002 ORDERED → NOT_BILLED; STAFF `GET /purchase-orders` → 403.
**e2e not run this session:** the agent's permission guard refused setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` for the test-DB reset. Run `npm run test:e2e -w @tradeflow/api` yourself (it only resets `tradeflow_test`), or allow it for the agent.

Not started: all PO frontend (no files exist under `pages/purchase-orders/`).

Facts gathered for the PO UI (from the API source):
- Lines are quantity × unit cost only; `total` = Σ line totals (no discount/VAT). `unitCost` optional per line (defaults to the product's current cost); one line per product; 1–200 lines; `expectedDate` and `notes` optional. `PATCH` only while DRAFT.
- Transitions: `POST /:id/order` DRAFT→ORDERED; `/:id/receive` from DRAFT or ORDERED → RECEIVED (adds stock, sets each product's `costPrice` to the line cost, locks the row); `/:id/cancel` from DRAFT or ORDERED. RECEIVED can't be cancelled. Wrong state → 409 `INVALID_STATUS`. Whole controller is manager+.
- Preview totals with `computeTotals` from `lib/order-math` using `discount: '0'`, `taxRate: '0'` (exact for qty × cost).
- A `SupplierPicker` is needed (copy `components/CustomerPicker.tsx`, endpoint `/suppliers`).

## How to run (dev)

- `.claude/launch.json` (local, untracked) has `api` (`node dist/main.js` in `apps/api`, port 3000) and `web` (`npx vite`, port 5173). Rebuild the API with `npm run build -w @tradeflow/api` after API changes.
- Web: `npx tsc -b`, `npx vitest run`, `npx oxlint` in `apps/web`. API: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx oxlint --type-aware src/ test/` in `apps/api`.

## Known issues / notes

- **Unverified this session:** the API e2e suite (blocked by the agent permission guard, see Phase 3); the supplier `IN_USE` delete refusal on seeded data (see Phase 2).
- Demo data now includes two voided test payments on customer 2 (Phase 1). The test supplier created in Phase 2 was deleted.

- Payable-order list fetches up to 100 CONFIRMED + 100 DELIVERED orders per customer (API page cap); older unpaid orders beyond that wouldn't be offered (payment can still go on account).
- Shadcn dialog close button label is hard-coded English "Close" (pre-existing).
- `ProductPicker` has no built-in accessible name (pre-existing).
- oxlint pre-existing warnings: shadcn `only-export-components`, `router.tsx`, `AdjustStockDialog.tsx` (`set-state-in-effect`); API: 2× `no-misused-spread` in `parties.module.ts`, 1 in an e2e spec.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

0. Run the API e2e suite once (see Phase 3 note) to confirm the purchase-order API change against the full suite.
1. Phase 3 — purchase orders (API facts are listed in the Phase 3 section above): build `pages/purchase-orders/` (list, draft editor with `ProductPicker` and unit costs, detail with Order / Receive / Cancel) reusing the sales-orders pages and `lib/order-math`; manager+ only (`Manager` route wrapper, nav `allow`). Then link supplier statement PO references and add "Orders" / "New order" on the supplier page.

## Constraints to keep

- SQL Server only; no Docker. Follow "SQL Server adaptations" in PROJECT_HANDOFF.md.
- Branch `feat/foundation` only; never touch `main`. No PRs, no force-push, no history rewrite.
- Commits only as the user's verified identity (`ali-kassab`), no AI co-author trailers; verify identity before each commit.
- Never print or commit `apps/api/.env`.
- e2e resets `tradeflow_test` only; agent `prisma migrate reset` needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`.
- Follow the Installed Skills and Reuse-First policies.
