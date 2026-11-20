import { describe, expect, it } from 'vitest';
import apiErrors from '../../../api/src/common/errors.ts?raw';
import { resources } from './resources';

// Plural suffixes differ by language (Arabic has six forms, English two), so compare base keys.
const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(obj: object, prefix = ''): string[] {
  const all = Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
  return [...new Set(all.map((k) => k.replace(PLURAL, '')))];
}

describe('locales', () => {
  for (const ns of Object.keys(resources.ar) as (keyof typeof resources.ar)[]) {
    it(`ar and en "${ns}" have the same keys`, () => {
      expect(keys(resources.en[ns]).sort()).toEqual(keys(resources.ar[ns]).sort());
    });
  }

  it('defines every Arabic plural form wherever a key is pluralised', () => {
    const flat = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as object, `${p}${k}.`) : [`${p}${k}`]));
    const ar = Object.values(resources.ar).flatMap((ns) => flat(ns));
    const bases = new Set(ar.filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
    const forms = new Intl.PluralRules('ar').resolvedOptions().pluralCategories;
    for (const base of bases) for (const f of forms) expect(ar).toContain(`${base}_${f}`);
  });

  it('translates every API error code', () => {
    // Read the API source as text so the web build never compiles API code.
    const codes = [...apiErrors.matchAll(/^\s+([A-Z_]+): '\1',$/gm)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(10);
    for (const code of codes) {
      expect(resources.ar.errors).toHaveProperty(code);
      expect(resources.en.errors).toHaveProperty(code);
    }
  });
});
