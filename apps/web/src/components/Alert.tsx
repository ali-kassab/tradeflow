import { CircleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Inline error banner, announced to screen readers. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
