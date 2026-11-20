import axios, { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorCode, refreshAccessToken } from './api';

function axiosError(status?: number, data?: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    'x',
    undefined,
    config,
    null,
    status ? { status, data, statusText: '', headers: {}, config } : undefined,
  );
}

describe('errorCode', () => {
  it('returns the API error code', () => {
    expect(errorCode(axiosError(409, { code: 'EMAIL_TAKEN' }))).toBe('EMAIL_TAKEN');
  });
  it('reports network failures', () => {
    expect(errorCode(axiosError())).toBe('NETWORK');
  });
  it('falls back for unknown errors', () => {
    expect(errorCode(new Error('boom'))).toBe('INTERNAL_ERROR');
  });
});

describe('refreshAccessToken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shares one in-flight refresh between concurrent callers', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'tok' } });
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe('tok');
    expect(b).toBe('tok');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('resolves null when the refresh cookie is rejected', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(axiosError(401));
    await expect(refreshAccessToken()).resolves.toBeNull();
  });
});
