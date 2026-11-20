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
