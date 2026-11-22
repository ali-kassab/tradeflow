# TradeFlow — project handoff

**TradeFlow — A Bilingual B2B Wholesale Management Platform.** Working name; trademark/domain availability not verified.

Portfolio project (CV/GitHub), not a commercial launch. Built independently: no code, assets or data from any previous employer/company repository.

## Product

Wholesalers manage products, stock, retailer customers, suppliers, sales and purchase orders, payments and balances, in **Arabic (default, RTL) or English (LTR)**.

### MVP scope

- Self-service sign-up: each registration creates a separate business (tenant) and its OWNER.
- Users and roles (OWNER / MANAGER / STAFF), business settings (name, currency, default VAT %).
- Categories and products (SKU, unit, cost, wholesale price, reorder level, opening stock).
- Inventory: stock ledger (OPENING, SALE, SALE_CANCEL, PURCHASE_RECEIPT, ADJUSTMENT), low-stock list, manual adjustments with a reason.
- Customers (credit limit as a warning only, customer-specific prices) and suppliers.
- Sales orders: DRAFT → CONFIRMED → DELIVERED, or CANCELLED. Per-tenant numbers (SO-00001).
- Purchase orders: DRAFT → ORDERED → RECEIVED, or CANCELLED (PO-00001).
- Customer and supplier payments: recorded internally, voidable, **never deleted**.
- Customer/supplier statements, dashboard, reports (sales, inventory value, balances, activity).

**Out of scope:** any external integration (payments, email, SMS, WhatsApp, AI, marketplaces, OAuth providers, accounting), Docker (for now), Redis, microservices, returns/credit notes, partial deliveries, multiple warehouses, product images.

## Business rules (authoritative)

- **Stock is deducted on CONFIRM** (atomic conditional update; never negative, plus a DB CHECK). Cancelling a CONFIRMED order restocks. DELIVERED orders cannot be cancelled.
- Quantities are whole numbers. Money is `DECIMAL(14,2)`, computed with Prisma Decimal, rounded half-up.
- Order totals: subtotal = Σ qty × unitPrice; tax = (subtotal − discount) × rate%; total = subtotal − discount + tax. The discount is a fixed amount ≤ subtotal.
  - The web editor previews totals with `apps/web/src/lib/order-math.ts` (BigInt cents, half-up), an exact mirror of `computeOrderTotals` in `apps/api/src/common/money.ts`. Change both together; the server stays authoritative.
- Price resolution: manager override → customer price → product sale price. STAFF cannot override prices.
- **Customer balance** = Σ total of CONFIRMED + DELIVERED orders − Σ non-voided customer payments.
  - A cancelled order leaves the balance, but its payments stay, so they become **customer credit** (negative balance).
- **Supplier balance** = Σ total of RECEIVED POs − Σ non-voided supplier payments.
- A payment linked to an order must belong to the same party, target a billed order (SO CONFIRMED/DELIVERED; PO RECEIVED), and not exceed that order's outstanding amount (row-locked).
- Receiving a PO sets each product's cost price to the latest unit cost. The cost is snapshotted on sales lines at confirm, for gross profit.
- Statements replay events (ORDER_CONFIRMED, ORDER_CANCELLED, PURCHASE_RECEIVED, PAYMENT, PAYMENT_VOIDED) with a running balance that equals the balance formula.

## Roles

| | OWNER | MANAGER | STAFF |
|---|---|---|---|
| Users, business settings | ✅ | ❌ | ❌ |
| Products/categories write, stock adjust | ✅ | ✅ | ❌ (read, **no cost fields**) |
| Customers create/edit | ✅ | ✅ | ✅ (no delete) |
| Sales orders create/confirm/deliver | ✅ | ✅ | ✅ |
| Cancel confirmed SO, price override, void payments | ✅ | ✅ | ❌ (may cancel drafts) |
| Suppliers, purchase orders, supplier payments | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Dashboard | full | full | sales/receivables only (no profit, stock value, payables) |

Enforced in the API (`@Roles`, `ManagerOrAbove`, `OwnerOnly`, `canSeeCosts`). The UI only mirrors it: `NAV` entries in `layout/AppLayout.tsx` take an `allow(role)` filter, and role-restricted routes are wrapped in `auth/RoleGate.tsx` (router `Manager` wrapper), which shows the translated `FORBIDDEN` message instead of a page full of 403s.

## Architecture

```
apps/api   NestJS 12 (ESM) · Prisma 7 (prisma-client generator, @prisma/adapter-mssql) · Microsoft SQL Server · Vitest
apps/web   React 19 · Vite 8 · Tailwind 4 · shadcn/ui (radix base, RTL) · TanStack Query · react-hook-form + zod · react-i18next · react-router 7 · recharts · sonner
```

