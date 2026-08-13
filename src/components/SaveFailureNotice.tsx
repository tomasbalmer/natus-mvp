import { useEffect, useState } from 'react';
import { setWriteFailureHandler, type WriteFailure } from '@/store/hydrate.ts';

/**
 * When a write does not reach Postgres, say so.
 *
 * `store/db.ts` swallows a `localStorage` quota error deliberately — the demo
 * should degrade rather than break in front of whoever is watching. A dropped
 * network write is a different thing and `DECISIONS.md` §12 says so: the
 * person believes their answers were saved, and they are sitting in one
 * browser tab that will forget them.
 *
 * Deliberately not a retry button. The write already succeeded locally and the
 * next change to the same namespace sends the whole value again, so retrying
 * by hand would duplicate work the store does anyway. What is missing is not a
 * mechanism, it is the person knowing.
 */
export function SaveFailureNotice() {
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  useEffect(() => {
    setWriteFailureHandler(setFailure);
  }, []);

  if (!failure) return null;

  return (
    <div
      role="alert"
      className="glass rounded-[var(--radius-option)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-crema"
    >
      <p>
        No pudimos guardar lo último en tu cuenta. Sigue acá en este navegador, pero si lo cerrás
        se pierde.
      </p>
      <button
        type="button"
        className="mt-1.5 text-[10.5px] tracking-wide text-crema/60 uppercase underline"
        onClick={() => setFailure(null)}
      >
        Entendido
      </button>
    </div>
  );
}
