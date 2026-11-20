# Session handoff — TradeFlow

_Last updated: 2026-11-20, end of session 2._

## Project

TradeFlow is a bilingual (Arabic RTL by default, English LTR) B2B wholesale management platform, built as a portfolio project. Read PROJECT_HANDOFF.md for the permanent architecture, business rules and policies.

## Checkpoint

**Phase 3 (web foundation) is done and verified offline.** The backend is still the session 1 state: complete, but never run against a real database.

## Completed this session

**Web foundation** (`apps/web`), following the i18n and design plan in PROJECT_HANDOFF.md:

| Item | Files |
|---|---|
| Removed the Geist and Inter fonts. Bundled IBM Plex Sans Arabic (400–700) through @fontsource. Applied the palette tokens (paper, ink, ledger green, carton amber, danger), added a `warning` color and a `tabular` utility. | `src/index.css`, `package.json`, `package-lock.json` |
| i18n: react-i18next with namespaces `common`, `auth`, `errors` and `dashboard`. Arabic is the default and the choice is saved under the localStorage key `tf.lang`. `<html lang dir>` switches at runtime. Keys are typed. | `src/i18n/{index,resources}.ts`, `i18next.d.ts`, `locales/{ar,en}/*.json` |
| API client: axios with `baseURL /api`. The access token is kept in memory only. A 401 triggers one shared ("single-flight") refresh, then a retry. Errors map to translated codes, plus a client-only `NETWORK` code. | `src/lib/api.ts` |
| Number and date formatting with `Intl`: Arabic uses `ar-EG-u-nu-latn` (Western digits); money comes in as a decimal string. | `src/lib/format.ts` |
| Auth: `AuthProvider` restores the session from the refresh cookie when the app loads, and provides login, register and logout. `useAuth` / `useSession`. UI role helpers. | `src/auth/*` |
| Pages: login and register (react-hook-form + zod, limits mirror the API DTOs), a dashboard (KPIs that respect the role-based response shape, a 30-day recharts area chart, latest orders and payments), and a 404 page. | `src/pages/**` |
| Router: `createBrowserRouter`, each page lazy-loaded, `RequireAuth` / `GuestOnly` guards. Layout: shadcn sidebar on the right in RTL and the left in LTR, plus the language switch and sign-out. | `src/router.tsx`, `src/layout/AppLayout.tsx`, `src/main.tsx` |
| Shared components: `Logo`, `LanguageSwitch`, `FormField` (react-hook-form + shadcn Field), `Alert` | `src/components/*.tsx` |
| Deleted the placeholder `src/App.tsx`. | |

**Reuse:** built on the existing shadcn/ui components (button, input, field, sidebar, chart, badge, skeleton, spinner, sonner, tooltip) and on libraries already installed (axios, TanStack Query, react-hook-form, zod, react-i18next, recharts, lucide). **No new dependencies were added.**

### Verification

- `npx vitest run` (web): **13/13 passed**. Covers ar/en key parity in every namespace, a translation for every API `ErrorCode` (read from `apps/api/src/common/errors.ts` as text), Western digits in Arabic money formatting, error-code mapping, the shared single-flight refresh, and a rejected refresh returning null.
- `tsc -b` (web): OK. `oxlint`: 0 errors. The warnings are `only-export-components` in the generated shadcn files and in `router.tsx`, which is harmless.
- `npm run build -w @tradeflow/web`: OK. Each page is its own chunk; the dashboard chunk (recharts) is about 103 kB gzip, the entry about 152 kB gzip.
- The Vite dev server started and `/login` returned HTTP 200.
- **NOT verified:** what the UI looks like in a browser (the browser pane refused to open localhost) and any flow against the real API (MySQL is down).

## Blockers (unchanged from session 1)

1. **MySQL is not running.** Windows service `MYSQL80` is stopped. Starting it needs an admin shell: `net start MYSQL80`.
2. **The DB user doesn't exist yet.** In MySQL Workbench, create `tradeflow`@`localhost` and grant it ``ALL ON `tradeflow%`.*``. Then replace the three `CHANGE_ME` values in `apps/api/.env` (gitignored).

## Known issues

- Global npm 10.8.2 crashes on Node 26. Use `npx -y npm@11 <cmd>`.
- `npm audit`: 3 high, all from `effect` inside the dev-only Prisma CLI. This is a documented, accepted risk.
- The `.claude/launch.json` (local, untracked) defines a `web` dev-server config.
- PROJECT_HANDOFF.md has no "Installed Skills" or "Reuse-First Development" policy sections, although the session instructions refer to them. They were not invented. The user should add them if they want them recorded permanently.

## Exact next steps (in order)

1. **User:** start MySQL, create the DB user and fill in `apps/api/.env` (see Blockers).
2. `npm run db:migrate`, then `npm run db:seed`, then `npm run test:e2e -w @tradeflow/api`, and fix any failures (this will be the first real run).
3. `npm run dev` and check the UI in a browser: login as `owner@demo.tradeflow.local` / `Demo@12345`, the dashboard, the ar/en switch, and an RTL/LTR layout check at mobile width.
4. Next frontend feature pages, in this order: **products/categories** → inventory (movements, adjustments, low stock) → customers (prices, ledger statement) → sales orders → payments → suppliers and purchase orders → reports → settings and users (owner only). Add each page to `NAV` in `src/layout/AppLayout.tsx` only once it exists, filtered by role. Add its namespace to `src/i18n/resources.ts` and to both locale folders.
5. Keep committing to `feat/foundation` and pushing. Ask before touching `main`.

## Conventions for continuation

- UI strings live in locale JSON only. API errors are translated by `code` in the `errors` namespace.
- Use only logical Tailwind classes (`ms/me/ps/pe/start/end`). Mirror direction-bearing icons with `rtl:-scale-x-100`. Show references and numbers like SKUs and order numbers with `dir="ltr"`.
- Show amounts with `formatMoney(value, tenant.currency, lang)` and the `tabular` class.
- Server state goes through TanStack Query (`api` from `@/lib/api`). Never store tokens in localStorage.
- The UI hides what a role can't do, but the API remains the authority (`isManagerOrAbove`, `isOwner`).

## Git

- Repo `D:\Workspace\tradeflow`. The working branch is `feat/foundation`, which tracks `origin/feat/foundation` at https://github.com/ali-kassab/tradeflow.
- Commits use only the user's identity (`ali-kassab`), with **no AI co-author trailers**. No PRs, no force-push, and nothing pushed to `main` without approval.