- **Modular monolith.** Modules in `apps/api/src/modules/*`: auth, users, tenant, catalog, inventory (`StockService` = the only writer of `stockQty`), parties (customers/suppliers), sales-orders, purchase-orders, payments (`LedgerService` = the only definition of balances/statements), reports.
- `src/common`: `auth.ts` (global `AuthGuard`, which reloads the user each request so deactivation and role changes apply immediately), `errors.ts` (stable error `code`s), `http-exception.filter.ts` (`{statusCode, code, message, details?}`, no internals leaked), `money.ts`, `pagination.ts` (`{data, meta}`), `tx.ts` (`assertOwned`, `nextDocumentNumber`, `logActivity`/`parseMetadata`), `enums.ts` (domain enums as const objects; see Database).
- `validation.ts`: `IsOptionalNotNull` (optional, but an explicit null is validated — use it for NOT NULL columns; update DTOs use `PartialType(…, { skipNullProperties: false })`), `Trim`, `ParseIdPipe` (route ids; outside the INT range → 404). Money inputs are capped at `MAX_MONEY` (DECIMAL(14,2)); the exception filter maps Prisma P2020 (value out of range) to 400.
- `setup-app.ts` is shared by `main.ts` and the e2e tests: `/api` prefix, helmet, cookie-parser, CORS allowlist, strict `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Swagger at `/api/docs` (non-production).

## Multi-tenancy

- Shared database; `tenantId` on every business row. `tenantId` comes from the JWT (and is verified against the DB), **never from input**.
- Required relations use **composite FKs `(tenantId, xId) → (tenantId, id)`**, so SQL Server rejects cross-tenant links.
- Optional relations (product.category, payment → order) use plain FKs plus a service-level `assertOwned` check.
- Other tenants' records always answer **404**.

## Auth

- Access JWT (15 min, `{sub, tid}`) in memory on the client.
- Refresh token: random 32 bytes, stored as a SHA-256 hash, in an httpOnly SameSite=Strict cookie `tf_refresh` (path `/api/auth`). Rotated on every use; replaying a rotated token revokes the whole family.
- argon2 password hashing; timing-equalised login; throttling on the auth endpoints.
- Password change requires the current password and revokes all sessions.
- Deactivating a user revokes their sessions.

## Database

Tables: Tenant, User, RefreshToken, Category, Product, StockMovement, Customer, CustomerPrice, Supplier, SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem, CustomerPayment, SupplierPayment, DocumentSequence, ActivityLog.

**Engine: Microsoft SQL Server only** (user decision, 2026-11-20; MySQL fully removed). Prisma provider `sqlserver`; runtime driver `@prisma/adapter-mssql`, which accepts the same `sqlserver://host:port;database=…;user=…;password=…;encrypt=true;trustServerCertificate=true` string as the CLI.

SQL Server adaptations (keep them):
- Text columns are **NVARCHAR** (Unicode, required for Arabic); `@db.Text` → `NVarChar(Max)`. Default server collation is case-insensitive, so unique email/SKU/name stay case-insensitive.
- **No native enums:** enum columns are `NVARCHAR(20)` with CHECK constraints listing the allowed values; TypeScript uses `src/common/enums.ts` (same names as before, e.g. `SalesOrderStatus.CONFIRMED`). `enums.spec.ts` fails if the migration's CHECK lists drift from `enums.ts`.
- **No Json type:** `ActivityLog.metadata` is JSON text (`NVARCHAR(MAX)` + `ISJSON` CHECK), written by `logActivity`, parsed by `parseMetadata`.
- Referential actions: SQL Server has no RESTRICT, so `onDelete: NoAction` (same guarantee); every relation has `onUpdate: NoAction` (ids never change; avoids multiple-cascade-path errors).
- Raw SQL is T-SQL: row locks `WITH (UPDLOCK, ROWLOCK)`; document numbers via `UPDATE … WITH (UPDLOCK, HOLDLOCK)` then `INSERT` if no row; `TOP (n)`, `CAST(x AS date)`, booleans as `1`. No `createMany({ skipDuplicates })` (deduplicate in code).
- Nested `items: { create }` must not pass `tenantId`: Prisma derives it from the parent's composite key.

