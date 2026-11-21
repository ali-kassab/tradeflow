import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

// Static sample rows for the brand panel: a ledger excerpt whose running balance
// follows the same rule the app uses (balance = previous + debit − credit).
const SAMPLE = [
  { ref: 'SO-00041', debit: 18450, credit: 0 },
  { ref: 'PAY-112', debit: 0, credit: 10000 },
  { ref: 'SO-00047', debit: 6320, credit: 0 },
  { ref: 'PAY-118', debit: 0, credit: 8000 },
];
const ROWS = SAMPLE.reduce<{ ref: string; debit: number; credit: number; balance: number }[]>(
  (acc, r) => [...acc, { ...r, balance: (acc.at(-1)?.balance ?? 0) + r.debit - r.credit }],
  [],
);
const fmt = new Intl.NumberFormat('en-US');

function LedgerMotif() {
  return (
    <table className="tabular w-full max-w-sm text-sm" dir="ltr" aria-hidden="true">
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.ref} className="border-b border-white/10 last:border-0">
            <td className="py-2.5 pe-4 text-white/60">{r.ref}</td>
            <td className="py-2.5 pe-4 text-end text-white/85">{r.debit ? fmt.format(r.debit) : ''}</td>
            <td className="py-2.5 pe-4 text-end text-warning">{r.credit ? fmt.format(r.credit) : ''}</td>
            <td className="py-2.5 text-end font-semibold text-white">{fmt.format(r.balance)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useTranslation('auth');
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Ink panel in both themes: the brand side reads like the cover of a ledger. */}
      <aside className="relative hidden flex-col justify-between bg-[#13252A] p-12 text-white lg:flex dark:bg-[#0C1417]">
        <Logo className="text-white" />
        <div className="space-y-6">
          <h2 className="max-w-md text-[2rem] leading-tight font-semibold tracking-tight text-balance">{t('brand.headline')}</h2>
          <p className="max-w-md leading-relaxed text-white/70">{t('brand.body')}</p>
          <div className="relative mt-4 max-w-sm rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3">
            <span aria-hidden="true" className="bg-rule absolute inset-y-3 start-0 w-0.5 rounded-full" />
            <LedgerMotif />
          </div>
        </div>
        <span aria-hidden="true" />
      </aside>
      <main className="bg-background flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-0.5">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1.5 mb-8">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
