import {
  BanknoteIcon,
  BoxesIcon,
  ChartColumnIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  HandCoinsIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  TagsIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useMatch, useResolvedPath } from 'react-router';
import { useAuth, useSession } from '@/auth/context';
import { type Role, isManagerOrAbove, isOwner } from '@/auth/types';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

interface NavGroup {
  label?: 'nav.groups.sales' | 'nav.groups.stock' | 'nav.groups.purchasing' | 'nav.groups.business';
  items: NavEntry[];
}

// Grouped by the job each screen belongs to; routes and role rules are unchanged.
const NAV: NavGroup[] = [
  { items: [{ to: '/', end: true, icon: LayoutDashboardIcon, label: 'nav.dashboard' }] },
  {
    label: 'nav.groups.sales',
    items: [
      { to: '/customers', end: false, icon: UsersIcon, label: 'nav.customers' },
      { to: '/sales-orders', end: false, icon: ReceiptIcon, label: 'nav.salesOrders' },
      { to: '/payments', end: false, icon: BanknoteIcon, label: 'nav.payments' },
    ],
  },
  {
    label: 'nav.groups.stock',
    items: [
      { to: '/products', end: false, icon: PackageIcon, label: 'nav.products' },
      { to: '/categories', end: false, icon: TagsIcon, label: 'nav.categories' },
      { to: '/inventory', end: false, icon: BoxesIcon, label: 'nav.inventory' },
    ],
  },
  {
    label: 'nav.groups.purchasing',
    items: [
      { to: '/suppliers', end: false, icon: TruckIcon, label: 'nav.suppliers', allow: isManagerOrAbove },
      { to: '/purchase-orders', end: false, icon: ClipboardListIcon, label: 'nav.purchaseOrders', allow: isManagerOrAbove },
      { to: '/supplier-payments', end: false, icon: HandCoinsIcon, label: 'nav.supplierPayments', allow: isManagerOrAbove },
    ],
  },
  {
    label: 'nav.groups.business',
    items: [
      { to: '/reports', end: false, icon: ChartColumnIcon, label: 'nav.reports', allow: isManagerOrAbove },
      { to: '/users', end: false, icon: UserCogIcon, label: 'nav.users', allow: isOwner },
      { to: '/settings', end: false, icon: SettingsIcon, label: 'nav.settings' },
    ],
  },
];

function NavItem({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  const match = useMatch({ path: useResolvedPath(to).pathname, end: end ?? false });
  const active = Boolean(match);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="relative h-9 gap-2.5 px-2.5 data-active:bg-card data-active:shadow-panel [&_svg]:opacity-80 data-active:[&_svg]:text-primary data-active:[&_svg]:opacity-100">
        <NavLink to={to} end={end}>
          {/* The amber column rule from the logo marks where you are. */}
          {active ? <span aria-hidden="true" className="bg-rule absolute inset-y-2 start-0 w-0.5 rounded-full" /> : null}
          {children}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join('');
}

function AccountMenu() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { user } = useSession();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent h-12 gap-3" aria-label={t('account.menu')}>
          <span aria-hidden="true" className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
            {initials(user.name)}
          </span>
          <span className="grid min-w-0 flex-1 text-start leading-tight">
            <span className="text-sidebar-accent-foreground truncate text-sm font-medium">{user.name}</span>
            <span className="text-muted-foreground truncate text-xs">{t(`roles.${user.role}`)}</span>
          </span>
          <ChevronsUpDownIcon aria-hidden="true" className="text-muted-foreground size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuLabel className="grid font-normal">
          <span className="text-foreground truncate font-medium">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs" dir="ltr">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <SettingsIcon aria-hidden="true" />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon aria-hidden="true" className="rtl:-scale-x-100" />
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, tenant } = useSession();
  const side = i18n.dir() === 'rtl' ? 'right' : 'left';

  return (
    <SidebarProvider>
      <Sidebar side={side} variant="inset" collapsible="offcanvas">
        <SidebarHeader className="gap-0.5 px-4 pt-4 pb-2">
          <Logo className="text-foreground" />
          <p className="text-muted-foreground truncate text-xs">{tenant.name}</p>
        </SidebarHeader>
        <SidebarContent className="gap-0">
          <nav aria-label={t('nav.main')}>
            {NAV.map((group, gi) => {
              const items = group.items.filter((item) => !item.allow || item.allow(user.role));
              if (items.length === 0) return null;
              return (
                <SidebarGroup key={group.label ?? gi} className="py-1.5">
                  {group.label ? <SidebarGroupLabel className="text-muted-foreground h-7 font-medium">{t(group.label)}</SidebarGroupLabel> : null}
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {items.map((item) => (
                        <NavItem key={item.to} to={item.to} end={item.end}>
                          <item.icon aria-hidden="true" />
                          <span>{t(item.label)}</span>
                        </NavItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </nav>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <AccountMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="md:border-border min-w-0 md:border">
        <header className="bg-background/85 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-5 md:rounded-t-xl">
          <SidebarTrigger aria-label={t('actions.toggleSidebar')} className="text-muted-foreground" />
          <Logo className="text-base md:hidden" />
          <div className="ms-auto flex items-center gap-0.5">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
