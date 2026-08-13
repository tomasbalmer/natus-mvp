import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, REDACTED, buildExport, exportFileName } from './export.ts';

const AT = '2026-08-11T14:03:00.000Z';

/** Shaped like a real snapshot: one key per namespace of `store/db.ts`. */
const SNAPSHOT: Record<string, unknown> = {
  client: { id: 'c1', email: 'ana@ejemplo.cl', profile: { legal_birth_name: 'Ana Perez' } },
  anonymous_session: null,
  soul_map_synthesis: [{ id: 's1', is_current: true, synthesis: { tips: [] } }],
  modality_matches: [{ id: 'm1', reactions: { 'terapia-somatica': { reaction: 'saved' } } }],
  recommendation_checkins: [{ practice_title: 'Caminar sin auriculares', checked_on: '2026-08-10' }],
  crisis_events: [{ id: 'e1', severity: 'low', false_positive: null }],
  ai_mode: { mode: 'byok', apiKey: 'sk-ant-api03-real-looking-secret-value-here' },
  preferences: { locale: 'es' },
};

describe('the export document', () => {
  const doc = buildExport(SNAPSHOT, { exportedAt: AT });

  it('is self-describing, so a file found later can be identified', () => {
    expect(doc.format).toBe(EXPORT_FORMAT);
    expect(doc.format_version).toBe(1);
    expect(doc.exported_at).toBe(AT);
  });

  it('carries every namespace present in the snapshot', () => {
    expect(Object.keys(doc.data).sort()).toEqual(Object.keys(SNAPSHOT).sort());
  });

  it('survives a JSON round trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it('keeps the data itself intact', () => {
    expect(doc.data['recommendation_checkins']).toEqual(SNAPSHOT['recommendation_checkins']);
    expect((doc.data['client'] as { email: string }).email).toBe('ana@ejemplo.cl');
  });

  it('names a file that sorts by day', () => {
    expect(exportFileName(AT)).toBe('natus-export-2026-08-11.json');
  });
});

describe('the API key never leaves in an export', () => {
  it('is replaced rather than carried', () => {
    const doc = buildExport(SNAPSHOT, { exportedAt: AT });
    const mode = doc.data['ai_mode'] as { mode: string; apiKey: string };

    expect(mode.apiKey).toBe(REDACTED);
    // Surgical: the surrounding record still tells the truth about the mode.
    expect(mode.mode).toBe('byok');
  });

  it('does not survive anywhere in the serialised document', () => {
    const serialised = JSON.stringify(buildExport(SNAPSHOT, { exportedAt: AT }));
    expect(serialised).not.toContain('sk-ant-');
  });

  it('is caught however deep it is nested, and under either spelling', () => {
    const doc = buildExport(
      {
        debug: {
          calls: [{ request: { headers: { api_key: 'sk-ant-nested' } } }],
        },
      },
      { exportedAt: AT },
    );

    expect(JSON.stringify(doc)).not.toContain('sk-ant-nested');
  });

  it('leaves a null key null rather than inventing a redaction', () => {
    const doc = buildExport({ ai_mode: { mode: 'fixture', apiKey: null } }, { exportedAt: AT });
    expect((doc.data['ai_mode'] as { apiKey: unknown }).apiKey).toBeNull();
  });
});
