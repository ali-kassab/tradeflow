# Session handoff — TradeFlow

_Last updated: 2026-11-20, session 2 (continued)._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. Read PROJECT_HANDOFF.md for the permanent architecture, business rules, SQL Server conventions and policies.

## Checkpoint

**MySQL → Microsoft SQL Server migration: done and verified against a real database.** The full backend now runs end to end for the first time: migrate, seed, e2e tests, the live API, and the web UI in a browser.

## Completed in this session

1. **Web foundation:** theme, i18n, auth flow, layout, dashboard. Commit `2b7708f`.
2. **Git:** with the user's approval, `main` was fast-forwarded to `feat/foundation` and pushed. **All work now goes to `main`.** `feat/foundation` stays as it was.
3. **MySQL removed and SQL Server adopted:**

| Change | Files |
|---|---|
| Provider `sqlserver`. `@prisma/adapter-mariadb` replaced by `@prisma/adapter-mssql@7.10.1`, which uses the same connection string as the CLI. | `prisma/schema.prisma`, `src/prisma/prisma.service.ts`, `package.json`, root `package-lock.json`, `prisma.config.ts` |
| NVARCHAR text, `NoAction` delete/update rules, enums become NVARCHAR + CHECK, Json becomes NVARCHAR(MAX) + ISJSON | `schema.prisma`, `src/common/enums.ts` (new), all enum imports moved there |
| Init migration regenerated for SQL Server. It had never been applied to any database. Hand-written CHECKs: the original seven plus enum and JSON checks. Lock provider `mssql`. | `prisma/migrations/20261120000000_init/migration.sql`, `migration_lock.toml` |
| T-SQL raw queries: `UPDLOCK` row locks, document-number upsert, `TOP`, `CAST AS date`, `isActive = 1` | `src/common/tx.ts`, `reports`, `sales-orders`, `purchase-orders`, `payments` modules |
| JSON text activity metadata (`logActivity` / `parseMetadata`). Customer prices are de-duplicated in code instead of `skipDuplicates`. | `src/common/tx.ts`, `reports.module.ts`, `parties.module.ts` |
| Test DB guard parses `database=` from the connection string | `test/global-setup.ts`, `databaseName()` in `prisma.service.ts` |
| `.env.example` updated for SQL Server. Docs updated. | `apps/api/.env.example`, both handoff files |

4. **Bugs found by the first real runs, all fixed:**
   - Nested `items.create` passed `tenantId`, which Prisma rejects. Purchase-order and sales-order create and update were affected.
   - Env validation rejected `PORT` and `REFRESH_TOKEN_TTL_DAYS`. Fixed with `@Type(() => Number)` on the un-annotated fields.
   - Vitest's oxc transform didn't emit decorator metadata, which breaks Nest DI and class-transformer. Fixed in both `vitest.config*.ts`.
   - Test bugs: auth tests used names shorter than the DTO minimum, and a tenancy assertion compared ids across different tables.
5. **Web fixes found in the browser:**
   - Added a route `errorElement` (`src/components/RouteError.tsx`). It reloads once on a stale-chunk error and otherwise shows a translated, recoverable message.
   - Added the full set of Arabic plural forms for the order count (zero/one/two/few/many/other), with a test.
   - Changed the daily-sales chart from an area to bars.
6. **Local SQL Server setup** was done through Windows authentication (the user is sysadmin):
   - Created login `tradeflow` with a generated password, which exists only in the gitignored `apps/api/.env` and was never printed.
   - Created databases `tradeflow`, `tradeflow_test` and `tradeflow_shadow`, with `tradeflow` as `db_owner` of each.
   - The existing `springMVC` and `PaymentSystemDb` databases were not touched.
   - The MYSQL80 Windows service was stopped, with the user's approval through UAC.

### Verification (actual results)

