/**
 * Domain enums. SQL Server has no native enum type, so these columns are NVARCHAR in
 * the database, restricted to exactly these values by CHECK constraints in the
 * migration. Keep both in sync: `enums.spec.ts` asserts the migration lists every value.
 *
 * Each is a const object plus a same-named union type, so call sites read the same
 * as they did with Prisma-generated enums (`SalesOrderStatus.CONFIRMED`).
 */
const values = <const T extends string>(...v: T[]) =>
  Object.freeze(Object.fromEntries(v.map((x) => [x, x])) as { [K in T]: K });

export const Role = values('OWNER', 'MANAGER', 'STAFF');
export type Role = (typeof Role)[keyof typeof Role];

export const StockMovementType = values('OPENING', 'SALE', 'SALE_CANCEL', 'PURCHASE_RECEIPT', 'ADJUSTMENT');
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const SalesOrderStatus = values('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED');
export type SalesOrderStatus = (typeof SalesOrderStatus)[keyof typeof SalesOrderStatus];

export const PurchaseOrderStatus = values('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PaymentMethod = values('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const DocumentType = values('SALES_ORDER', 'PURCHASE_ORDER');
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/** Every enum with its database column(s), used by the migration consistency test. */
export const ENUM_COLUMNS = {
  'User.role': Role,
  'StockMovement.type': StockMovementType,
  'SalesOrder.status': SalesOrderStatus,
  'PurchaseOrder.status': PurchaseOrderStatus,
  'CustomerPayment.method': PaymentMethod,
  'SupplierPayment.method': PaymentMethod,
  'DocumentSequence.docType': DocumentType,
} as const;
