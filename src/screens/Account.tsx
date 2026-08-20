import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PHOTO, Screen } from '@/components/Screen';
import { buildExport, exportFileName } from '@/lib/export';
import { clearAll, exportAll } from '@/store/db';
import { clearStoredBlobs } from '@/store/blobs';
import { hasRemoteIdentity, purgeRemote } from '@/store/hydrate.ts';
import { signOut } from '@/supabase/session.ts';
import { getClient } from '@/store/account';
import { getPreferences, setLocale, type Locale } from '@/store/preferences';

/**
 * PDR 11.3: take your data, delete your data, choose your language.
 *
 * The delete is two steps and the second one is not styled as the easy path.
 * It also runs the IndexedDB sweep, because "delete my account" that leaves
 * blobs behind is the kind of promise that is only discovered to be false by
 * someone who trusted it.
 *
 * That sentence was written about blobs and was true about Postgres too, for
 * a while. `clearAll` empties the mirror and `localStorage` without going
 * through `write`, so it never reached the persister: the browser emptied,
 * every row stayed, and the next hydration brought all of it back. The rows
 * go first now, and nothing local is touched until they are gone.
 */

const LOCALES: [Locale, string][] = [
  ['es', 'Español'],
  ['en', 'English'],
];

export function Account() {
  const navigate = useNavigate();
  const client = getClient();
  const [locale, setStoredLocale] = useState<Locale>(() => getPreferences().locale);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const download = () => {
    const at = new Date().toISOString();
    const doc = buildExport(exportAll(), { exportedAt: at });
    const name = exportFileName(at);

    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);

    setExported(name);
  };

  const deleteEverything = async () => {
    setBusy(true);
    setFailed(false);

    // Postgres first, and nothing local until it answers. A browser emptied
    // against rows that survived is the worst of the three outcomes: it looks
    // done, it reads as done, and the next load contradicts it.
    try {
      await purgeRemote();
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }

    await clearStoredBlobs();
    // localStorage last: if the blob sweep throws, the record of what exists
    // is still there to try again with.
    clearAll();

    // The account is gone; the session that reaches it should not outlive it,
    // least of all on a phone somebody is handing back.
    await signOut().catch(() => {
      // Already unreachable, or never configured. Nothing is left to protect.
    });

    navigate('/', { replace: true });
  };

  const leave = async () => {
    setBusy(true);
    await signOut().catch(() => {});
    // Not `clearAll`: signing out is not deleting. What it must not leave is
    // one person's data on screen for whoever opens the app next, and the
    // mirror is what would do that, so the reload is the point.
    window.location.assign(import.meta.env.BASE_URL);
  };

  return (
    <Screen backdrop="palm" scrim="heavy" opacity={PHOTO.content40}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Mi cuenta</p>
        <h1 className="mb-6 text-[length:var(--fs-title-28)] leading-[var(--lh-heading-1_15)] text-blanco">
          Tus datos
          <br />
          son tuyos.
        </h1>

        <section className="glass mb-3 rounded-[var(--radius-option)] px-4 py-3.5">
          <p className="eyebrow mb-1.5">Estado</p>
          {client ? (
            <>
              <p className="text-[length:var(--fs-body-13)] leading-snug text-blanco">{client.email}</p>
              <p className="mt-1 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
                Cuenta simulada. No se envió ningún correo y no hay ningún servidor donde
                exista.
              </p>
            </>
          ) : (
            <>
              <p className="text-[length:var(--fs-body-13)] leading-snug text-blanco">Sin cuenta</p>
              <p className="mt-1 mb-2.5 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
                Todo lo tuyo vive en este navegador y caduca a los siete días.
              </p>
              <Link
                to="/registro"
                className="glass-chip inline-block rounded-full px-3 py-1.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/75 uppercase no-underline"
              >
                Guardar mi mapa
              </Link>
            </>
          )}
        </section>

        <section className="glass mb-3 rounded-[var(--radius-option)] px-4 py-3.5">
          <p className="eyebrow mb-1.5">Idioma</p>
          <div className="mb-2 flex gap-2">
            {LOCALES.map(([code, label]) => (
              <button
                key={code}
                type="button"
                aria-pressed={locale === code}
                onClick={() => setStoredLocale(setLocale(code).locale)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-[length:var(--fs-label-11)] tracking-wide uppercase transition-colors',
                  locale === code ? 'bg-verde text-crema' : 'glass-chip text-crema/60',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
            Queda guardada tu preferencia. La demo está escrita solo en español, así que la
            pantalla no cambia todavía.
          </p>
        </section>

        <section className="glass mb-3 rounded-[var(--radius-option)] px-4 py-3.5">
          <p className="eyebrow mb-1.5">Llevarte tus datos</p>
          <p className="mb-3 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
            Un archivo JSON con todo: tus respuestas, tu mapa, tus caminos, tus marcas de
            rutina. Bajarlo no borra nada.
          </p>
          <button
            type="button"
            onClick={download}
            className="glass-chip w-full rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/75 uppercase"
          >
            Descargar mis datos
          </button>
          {exported && (
            <p role="status" className="mt-2 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
              Descargado como {exported}.
            </p>
          )}
        </section>

        <section className="mb-3 rounded-[var(--radius-option)] border border-alerta/25 px-4 py-3.5">
          <p className="eyebrow mb-1.5">Borrar todo</p>
          <p className="mb-3 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
            Se va tu cuenta, tu mapa, tus caminos, tu rutina y cualquier archivo guardado. No
            hay copia en ningún lado, así que no se puede deshacer.
          </p>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full rounded-full border border-alerta/40 px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-alerta uppercase"
            >
              Borrar todo
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[length:var(--fs-body-12)] leading-relaxed text-crema/80">
                ¿Seguro? Después de esto no queda nada tuyo en este navegador.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteEverything()}
                // Solid, not 85%: dark text over the faded red measured 3.8:1,
                // under the 4.5 this 11px label needs.
                className="w-full rounded-full bg-alerta px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-negro uppercase disabled:opacity-50"
              >
                {busy ? 'Borrando' : 'Sí, borrar todo'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="glass-chip w-full rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/70 uppercase"
              >
                Mejor no
              </button>
              {failed && (
                <p
                  role="alert"
                  className="text-[length:var(--fs-body-11_5)] leading-relaxed text-alerta"
                >
                  No pudimos borrar lo que está guardado en tu cuenta, así que tampoco borramos
                  nada de este navegador. Sigue todo como estaba y podés volver a intentar.
                </p>
              )}
            </div>
          )}
        </section>

        {hasRemoteIdentity() && (
          <section className="mt-6">
            <button
              type="button"
              disabled={busy}
              onClick={() => void leave()}
              className="glass-chip w-full rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/70 uppercase disabled:opacity-50"
            >
              Cerrar sesión
            </button>
            <p className="mt-2 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
              Tus datos quedan en tu cuenta. Volvés a entrar con el mismo Google y está todo.
            </p>
          </section>
        )}
      </div>
    </Screen>
  );
}
