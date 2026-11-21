import { type ReactNode, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { RoleGate } from '@/auth/RoleGate';
import { useAuth } from '@/auth/context';
import { isManagerOrAbove } from '@/auth/types';
import { RouteError } from '@/components/RouteError';
import { Spinner } from '@/components/ui/spinner';
import { AppLayout } from '@/layout/AppLayout';

// Route-level code splitting: each page is its own chunk (recharts only loads with the dashboard).
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const CategoriesPage = lazy(() => import('@/pages/products/CategoriesPage'));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage'));
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@/pages/customers/CustomerDetailPage'));
const SalesOrdersPage = lazy(() => import('@/pages/sales-orders/SalesOrdersPage'));
const SalesOrderDetailPage = lazy(() => import('@/pages/sales-orders/SalesOrderDetailPage'));
const SalesOrderEditorPage = lazy(() => import('@/pages/sales-orders/SalesOrderEditorPage'));
const PaymentsPage = lazy(() => import('@/pages/payments/PaymentsPage'));
const SuppliersPage = lazy(() => import('@/pages/suppliers/SuppliersPage'));
const SupplierDetailPage = lazy(() => import('@/pages/suppliers/SupplierDetailPage'));
const PurchaseOrdersPage = lazy(() => import('@/pages/purchase-orders/PurchaseOrdersPage'));
const PurchaseOrderDetailPage = lazy(() => import('@/pages/purchase-orders/PurchaseOrderDetailPage'));
const PurchaseOrderEditorPage = lazy(() => import('@/pages/purchase-orders/PurchaseOrderEditorPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <Spinner className="size-6" />
      <span className="sr-only">{t('status.loading')}</span>
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;
}

/** Pages the API only serves to managers and owners. */
function Manager({ children }: { children: ReactNode }) {
  return (
    <RoleGate allow={isManagerOrAbove}>
      <Page>{children}</Page>
    </RoleGate>
  );
}

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}

function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <Page><LoginPage /></Page> },
      { path: '/register', element: <Page><RegisterPage /></Page> },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Page><DashboardPage /></Page> },
      { path: '/products', element: <Page><ProductsPage /></Page> },
      { path: '/categories', element: <Page><CategoriesPage /></Page> },
      { path: '/inventory', element: <Page><InventoryPage /></Page> },
      { path: '/customers', element: <Page><CustomersPage /></Page> },
      { path: '/customers/:id', element: <Page><CustomerDetailPage /></Page> },
      { path: '/sales-orders', element: <Page><SalesOrdersPage /></Page> },
      { path: '/sales-orders/new', element: <Page><SalesOrderEditorPage /></Page> },
      { path: '/sales-orders/:id', element: <Page><SalesOrderDetailPage /></Page> },
      { path: '/sales-orders/:id/edit', element: <Page><SalesOrderEditorPage /></Page> },
      { path: '/payments', element: <Page><PaymentsPage /></Page> },
      { path: '/suppliers', element: <Manager><SuppliersPage /></Manager> },
      { path: '/suppliers/:id', element: <Manager><SupplierDetailPage /></Manager> },
      { path: '/purchase-orders', element: <Manager><PurchaseOrdersPage /></Manager> },
      { path: '/purchase-orders/new', element: <Manager><PurchaseOrderEditorPage /></Manager> },
      { path: '/purchase-orders/:id', element: <Manager><PurchaseOrderDetailPage /></Manager> },
      { path: '/purchase-orders/:id/edit', element: <Manager><PurchaseOrderEditorPage /></Manager> },
      { path: '*', element: <Page><NotFoundPage /></Page> },
    ],
  },
]);
