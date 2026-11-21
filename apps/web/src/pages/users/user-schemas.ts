import type { TFunction } from 'i18next';
import { z } from 'zod';

export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;

const name = (t: TFunction<'users'>) => z.string().trim().min(2, t('validation.nameLength')).max(120, t('validation.nameLength'));
const password = (t: TFunction<'users'>) => z.string().min(8, t('validation.passwordMin')).max(128, t('validation.passwordMax'));

// Mirrors CreateUserDto / UpdateUserDto / ResetPasswordDto (apps/api/src/modules/users/users.ts).
export const createUserSchema = (t: TFunction<'users'>) =>
  z.object({
    name: name(t),
    email: z.string().trim().min(1, t('validation.required')).email(t('validation.email')).max(190, t('validation.email')),
    password: password(t),
    role: z.enum(ROLES),
  });
export type CreateUserValues = z.infer<ReturnType<typeof createUserSchema>>;

export const editUserSchema = (t: TFunction<'users'>) =>
  z.object({
    name: name(t),
    role: z.enum(ROLES),
    isActive: z.boolean(),
  });
export type EditUserValues = z.infer<ReturnType<typeof editUserSchema>>;

export const resetPasswordSchema = (t: TFunction<'users'>) => z.object({ password: password(t) });
export type ResetPasswordValues = z.infer<ReturnType<typeof resetPasswordSchema>>;

// No look-alike characters (0/O, 1/l/I), so a temporary password can be read out or copied by hand.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random temporary password (crypto-strength) for the owner to hand to the user. */
export function generatePassword(length = 12, random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)) {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    for (const b of random(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}
