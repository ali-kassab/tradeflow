import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { PaymentStatus, SalesOrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

// Colour follows meaning: drafts are quiet, billed orders use the ledger green,
// cancelled ones fade out. Amber is kept for money still owed.
const STATUS_CLASS: Record<SalesOrderStatus, string> = {
  DRAFT: 'border-border text-muted-foreground bg-transparent',
  CONFIRMED: 'bg-primary/10 text-primary border-transparent',
  DELIVERED: 'bg-primary text-primary-foreground border-transparent',
  CANCELLED: 'bg-muted text-muted-foreground border-transparent line-through',
};

export function OrderStatusBadge({ status, className }: { status: SalesOrderStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], className)}>
      {t(`orderStatus.${status}`)}
    </Badge>
  );
}

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  NOT_BILLED: 'text-muted-foreground',
  UNPAID: 'text-warning-foreground font-medium',
  PARTIAL: 'text-warning-foreground',
  PAID: 'text-primary',
};

export function PaymentStatusText({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('salesOrders');
  return <span className={cn('text-sm', PAYMENT_CLASS[status])}>{t(`paymentStatus.${status}`)}</span>;
}
