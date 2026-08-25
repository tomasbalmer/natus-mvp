import type { CSSProperties, ReactNode } from 'react';

export type Backdrop = 'forest' | 'surf' | 'palm' | 'grass' | 'none';

const IMAGES: Record<Exclude<Backdrop, 'none'>, string> = {
  forest: 'forest.avif',
  surf: 'surf.avif',
  palm: 'palm.avif',
  grass: 'grass.avif',
};

/**
 * Legibility gradients, transcribed per-screen from the mockup. Each one is
 * tuned to where that screen puts its text: `bottom` keeps the top of the
 * photograph clear and crushes the base to near-black for a bottom-anchored
 * headline, `even` is for screens with content throughout.
 */
const SCRIMS = {
  bottom:
    'linear-gradient(to bottom, rgb(0 0 0/0.15) 0%, rgb(0 0 0/0.05) 25%, rgb(0 0 0/0.35) 55%, rgb(0 0 0/0.82) 78%, rgb(0 0 0/0.96) 100%)',
  even: 'linear-gradient(to bottom, rgb(0 0 0/0.55) 0%, rgb(0 0 0/0.45) 50%, rgb(0 0 0/0.78) 100%)',
  diagonal:
    'linear-gradient(160deg, rgb(0 0 0/0.72) 0%, rgb(0 0 0/0.60) 60%, rgb(0 0 0/0.80) 100%)',
  heavy:
    'linear-gradient(to bottom, rgb(0 0 0/0.45) 0%, rgb(0 0 0/0.35) 40%, rgb(0 0 0/0.75) 70%, rgb(0 0 0/0.94) 100%)',
} as const;

export type Scrim = keyof typeof SCRIMS;

/**
 * How much of the photograph shows through, per screen.
 *
 * Nine values for what are really three situations. `hero` is the two entry
 * screens, where the photograph is the screen. `veil` is the onboarding
 * sequence, where it recedes behind a question. `content` is everything
 * else — and that one carries five numbers across twenty-seven screens,
 * including a 0.42 sitting next to a 0.45 in two states of the same screen.
 *
 * Named at their transcribed values rather than normalised, for the same
 * reason as the type scale in `tokens.css`: naming the drift and deciding
 * what it should be are different jobs.
 */
export const PHOTO = {
  hero: 0.9,
  veil70: 0.7,
  veil60: 0.6,
  veil55: 0.55,
  content50: 0.5,
  content45: 0.45,
  content42: 0.42,
  content40: 0.4,
  content35: 0.35,
} as const;

type ScreenProps = {
  backdrop?: Backdrop;
  scrim?: Scrim;
  /** Background opacity, matching the per-screen values in the mockup. */
  opacity?: number;
  focus?: string;
  children: ReactNode;
};

/**
 * A full-bleed screen: photograph, legibility gradient, content.
 *
 * Image paths go through `import.meta.env.BASE_URL` so the app works both at
 * a domain root and under a `/natus-mvp/` subpath without a code change.
 */
export function Screen({
  backdrop = 'none',
  scrim = 'even',
  opacity = 0.85,
  focus = 'center',
  children,
}: ScreenProps) {
  const base = import.meta.env.BASE_URL;

  const photoStyle: CSSProperties | undefined =
    backdrop === 'none'
      ? undefined
      : {
          backgroundImage: `url(${base}img/${IMAGES[backdrop]})`,
          backgroundPosition: focus,
          opacity,
        };

  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden bg-black sm:min-h-0">
      {photoStyle && <div className="photo-layer" style={photoStyle} aria-hidden="true" />}
      <div className="photo-scrim" style={{ background: SCRIMS[scrim] }} aria-hidden="true" />
      <div className="relative flex h-full min-h-dvh flex-col sm:min-h-0">{children}</div>
    </div>
  );
}
