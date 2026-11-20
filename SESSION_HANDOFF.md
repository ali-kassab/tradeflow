# Session handoff — TradeFlow

_Last updated: 2026-11-20, end of session 2 (safe shutdown)._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. Read PROJECT_HANDOFF.md for the permanent architecture, business rules, SQL Server conventions and policies.

## Checkpoint

**Backend MVP complete on Microsoft SQL Server and verified. Frontend:**

- **Built and verified:** auth, dashboard, products, categories, inventory.
- **Not built yet:** customers, sales orders, payments, suppliers, purchase orders, reports, settings, users.

No partially built feature is left: each page that exists is complete and was checked in the browser against the live API.

## Completed this session (commits on `main`)

| Commit | Content |
|---|---|
| `2b7708f` | Web foundation: theme tokens, IBM Plex Sans Arabic, react-i18next with ar default and runtime `dir`, axios client with in-memory token and single-flight refresh, auth pages, sidebar layout, dashboard |
| `e3c6927` | **MySQL replaced by SQL Server** (`@prisma/adapter-mssql`): NVARCHAR text, `NoAction` delete/update rules, enums as NVARCHAR + CHECK (`src/common/enums.ts`), JSON metadata as NVARCHAR + ISJSON, T-SQL raw queries, regenerated init migration. Fixes to pre-existing bugs found by the first real runs (nested `tenantId`, env numeric coercion, Vitest decorator metadata, two wrong e2e assertions). Web route error element, full Arabic plurals, bar chart. |
| `2fda48b` | Products and categories pages, plus shared UI: `PageHeader`, `PaginationBar`, `ConfirmDialog`, `lib/notify.ts`, `lib/queries.ts`, `lib/types.ts`, `lib/use-debounced.ts` |
| _(this checkpoint)_ | **Inventory page** (`/inventory`): movement history filtered by product (`?productId=`) and type, with pagination, and a manager-only adjustment dialog (add/remove, live balance preview, reason required, INSUFFICIENT_STOCK handled). Shared `ProductPicker` (server-side search, Command + Popover). A "stock history" link on every product row. |

Environment work:
- SQL Server login `tradeflow` created, with a generated password that exists only in the gitignored `apps/api/.env`.
- Databases `tradeflow`, `tradeflow_test` and `tradeflow_shadow` created; the login is `db_owner` of each.
- `main` fast-forwarded from `feat/foundation` with the user's approval.
- The MYSQL80 service was stopped.

## Verification (actual results)

| Check | Result |
|---|---|
| API unit tests | 11/11 (at `e3c6927`; the API hasn't changed since) |
| API e2e on SQL Server | **27/27** (at `e3c6927`) |
| Live smoke `node apps/api/scripts/smoke.mjs` | **26/26** (at `e3c6927`) |
| Seed on SQL Server | OK, Arabic stored as Unicode |
| Web `tsc -b`, `vitest`, production build (this checkpoint) | OK, **16/16**, OK |
| Web `oxlint` | 0 errors. The warnings are `only-export-components` in the generated shadcn files and `router.tsx`. |
| Browser, against the live API | **Dashboard:** ar/en, RTL/LTR, mobile 375 px, STAFF view. **Products:** create/edit/validation/duplicate SKU/search/IN_USE delete. **Categories:** add/duplicate/delete. **Inventory:** history link, filters, adjustment including the negative guard and preview. The pane was hidden, so the forms were driven through DOM events and the layout was checked by measurement, not by eye. |

## Known issues / notes

- **Branch conflict to resolve:** in this session the user chose to commit to `main` (recorded in PROJECT_HANDOFF.md). The shutdown instruction said to push to the feature branch and never to `main`. This checkpoint is therefore committed locally on `main` and pushed **only** to `origin/feat/foundation` as a fast-forward. `origin/main` stays at `2fda48b`. **The user must confirm which branch is authoritative going forward.**
- The demo dev database contains test edits made during browser checks: product HONEY-500 was created and deleted, and an oil adjustment of −3 ("تلف أثناء النقل") was recorded. Re-seeding requires `prisma migrate reset` with the consent variable described in PROJECT_HANDOFF.md.
- Inventory movements show the reference type but don't link to orders yet; add links once the order pages exist.
- The browser pane was hidden all session, so a visual pass by eye is still worthwhile.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high, from the dev-only Prisma CLI dependency `effect`. This is an accepted risk.

## Exact next step

1. Resolve the branch question above. If `main` is confirmed, run `git push origin main` (a fast-forward from `2fda48b`).
2. Build the **customers** page: CRUD, customer-specific prices (`GET/PUT /customers/:id/prices`, using `ProductPicker`), and the ledger-style statement (`/customers/:id/statement`), which is the signature UI with debit, credit and running balance in tabular numerals.
3. Then: sales orders (draft editor and confirm/deliver/cancel), payments (record and void), suppliers and purchase orders, reports, settings and users.

For each page: add a locale namespace in `src/i18n/resources.ts` and both locale folders, add a `NAV` entry in `AppLayout.tsx` filtered by role, then verify against the live API. Start the API with `npm run build -w @tradeflow/api` and `node apps/api/dist/main.js`, and the web app with `npx vite` in `apps/web`.

## Constraints to keep

- SQL Server only; no Docker. Follow the "SQL Server adaptations" list in PROJECT_HANDOFF.md.
- Never print or commit `apps/api/.env`. Only the user's git identity, with no AI trailers. Never force-push or rewrite history.
- `prisma migrate reset` by an agent needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`, and only for those two databases.
- Keep the Installed Skills and Reuse-First policy requirements from the user's instructions. PROJECT_HANDOFF.md doesn't contain those sections yet.
