import { Screen } from '@/components/Screen';
import { CrisisResourceList } from '@/components/CrisisResourceList';

/**
 * The full-screen takeover for high severity. PDR 6.4.
 *
 * What this screen deliberately does not do: interpret, symbolise, offer a
 * reading of the natal chart, suggest a modality, or upsell anything. PDR 1.6
 * — clinical safety before product, without a commercial fallback. It shows
 * containment and phone numbers, and gets out of the way.
 *
 * The copy here is a draft. PDR 14 lists "lenguaje del crisis_response
 * revisado por psicólogo" as a production blocker.
 */
export function CrisisScreen({
  country,
  message,
  onNotMyCase,
  onBack,
}: {
  country: string | undefined;
  /** Layer 2 supplies `crisis_response`; Layer 1 has no model text and uses
   *  the written fallback below. */
  message?: string;
  onNotMyCase?: () => void;
  onBack?: () => void;
}) {
  return (
    <Screen backdrop="palm" scrim="diagonal" opacity={0.5}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-6 pt-14 pb-9 sm:min-h-0">
        <div className="mb-6 flex items-center gap-2.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-alerta shadow-[0_0_8px_var(--natus-alerta)]" />
          <p className="eyebrow">Antes de seguir</p>
        </div>

        <h1 className="mb-5 text-[30px] text-blanco">
          Lo que estás
          <br />
          contando importa.
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-crema/75">
          {message ??
            'Por lo que escribiste, esto no es algo para atravesar solo y no es algo que un mapa simbólico pueda acompañar. Hay personas disponibles ahora mismo para hablar con vos.'}
        </p>

        <CrisisResourceList country={country} />

        <div className="mt-8 flex flex-col gap-3">
          {onBack && (
            <button type="button" className="cta" onClick={onBack}>
              Volver
            </button>
          )}

          {onNotMyCase && (
            /*
             * PDR 6.4. Discreet on purpose: it must exist, and it must not
             * read as an invitation to dismiss the screen. Without it,
             * someone who wrote "ya no aguanto este trabajo" is locked out of
             * the product with no way back.
             */
            <button
              type="button"
              onClick={onNotMyCase}
              className="self-center px-2 py-1 text-[11px] text-crema/40 underline underline-offset-4 hover:text-crema/70"
            >
              Esto no aplica a mi caso
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}
