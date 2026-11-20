/** Response shapes of the TradeFlow API (see apps/api). Money is a decimal string. */

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface Category {
  id: number;
  name: string;
  productCount: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  categoryId: number | null;
  category: { id: number; name: string } | null;
  /** Absent for STAFF: the API strips cost data. */
  costPrice?: string;
  salePrice: string;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
  isLowStock: boolean;
}

export type StockMovementType = 'OPENING' | 'SALE' | 'SALE_CANCEL' | 'PURCHASE_RECEIPT' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  productId: number;
  type: StockMovementType;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  balanceAfter: number;
  refType: string | null;
  refId: number | null;
  note: string | null;
  userId: number;
  createdAt: string;
  product: { id: number; name: string; sku: string; unit: string };
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  /** A warning threshold only; the API never blocks orders on it. */
  creditLimit: string | null;
  notes: string | null;
  isActive: boolean;
  /** Σ billed orders − Σ non-voided payments. Negative means customer credit. */
  balance: string;
}

export interface CustomerDetail extends Customer {
  totalBilled: string;
  totalPaid: string;
}

export interface CustomerPrice {
  id: number;
  productId: number;
  price: string;
  product: { id: number; name: string; sku: string; salePrice: string };
}

export type StatementEntryType = 'ORDER_CONFIRMED' | 'ORDER_CANCELLED' | 'PURCHASE_RECEIVED' | 'PAYMENT' | 'PAYMENT_VOIDED';

export interface StatementEntry {
  date: string;
  type: StatementEntryType;
  reference: string;
  refId: number;
  debit: string;
  credit: string;
  /** Running balance after this entry. */
  balance: string;
}

export interface Statement {
  entries: StatementEntry[];
  balance: string;
}

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'NOT_BILLED' | 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

interface OrderPaymentSummary {
  paidAmount: string;
  /** Zero unless the order is billed (CONFIRMED/DELIVERED). */
  outstanding: string;
  paymentStatus: PaymentStatus;
}

interface OrderMoney {
  subtotal: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  total: string;
}

export interface SalesOrderListItem extends OrderMoney, OrderPaymentSummary {
  id: number;
  number: string;
  customerId: number;
  customer: { id: number; name: string };
  status: SalesOrderStatus;
  orderDate: string;
  itemCount: number;
}

export interface SalesOrderItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  /** Cost snapshot at confirmation; absent for STAFF. */
  unitCost?: string;
}

export interface CustomerPayment {
  id: number;
  customerId: number;
  salesOrderId: number | null;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface SalesOrder extends OrderMoney, OrderPaymentSummary {
  id: number;
  number: string;
  customerId: number;
  customer: { id: number; name: string; phone: string | null; address: string | null; taxNumber: string | null; creditLimit: string | null };
  status: SalesOrderStatus;
  orderDate: string;
  notes: string | null;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: SalesOrderItem[];
  payments: CustomerPayment[];
}
