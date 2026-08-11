import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The accessibility criterion of Phase 10, made enforceable.
 *
 * Every screen sets text in `crema` over a photograph under a black scrim. The
 * effective background sits between #0e0e0e and roughly #1f1f1c, and against
 * that, `crema` at an alpha below 0.55 falls under the 4.5:1 that WCAG AA asks
 * of normal text:
 *
 *   alpha   0.25   0.35   0.45   0.50   0.55   0.60
 *   ratio   1.9    2.6    3.6    4.2    4.7    5.4
 *
 * Seventy-seven usages sat below that line before this phase, most of them
 * 10-12px metadata — the smallest text on the page, set in the faintest ink.
 * Hierarchy is carried by size and weight instead, which is where it belongs.
 *
 * A lint rather than a review: the next faint caption someone adds fails here.
 */

const MINIMUM_TEXT_ALPHA = 55;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('text over photography meets WCAG AA', () => {
  const files = sourceFiles('src');

  it('finds the screens to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s sets no text below the contrast floor', (file) => {
    const source = readFileSync(file, 'utf8');
    const tooFaint = [...source.matchAll(/text-(?:crema|blanco)\/(\d+)\b/g)]
      .map((match) => Number(match[1]))
      .filter((alpha) => alpha < MINIMUM_TEXT_ALPHA);

    expect(tooFaint).toEqual([]);
  });
});
