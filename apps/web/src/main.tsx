import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { AppDirection } from '@/components/AppDirection';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './i18n';
import './index.css';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 4xx answers (forbidden, not found, validation) won't change on retry.
      retry: (count, error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        return !(status && status >= 400 && status < 500) && count < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppDirection>
        <AuthProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" />
          </TooltipProvider>
        </AuthProvider>
      </AppDirection>
    </QueryClientProvider>
  </StrictMode>,
);
