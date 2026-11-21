# Session handoff — TradeFlow

_Last updated: 2026-11-21, session 6. Checkpoint: Phases 5 (reports, `fca0404`) and 6 (settings and users) done and pushed; Phase 7 (finalisation) next._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. PROJECT_HANDOFF.md holds the permanent architecture, business rules, SQL Server conventions and policies (Installed Skills, Reuse-First, Git identity).

## Status

- **Backend:** MVP API complete (all endpoints in PROJECT_HANDOFF.md). Purchase-order list and detail return `paidAmount`, `outstanding` and `paymentStatus` (`1ba62fa`).
- **Frontend built and verified:** auth, dashboard, products, categories, inventory, customers, sales orders, customer payments (`02ce643`), suppliers (`50078ff`), purchase orders (`fa43352`), supplier payments (`55b21d0`), reports (`fca0404`), settings and users (session 6). Every MVP screen now exists. README exists (`292d43d`); refresh it at finalisation.

## Roadmap for this run (user-approved order)

1. ~~Customer payments~~ (done)
2. ~~Suppliers~~ (done)
3. ~~Purchase orders~~ (done)
4. ~~Supplier payments~~ (done)
5. ~~Reports~~ (done, session 6)
6. ~~Settings and users~~ (done, session 6)
7. Finalisation — **next**: full review, e2e on `tradeflow_test`, lint/a11y, README, handoffs

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

## Phase 4 — supplier payments (done, session 5)

Built by generalising the customer-payments UI with a `kind` ('customer' | 'supplier') instead of copying it.

| Area | Files |
|---|---|
| Per-kind config (endpoint, list/party/order paths, `partyParam`, order body field, billed statuses, caches to invalidate), `fetchPayableOrders(kind, partyId)`, `toPaymentRow` (normalises customer/supplier list rows) + 3 tests | `apps/web/src/pages/payments/payment-kinds.ts`, `payment-kinds.spec.ts` |
| `PaymentsView({kind})`: shared list (search, `?customerId=` / `?supplierId=` chip, party and order links, void for manager+). `/payments` = customer (default export), `/supplier-payments` = supplier (manager+ route and nav entry) | `pages/payments/PaymentsPage.tsx`, `pages/payments/SupplierPaymentsPage.tsx` |
| `RecordPaymentDialog` props are now `kind` (default `'customer'`), `party` (was `customer`), `order`; picks `CustomerPicker`/`SupplierPicker`, sends `customerId`+`salesOrderId` or `supplierId`+`purchaseOrderId`. `VoidPaymentDialog` takes `kind`; `VoidTarget.customerName` → `partyName` | `pages/payments/RecordPaymentDialog.tsx`, `VoidPaymentDialog.tsx`; call sites `pages/customers/CustomerDetailPage.tsx`, `pages/sales-orders/SalesOrderDetailPage.tsx` |
| Entry points: "Record payment" on RECEIVED POs with outstanding > 0; supplier page "Payments" + "Record payment"; supplier statement payment rows → `/supplier-payments?supplierId=` | `pages/purchase-orders/PurchaseOrderDetailPage.tsx`, `pages/suppliers/SupplierDetailPage.tsx` |
| i18n: party-specific payment strings moved under `payments.party.{customer,supplier}` (title, description, search, column, field, validation, balance, noOpenOrders, paidAt, voidBody); `nav.payments` now reads "Customer payments" / "مدفوعات العملاء"; new `nav.supplierPayments`, `suppliers.payments/recordPayment`, `purchaseOrders.actions.recordPayment`; type `SupplierPaymentListItem` | `i18n/locales/*`, `lib/types.ts`, `layout/AppLayout.tsx`, `router.tsx` |

Verification (actual results, 2026-11-21): web `tsc -b` OK; vitest 36/36; oxlint on changed dirs 0 warnings; `vite build` OK.
- Browser, STAFF: no Supplier payments nav entry, `/supplier-payments` → permission message; `/payments` titled "Customer payments", no Void column; empty submit → "Choose a customer." + amount error.
- Browser, MANAGER: PO-00003 "Record payment" → supplier + order locked, amount preset 1,512.50; 1,512.51 blocked client-side; 500.00 recorded → PO partly paid, outstanding 1,012.50; supplier 2 statement 1,512.50 − 500.00 = 1,012.50, payment row links to `/supplier-payments?supplierId=2`; voided with a reason → PO back to unpaid 1,512.50. Customer 2 record dialog still shows "Customer", balance 2,900.40.
- Arabic, 375 px: supplier record dialog fits (scrollWidth 375), shows "المستحق للمورد: 6,080.00" and payable PO-00001 for المصرية للأغذية (not submitted).
- API (curl, demo users): overpay 1,512.51 on PO-00003 → 400 `AMOUNT_EXCEEDS_OUTSTANDING` (outstanding 1512.50); PO-00003 with supplier 1 → 400 `INVALID_REFERENCE`; STAFF `GET /payments/supplier` → 403; second void → 409 `ALREADY_VOIDED`.

Demo data from Phase 4: one **voided** 500.00 supplier payment on PO-00003 (reason "UI verification entry"); balances unchanged.

