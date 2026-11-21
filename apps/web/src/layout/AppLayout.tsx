import { BanknoteIcon, BoxesIcon, ClipboardListIcon, HandCoinsIcon, LayoutDashboardIcon, LogOutIcon, type LucideIcon, PackageIcon, ReceiptIcon, TagsIcon, TruckIcon, UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useMatch, useResolvedPath } from 'react-router';
import { useAuth, useSession } from '@/auth/context';
import { type Role, isManagerOrAbove } from '@/auth/types';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// Only pages that exist are listed. `allow` hides entries the API would refuse for the role.
interface NavEntry {
  to: string;
  end: boolean;
  icon: LucideIcon;
  label: 'nav.dashboard' | 'nav.products' | 'nav.categories' | 'nav.inventory' | 'nav.customers' | 'nav.salesOrders' | 'nav.payments' | 'nav.suppliers' | 'nav.purchaseOrders' | 'nav.supplierPayments' | 'nav.reports' | 'nav.settings' | 'nav.users';
  allow?: (role: Role) => boolean;
}

const NAV: NavEntry[] = [
  { to: '/', end: true, icon: LayoutDashboardIcon, label: 'nav.dashboard' },
  { to: '/products', end: false, icon: PackageIcon, label: 'nav.products' },
  { to: '/categories', end: false, icon: TagsIcon, label: 'nav.categories' },
  { to: '/inventory', end: false, icon: BoxesIcon, label: 'nav.inventory' },
  { to: '/customers', end: false, icon: UsersIcon, label: 'nav.customers' },
  { to: '/sales-orders', end: false, icon: ReceiptIcon, label: 'nav.salesOrders' },
  { to: '/payments', end: false, icon: BanknoteIcon, label: 'nav.payments' },
  { to: '/suppliers', end: false, icon: TruckIcon, label: 'nav.suppliers', allow: isManagerOrAbove },
  { to: '/purchase-orders', end: false, icon: ClipboardListIcon, label: 'nav.purchaseOrders', allow: isManagerOrAbove },
  { to: '/supplier-payments', end: false, icon: HandCoinsIcon, label: 'nav.supplierPayments', allow: isManagerOrAbove },
];

function NavItem({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  const match = useMatch({ path: useResolvedPath(to).pathname, end: end ?? false });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={Boolean(match)}>
        <NavLink to={to} end={end}>
          {children}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { user, tenant } = useSession();
  const side = i18n.dir() === 'rtl' ? 'right' : 'left';

  return (
    <SidebarProvider>
      <Sidebar side={side} collapsible="offcanvas">
        <SidebarHeader className="px-4 pt-5 pb-3">
          <Logo className="text-sidebar-accent-foreground" />
          <p className="text-sidebar-foreground/70 mt-1 truncate text-sm">{tenant.name}</p>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <nav aria-label={t('nav.main')}>
                <SidebarMenu>
                  {NAV.filter((item) => !item.allow || item.allow(user.role)).map((item) => (
                    <NavItem key={item.to} to={item.to} end={item.end}>
                      <item.icon aria-hidden="true" />
                      <span>{t(item.label)}</span>
                    </NavItem>
                  ))}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t p-4">
          <div className="min-w-0">
            <p className="text-sidebar-accent-foreground truncate text-sm font-medium">{user.name}</p>
            <p className="text-sidebar-foreground/70 truncate text-xs">{t(`roles.${user.role}`)}</p>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="bg-background/90 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger aria-label={t('actions.toggleSidebar')} />
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitch />
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOutIcon aria-hidden="true" className="rtl:-scale-x-100" />
              {t('actions.signOut')}
            </Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
