# Session handoff — TradeFlow

_Last updated: 2026-11-22, end of session 11. Checkpoint: repository consolidated. **`main` is the only branch and the GitHub default branch**; `feat/foundation` was merged and deleted. GitHub Actions CI is green on `main` (including the full e2e suite with the database reset). Status **READY WITH KNOWN LIMITATIONS**. No feature work in progress._

## Session 11 — repository consolidation, QA and CI

The user authorised (in chat): merging into `main`, pushing, making `main` the default branch, and deleting `feat/foundation` once it was safely integrated.

- **Git:** the latest remote state was fetched (Git Bash can't reach github.com from this machine, but PowerShell `git` and `gh` can). `origin/main` was `ad846e1` (PR #3 merge, the user's), whose tree equals `8ca45f5`. Only `68d7c9d` (session 9 audit fixes) and `e784987` (session 10 handoff) were missing. Local `main` (which had no unique commits) was fast-forwarded to `ad846e1`, then `feat/foundation` was merged with `--no-ff`. The result is `4465ee1`; no conflicts, and its tree equals `e784987`. Pushed. The GitHub default branch was changed from `feat/foundation` to `main` (verified through the API). The GitHub compare showed `feat/foundation` was 0 ahead of `main` with 0 differing files, so it was deleted on GitHub and locally (`git branch -d`). `git ls-remote --heads` now lists only `main`.
- **New test:** `apps/api/test/delete-guards.e2e-spec.ts` (6 tests). Deleting a supplier with a PO, or with only an on-account payment, gets 409 `IN_USE` and the row stays. An unused supplier gets 204. A customer with an order, or a product on an order, gets 409. Deleting a category keeps its products and sets their `categoryId` to NULL. STAFF delete of customers or suppliers gets 403. This closes the unverified supplier `IN_USE` item. No bugs found.
- **CI:** new `.github/workflows/ci.yml` (see PROJECT_HANDOFF "Git / GitHub policy"). Its SQL Server service container exists only in CI; local setup remains Docker-free. Run 45023673714 on `37506ba`: both jobs succeeded. API unit 16/16, web unit 52/52, e2e 6 files / 39/39 after "Database reset successful", demo seed OK. Lint warnings in CI are the accepted pre-existing ones.
- **Local checks (actual):**
  - Typecheck and unit tests: API `tsc` OK, unit 16/16; web `tsc -b` OK, vitest 52/52.
  - Lint: API oxlint 2 warnings, web oxlint 33 warnings, 0 errors (all pre-existing).
  - Builds: `nest build` OK, `vite build` OK.
  - e2e without the reset step: 33/33 (existing suites), then delete-guards 6/6. Setting the Prisma consent variable was again refused by the agent classifier, and that was not worked around.
  - Smoke test: 26/26 on the first run. Immediate re-runs failed at login with 429 from the documented auth throttle (10/min); expected, not a bug.
- **Browser (dev stack, demo MANAGER, first time in the browser for this role):**
  - Workflow: confirmed draft SO-00012 in the UI (Arabic, desktop). Checked through the API: WATER-24 47→42, PASTA-400 400→360, SALE ledger entry −5, customer 5 balance 2,457.84→3,620.64, dashboard today 1,162.80 / 1 order, month 27,595.98→28,758.78, receivables 12,789.98→13,952.78. The customer page shows the new balance and statement row.
  - Language and theme: English LTR plus the light theme on the dashboard (theme persisted in `tf.theme`).
  - 375 px, Arabic, dark: `/`, `/sales-orders/12`, `/purchase-orders`, `/reports?tab=balances` and `/customers/5` have no horizontal scroll.
  - Errors: the console shows only the expected pre-login 401s; no API errors.
- **Dev data change:** SO-00012 (customer 5) is now CONFIRMED in the dev DB `tradeflow`.

## Session 10 — status check, push blocked (resolved in session 11)

