import { createContext, use } from 'react';
import type { Session } from './types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  businessName: string;
  name: string;
}

export interface AuthContextValue {
  status: 'loading' | 'anonymous' | 'authenticated';
  session: Session | null;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For pages rendered behind <RequireAuth>, where a session is guaranteed. */
export function useSession() {
  const { session } = useAuth();
  if (!session) throw new Error('useSession requires an authenticated session');
  return session;
}
