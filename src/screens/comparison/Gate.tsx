import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { CrisisScreen } from '@/screens/CrisisScreen';
import { activeHighSeverityEvent } from '@/store/crisis';
import { activeProfile } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';

/**
 * PDR 8.5 rule 6: while the person asking is in crisis, the comparison does
 * not run at all.
 *
 * The check sits in front of all three screens rather than in front of the
 * model call, because the feature being unavailable is the point — reaching
 * the consent screen and then being refused at the last step would be worse
 * than not offering it.
 */
export function ComparisonGate({ children }: { children: ReactNode }) {
  const profile = activeProfile();

  if (activeHighSeverityEvent()) {
    return <CrisisScreen country={profile?.draft.country} />;
  }

  if (!profile || !currentSynthesis()) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={0.45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Para comparar hace falta tu mapa primero. El de la otra persona lo cargás después.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  return <>{children}</>;
}
