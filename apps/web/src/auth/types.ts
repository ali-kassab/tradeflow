export type Role = 'OWNER' | 'MANAGER' | 'STAFF';

export interface SessionUser {
  id: number;
  tenantId: number;
  role: Role;
  name: string;
  email: string;
}

export interface SessionTenant {
  id: number;
  name: string;
  currency: string;
  defaultTaxRate: string;
}

export interface Session {
  user: SessionUser;
  tenant: SessionTenant;
}

/** UI mirror of the API's `canSeeCosts` / `ManagerOrAbove`; the API remains the authority. */
export const isManagerOrAbove = (role: Role) => role === 'OWNER' || role === 'MANAGER';
export const isOwner = (role: Role) => role === 'OWNER';