## Phase 5 — reports (done, session 6)

Restored from the session-5 stash, finished, committed. `/reports` (manager+), four tabs in `?tab=` (`sales` default, `inventory`, `balances`, `activity`); Radix mounts only the active tab, so each report fetches when opened.

| Area | Files |
|---|---|
| Page + tabs (URL-synced via `toReportTab`), route behind `Manager`, nav entry `ChartColumnIcon` with `allow: isManagerOrAbove` | `apps/web/src/pages/reports/ReportsPage.tsx`, `router.tsx`, `layout/AppLayout.tsx` |
| Sales: from/to dates (invalid range blocks the query), ledger-style summary (net sales − cost = gross profit, margin, VAT + invoiced total), single-series daily bar chart + `<details>` table, top customers / top products (gross profit, margin) | `pages/reports/SalesReport.tsx` |
| Inventory: value at cost, units, low-stock count; "only items to reorder" filter (client-side); rows link to `/inventory?productId=`; total footer | `pages/reports/InventoryReport.tsx` |
| Balances: owed / credit totals for customers and suppliers (exact BigInt cents), tables with "credit"/"in advance" tags for negative balances, "Over limit" badge (warning only) | `pages/reports/BalancesReport.tsx` |
| Activity: last 100 actions, user, translated action, reference link (`<bdi>` document number), details (amount/total, void reason, signed stock qty + note) | `pages/reports/ActivityReport.tsx` |
| Helpers + tests: `defaultRange`, `isValidRange`, `marginPercent`, `ACTIVITY_ACTIONS`/`isKnownAction`, `activityHref`, `metaValue`, `splitBalances`, `isOverLimit`, `REPORT_TABS`/`toReportTab` | `pages/reports/report-utils.ts`, `report-utils.spec.ts` |
| Types `SalesReport`, `InventoryReport`, `BalancesReport`, `ActivityEntry`; `formatDateTime`; i18n `reports` namespace (ar/en) | `lib/types.ts`, `lib/format.ts`, `i18n/locales/{ar,en}/reports.json`, `i18n/resources.ts` |

Layout note: single-column CSS grids holding scrollable tables need `grid-cols-[minmax(0,1fr)]`, otherwise the implicit `auto` track grows to the table width and the whole page scrolls sideways on phones.

Verification (actual results, 2026-11-21): web `tsc -b` OK; vitest 45/45; oxlint on changed dirs 0 warnings; `vite build` OK (ReportsPage chunk 21.0 kB / 4.5 kB gzip); API `tsc --noEmit` OK, vitest 11/11 (API unchanged).
- Browser, MANAGER, English: sales (last 30 days) 10 orders, net 34,657.00 − cost 28,901.50 = gross profit 5,755.50 (16.6%); inventory value 61,584.50 and 1,258 units = sum of the 11 rows, 4 low-stock, filter → 4 rows, no footer; balances owed by customers 12,789.98 (= sum of 4 rows), customer credit 500.00 (ماركت السعادة), owed to suppliers 7,592.50 (6,080.00 + 1,512.50); activity lists the session-5 PO/payment actions with reasons and amounts. `?tab=` updates on tab change.
- Arabic, 375 px: all four tabs RTL with scrollWidth = clientWidth = 375 (after the grid fix above and removing a scroll wrapper around the tab list that showed a stray scrollbar).
- STAFF: no Reports nav entry; `/reports` shows the permission message; API `GET /reports/{sales,inventory,balances,activity}` → 403 for staff, 200 for manager.
- Dataviz skill: single-series chart only (no categorical palette, so no validator run), no legend for one series, tooltip via `ChartTooltip`, table view in `<details>`.

## Phase 6 — settings and users (done, session 6)

| Area | Files |
|---|---|
| `/settings` (every role): Business section — owner edits name, currency (ISO 3 letters, upper-cased), default VAT % (0–100, ≤ 2 decimals; sent as a number); other roles see it read-only. Save refreshes the session in place (`reloadSession`), so the sidebar name, money formatting and new-order VAT update without a reload. Your password section — current + new (8–128) + repeat; on success the API revokes every session, so the UI signs out and goes to `/login` with a toast | `apps/web/src/pages/settings/SettingsPage.tsx`, `settings-schemas.ts` |
| `/users` (owner, router `Owner` wrapper = `RoleGate` with `isOwner`): list (name + "(you)", email, role, active/deactivated, last sign-in); Add user (name, email, temporary password with "Generate", role); Edit (name, role, "Can sign in" — role and access locked for yourself, mirroring `CANNOT_MODIFY_SELF`; only the name is sent then); Reset password (not on yourself). Editing your own name reloads the session | `pages/users/UsersPage.tsx`, `UserFormDialog.tsx`, `ResetPasswordDialog.tsx`, `PasswordField.tsx` (shadcn `InputGroup`), `user-schemas.ts` (zod mirrors of the DTOs, `generatePassword`: crypto random, unambiguous alphabet, rejection sampling) |
| `reloadSession()` on the auth context (re-reads `/auth/me`) | `auth/context.ts`, `auth/AuthProvider.tsx` |
| Types `TenantSettings`, `UserAccount`; i18n `settings` and `users` namespaces (ar/en); nav entries Users (`allow: isOwner`) and Settings (all) | `lib/types.ts`, `i18n/*`, `layout/AppLayout.tsx`, `router.tsx` |

