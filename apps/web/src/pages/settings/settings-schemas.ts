import type { TFunction } from 'i18next';
import { z } from 'zod';

const TAX_RATE = /^\d{1,3}(\.\d{1,2})?$/;

// Mirrors UpdateTenantDto (apps/api/src/modules/tenant/tenant.ts).
export const tenantSchema = (t: TFunction<'settings'>) =>
  z.object({
    name: z.string().trim().min(2, t('validation.nameLength')).max(120, t('validation.nameLength')),
    currency: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z]{3}$/.test(v), t('validation.currency')),
    defaultTaxRate: z
      .string()
      .trim()
      .refine((v) => TAX_RATE.test(v) && Number(v) <= 100, t('validation.taxRate')),
  });
export type TenantValues = z.input<ReturnType<typeof tenantSchema>>;

// Mirrors ChangePasswordDto (apps/api/src/modules/auth/auth.dto.ts), plus a confirmation field.
export const passwordSchema = (t: TFunction<'settings'>) =>
  z
    .object({
      currentPassword: z.string().min(1, t('validation.required')).max(128, t('validation.passwordMax')),
      newPassword: z.string().min(8, t('validation.passwordMin')).max(128, t('validation.passwordMax')),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: t('validation.passwordMatch') });
export type PasswordValues = z.infer<ReturnType<typeof passwordSchema>>;
