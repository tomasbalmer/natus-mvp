import { isBackendConfigured, supabase } from '@/supabase/client';
import type { NatalChartDraft, OnboardingDraft } from '@/store/session';

type NatalChartResponse = {
  context?: unknown;
  api_version?: unknown;
  error?: unknown;
};

export class NatalChartError extends Error {}

export function natalChartInput(draft: OnboardingDraft) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.birth_date);
  const time = /^(\d{2}):(\d{2})$/.exec(draft.birth_time);
  const nation = draft.birth_country.trim().toUpperCase();
  const city = draft.birth_city.trim();
  const name = draft.legal_birth_name.trim();

  if (!date || !time || !name || !city || !/^[A-Z]{2}$/.test(nation)) {
    throw new NatalChartError(
      'Revisá la fecha, la hora, la ciudad y el país de nacimiento antes de calcular tu carta.',
    );
  }

  return {
    name,
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
    city,
    nation,
  };
}

export function hasNatalChartInput(draft: OnboardingDraft): boolean {
  try {
    natalChartInput(draft);
    return true;
  } catch (error) {
    if (error instanceof NatalChartError) return false;
    throw error;
  }
}

export async function calculateNatalChart(draft: OnboardingDraft): Promise<NatalChartDraft> {
  const subject = natalChartInput(draft);
  if (!isBackendConfigured || !supabase) {
    throw new NatalChartError(
      'El cálculo de la carta necesita conexión con el servicio. Podés seguir sin ella en esta demo.',
    );
  }

  let response;
  try {
    response = await supabase.functions.invoke<NatalChartResponse>('natal-chart', {
      body: { subject },
    });
  } catch {
    throw new NatalChartError(
      'No pudimos calcular tu carta ahora. El resto de tu mapa puede generarse igual.',
    );
  }

  const { data, error } = response;

  if (error || typeof data?.context !== 'string' || data.context.trim() === '') {
    throw new NatalChartError(
      'No pudimos calcular tu carta con ese lugar. Revisá la ciudad y el país, o seguí sin ella.',
    );
  }

  return {
    provider: 'astrologer',
    api_version: 'v5',
    context: data.context,
    calculated_at: Date.now(),
    parse_status: 'parsed',
  };
}
