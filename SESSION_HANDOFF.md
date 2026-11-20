# Session handoff — TradeFlow

_Last updated: 2026-11-20, session 3 (customers checkpoint)._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. Read PROJECT_HANDOFF.md for the permanent architecture, business rules, SQL Server conventions and policies (including Installed Skills and Reuse-First).

## Checkpoint

**Backend MVP complete on Microsoft SQL Server and verified. Frontend:**

- **Built and verified:** auth, dashboard, products, categories, inventory, **customers** (list, detail, statement, special prices).
- **Not built yet:** sales orders, payments, suppliers, purchase orders, reports, settings, users.

No partially built feature is left.

## Branch state (important)

- Work is on **`feat/foundation`**, pushed to `origin/feat/foundation`. `main` (local `a2454af`, `origin/main` `2fda48b`) was **not touched** this session.
- Reason: PROJECT_HANDOFF's session-2 decision said "commit to `main`", but the user's standing instructions say never to modify `main`. The feature branch is the safe reading; `main` can be fast-forwarded later. **The user still has to say which branch is authoritative.**

## Completed this session

Customers frontend (one commit on `feat/foundation`, on top of `a2454af`):

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

Skills read and followed: `frontend-design` (boldness kept to the ledger; everything else quiet, existing tokens) and `vercel-react-best-practices` (derived state in render, functional `setState`, ternary conditionals, hoisted constants, parallel queries on the detail page).

## Verification (actual results)

| Check | Result |
|---|---|
| Web `tsc -b` | OK |
| Web `vitest` | **20/20** (was 16; +credit helpers, +percent format) |
| Web `oxlint` | 0 errors; no warnings in new or changed files (existing warnings: shadcn `only-export-components`, `router.tsx`, `use-mobile.ts`, `AdjustStockDialog.tsx`) |
| Web production build | OK (`CustomersPage` 5.1 kB, `CustomerDetailPage` 13.6 kB) |
| Live smoke `node apps/api/scripts/smoke.mjs http://localhost:3000/api` | all checks passed (API code unchanged) |
| Browser vs live API (manager) | List balances match the dashboard receivable; statement for customer 3 replays to −500.00 = billed − paid; create (email validation), edit clearing phone + credit limit, delete refused with `IN_USE` and translated, delete of the test customer; price edit: invalid amount blocked, −10% shown, `PUT` 200 |
| Browser (staff) | Add/edit shown, no delete, prices read-only with explanation |
| ar/en, RTL/LTR, 375 px | Radix `dir` follows the language live; no page-level horizontal scroll at 375 px (ledger scrolls inside its frame) |

The browser pane was mostly hidden, so most checks were DOM measurements; two screenshots (desktop RTL, mobile EN) were reviewed.

## Known issues / notes

- **Branch question** above is still open.
- Demo data: the test customer was deleted and customer 3's test price was reset to an empty list via the API, so customers are back to the seeded five. Earlier edits from session 2 (HONEY-500 created/deleted; oil adjustment −3) remain.
- Statement references (`SO-…`, payment `#id`) are plain text; link them once the sales-order and payment pages exist. Same for inventory movements.
- The shadcn dialog close button's screen-reader label is the hard-coded English "Close" (pre-existing in `components/ui/dialog.tsx`); worth translating in a later pass.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

1. Build the **sales orders** pages: list (status filter, per-tenant numbers), draft editor (customer picker, line items with `ProductPicker`, price resolution shown, manager-only price override, discount, VAT from tenant default), and the confirm/deliver/cancel actions with `INSUFFICIENT_STOCK`/`INVALID_STATUS` handling. A `CustomerPicker` modelled on `ProductPicker` will be needed.
2. Then payments (record against a customer/order, void), suppliers (reuse `LedgerStatement`), purchase orders, reports, settings, users.

For each page: add a locale namespace in `src/i18n/resources.ts` and both locale folders, add a `NAV` entry in `AppLayout.tsx` (filtered by role where needed), then verify against the live API. Start the API with `npm run build -w @tradeflow/api` and `node apps/api/dist/main.js`; the web app via the `web` entry in `.claude/launch.json` (`npx vite` in `apps/web`).

## Constraints to keep

- SQL Server only; no Docker. Follow the "SQL Server adaptations" list in PROJECT_HANDOFF.md.
- Never print or commit `apps/api/.env`. Only the user's git identity, with no AI trailers. Never force-push or rewrite history. Don't modify `main` until the user says so.
- `prisma migrate reset` by an agent needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`, and only for those two databases.
- Follow the Installed Skills and Reuse-First policies in PROJECT_HANDOFF.md.