- CHECK constraints: stock ≥ 0, prices ≥ 0, item qty > 0, payment amount > 0, discount ≤ subtotal, enum values, metadata is JSON.
- Databases (local): `tradeflow` (dev), `tradeflow_test` (e2e, wiped each run), `tradeflow_shadow` (`prisma migrate dev` only). SQL login `tradeflow` is `db_owner` of exactly these three; no server-level roles.
- Migrations in `apps/api/prisma/migrations` (`migration_lock.toml` provider `mssql`). The seed (`prisma/seed.ts`) builds a fictional EGP demo business by calling the real services.
- Demo users: `owner@ / manager@ / staff@demo.tradeflow.local`, password `Demo@12345`. Demo-only, safe to publish.

## API (all under `/api`)

| Area | Endpoints |
|---|---|
| auth | `POST register`, `POST login`, `POST refresh`, `POST logout`, `GET me`, `POST change-password` |
| users (owner) | `GET`, `POST`, `PATCH /:id`, `POST /:id/reset-password` |
| tenant | `GET`, `PATCH` (owner) |
| categories | CRUD |
| products | CRUD (`?search, categoryId, status, lowStock`) |
| inventory | `GET movements`, `POST adjustments` |
| customers | CRUD, `/:id/statement`, `/:id/prices` (`GET`, `PUT`) |
| suppliers | CRUD, `/:id/statement` |
| sales-orders | CRUD (draft), `/:id/confirm` `/deliver` `/cancel` |
| purchase-orders | CRUD (draft), `/:id/order` `/receive` `/cancel` |
| payments | `GET/POST customer`, `POST customer/:id/void`, same for `supplier` |
| dashboard, reports | `GET /dashboard`, `/reports/sales?from&to`, `/reports/inventory`, `/reports/balances`, `/reports/activity` |
| health | `GET /health` |

## Internationalization (plan for the web app)

- `react-i18next` with resources in `src/i18n/locales/{ar,en}/*.json`. Default `ar`; the choice is persisted in `localStorage`.
- `<html lang dir>` is switched at runtime. Use only logical Tailwind classes (`ms-/me-/ps-/pe-/start-/end-`); shadcn is configured with `rtl: true`.
- API errors are translated by `code`, so there is no server-side localisation.
- Radix primitives don't read `<html dir>`: `src/components/AppDirection.tsx` wraps the app in Radix `Direction.Provider` fed by `i18n.dir()`. Keep it at the root, or Tabs/Select/menus render LTR inside Arabic.
- Tailwind 4 `divide-x`/`space-x` are already logical: never add `rtl:*-reverse`.
- Numbers use **Western digits** in Arabic (`ar-EG-u-nu-latn` via `Intl`). Default currency is EGP.
- Font: IBM Plex Sans Arabic (bundled via @fontsource, no CDN).
- Design tokens:
  - paper `#F6F7F5`
  - ink `#1B2A33`
  - ledger green `#0F6E5A` (primary)
  - carton amber `#C8891B` (low stock/warnings)
  - danger `#B4382F`
- The signature UI element is a ledger-style statement (debit/credit/running balance, tabular numerals). Everything else stays quiet. It is the shared `src/components/LedgerStatement.tsx` (customers and suppliers); its labels live in `common.statement`.

## Testing

- Unit: `npm test -w @tradeflow/api` and `npm test -w @tradeflow/web` (Vitest). Vitest compiles with oxc, configured with `decorator: { legacy: true, emitDecoratorMetadata: true }` because Nest DI and class-transformer need decorator metadata.
- e2e: `npm run test:e2e -w @tradeflow/api`. Uses `TEST_DATABASE_URL`; the DB name must contain "test", and it is reset from migrations on each run. Suites cover auth, workflows/financial consistency (incl. concurrent overselling), tenant isolation (reads, writes and cross-references, plus DB-level FK checks), RBAC, and audit regressions (null/overflow input, out-of-range ids, strict dates, local-day report bucketing).
- Prisma blocks `migrate reset` when run by an AI agent unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` holds the user's exact consent text. The user consented (2026-11-20) with: "Yes, I consent to resetting tradeflow and tradeflow_test" — that covers only those two databases. A human running the tests needs nothing.
- **Verification status (2026-11-22, session 11):** GitHub Actions CI is green on `main`: type checks, lint, builds, API unit 16/16, web unit 52/52, and API e2e 39/39 **including the `prisma migrate reset` step** on a disposable SQL Server container, plus the demo seed. Locally the agent's classifier still refuses setting the Prisma consent variable, so local agent e2e runs use a no-reset config on the already-migrated `tradeflow_test`; CI is the authoritative full e2e run.
- Report days: `from`/`to` are local calendar days (`parseDay`) and daily series are bucketed by local day (`localDayKey`), matching the dashboard's "today". The server timezone is the business timezone (no per-tenant timezone).
- Live smoke test: `node apps/api/scripts/smoke.mjs [baseUrl]` (defaults to the web proxy `http://localhost:5173/api`) signs in as each demo role and checks main endpoints and role-dependent shapes. `node apps/api/scripts/with-test-db.mjs <cmd>` runs a command against `TEST_DATABASE_URL`.

