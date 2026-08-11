import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { CrisisBanner } from '@/components/CrisisBanner';
import { CrisisScreen } from '@/screens/CrisisScreen';
import { activeProfile, isSignedIn } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import { currentMatchFor, isCheckedToday, savedSlugs } from '@/store/matches';
import { remainingQuestions } from '@/store/chat';
import { activeHighSeverityEvent, hasRecentLowSeverity } from '@/store/crisis';

/**
 * The signed-in home of PDR 11.1.
 *
 * Seven sections, one per destination the journey has: the map, the paths, the
 * routine, the conversation, the meditations, the chart comparison, and the
 * account. The greeting is chrome rather than a section — it says where the
 * person is, not where they can go.
 *
 * _Note on provenance: PDR 11.1 names the dashboard's sections and that part
 * of the document was not to hand when this was written. The seven here are
 * derived from the product's own surfaces, which is the same list from the
 * other direction. If the PDR's ordering differs, this array is the only thing
 * to change._
 *
 * What is deliberately absent, per PDR 12.2: any streak, badge, completion
 * percentage, or "hace 3 días que no entrás". The only number on this screen
 * is how many practices are marked today, which resets every day by design and
 * cannot be lost.
 */

type Section = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Null while the surface has not been built in this demo. */
  to: string | null;
};

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function Dashboard() {
  const profile = activeProfile();
  const synthesis = currentSynthesis();
  const match = synthesis ? currentMatchFor(synthesis.id) : undefined;

  // A high-severity event takes the whole screen, exactly as it does in
  // onboarding. PDR 1.6: clinical safety before product, with no commercial
  // fallback — so no "meanwhile, here are your recommendations".
  if (activeHighSeverityEvent()) {
    return <CrisisScreen country={profile?.draft.country} />;
  }

  if (!profile || !synthesis) {
    return (
      <Screen backdrop="forest" scrim="heavy" opacity={0.45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Tu espacio se arma con tu mapa. Empecemos por ahí.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  const saved = savedSlugs().length;
  const chatRemaining = remainingQuestions();
  const practices = match?.result.routine ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = practices.filter((p) => isCheckedToday(p.title, today)).length;

  const sections: Section[] = [
    {
      key: 'mapa',
      eyebrow: 'Tu mapa del alma',
      title: 'Lo que vemos en lo que contaste',
      body: synthesis.synthesis.soul_map_synthesis.que_necesitas_ahora,
      to: '/mapa',
    },
    {
      key: 'caminos',
      eyebrow: 'Caminos posibles',
      title: match
        ? `${match.result.matched_modalities.length} terapias, ordenadas`
        : 'Todavía sin generar',
      body:
        saved > 0
          ? `Guardaste ${saved} ${saved === 1 ? 'camino' : 'caminos'} para volver a mirarlos.`
          : 'Ordenadas por lo que contaste, no puntuadas. Ninguna es la respuesta correcta.',
      to: '/recomendaciones',
    },
    {
      key: 'rutina',
      eyebrow: 'Tu rutina',
      title:
        practices.length === 0
          ? 'Sale de tus caminos'
          : `${doneToday} de ${practices.length} marcadas hoy`,
      body: 'Cosas concretas para probar. Si dejás de marcar, no pasa nada.',
      to: '/rutina',
    },
    {
      key: 'chat',
      eyebrow: 'Conversación',
      title: 'Preguntarle algo a tu mapa',
      body: chatRemaining > 0
        ? `Te quedan ${chatRemaining} ${chatRemaining === 1 ? 'pregunta' : 'preguntas'} incluidas.`
        : 'Usaste las preguntas incluidas. Tu mapa y tus caminos siguen disponibles.',
      to: '/chat',
    },
    {
      key: 'meditaciones',
      eyebrow: 'Meditaciones',
      title: 'Una práctica guiada, hecha para vos',
      body: 'Todavía no está en esta demo.',
      to: null,
    },
    {
      key: 'comparacion',
      eyebrow: 'Comparar cartas',
      title: 'Mirar un vínculo desde los dos lados',
      body: 'Todavía no está en esta demo.',
      to: null,
    },
    {
      key: 'cuenta',
      eyebrow: 'Mi cuenta',
      title: 'Tus datos, y cómo llevártelos',
      body: 'Descargar todo lo que hay guardado, o borrarlo entero.',
      to: '/cuenta',
    },
  ];

  const name = firstNameOf(profile.draft.legal_birth_name);

  return (
    <Screen backdrop="forest" scrim="heavy" opacity={0.42}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Tu espacio</p>
        <h1 className="mb-6 text-[30px] leading-[1.15] text-blanco">
          {name ? (
            <>
              Hola,{' '}
              <span className="font-serif text-crema italic">{name}</span>.
            </>
          ) : (
            'Hola.'
          )}
        </h1>

        {hasRecentLowSeverity() && (
          <div className="-mx-2 mb-5">
            <CrisisBanner country={profile.draft.country} />
          </div>
        )}

        {!isSignedIn() && (
          <Link
            to="/registro"
            className="glass mb-5 block rounded-[var(--radius-option)] px-4 py-3.5 no-underline"
          >
            <p className="text-[13px] leading-snug text-blanco">Guardá tu mapa</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-crema/50">
              Sin cuenta, esto vive siete días en este navegador y después se va.
            </p>
          </Link>
        )}

        <div className="flex flex-col gap-2.5">
          {sections.map((section) => {
            const inner = (
              <>
                <p className="eyebrow mb-1.5">{section.eyebrow}</p>
                <h2 className="mb-1.5 text-[15px] leading-snug text-blanco">{section.title}</h2>
                <p className="line-clamp-3 text-[12px] leading-relaxed text-crema/55">
                  {section.body}
                </p>
              </>
            );

            return section.to ? (
              <Link
                key={section.key}
                to={section.to}
                className="glass rounded-[var(--radius-option)] px-4 py-3.5 no-underline"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={section.key}
                aria-disabled="true"
                className="rounded-[var(--radius-option)] border border-crema/8 px-4 py-3.5 opacity-45"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}
