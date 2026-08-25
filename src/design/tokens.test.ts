import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The mockups are the visual source of truth. `tokens.css` claims to
 * transcribe them verbatim, which is only true if something enforces it.
 *
 * These values are read off `natus-mockups.html`'s `:root` block. If a token
 * is "improved" in the CSS without the mockup moving too, this fails.
 */
const MOCKUP_PALETTE = {
  '--natus-verde': '#1c3829',
  '--natus-azul': '#0d2137',
  '--natus-negro': '#1a1a1e',
  '--natus-crema': '#e8dcc8',
  '--natus-blanco': '#fafaf8',
  '--natus-tierra': '#8b6f52',
  '--natus-fondo': '#0e0e0e',
} as const;

/** Mockup: rgba(255,255,255,0.08 / 0.15 / 0.13). Alpha is what matters. */
const MOCKUP_GLASS_ALPHA = {
  '--glass-bg': '0.08',
  '--glass-border': '0.15',
  '--glass-hover': '0.13',
} as const;

const MOCKUP_GEOMETRY = {
  '--radius-frame': '48px',
  '--radius-cta': '27px',
  '--radius-option': '14px',
  '--h-cta': '54px',
  '--h-option': '52px',
} as const;

/**
 * Tokens this demo adds that have no counterpart in the mockup. Kept apart so
 * MOCKUP_GEOMETRY keeps meaning exactly one thing: fidelity to the design.
 */
const DEMO_CHROME = {
  '--top-inset': '62px',
  '--bottom-inset': '80px',
} as const;

function readTokens(): Map<string, string> {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value.trim().toLowerCase());
  }
  return tokens;
}

describe('design tokens match the mockup', () => {
  const tokens = readTokens();

  it.each(Object.entries(MOCKUP_PALETTE))('%s is %s', (name, expected) => {
    expect(tokens.get(name)).toBe(expected);
  });

  it.each(Object.entries(MOCKUP_GLASS_ALPHA))('%s carries alpha %s', (name, alpha) => {
    const value = tokens.get(name);
    expect(value, `${name} is not defined`).toBeDefined();
    // Accept either rgb(255 255 255 / a) or rgba(255,255,255,a).
    expect(value).toMatch(/^rgba?\(\s*255[\s,]+255[\s,]+255\s*[/,]\s*([\d.]+)\s*\)$/);
    expect(value?.match(/([\d.]+)\s*\)$/)?.[1]).toBe(alpha);
  });

  it.each(Object.entries(MOCKUP_GEOMETRY))('%s is %s', (name, expected) => {
    expect(tokens.get(name)).toBe(expected);
  });

  it.each(Object.entries(DEMO_CHROME))('%s is %s (demo chrome, not from the mockup)', (name, expected) => {
    expect(tokens.get(name)).toBe(expected);
  });

  it('defines a crisis colour outside the calm palette', () => {
    // Crisis must not read as part of the brand language. Asserting only that
    // it exists and is not one of the brand colours.
    const alert = tokens.get('--natus-alerta');
    expect(alert).toBeDefined();
    expect(Object.values(MOCKUP_PALETTE)).not.toContain(alert);
  });
});
