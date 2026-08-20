import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CrisisResourceList } from '@/components/CrisisResourceList';
import { activeHighSeverityEvent } from '@/store/crisis';
import { activeProfile } from '@/store/account';

/**
 * The last thing between a render error and a blank screen.
 *
 * A white page is the worst failure this product has. Everything else degrades
 * on purpose — no backend falls back to fixtures, no model key answers
 * `no_model`, a dropped write says so and keeps going — and then one thrown
 * error in one component undoes all of it and leaves nothing at all. On a
 * prototype that asks about suicidal ideation and prints phone numbers, that
 * is not an equivalent failure to any other.
 *
 * **The fallback consults the crisis state before deciding what to show.**
 * If the person is inside an active high-severity event, the numbers are the
 * whole point of the screen they were on, and a calm "something broke" that
 * takes them away from those numbers is the one version of this that must not
 * ship. Every read below is wrapped, because the store is a plausible source
 * of the error being caught and a fallback that throws is not a fallback.
 *
 * Deliberately independent of `PhoneFrame` and `Screen`. Either of those may
 * be what failed, and this renders above them at the root.
 */

type Props = {
  children: ReactNode;
  /** Marks the root boundary, which has no shell left to return to. */
  atRoot?: boolean;
};

type State = { error: Error | null };

/** Whatever the crisis store can still tell us, or nothing. Never throws. */
function crisisContext(): { active: boolean; country: string | undefined } {
  try {
    const active = activeHighSeverityEvent() !== undefined;
    let country: string | undefined;
    try {
      country = activeProfile()?.draft.country;
    } catch {
      // A broken profile does not cost the numbers: `resourcesForCountry`
      // answers an undefined country with the international fallback.
    }
    return { active, country };
  } catch {
    return { active: false, country: undefined };
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // There is no error reporting service wired up. The console is the whole
    // of the observability story, and saying so beats implying otherwise.
    console.error('[natus] render error', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { active, country } = crisisContext();

    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col justify-center gap-6 bg-fondo px-6 py-10"
      >
        {active ? (
          <>
            <div>
              <div className="mb-5 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-alerta shadow-[0_0_8px_var(--natus-alerta)]"
                />
                <p className="eyebrow">Antes de seguir</p>
              </div>
              <h1 className="mb-4 text-[length:var(--fs-title-26)] leading-[var(--lh-heading-1_18)] text-blanco">
                Se rompió la pantalla, no lo que te está pasando.
              </h1>
              <p className="text-[length:var(--fs-body-13)] leading-relaxed text-crema/75">
                Hay personas disponibles ahora mismo para hablar con vos.
              </p>
            </div>
            <CrisisResourceList country={country} />
          </>
        ) : (
          <div>
            <p className="eyebrow mb-4">Algo salió mal</p>
            <h1 className="mb-4 text-[length:var(--fs-title-26)] leading-[var(--lh-heading-1_18)] text-blanco">
              Se rompió algo de este lado.
            </h1>
            <p className="text-[length:var(--fs-body-13)] leading-relaxed text-crema/70">
              Es un problema nuestro, no algo que hayas hecho mal. Lo que ya
              habías guardado sigue guardado.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {/* A full reload rather than a state reset: the root boundary caught
              something in the shell, and re-rendering the same shell would
              land on the same error. */}
          <button
            type="button"
            className="cta"
            onClick={this.props.atRoot ? reload : this.reset}
          >
            Volver a intentar
          </button>
          {!this.props.atRoot && (
            <a
              href={import.meta.env.BASE_URL}
              className="self-center text-[length:var(--fs-label-10_5)] tracking-wide text-crema/55 no-underline uppercase"
            >
              Ir al inicio
            </a>
          )}
        </div>

        {import.meta.env.DEV && (
          <pre className="overflow-x-auto text-[length:var(--fs-micro-9)] leading-relaxed text-crema/55">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}

function reload(): void {
  window.location.reload();
}
