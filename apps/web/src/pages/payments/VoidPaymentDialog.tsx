import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSession } from '@/auth/context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { api, errorCode } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { toastError } from '@/lib/notify';
import { KINDS, type PartyKind } from './payment-kinds';

export interface VoidTarget {
  id: number;
  amount: string;
  partyName: string;
}

interface Props {
  payment: VoidTarget | undefined;
  /** Customer payments by default. */
  kind?: PartyKind;
  onClose: () => void;
}

/** Voids a customer or supplier payment with a reason (manager+; the API enforces it). The record is kept. */
export function VoidPaymentDialog({ payment, kind = 'customer', onClose }: Props) {
  const { t, i18n } = useTranslation('payments');
  const { tenant } = useSession();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);
  // The dialog keeps showing the last payment while it animates closed.
  const [shown, setShown] = useState(payment);
  // A newly opened payment starts with an empty reason (adjusted during render, no effect).
  if (payment && payment !== shown) {
    setShown(payment);
    setReason('');
    setError(false);
  }

  const refresh = () => {
    for (const key of KINDS[kind].invalidate) void qc.invalidateQueries({ queryKey: [key] });
  };

  const voidIt = useMutation({
    mutationFn: async (v: { id: number; reason: string }) => api.post(`${KINDS[kind].endpoint}/${v.id}/void`, { reason: v.reason }),
    onSuccess: () => {
      toast.success(t('void.done'));
      refresh();
      onClose();
    },
    onError: (e) => {
      toastError(e);
      if (errorCode(e) === 'ALREADY_VOIDED') {
        refresh();
        onClose();
      }
    },
  });

  const submit = () => {
    const r = reason.trim();
    if (r.length < 2 || r.length > 255 || !payment) {
      setError(true);
      return;
    }
    voidIt.mutate({ id: payment.id, reason: r });
  };

  return (
    <Dialog open={Boolean(payment)} onOpenChange={(o) => !o && !voidIt.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('void.title')}</DialogTitle>
          <DialogDescription>
            {shown ? t(`party.${kind}.voidBody`, { amount: formatMoney(shown.amount, tenant.currency, i18n.language), name: shown.partyName }) : null}
          </DialogDescription>
        </DialogHeader>
        <form
          id="void-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="void-reason">{t('void.reason')}</FieldLabel>
            <Textarea
              id="void-reason"
              rows={3}
              maxLength={255}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(false);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'void-reason-error' : undefined}
            />
            {error ? <FieldError id="void-reason-error">{t('validation.reason')}</FieldError> : null}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={voidIt.isPending}>
            {t('void.keep')}
          </Button>
          <Button type="submit" form="void-form" variant="destructive" disabled={voidIt.isPending}>
            {voidIt.isPending ? <Spinner /> : null}
            {t('void.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

