import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/store/session';
import { buildSoulMapUserMessage } from './soul-map';

describe('Soul Map astrological context', () => {
  it('injects a calculated chart into the chart block', () => {
    const message = buildSoulMapUserMessage({
      draft: {
        ...emptyDraft(),
        natal_chart: {
          provider: 'astrologer',
          api_version: 'v5',
          context: '<chart_analysis><planet name="Sun" sign="Gemini" /></chart_analysis>',
          calculated_at: 1,
          parse_status: 'parsed',
        },
      },
      numerology: null,
    });

    expect(message).toContain('<planet name="Sun" sign="Gemini" />');
    expect(message).not.toContain('No hay carta disponible');
  });

  it('forbids invented placements when there is no chart', () => {
    const message = buildSoulMapUserMessage({ draft: emptyDraft(), numerology: null });
    expect(message).toContain('No hay carta disponible');
    expect(message).toContain('No inventes ninguna');
  });
});