| Check | Result |
|---|---|
| `prisma validate`, `migrate deploy` (dev and test DBs) | OK |
| `prisma db seed` (dev) | OK: 3 users, 11 products, 5 customers, 12 sales orders, 2 purchase orders, 9 payments, 37 stock movements, 31 activity rows. Arabic stored as Unicode (first codepoint 1571 = أ). Minimum stock 0. |
| API unit tests | **11/11** (money maths, plus enum CHECK ↔ `enums.ts` consistency) |
| API e2e (SQL Server, `tradeflow_test`) | **27/27**: auth, workflows and financial consistency incl. concurrent overselling, tenant isolation incl. DB-level FK and CHECK, RBAC |
| API `tsc --noEmit`, `nest build` | OK |
| API `oxlint` | 0 errors, 3 warnings in code this session didn't touch (`parties.module.ts` spread of a class instance, a sort without a comparator in `workflows.e2e-spec.ts`) |
| Live smoke `node apps/api/scripts/smoke.mjs` (built API + Vite proxy) | **26/26**: login, me, dashboard, products and all four reports for owner, manager and staff, including STAFF cost hiding and 403s; statements; activity metadata parsed |
| Web unit tests, `tsc -b` | **14/14**, OK |
| Browser (built-in pane) | Login → dashboard with real data. Arabic RTL with the sidebar on the right; English LTR with the sidebar on the left, choice saved; 375 px mobile has one column and no horizontal overflow. Screenshots were partly unreliable because the pane was hidden, so the layout was confirmed through DOM measurements. |

## Current state

- The backend MVP (every module in PROJECT_HANDOFF.md) runs on SQL Server and is covered by e2e tests.
- **Frontend:** login, register, dashboard, **products** (`/products`: search, category/status/low-stock filters, pagination, create/edit dialog, delete with confirmation; cost column and all write controls hidden for STAFF) and **categories** (`/categories`: list with product counts, add/rename/delete) are built. Shared building blocks: `PageHeader`, `PaginationBar`, `ConfirmDialog`, `lib/notify.ts` (`toastError`), `lib/queries.ts`, `lib/types.ts`, `lib/use-debounced.ts`. The other modules have no UI yet.
- Products/categories were verified in the browser against the live SQL Server API:
  - validation messages and duplicate-SKU errors (case-insensitive);
  - create → toast → list refresh, with opening stock recorded;
  - edit with pre-filled values, and deactivation;
  - search;
  - deleting a product that is in orders is refused (IN_USE toast);
  - category add, duplicate-name error, and delete;
  - the STAFF view (no costs, no write controls).
  The browser pane was hidden, so the forms were driven through DOM events rather than mouse clicks.
- A product that was never on an order can be deleted together with its stock movements (`CatalogService.deleteProduct`); the confirmation text says so.
- Processes left running: the built API (`node apps/api/dist/main.js`, started from a background task) and Vite in the Terminal tab "web dev server". Stop both when done.

## Exact next steps

1. Build the remaining frontend feature pages, in this order:
   - inventory (movements, adjustments);
   - customers (CRUD, customer prices, the ledger-style statement as the signature UI);
   - sales orders (draft editor, price resolution, confirm/deliver/cancel);
   - payments (record, void);
   - suppliers and purchase orders (order/receive/cancel);
   - reports (sales, inventory, balances, activity);
   - settings (tenant) and users (owner only).

   For each page: add a locale namespace in `src/i18n/resources.ts` and both locale folders, add a `NAV` entry in `AppLayout.tsx` filtered by role, and verify it in the browser against the live API.
2. After each page: web tests and `tsc -b`, then the API e2e suite if API code changed. Commit and push to `main`.

## Constraints to keep

- SQL Server only; no Docker. Follow the "SQL Server adaptations" list in PROJECT_HANDOFF.md.
- Never print or commit `apps/api/.env`. Only the user's git identity, with no AI trailers. Push to `main`, never force-push.
- `prisma migrate reset` by an agent needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`, and only for those two databases.
- Don't change the PowerShell execution policy; use `npx.cmd`.
- Keep the Installed Skills and Reuse-First policy requirements from the user's instructions. PROJECT_HANDOFF.md doesn't contain those sections yet.
