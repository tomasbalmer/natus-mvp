import { Link } from 'react-router-dom';
import { PHOTO, Screen } from '@/design/Screen';

/**
 * An unknown address used to render the Landing, so a mistyped or stale link
 * silently became the welcome screen. Saying so is the honest version.
 */
export function NotFound() {
  return (
    <Screen backdrop="forest" scrim="heavy" opacity={PHOTO.content45}>
      <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0 sm:flex-1">
        <h1 className="font-serif text-[length:var(--fs-voice-22)] leading-snug font-light text-blanco">
          Esta página no existe.
        </h1>
        <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">
          Puede que el enlace esté mal escrito o sea de una versión anterior.
        </p>
        <Link to="/" className="cta no-underline">
          Ir al inicio
        </Link>
      </div>
    </Screen>
  );
}
