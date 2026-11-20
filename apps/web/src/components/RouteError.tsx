import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

const RELOAD_KEY = 'tf.chunkReloadAt';
const RETRY_WINDOW_MS = 30_000;

/** A lazy page chunk failed to download: stale deploy, or Vite re-optimising deps in dev. */
function isChunkLoadError(error: unknown) {
  return (
    error instanceof TypeError &&
    /dynamically imported module|Importing a module script failed/i.test(error.message)
  );
}

/** Reload at most once per window, so a persistent failure shows the message instead of looping. */
function shouldAutoReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RETRY_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Route-level error screen: one automatic reload for stale chunks, otherwise a recoverable message. */
export function RouteError() {
  const error = useRouteError();
  const { t } = useTranslation();
  const chunk = isChunkLoadError(error);

  useEffect(() => {
    if (chunk && shouldAutoReload()) window.location.reload();
  }, [chunk]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4" role="alert">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">{t('routeError.title')}</h1>
        <p className="text-muted-foreground mt-2">{t(chunk ? 'routeError.chunk' : 'routeError.body')}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>{t('routeError.reload')}</Button>
          <Button variant="outline" asChild>
            <Link to="/">{t('notFound.back')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
