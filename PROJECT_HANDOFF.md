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

Enforced in the API (`@Roles`, `ManagerOrAbove`, `OwnerOnly`, `canSeeCosts`). The UI only mirrors it.

## Architecture

```
apps/api   NestJS 12 (ESM) · Prisma 7 (prisma-client generator, @prisma/adapter-mariadb) · MySQL 8 · Vitest
apps/web   React 19 · Vite 8 · Tailwind 4 · shadcn/ui (radix base, RTL) · TanStack Query · react-hook-form + zod · react-i18next · react-router 7 · recharts · sonner
```

- **Modular monolith.** Modules in `apps/api/src/modules/*`: auth, users, tenant, catalog, inventory (`StockService` = the only writer of `stockQty`), parties (customers/suppliers), sales-orders, purchase-orders, payments (`LedgerService` = the only definition of balances/statements), reports.
- `src/common`: `auth.ts` (global `AuthGuard`, which reloads the user each request so deactivation and role changes apply immediately), `errors.ts` (stable error `code`s), `http-exception.filter.ts` (`{statusCode, code, message, details?}`, no internals leaked), `money.ts`, `pagination.ts` (`{data, meta}`), `tx.ts` (`assertOwned`, `nextDocumentNumber`, `logActivity`).
- `setup-app.ts` is shared by `main.ts` and the e2e tests: `/api` prefix, helmet, cookie-parser, CORS allowlist, strict `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Swagger at `/api/docs` (non-production).

## Multi-tenancy

- Shared database; `tenantId` on every business row. `tenantId` comes from the JWT (and is verified against the DB), **never from input**.
- Required relations use **composite FKs `(tenantId, xId) → (tenantId, id)`**, so MySQL rejects cross-tenant links.
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

- CHECK constraints: stock ≥ 0, prices ≥ 0, item qty > 0, payment amount > 0, discount ≤ subtotal.
- Migrations in `apps/api/prisma/migrations`. The seed (`prisma/seed.ts`) builds a fictional EGP demo business by calling the real services.
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
- Numbers use **Western digits** in Arabic (`ar-EG-u-nu-latn` via `Intl`). Default currency is EGP.
- Font: IBM Plex Sans Arabic (bundled via @fontsource, no CDN).
- Design tokens:
  - paper `#F6F7F5`
  - ink `#1B2A33`
  - ledger green `#0F6E5A` (primary)
  - carton amber `#C8891B` (low stock/warnings)
  - danger `#B4382F`
- The signature UI element is a ledger-style statement (debit/credit/running balance, tabular numerals). Everything else stays quiet.

## Testing

- Unit: `npm test -w @tradeflow/api` (Vitest).
- e2e: `npm run test:e2e -w @tradeflow/api`. Uses `TEST_DATABASE_URL`; the DB name must contain "test", and it is reset from migrations on each run. Suites cover auth, workflows/financial consistency (incl. concurrent overselling), tenant isolation (reads, writes and cross-references, plus DB-level FK checks), and RBAC.

## Setup (local, no Docker)

1. Node ≥ 22 (dev machine: Node 26; use npm 11).
2. MySQL 8 running locally; create user `tradeflow` with rights on `tradeflow%`.
3. `cp apps/api/.env.example apps/api/.env` and fill it in.
4. `npm install`, then `npm run db:migrate`, `npm run db:seed`, `npm run dev` (API :3000, web :5173 with a `/api` proxy).

## Git / GitHub policy

- Repo `D:\Workspace\tradeflow`. Target: public GitHub repo `tradeflow` under the authenticated account (`ali-kassab`).
- Commits use only the user's git identity, with **no AI/Claude author or co-author trailers**. No PRs. Never force-push.
- Before every push: check for secrets, confirm `.env` is ignored, review staged files.
- Branch policy (user decision): work on feature branches (currently `feat/foundation`) and push those; never push to `main` without explicit approval; never force-push.
- Original company repositories are never modified.
