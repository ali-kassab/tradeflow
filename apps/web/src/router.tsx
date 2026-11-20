import { type ReactNode, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { useAuth } from '@/auth/context';
import { RouteError } from '@/components/RouteError';
import { Spinner } from '@/components/ui/spinner';
import { AppLayout } from '@/layout/AppLayout';

// Route-level code splitting: each page is its own chunk (recharts only loads with the dashboard).
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const CategoriesPage = lazy(() => import('@/pages/products/CategoriesPage'));
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
      { path: '*', element: <Page><NotFoundPage /></Page> },
    ],
  },
]);
