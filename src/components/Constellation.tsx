import type { Modality } from '@/lib/schemas';

/**
 * Mockup screen 04, re-pointed.
 *
 * The mockup drew a constellation of facilitator avatars around a centre
 * marked "98% match", with the name underneath. The visual survives the scope
 * change intact and its claim does not: the nodes are modalities, the centre
 * is the first-ranked path rather than the best person, and there is no score
 * anywhere. PDR 0.1 and 7.5.
 */

const POSITIONS = [
  { className: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', size: 'size-[92px]', text: 'text-[11px]' },
  { className: 'top-[16%] left-[4%]', size: 'size-[68px]', text: 'text-[9px]' },
  { className: 'top-[18%] right-[4%]', size: 'size-[64px]', text: 'text-[9px]' },
  { className: 'bottom-[8%] left-[10%]', size: 'size-[56px]', text: 'text-[8px]' },
  { className: 'bottom-[10%] right-[8%]', size: 'size-[52px]', text: 'text-[8px]' },
] as const;

export function Constellation({ modalities }: { modalities: Modality[] }) {
  const shown = modalities.slice(0, POSITIONS.length);

  return (
    // shrink-0 is load-bearing: inside the screen's flex column this box was
    // being compressed to a fraction of its height, and the absolutely
    // positioned nodes stayed put and landed on the heading.
    <div className="relative mx-auto h-[300px] w-full max-w-[300px] shrink-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 300 300"
        fill="none"
        aria-hidden="true"
      >
        <line x1="150" y1="150" x2="58" y2="72" stroke="rgb(232 220 200 / 0.10)" />
        <line x1="150" y1="150" x2="242" y2="76" stroke="rgb(232 220 200 / 0.10)" />
        <line x1="150" y1="150" x2="68" y2="242" stroke="rgb(232 220 200 / 0.08)" />
        <line x1="150" y1="150" x2="238" y2="238" stroke="rgb(232 220 200 / 0.08)" />
        <circle cx="104" cy="111" r="2" fill="rgb(232 220 200 / 0.15)" />
        <circle cx="196" cy="113" r="2" fill="rgb(232 220 200 / 0.15)" />
        <circle cx="109" cy="196" r="1.5" fill="rgb(232 220 200 / 0.10)" />
        <circle cx="194" cy="194" r="1.5" fill="rgb(232 220 200 / 0.10)" />
      </svg>

      {shown.map((modality, index) => {
        const position = POSITIONS[index]!;
        const isCentre = index === 0;
        return (
          <div key={modality.slug} className={`absolute ${position.className}`}>
            <div
              className={[
                'flex items-center justify-center rounded-full border p-2 text-center leading-tight',
                position.size,
                position.text,
                isCentre
                  ? 'border-crema/35 bg-verde/45 text-crema shadow-[0_0_40px_rgb(28_56_41/0.35)]'
                  : 'border-crema/20 bg-[var(--glass-bg)] text-crema/70',
              ].join(' ')}
              style={{ backdropFilter: 'blur(16px)' }}
            >
              {modality.name_es}
            </div>
          </div>
        );
      })}
    </div>
  );
}
