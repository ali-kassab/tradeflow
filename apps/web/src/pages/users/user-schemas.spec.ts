import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { passwordSchema, tenantSchema } from '../settings/settings-schemas';
import { createUserSchema, editUserSchema, generatePassword } from './user-schemas';

const t = ((k: string) => k) as unknown as TFunction<never>;

describe('settings and user schemas', () => {
  it('normalises the currency and validates the VAT rate like the API', () => {
    expect(tenantSchema(t).parse({ name: ' Demo ', currency: 'egp', defaultTaxRate: '14' })).toEqual({
      name: 'Demo',
      currency: 'EGP',
      defaultTaxRate: '14',
    });
    expect(tenantSchema(t).safeParse({ name: 'Demo', currency: 'EG', defaultTaxRate: '14' }).success).toBe(false);
    expect(tenantSchema(t).safeParse({ name: 'Demo', currency: 'EGP', defaultTaxRate: '100.01' }).success).toBe(false);
    expect(tenantSchema(t).safeParse({ name: 'Demo', currency: 'EGP', defaultTaxRate: '14.125' }).success).toBe(false);
    expect(tenantSchema(t).safeParse({ name: 'Demo', currency: 'EGP', defaultTaxRate: '0' }).success).toBe(true);
  });

  it('requires a matching new password of 8+ characters', () => {
    const s = passwordSchema(t);
    expect(s.safeParse({ currentPassword: 'x', newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' }).success).toBe(true);
    expect(s.safeParse({ currentPassword: 'x', newPassword: 'abcdefg', confirmPassword: 'abcdefg' }).success).toBe(false);
    const mismatch = s.safeParse({ currentPassword: 'x', newPassword: 'abcdefgh', confirmPassword: 'abcdefgX' });
    expect(mismatch.error?.issues[0].path).toEqual(['confirmPassword']);
  });

  it('validates new and edited users', () => {
    expect(createUserSchema(t).safeParse({ name: 'Sara', email: 'sara@example.com', password: 'Temp-1234', role: 'STAFF' }).success).toBe(true);
    expect(createUserSchema(t).safeParse({ name: 'Sara', email: 'nope', password: 'Temp-1234', role: 'STAFF' }).success).toBe(false);
    expect(editUserSchema(t).safeParse({ name: 'S', role: 'MANAGER', isActive: true }).success).toBe(false);
    expect(editUserSchema(t).safeParse({ name: 'Sara', role: 'ADMIN', isActive: true }).success).toBe(false);
  });

  it('generates temporary passwords from the unambiguous alphabet', () => {
    const p = generatePassword();
    expect(p).toHaveLength(12);
    expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
    expect(generatePassword(12)).not.toBe(p);
    // Bytes above the rejection limit are skipped, never mapped with bias.
    let call = 0;
    const fake = (b: Uint8Array) => b.fill(call++ === 0 ? 255 : 0);
    expect(generatePassword(4, fake)).toBe('aaaa');
  });
});