- Local `feat/foundation` is 1 ahead / 2 behind `origin/feat/foundation`. Local-only: `68d7c9d` (session 9 audit fixes) and this handoff commit. Remote-only: the GitHub PR merge commits `8a52918` (PR #1 feat/foundation → main) and `02daf93` (PR #2 main → feat/foundation), made by the user on 2026-11-21. Their tree is identical to `8ca45f5` (`git diff 8ca45f5 origin/feat/foundation` is empty), so a merge of `origin/feat/foundation` into local has no conflicts and changes no content.
- `origin/main` is now `8a52918` (the user merged PR #1 on GitHub). The local `main` ref was not touched.
- **Blockers:** (1) `git fetch` failed, so GitHub can't be reached from this machine right now (port 443 connection timeout). (2) A push now needs `git merge origin/feat/foundation` first, and the user's rules require explicit approval for any merge. Rebase or force-push are not options.
- Checks re-run (actual results): API `tsc --noEmit` OK, unit 16/16; web `tsc -b` OK, vitest 52/52. No code changed in session 10.
- Roadmap: every phase is done; no approved feature work remains.

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. PROJECT_HANDOFF.md holds the permanent architecture, business rules, SQL Server conventions and policies (Installed Skills, Reuse-First, Git identity).

## Status

- **Backend:** MVP API complete (all endpoints in PROJECT_HANDOFF.md). Purchase-order list and detail return `paidAmount`, `outstanding` and `paymentStatus` (`1ba62fa`).
- **Frontend built and verified:** auth, dashboard, products, categories, inventory, customers, sales orders, customer payments (`02ce643`), suppliers (`50078ff`), purchase orders (`fa43352`), supplier payments (`55b21d0`), reports (`fca0404`), settings and users (`b44aabb`). Every MVP screen exists. README refreshed in Phase 7.

## Roadmap for this run (user-approved order)

1. ~~Customer payments~~ (done)
2. ~~Suppliers~~ (done)
3. ~~Purchase orders~~ (done)
4. ~~Supplier payments~~ (done)
5. ~~Reports~~ (done, session 6)
6. ~~Settings and users~~ (done, session 6)
7. ~~Finalisation~~ (done, session 6; API e2e left to the user, see below)

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

## Phase 7 — finalisation (done, session 6)

- Lint: `oxlint` across `apps/web` and `oxlint --type-aware src/ test/` in `apps/api` show only the pre-existing warnings listed under Known issues; nothing new.
- A11y fixes: dialog and sheet close buttons read `common.actions.close` ("Close" / "إغلاق") instead of hard-coded English (`components/ui/dialog.tsx`, `components/ui/sheet.tsx`, minimal edits to the shadcn files; key added to `i18n/locales/{ar,en}/common.json`). `components/ProductPicker.tsx` gets `aria-label` from its placeholder when it has no `id` (with an `id`, its `<label htmlFor>` names it). Verified in the browser (Arabic): inventory filter combobox is named "كل المنتجات", dialog close button "إغلاق".
- README: feature table, key features, status badge and Project Status reflect the finished MVP; scripts table checked against the package scripts. No screenshots added.
- API e2e: **not run** — the agent permission guard refused it again (setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). Left to the user.
- Final checks (actual): web `tsc -b` OK, vitest 51/51, oxlint no new warnings, `vite build` OK; API `tsc --noEmit` OK, vitest 11/11.

## Session 7 — verification only (no code changes)

- Started from `439e9e8`; working tree clean apart from the untracked local `.claude/`.
- Tried the API e2e suite once with the recorded consent text: **blocked** by the agent's auto-mode permission classifier (fourth session in a row). Not worked around.
- Re-ran non-DB checks (actual): API `tsc --noEmit` OK, vitest 11/11; web `tsc -b` OK, vitest 51/51.
- No roadmap work remains; no new features started (none are approved).

## Session 8 — Phase 7 finalisation review

Started from `3a37415`; tree clean apart from the untracked local `.claude/`. No new features, no architecture or API behaviour changes.

- **Review, backend:** every write route has the documented guard (class-level `@ManagerOrAbove` on suppliers and purchase orders, `@OwnerOnly` on users, per-route on catalog, inventory, customers delete/prices, payment voids and supplier payments, tenant PATCH, reports); matches the README role matrix. No changes needed.
- **Review, frontend:** all icon-only buttons and search/table inputs have accessible names; no hard-coded UI strings found outside shadcn primitives.
- **Fixes:**
  - `pages/inventory/AdjustStockDialog.tsx`: the "Adjustment" (نوع التسوية) label wasn't tied to its control → `TabsList` now `aria-labelledby` the label. The form moved into an inner `AdjustStockForm` inside `DialogContent` (same pattern as `RecordPaymentDialog`, keyed on the preset product), removing the reset `useEffect` and its `set-state-in-effect` lint warning.
  - `apps/api/test/workflows.e2e-spec.ts`: status codes sorted numerically (`require-array-sort-compare`). Same result for `[201, 400]`; typechecked, not executed (e2e not run).
- **Docs:** README status badge now reads "MVP feature-complete · e2e pending", a Verification status warning, test-suite lines and "Run the API e2e suite" under Planned. PROJECT_HANDOFF: verification status under Testing; the dialog-form convention under Reuse-First.
- **Checks (actual results):** web `tsc -b` OK, vitest 51/51, oxlint 33 warnings (was 34; all pre-existing shadcn/router/`use-mobile` ones), `vite build` OK (pre-existing >500 kB chunk notice); API `tsc --noEmit` OK, vitest 11/11, oxlint 2 warnings (was 3), `nest build` OK.
- **Browser (owner, Arabic):** `/inventory` → Adjust stock: tablist labelled "نوع التسوية"; empty save shows product and reason errors; Cancel then reopen → empty quantity, no errors; `/inventory?productId=1` → picker preset to RICE-5KG (128 → 128). Nothing submitted; no console errors.
- **Not run:** API e2e (destructive reset of `tradeflow_test`; not authorised this session).

## Session 9 — QA, full-system testing & release-readiness audit

Started from `8ca45f5` (UI redesign committed); tree clean apart from the untracked local `.claude/`. No new features. API behaviour changes are limited to input handling: requests that used to crash with 500 now get 400/404; in addition, `reorderLevel` above 10,000,000 and stock adjustments beyond ±10,000,000 (previously accepted) now get 400, adjustment notes and void reasons are stored trimmed, and `GET /reports/sales` returns `from`/`to` as local midnight (e.g. 22:00Z in Cairo) instead of UTC midnight. Committed and pushed at the end of the session with user approval.

- **E2E: 27/27 on the committed code (`8ca45f5`, before any fix)**, then **33/33** on the fixed tree with the new regression suite (re-run in the session 9 review). No run in sessions 4–9 used a freshly reset database. In the review, the regression suite run against `8ca45f5` failed 5 of 6 tests for the expected reasons (500s, `2026-02-30` accepted, today's chart bar empty); the sixth (nullable fields can still be cleared) is meant to pass on both. The agent's classifier refused setting `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, so the suites ran via a scratch Vitest config without the destructive `globalSetup` reset, on `tradeflow_test` after `prisma migrate status` showed it up to date. Isolation verified first: `global-setup` refuses DB names without "test"; `env-setup` sets `DATABASE_URL = TEST_DATABASE_URL`; `@nestjs/config` lets process.env win over `.env`.
- **Bugs fixed (regressions in `test/regressions.e2e-spec.ts` and `src/common/validation.spec.ts`):**
  1. `null` for NOT NULL fields (PATCH products/customers/suppliers/tenant/users, `unit: null` on create) → 500. New `common/validation.ts` (`IsOptionalNotNull`, `Trim`, `ParseIdPipe`); update DTOs use `PartialType(…, { skipNullProperties: false })`; nullable fields (product `categoryId`, party contact fields, `creditLimit`) still accept null.
  2. Numeric overflow (adjustment 2^31, money > DECIMAL(14,2), qty × price) → 500. `@Max(MAX_MONEY)` on money inputs, ±10,000,000 on adjustments, `reorderLevel` ≤ 10,000,000; filter maps Prisma P2020 → 400 `VALIDATION_ERROR`.
  3. Route ids > 2^63 → 500. `ParseIdPipe` on all 29 id params (non-numeric → 400 as before, out of INT range → 404).
  4. Reports/dashboard timezone: `from`/`to` were parsed as UTC midnight and the daily series grouped by UTC date, so orders confirmed 00:00–02:00 Cairo time fell on the wrong day or out of range. `parseDay` + JS bucketing by `localDayKey` in `reports.module.ts`.
  5. Mobile nav sheet stayed open after choosing a page (pre-dates the redesign). `NavItem` closes it on mobile (`layout/AppLayout.tsx`). Browser-verified only (web tests have no DOM environment).
  - Also: strict ISO dates (`2026-02-30` was accepted as Mar 2), whitespace-only adjustment notes / void reasons rejected.
- **Checks (actual):** API tsc OK, unit 16/16, oxlint 2 warnings (pre-existing), `nest build` OK; web tsc OK, vitest 52/52, oxlint 33 warnings (pre-existing), `vite build` OK; smoke 26/26 via the web proxy.
- **Browser (fresh stack on ports 3001/5174 against `tradeflow_test`, seeded with `prisma db seed`):** all 22 routes + detail pages and not-found states opened as owner in Arabic on desktop, and again at 375 px in Arabic dark (no horizontal scroll on any route); staff nav and restricted pages in Arabic; English spot-checked on login, products (create dialog), dashboard and sales-order detail; light theme on dashboard and sales-order detail; theme (`tf.theme`) and language (`tf.lang`) persist across reloads; manager role not exercised in the browser (API smoke test and e2e only); product created through the UI; workflow edit → adjust → SO → confirm → partial payment → PO receive verified in UI, API and dashboard (deltas exact, statement = balance); logout revokes the refresh token; no console errors beyond intentional 401/404 probes; no API server errors.
- **Probed and fine:** tampered / `alg:none` JWT → 401; CORS rejects unknown origins; helmet headers; SQL-injection strings harmless; staff never receives cost fields; cross-role writes → 403.
- Test DB now also contains the seeded demo business and QA records (product QA-BISC-1, SO-00013, PO-00003). Dev DB `tradeflow` untouched.
- **Independent review (2026-11-22):** read every hunk; only cleanup was two stray blank lines in import blocks (`parties.module.ts`, `payments.module.ts`). Re-run on the final tree: API tsc OK, unit 16/16, `nest build` OK, oxlint 2 warnings; e2e 33/33 (verbose, reset skipped); web tsc OK, vitest 52/52, oxlint 33 warnings / 0 errors, `vite build` OK. The smoke test (26/26) ran once earlier in session 9 against the fixed API build and was not re-run in the review. Docs corrected where they overstated browser coverage and the scope of API changes. Before the commit, typechecks and unit tests were run once more (16/16, 52/52).
- Files: new `apps/api/src/common/validation.ts`, `validation.spec.ts`, `apps/api/test/regressions.e2e-spec.ts`; modified `common/http-exception.filter.ts`, `modules/{catalog/catalog.dto.ts,catalog/catalog.module.ts,inventory/inventory.module.ts,parties/parties.module.ts,payments/payments.module.ts,purchase-orders/purchase-orders.module.ts,reports/reports.module.ts,sales-orders/sales-orders.module.ts,tenant/tenant.ts,users/users.ts}`, `apps/web/src/layout/AppLayout.tsx`, README, PROJECT_HANDOFF (validation helpers and report-day rule recorded as permanent conventions), this file.

## How to run (dev)

- `.claude/launch.json` (local, untracked) has `api` (`node dist/main.js` in `apps/api`, port 3000) and `web` (`npx vite`, port 5173). Rebuild the API with `npm run build -w @tradeflow/api` after API changes.
- Web: `npx tsc -b`, `npx vitest run`, `npx oxlint` in `apps/web`. API: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx oxlint --type-aware src/ test/` in `apps/api`.

## Known issues / notes

- **Verified in session 11:** the e2e reset step (in CI) and the supplier `IN_USE` refusal (new e2e suite). Still agent-blocked locally: running the reset step on this machine (the classifier refuses the Prisma consent variable).
- **Not exercised in the browser:** every write flow under every role. Session 11 covered the manager SO confirm; earlier sessions covered the others per phase. CI e2e covers the API side.
- **Known limitations (session 9, not fixed):** login page always shows the demo credentials; no per-business timezone (server local day); search treats `%`/`_` as LIKE wildcards; inactive customers can still be used on orders via the API (UI pickers hide them); access tokens stay valid up to 15 min after a password change (deactivation is immediate). Test caveat: the local-midnight regression test only detects the report-day bug when the machine's timezone is not UTC (it does here, Egypt Standard Time).
- Session 6 decisions: report tabs live in `?tab=`; balances are summed in exact BigInt cents (`splitBalances`); single-column grids holding scrollable tables use `grid-cols-[minmax(0,1fr)]`; `reloadSession()` on the auth context refreshes tenant/user after settings changes; temporary passwords come from `generatePassword` (crypto, unambiguous alphabet); a password change signs the user out because the API revokes every session. No new dependencies.
- Session 6 commits: `fca0404` (reports), `b44aabb` (settings, users, password change), finalisation commit (a11y labels, README, this handoff).
- The session-5 stash ("WIP phase 5 reports") was dropped after the Phase 5 commit was pushed; its content is all in that commit.
- The browser pane was last used on the session 9 QA stack (port 5174, now stopped), signed in as demo STAFF; the QA launch entries were removed from `.claude/launch.json`.
- Dev-only: when several auth files change at once, Vite HMR can reload the page twice while a refresh is in flight; the second load replays the rotated refresh token, the API revokes the family (by design) and you land on `/login`. Not reproducible on normal navigation (refresh calls are deduplicated in `lib/api.ts`).
- Demo data now includes two voided test payments on customer 2 (Phase 1), PO-00003 received and PO-00004 cancelled (Phase 3), one voided 500.00 supplier payment on PO-00003 (Phase 4). The test supplier created in Phase 2 was deleted.

- Payable-order list fetches up to 100 orders per billed status per party (API page cap: customers CONFIRMED + DELIVERED, suppliers RECEIVED); older unpaid orders beyond that wouldn't be offered (payment can still go on account).
- oxlint remaining warnings (accepted): web — shadcn `only-export-components` (badge, button, tabs, sidebar), `router.tsx` lazy-page consts, shadcn `hooks/use-mobile.ts` (`set-state-in-effect`); API — 2× `no-misused-spread` in `parties.module.ts` (spreading validated DTOs into Prisma `data`; harmless).
- `vite build` warns that the main chunk exceeds 500 kB (pre-existing; pages are already lazy-loaded).
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

1. Nothing is pending. Check that the latest CI run on `main` is green (`gh run list --limit 3`).
2. (User decision, before real-world use) The known limitations: hide the demo-credentials hint outside demo deployments, a per-business timezone, escaping `%`/`_` in search. Don't start them without approval.
3. Optional, only if the user asks: README screenshots, a `LICENSE` file (package.json says MIT), branch protection requiring CI on `main`. The roadmap has no further feature work; don't invent any.

## Constraints to keep

- SQL Server only; no Docker in the local setup (the CI SQL Server service container is the one exception). Follow "SQL Server adaptations" in PROJECT_HANDOFF.md.
- `main` is the single authoritative and default branch; `feat/foundation` no longer exists. PRs and merges only when the user asks; no force-push, no history rewrite. Keep CI green.
- In this environment Git Bash can't reach github.com; use PowerShell `git` for fetch and push (`gh` works from both).
- Commits only as the user's verified identity (`ali-kassab`), no AI co-author trailers; verify identity before each commit.
- Never print or commit `apps/api/.env`.
- e2e resets `tradeflow_test` only; agent `prisma migrate reset` needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`.
- Follow the Installed Skills and Reuse-First policies.