## Setup (local, no Docker)

1. Node ≥ 22 (dev machine: Node 26; use npm 11).
2. SQL Server (2019+; dev machine: SQL Server 2025 Developer, default instance `MSSQLSERVER`) with **TCP 1433 enabled** and **mixed-mode (SQL) authentication**. As a sysadmin (e.g. `sqlcmd -S localhost -E -C`), create login `tradeflow` and databases `tradeflow`, `tradeflow_test`, `tradeflow_shadow`, each with user `tradeflow` in `db_owner`.
3. `cp apps/api/.env.example apps/api/.env` and fill in the password and a JWT secret (never commit `.env`).
4. `npm install`, then `npm run db:deploy -w @tradeflow/api`, `npm run db:seed -w @tradeflow/api`, `npm run dev` (API :3000, web :5173 with a `/api` proxy).
5. Windows PowerShell blocks `npx.ps1`/`npm.ps1` on this machine (execution policy); use `npx.cmd`/`npm.cmd` there. Do not change the policy.

## Git / GitHub policy

- Repo `D:\Workspace\tradeflow`. Target: public GitHub repo `tradeflow` under the authenticated account (`ali-kassab`).
- Commits use only the user's git identity, with **no AI/Claude author or co-author trailers**. No PRs. Never force-push.
- Before every push: check for secrets, confirm `.env` is ignored, review staged files.
- Branch policy (changed by the user 2026-11-22): **`main` is the single authoritative branch and the GitHub default branch.** `feat/foundation` was merged into `main` and deleted (local and remote). New work goes to `main` (or a short-lived branch merged into `main` when the user asks for one). Never force-push, never rewrite history; PRs and merges only when the user asks.
- CI: `.github/workflows/ci.yml` runs on pushes to `main`, PRs targeting `main` and manual dispatch. Job `checks`: `npm ci`, then API typecheck, lint, unit tests and build, then web typecheck, lint, unit tests and production build. Job `e2e`: a disposable `mcr.microsoft.com/mssql/server:2022-latest` service container (throwaway SA password, not a secret), creates `tradeflow_test`, runs `npm run test:e2e -w @tradeflow/api` (including the `prisma migrate reset` step), then seeds the demo business. The JWT secret is generated per run and masked. No repository secrets are needed.
- Before every commit: verify `git config user.name/user.email` and `gh auth status` match the user's existing identity (`ali-kassab`); if anything is missing or inconsistent, stop and ask. Inspect the staged diff before committing and the author/committer after.
- Original company repositories are never modified.

## Installed Skills policy

- Before a task, discover the installed Skills that apply, read their instructions, and follow them. Relevant here: web UI `frontend-design`, `vercel-react-best-practices`; browser testing `webapp-testing` or the built-in browser.
- The `spring-*`, `flyway-migrations` and `multi-tenancy` Skills target Spring Boot/Java and don't apply to this NestJS/Prisma stack.
- Never claim a Skill was used unless its instructions were actually read and followed; report which Skills were used and where.
- Project architecture, security requirements and existing conventions always win over generic Skill advice.

## Reuse-First Development policy

- Use existing project components and installed libraries first (shadcn/ui primitives, `radix-ui`, `PageHeader`, `PaginationBar`, `ConfirmDialog`, `FormField`, `ProductPicker`, `CustomerPicker`, `SupplierPicker`, `LedgerStatement`, `RecordPaymentDialog`, `VoidPaymentDialog`, `lib/order-math`, `lib/format`, `lib/notify`, TanStack Query, react-hook-form + zod).
- For anything new, evaluate mature, compatible, free/open-source options before building custom code; check maintenance, licence, accessibility and bundle impact, and avoid unnecessary dependencies.
- Customise reused components to the design tokens, Arabic RTL, English LTR and responsive layout.
- Customer and supplier payments share one UI: `PaymentsView`, `RecordPaymentDialog` and `VoidPaymentDialog` take a `kind` (`customer` | `supplier`); per-kind endpoints, billed statuses and cache keys live in `pages/payments/payment-kinds.ts`.
- Dialog forms live in a child component rendered inside `DialogContent` (Radix mounts it only while open), so each opening starts fresh without a reset effect; add a `key` when a preset prop can change while open (`RecordPaymentDialog`, `AdjustStockDialog`).
- Don't refactor or replace existing components merely to apply this policy.
