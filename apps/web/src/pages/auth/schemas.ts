import type { TFunction } from 'i18next';
import { z } from 'zod';

// Mirrors the API's DTO limits (auth.dto.ts) so most mistakes are caught before a round trip.
export const loginSchema = (t: TFunction<'auth'>) =>
  z.object({
    email: z.string().trim().min(1, t('validation.required')).email(t('validation.email')),
    password: z.string().min(1, t('validation.required')).max(128, t('validation.passwordMax')),
  });

export const registerSchema = (t: TFunction<'auth'>) =>
  z.object({
    businessName: z.string().trim().min(2, t('validation.nameLength')).max(120, t('validation.nameLength')),
    name: z.string().trim().min(2, t('validation.nameLength')).max(120, t('validation.nameLength')),
    email: z.string().trim().min(1, t('validation.required')).email(t('validation.email')).max(190),
    password: z.string().min(8, t('validation.passwordMin')).max(128, t('validation.passwordMax')),
  });

export type LoginValues = z.infer<ReturnType<typeof loginSchema>>;
export type RegisterValues = z.infer<ReturnType<typeof registerSchema>>;
