# Session handoff — TradeFlow

_Last updated: 2026-11-21, session 4 (MVP completion run). Checkpoint: Phase 1 (customer payments) done._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. PROJECT_HANDOFF.md holds the permanent architecture, business rules, SQL Server conventions and policies (Installed Skills, Reuse-First, Git identity).

## Status

- **Backend:** MVP API complete (all endpoints in PROJECT_HANDOFF.md). No backend changes this session so far.
- **Frontend built and verified:** auth, dashboard, products, categories, inventory, customers, sales orders, **customer payments**.
- **Frontend not built yet:** suppliers, purchase orders, supplier payments, reports, settings, users. README missing.

## Roadmap for this run (user-approved order)

1. ~~Customer payments~~ (done)
2. Suppliers (list, form, detail, statement via `LedgerStatement`; manager+)
3. Purchase orders (list, draft editor, order / receive / cancel, detail)
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

## How to run (dev)

- `.claude/launch.json` (local, untracked) has `api` (`node dist/main.js` in `apps/api`, port 3000) and `web` (`npx vite`, port 5173). Rebuild the API with `npm run build -w @tradeflow/api` after API changes.
- Web: `npx tsc -b`, `npx vitest run`, `npx oxlint` in `apps/web`. API: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx oxlint --type-aware src/ test/` in `apps/api`.

## Known issues / notes

- Payable-order list fetches up to 100 CONFIRMED + 100 DELIVERED orders per customer (API page cap); older unpaid orders beyond that wouldn't be offered (payment can still go on account).
- Shadcn dialog close button label is hard-coded English "Close" (pre-existing).
- `ProductPicker` has no built-in accessible name (pre-existing).
- oxlint pre-existing warnings: shadcn `only-export-components`, `router.tsx`, `AdjustStockDialog.tsx` (`set-state-in-effect`); API: 2× `no-misused-spread` in `parties.module.ts`, 1 in an e2e spec.
- Global npm 10 crashes on Node 26: use `npx -y npm@11`. In PowerShell use `npx.cmd`; don't change the execution policy.
- `npm audit`: 3 high from the dev-only Prisma CLI dependency `effect` (accepted).

## Exact next step

Phase 2 — suppliers: read `apps/api/src/modules/parties/parties.module.ts` (supplier DTOs, list shape, statement), then build `pages/suppliers/` (list, form dialog, detail with `LedgerStatement`) reusing the customers pages' patterns; nav entry for manager+ only; verify as manager and staff (staff must not see it; API returns 403).

## Constraints to keep

- SQL Server only; no Docker. Follow "SQL Server adaptations" in PROJECT_HANDOFF.md.
- Branch `feat/foundation` only; never touch `main`. No PRs, no force-push, no history rewrite.
- Commits only as the user's verified identity (`ali-kassab`), no AI co-author trailers; verify identity before each commit.
- Never print or commit `apps/api/.env`.
- e2e resets `tradeflow_test` only; agent `prisma migrate reset` needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Yes, I consent to resetting tradeflow and tradeflow_test"`.
- Follow the Installed Skills and Reuse-First policies.
