import { supabase } from './client.ts';

export type ErrorKind = 'render' | 'error' | 'rejection';

const MAX_PER_PAGE = 5;
let sent = 0;

export function reportError(kind: ErrorKind, error: unknown): void {
  if (!supabase || sent >= MAX_PER_PAGE) return;
  sent += 1;

  const client = supabase;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  void client.auth
    .getSession()
    .then(({ data }) => {
      if (!data.session) return;
      return client.functions.invoke('report-error', {
        body: {
          kind,
          message,
          stack,
          path: window.location.pathname,
          release: import.meta.env['VITE_RELEASE'],
        },
      });
    })
    .catch(() => {});
}

export function installErrorReporting(): void {
  window.addEventListener('error', (event) => reportError('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError('rejection', event.reason));
}
