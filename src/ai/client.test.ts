import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';


type Invoke = (fn: string, options: unknown) => Promise<{ data: unknown; error: unknown }>;

function mockClient(invoke: Invoke) {
  vi.doMock('@/supabase/client', () => ({
    isBackendConfigured: true,
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      functions: { invoke },
    },
  }));
}

function httpError(status: number, body: unknown) {
  const error = new Error(`Edge Function returned ${status}`);
  error.name = 'FunctionsHttpError';
  return Object.assign(error, {
    context: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

const call = {
  purpose: 'chat' as const,
  promptVersion: 'test',
  system: '',
  user: '',
  schema: z.object({ text: z.string() }),
  fixture: () => ({ text: 'fixture' }),
  edge: { fn: 'chat', body: {} },
};

async function run(invoke: Invoke) {
  mockClient(invoke);
  const { runAi } = await import('./client');
  return runAi(call);
}

describe('runAi on the server path', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/supabase/client');
    vi.resetModules();
  });

  it('returns the parsed result', async () => {
    const result = await run(async () => ({ data: { result: { text: 'hola' } }, error: null }));
    expect(result).toMatchObject({ value: { text: 'hola' }, mode: 'server' });
  });

  it.each([
    [402, 'quota', { error: 'quota_exhausted', remaining: 0 }],
    [429, 'spend_limit', { error: 'spend_limit', scope: 'person' }],
    [403, 'crisis', { error: 'refused_crisis' }],
    [500, 'api_error', { error: 'misconfigured' }],
  ])('reads a %i as %s', async (status, kind, body) => {
    await expect(run(async () => ({ data: null, error: httpError(status, body) }))).rejects.toMatchObject({
      kind,
    });
  });

  it.each([404, 503])('falls back to the fixture on a %i', async (status) => {
    const result = await run(async () => ({ data: null, error: httpError(status, { error: 'no_model' }) }));
    expect(result).toMatchObject({ value: { text: 'fixture' }, mode: 'fixture' });
  });

  it('carries the verdict when the server answers with containment', async () => {
    const answer = { type: 'crisis', severity: 'low', category: 'panico', resources: [] };
    await expect(run(async () => ({ data: answer, error: null }))).rejects.toMatchObject({
      kind: 'crisis',
      crisis: { severity: 'low', category: 'panico' },
    });
  });

  it('reads an aborted request as a timeout, and asks for one', async () => {
    let options: unknown;
    const abort = Object.assign(new Error('fetch failed'), {
      name: 'FunctionsFetchError',
      context: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    });
    await expect(
      run(async (_fn, opts) => {
        options = opts;
        return { data: null, error: abort };
      }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(options).toMatchObject({ timeout: expect.any(Number) });
  });
});
