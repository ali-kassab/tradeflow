import { describe, expect, it } from 'vitest';
import apiErrors from '../../../api/src/common/errors.ts?raw';
import { resources } from './resources';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  for (const ns of Object.keys(resources.ar) as (keyof typeof resources.ar)[]) {
    it(`ar and en "${ns}" have the same keys`, () => {
      expect(keys(resources.en[ns]).sort()).toEqual(keys(resources.ar[ns]).sort());
    });
  }

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