Verification (actual results, 2026-11-21): web `tsc -b` OK; vitest 51/51 (`pages/users/user-schemas.spec.ts` + locale parity for the new namespaces); oxlint on changed dirs 0 new warnings (router.tsx keeps its pre-existing `only-export-components` warnings); `vite build` OK (SettingsPage 5.7 kB, UsersPage 10.3 kB).
- STAFF: nav has Settings, no Users/Reports; `/settings` shows the business read-only (name, EGP, 14%) and the password form; `/users` shows the permission message.
- OWNER, English: users list shows the 3 demo users; empty Add → name/email/password errors; Generate fills a 12-char password and clears the error; created "QA Tester" (STAFF); own Edit has role and access disabled; QA Tester role → Manager; reset with "short" blocked, then reset OK (API: old password 401, new 200). API: duplicate email (different case) → 409 `EMAIL_TAKEN`; owner PATCH own role → 400 `CANNOT_MODIFY_SELF`.
- Settings as owner: currency "EG" and VAT 100.5 blocked client-side; saved "usd"/15 → stored USD, new sales order editor shows 15% and $; business rename updated the sidebar in place (no reload); all restored to the original name, EGP, 14 (confirmed via `GET /tenant`).
- Password change as QA Tester: mismatch → field error; wrong current → toast "Current password is incorrect." (still signed in); correct → toast + redirected to `/login`; API: old 401, new 200. Then deactivated QA Tester as owner → list shows "Deactivated"; login → 401 `ACCOUNT_DISABLED`.
- Arabic, 375 px: `/users` and `/settings` RTL, scrollWidth = 375 (users table scrolls inside its card).

Demo data from Phase 6: one extra **deactivated** user "QA Tester" (`qa.tester@demo.tradeflow.local`, MANAGER). Users can't be deleted (no API); it is harmless. Business settings unchanged.

## How to run (dev)

- `.claude/launch.json` (local, untracked) has `api` (`node dist/main.js` in `apps/api`, port 3000) and `web` (`npx vite`, port 5173). Rebuild the API with `npm run build -w @tradeflow/api` after API changes.
- Web: `npx tsc -b`, `npx vitest run`, `npx oxlint` in `apps/web`. API: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx oxlint --type-aware src/ test/` in `apps/api`.

## Known issues / notes

- **Unverified:** the API e2e suite (blocked by the agent permission guard in sessions 4 and 5; not attempted in session 6); the supplier `IN_USE` delete refusal on seeded data (see Phase 2).
- The session-5 stash ("WIP phase 5 reports") was dropped after the Phase 5 commit was pushed; its content is all in that commit.
- The browser pane was left signed in as the demo OWNER, in Arabic.
- Dev-only: when several auth files change at once, Vite HMR can reload the page twice while a refresh is in flight; the second load replays the rotated refresh token, the API revokes the family (by design) and you land on `/login`. Not reproducible on normal navigation (refresh calls are deduplicated in `lib/api.ts`).
- Demo data now includes two voided test payments on customer 2 (Phase 1), PO-00003 received and PO-00004 cancelled (Phase 3), one voided 500.00 supplier payment on PO-00003 (Phase 4). The test supplier created in Phase 2 was deleted.

- Payable-order list fetches up to 100 orders per billed status per party (API page cap: customers CONFIRMED + DELIVERED, suppliers RECEIVED); older unpaid orders beyond that wouldn't be offered (payment can still go on account).
- Shadcn dialog close button label is hard-coded English "Close" (pre-existing).
- `ProductPicker` has no built-in accessible name (pre-existing).
- oxlint pre-existing warnings: shadcn `only-export-components`, `router.tsx`, `AdjustStockDialog.tsx` (`set-state-in-effect`); API: 2× `no-misused-spread` in `parties.module.ts`, 1 in an e2e spec.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

0. (User) Run the API e2e suite once: `npm run test:e2e -w @tradeflow/api` (resets only `tradeflow_test`); the agent's permission guard blocks it (sessions 4 and 5).
1. Phase 7 (finalisation): full review of the web app (consistency, a11y — e.g. the pre-existing "Close" label and `ProductPicker` name below), oxlint across `apps/web/src` and `apps/api`, API e2e on `tradeflow_test` if the permission guard allows (else leave it to the user), refresh README (features, screenshots optional, setup), final handoff update. Don't add features.

## Constraints to keep

- SQL Server only; no Docker. Follow "SQL Server adaptations" in PROJECT_HANDOFF.md.
- Branch `feat/foundation` only; never touch `main`. No PRs, no force-push, no history rewrite.
- Commits only as the user's verified identity (`ali-kassab`), no AI co-author trailers; verify identity before each commit.
- Never print or commit `apps/api/.env`.
- e2e resets `tradeflow_test` only; agent `prisma migrate reset` needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`.
- Follow the Installed Skills and Reuse-First policies.
