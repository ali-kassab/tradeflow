import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/** Error body produced by the API's global exception filter. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * The access token lives only in memory (never localStorage), so an XSS payload
 * can't read a persisted token. The refresh token is an httpOnly cookie the
 * browser sends to /api/auth/* on its own.
 */
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh call. That matters
// because refresh tokens rotate and replaying a rotated one revokes the whole family.
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= axios
    .post<{ accessToken: string }>('/api/auth/refresh', null, { withCredentials: true })
    .then((r) => {
      setAccessToken(r.data.accessToken);
      return r.data.accessToken;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const isAuthCall = NO_REFRESH.some((p) => config?.url?.endsWith(p));
  if (error.response?.status !== 401 || !config || config._retried || isAuthCall) {
    throw error;
  }
  config._retried = true;
  const token = await refreshAccessToken();
  if (!token) {
    onSessionExpired?.();
    throw error;
  }
  return api(config);
});

/** Maps any thrown value to a stable code that the `errors` namespace can translate. */
export function errorCode(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'NETWORK';
    return error.response.data?.code ?? 'INTERNAL_ERROR';
  }
  return 'INTERNAL_ERROR';
}
