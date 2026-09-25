import { useEffect, useState } from 'react';
import { setWriteFailureHandler, type WriteFailure } from '@/store/hydrate.ts';

/**
 * When a write does not reach Postgres, say so.
 *
 * `store/db.ts` swallows a `localStorage` quota error deliberately — the demo
 * should degrade rather than break in front of whoever is watching. A dropped
 * network write is a different thing: the
 * person believes their answers were saved, and they are sitting in one
 * browser tab that will forget them.
 *
 * Deliberately not a retry button. The write already succeeded locally and the
 * next change to the same namespace sends the whole value again, so retrying
 * by hand would duplicate work the store does anyway. What is missing is not a
 * mechanism, it is the person knowing.
 */
export function SaveFailureNotice({ offline = false }: { offline?: boolean }) {
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [offlineSeen, setOfflineSeen] = useState(false);

  useEffect(() => {
    setWriteFailureHandler(setFailure);
  }, []);

  if (offline && !offlineSeen) {
    return (
      <div
        role="alert"
        className="surface surface-p10 px-3.5 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema"
      >
        <p>
          No pudimos conectar con tu cuenta. Lo que hagas ahora queda solo en este navegador y no se
          guarda.
        </p>
        <button
          type="button"
          className="mt-1.5 text-[length:var(--fs-label-10_5)] tracking-wide text-crema/60 uppercase underline"
          onClick={() => setOfflineSeen(true)}
        >
          Entendido
        </button>
      </div>
    );
  }

  if (!failure) return null;

  return (
    <div
      role="alert"
      className="surface surface-p10 px-3.5 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema"
    >
      <p>
        No pudimos guardar lo último en tu cuenta. Sigue acá en este navegador, pero si lo cerrás
        se pierde.
      </p>
      <button
        type="button"
        className="mt-1.5 text-[length:var(--fs-label-10_5)] tracking-wide text-crema/60 uppercase underline"
        onClick={() => setFailure(null)}
      >
        Entendido
      </button>
    </div>
  );
}
