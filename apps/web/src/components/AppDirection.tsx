import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Radix primitives (Tabs, Select, menus…) don't read <html dir>; without a provider they
 * stamp dir="ltr" on themselves and render LTR inside the Arabic UI. This feeds them the
 * active language's direction and re-renders when the language changes.
 */
export function AppDirection({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  return <Direction.Provider dir={i18n.dir()}>{children}</Direction.Provider>;
}
