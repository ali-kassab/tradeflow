// Arabic uses Western (Latin) digits throughout, per the design plan.
const LOCALES = { ar: 'ar-EG-u-nu-latn', en: 'en-US' } as const;

function locale(lang: string) {
  return lang === 'ar' ? LOCALES.ar : LOCALES.en;
}

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(key: string, lang: string, opts: Intl.NumberFormatOptions) {
  const k = `n|${lang}|${key}`;
  let f = cache.get(k) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(locale(lang), opts);
    cache.set(k, f);
  }
  return f;
}

function dateFormat(key: string, lang: string, opts: Intl.DateTimeFormatOptions) {
  const k = `d|${lang}|${key}`;
  let f = cache.get(k) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale(lang), opts);
    cache.set(k, f);
  }
  return f;
}

/** Money arrives from the API as a decimal string ("1234.50"); it is only formatted here. */
export function formatMoney(value: string | number, currency: string, lang: string) {
  return numberFormat(`money|${currency}`, lang, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatNumber(value: number, lang: string) {
  return numberFormat('int', lang, { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | Date, lang: string) {
  return dateFormat('date', lang, { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(value),
  );
}

export function formatShortDay(value: string | Date, lang: string) {
  return dateFormat('day', lang, { month: 'short', day: 'numeric' }).format(new Date(value));
}

/** Signed percentage, e.g. "+5.5%" / "-10%"; takes a value in percent (10 → 10%). */
export function formatPercent(value: number, lang: string) {
  return numberFormat('pct', lang, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value / 100);
}
