import { toast } from 'sonner';
import i18n from '@/i18n';
import { errorCode } from './api';

/** Shows a translated toast for any API/network error. */
export function toastError(error: unknown) {
  const code = errorCode(error);
  toast.error(i18n.t(code as 'INTERNAL_ERROR', { ns: 'errors', defaultValue: i18n.t('INTERNAL_ERROR', { ns: 'errors' }) }));
}
