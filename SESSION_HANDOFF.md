# Session handoff — TradeFlow

_Last updated: 2026-11-20, end of session 3 (safe shutdown after the sales orders checkpoint)._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. Read PROJECT_HANDOFF.md for the permanent architecture, business rules, SQL Server conventions and policies (including Installed Skills and Reuse-First).

## Checkpoint

**Backend MVP complete on Microsoft SQL Server and verified. Frontend:**

- **Built and verified:** auth, dashboard, products, categories, inventory, customers (list, detail, statement, special prices), **sales orders** (list, draft editor, detail with confirm/deliver/cancel).
- **Not built yet:** payments, suppliers, purchase orders, reports, settings, users.

No partially built feature is left.

## Branch state (important)

- Work is on **`feat/foundation`**, pushed to `origin/feat/foundation`. `main` (local `a2454af`, `origin/main` `2fda48b`) was **not touched** this session.
- Reason: PROJECT_HANDOFF's session-2 decision said "commit to `main`", but the user's standing instructions say never to modify `main`. The feature branch is the safe reading; `main` can be fast-forwarded later. **The user still has to say which branch is authoritative.**

## Completed this session

### Checkpoint 1 — customers (`c7de966`, pushed)

| Area | Files |
|---|---|
| List `/customers`: search, status filter, balance with over-limit badge, add/edit (all roles), delete (manager+, `IN_USE` handled), new customer opens its detail page | `apps/web/src/pages/customers/CustomersPage.tsx` |
| Form dialog: zod schema mirroring `CreateCustomerDto`; empty optional fields sent as `null` so edits can clear them | `pages/customers/CustomerFormDialog.tsx` |
| Detail `/customers/:id`: contact line, billed − paid = balance summary (owes / in credit / settled, credit-limit warning), tabs | `pages/customers/CustomerDetailPage.tsx` |
| Special prices: read-only for STAFF; manager edit mode with `ProductPicker`, per-row validation, % difference vs standard price, `PUT` replaces the list | `pages/customers/CustomerPrices.tsx` |
| Helpers + tests: `isOverLimit`, `priceDifference`; `formatPercent` | `pages/customers/credit.ts`, `credit.spec.ts`, `lib/format.ts`, `lib/format.spec.ts` |
| **Shared ledger statement** (signature UI): debit/credit/running balance, blank zero cells, double-ruled closing balance; reusable for suppliers | `apps/web/src/components/LedgerStatement.tsx` |
| **Global RTL fix:** Radix `Direction.Provider` at the root (`AppDirection`). Before this, every Radix primitive (Tabs, Select, menus) stamped `dir="ltr"` inside the Arabic UI; this also affected the inventory adjustment tabs | `components/AppDirection.tsx`, `main.tsx` |
| Types, i18n (`customers` namespace; generic statement labels in `common.statement`), nav entry, routes | `lib/types.ts`, `i18n/resources.ts`, `i18n/locales/{ar,en}/{customers,common}.json`, `layout/AppLayout.tsx`, `router.tsx` |
| Docs | PROJECT_HANDOFF.md: `AppDirection` + logical `divide-x` conventions, `LedgerStatement` location, branch-policy conflict, Installed Skills and Reuse-First sections |

### Checkpoint 2 — sales orders (commit after `c7de966`, pushed; see git log)

| Area | Files |
|---|---|
| List `/sales-orders`: status filter, search, `?customerId=` filter chip, payment status with labelled outstanding amount | `apps/web/src/pages/sales-orders/SalesOrdersPage.tsx` |
| Draft editor `/sales-orders/new[?customerId=]` and `/:id/edit`: `CustomerPicker`, `ProductPicker` lines, price source per line (customer / standard / override), manager-only override with reset, discount, VAT %, live totals, stock and credit-limit warnings (warnings only). A loader fetches the draft, its products and customer prices first, then mounts the editor with complete initial state (no sync effects). Non-drafts redirect to the detail page | `SalesOrderEditorPage.tsx` |
| Detail `/sales-orders/:id`: lines (unit cost column for managers after confirm), totals, paid/outstanding, payments list, history; Confirm / Mark delivered / Cancel with role rules mirrored from the API; `INSUFFICIENT_STOCK` names the product and quantities; `INVALID_STATUS` refetches | `SalesOrderDetailPage.tsx`, `badges.tsx` |
| Totals mirror of `computeOrderTotals` (BigInt cents, half-up) + 5 tests | `lib/order-math.ts`, `lib/order-math.spec.ts` |
| Shared: `CustomerPicker` (like `ProductPicker`), `errorDetails()` in `lib/api.ts`, optional `cancelLabel` on `ConfirmDialog`, optional `referenceHref` on `LedgerStatement` | `components/*`, `lib/api.ts` |
| Customer page: statement order references link to orders; "Orders" and "New order" buttons | `pages/customers/CustomerDetailPage.tsx` |
| i18n `salesOrders` namespace; picker labels in `common`; nav entry; 4 routes | `i18n/*`, `layout/AppLayout.tsx`, `router.tsx` |

