import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/Alert';
import { useSession } from './context';
import type { Role } from './types';

/**
 * Hides a page from roles the API would refuse (e.g. STAFF on suppliers) and explains why,
 * instead of rendering a page whose requests all fail with 403. The API stays the authority.
 */
export function RoleGate({ allow, children }: { allow: (role: Role) => boolean; children: ReactNode }) {
  const { user } = useSession();
  const { t } = useTranslation('errors');
  return allow(user.role) ? children : <Alert>{t('FORBIDDEN')}</Alert>;
}