Skills read and followed: `frontend-design` (boldness kept to the ledger; everything else quiet, existing tokens) and `vercel-react-best-practices` (derived state in render, functional `setState`, ternary conditionals, hoisted constants, parallel queries on the detail page).

## Verification (actual results)

| Check | Result |
|---|---|
| Web `tsc -b` | OK |
| Web `vitest` | **26/26** (16 at session start; +credit helpers, +percent format, +order-math, +locale parity for new namespaces) |
| Web `oxlint` | 0 errors; no warnings in new or changed files (existing warnings: shadcn `only-export-components`, `router.tsx`, `use-mobile.ts`, `AdjustStockDialog.tsx`) |
| Web production build | OK (sales-order chunks 4.7 / 10.8 / 19.1 kB) |
| Live smoke `node apps/api/scripts/smoke.mjs http://localhost:3000/api` | all checks passed (API code unchanged) |
| Browser, customers (manager) | List balances match the dashboard receivable; statement for customer 3 replays to −500.00 = billed − paid; create (email validation), edit clearing phone + credit limit, delete refused with `IN_USE` and translated, delete of the test customer; price edit: invalid amount blocked, −10% shown, `PUT` 200 |
| Browser (staff) | Customers: add/edit shown, no delete, prices read-only. Sales orders: draft SO-00012 shows Edit/Cancel/Confirm; editor prices read-only, preview equals server total 1,162.80 |
| Browser, sales orders (manager) | New order from the customer page (preset customer, 14% VAT, today); preview 775.20 = saved SO-00013 to the cent; override recognised on reopening; confirm: stock rice 118→115, oil 30→28, balance 2,309.20→3,084.40, statement links to SO-00013; zero-stock draft SO-00014: specific `INSUFFICIENT_STOCK` toast, stays Draft, then cancelled ("Keep order" / "Cancel order" dialog); cancel of confirmed SO-00013 restocked to 118/30 and returned the balance to 2,309.20 |
| Mobile 375 px, Arabic | No page-level horizontal scroll on list, detail, editor; editor line table scrolls inside its frame |
| Customers ar/en, 375 px | Radix `dir` follows the language live; no page-level horizontal scroll at 375 px (ledger scrolls inside its frame) |

The browser pane was mostly hidden, so most checks were DOM measurements; three screenshots (customer detail desktop RTL, customer detail mobile EN, order editor mobile AR) were reviewed. A **SO-00013 / SO-00014** detail page in Arabic on desktop was not visually reviewed.

## Known issues / notes

- **Branch question** above is still open.
- Demo data: the test customer was deleted and customer 3's test price reset, so customers are back to the seeded five. Two **cancelled** test orders now exist (SO-00013, SO-00014; orders are never deleted); stock and balances were verified back to their previous values. Earlier edits from session 2 (HONEY-500 created/deleted; oil adjustment −3) remain.
- Statement order references now link to orders; payment references and inventory movements still don't link (add with the payments page).
- No "record payment" button on orders yet; it belongs to the payments release.
- The add-product picker's accessible name comes from an sr-only label in the editor; `ProductPicker` itself (pre-existing, also used in inventory) has no built-in name for a combobox trigger.
- The shadcn dialog close button's screen-reader label is the hard-coded English "Close" (pre-existing in `components/ui/dialog.tsx`); worth translating in a later pass.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

1. Build **payments** (customer side first): list (`GET /payments/customer`), record dialog (customer, optional billed order with its outstanding amount, method, date, reference; `AMOUNT_EXCEEDS_OUTSTANDING` handled), void with reason (manager+, `ALREADY_VOIDED`), and a "Record payment" entry point on the order detail and customer pages. Read `apps/api/src/modules/payments/payments.module.ts` for the DTOs first.
2. Then suppliers (reuse `LedgerStatement`), purchase orders (+ supplier payments), reports, settings, users.

For each page: add a locale namespace in `src/i18n/resources.ts` and both locale folders, add a `NAV` entry in `AppLayout.tsx` (filtered by role where needed), then verify against the live API. Start the API with `npm run build -w @tradeflow/api` and `node apps/api/dist/main.js`; the web app via the `web` entry in `.claude/launch.json` (`npx vite` in `apps/web`).

## Constraints to keep

- SQL Server only; no Docker. Follow the "SQL Server adaptations" list in PROJECT_HANDOFF.md.
- Never print or commit `apps/api/.env`. Only the user's git identity, with no AI trailers. Never force-push or rewrite history. Don't modify `main` until the user says so.
- `prisma migrate reset` by an agent needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`, and only for those two databases.
- Follow the Installed Skills and Reuse-First policies in PROJECT_HANDOFF.md.
