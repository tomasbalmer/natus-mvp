import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The layering, made executable.
 *
 * `CLAUDE.md` has always stated these rules and the code has always followed
 * them — a survey of every cross-layer import found one violation in more than
 * two hundred edges, which is a better record than most codebases keep. That is
 * exactly why this file exists now rather than later: the discipline is intact
 * and cheap to fence, and a rule that only lives in prose erodes one reasonable
 * shortcut at a time, each of them defensible on the afternoon it is taken.
 *
 * What is fenced here is not style. The direction of dependencies is what lets
 * `src/lib` be copied verbatim into an Edge Function, and what would let it be
 * reused by a native client without touching a line. The day `lib` imports the
 * store, that portability is gone and nothing will announce it.
 */

const SRC = resolve(__dirname);

/**
 * Low number depends on nothing above it.
 *
 * `supabase` sits at 1 rather than beside `store`: it is the client and the
 * session, which the data layer builds on rather than the other way round.
 */
const LAYERS: Record<string, number> = {
  styles: 0,
  lib: 0,
  supabase: 1,
  astrology: 1,
  store: 2,
  ai: 2,
  audio: 2,
  components: 3,
  screens: 4,
};

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
    }
  };
  walk(SRC);
  return out;
}

/** The layer a file belongs to, or undefined for the shell (App, main). */
function layerOf(file: string): string | undefined {
  const top = relative(SRC, file).split('/')[0];
  return top !== undefined && top in LAYERS ? top : undefined;
}

/** The layer an import resolves to, following both `@/x` and relative paths. */
function targetLayer(file: string, spec: string): string | undefined {
  if (spec.startsWith('@/')) return spec.slice(2).split('/')[0];
  if (!spec.startsWith('.')) return undefined;
  const abs = resolve(file, '..', spec);
  if (!abs.startsWith(SRC)) return undefined;
  return relative(SRC, abs).split('/')[0];
}

function importsOf(text: string): string[] {
  return [...text.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((m) => m[1] as string);
}

/**
 * Imports that survive compilation.
 *
 * `import type` is erased, so it creates no runtime edge and costs none of the
 * portability these rules exist to protect. It is still a coupling worth
 * seeing, which is why the two are separated rather than merged.
 */
function runtimeImportsOf(text: string): string[] {
  const withoutTypeImports = text.replace(/import\s+type\s+[^;]+;/g, '');
  return importsOf(withoutTypeImports);
}

function typeOnlyImportsOf(text: string): string[] {
  return [...text.matchAll(/import\s+type\s+[^']*'([^']+)'/g)].map((m) => m[1] as string);
}

const FILES = sourceFiles();

describe('the layering holds', () => {
  it('finds the source tree', () => {
    expect(FILES.length).toBeGreaterThan(80);
  });

  it('never lets a lower layer import a higher one at runtime', () => {
    const violations: string[] = [];

    for (const file of FILES) {
      const from = layerOf(file);
      if (from === undefined) continue;

      for (const spec of runtimeImportsOf(readFileSync(file, 'utf8'))) {
        const to = targetLayer(file, spec);
        if (to === undefined || !(to in LAYERS)) continue;
        const [a, b] = [LAYERS[from] as number, LAYERS[to] as number];
        if (b > a) violations.push(`${relative(SRC, file)} (${from}) → ${spec} (${to})`);
      }
    }

    // Reported as a list rather than one at a time: a refactor that inverts a
    // dependency usually inverts several, and fixing them one test run at a
    // time is how somebody gives up halfway.
    expect(violations).toEqual([]);
  });

  /**
   * A ratchet rather than a rule.
   *
   * One upward edge exists and it is `import type` only: `astrology` names
   * `OnboardingDraft` and `NatalChartDraft`, both declared in `store/session`.
   * Nothing breaks — the import is erased — but the types are domain shapes
   * sitting in the data layer, and the day somebody wants the astrology module
   * on its own they will have to move them first.
   *
   * Listed exactly so that this one stays the only one. A second entry is a
   * failing test and a conversation, not a silent accumulation.
   */
  it('adds no new upward type-only import', () => {
    const known = ['astrology/natal-chart.ts (astrology) → @/store/session (store)'];
    const found: string[] = [];

    for (const file of FILES) {
      const from = layerOf(file);
      if (from === undefined) continue;

      for (const spec of typeOnlyImportsOf(readFileSync(file, 'utf8'))) {
        const to = targetLayer(file, spec);
        if (to === undefined || !(to in LAYERS)) continue;
        const [a, b] = [LAYERS[from] as number, LAYERS[to] as number];
        if (b > a) found.push(`${relative(SRC, file)} (${from}) → ${spec} (${to})`);
      }
    }

    expect(found.sort()).toEqual(known.sort());
  });
});

describe('src/lib stays portable', () => {
  const LIB = FILES.filter((f) => layerOf(f) === 'lib');

  it('finds the library', () => {
    expect(LIB.length).toBeGreaterThan(10);
  });

  it('imports nothing outside itself', () => {
    const reaching = LIB.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((spec) => spec.startsWith('@/') || spec.startsWith('../'))
        .map((spec) => `${relative(SRC, file)} → ${spec}`),
    );

    // `@/` would resolve through Vite's alias, which the Edge runtime does not
    // have; `../` would reach outside the directory that gets copied. Both
    // break the copy rather than this repository, which is why they are caught
    // here instead of by the type checker.
    expect(reaching).toEqual([]);
  });

  it('carries the file extension on every relative import', () => {
    const bare = LIB.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((spec) => spec.startsWith('./') && !/\.(ts|js|json)$/.test(spec))
        .map((spec) => `${relative(SRC, file)} → ${spec}`),
    );

    // Deno resolves no extensions. A missing one took every function down at
    // once, and `tsc` had nothing to say about it because Vite had resolved it
    // happily on the way in.
    expect(bare).toEqual([]);
  });

  it('touches no React and no browser global', () => {
    const found: string[] = [];

    for (const file of LIB) {
      const text = readFileSync(file, 'utf8')
        // Strip comments first: the prose in this codebase says "document" and
        // "window" often enough that matching them raw is all false positives.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      for (const [what, pattern] of [
        ['react', /\bfrom\s*'react'/],
        ['localStorage', /\blocalStorage\b/],
        ['window', /(?<![.\w])window\s*\./],
        ['document', /(?<![.\w])document\s*\./],
        ['navigator', /(?<![.\w])navigator\s*\./],
      ] as const) {
        if (pattern.test(text)) found.push(`${relative(SRC, file)}: ${what}`);
      }
    }

    expect(found).toEqual([]);
  });
});

/**
 * The lesson is borrowed, and it was expensive for somebody else.
 *
 * `waterplan-frontend` is fifty times this size and does everything right on
 * paper: a design-system package, a token library, a Storybook. Its newest
 * type scale — two roles, sizes paired with line-heights — is the shape this
 * one should grow into. It is used in three files. Fourteen use the scale it
 * replaced, and **five hundred and fifty-three places write `font-size:`
 * with a number in it**, because nothing anywhere fails when they do.
 *
 * Their colour tokens, by contrast, are used in five hundred and sixty-one
 * files. Same team, same repository, same folder — the difference is that a
 * hex code is hard to invent from memory and `13px` is not.
 *
 * This file is the part they are missing. The scale reached one hundred per
 * cent adoption today; these two tests are what keep it there, and they cost
 * nothing while nobody is trying to erode it.
 */
describe('the type scale cannot erode', () => {
  const JSX = FILES.filter((f) => f.endsWith('.tsx'));

  it('finds the components', () => {
    expect(JSX.length).toBeGreaterThan(20);
  });

  it('has no font size written as a literal', () => {
    const found: string[] = [];

    for (const file of JSX) {
      for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        // Both spellings: an arbitrary value, and Tailwind's own scale, which
        // is a second vocabulary for the same axis rather than an exception
        // to the first.
        const literal = /\btext-\[[0-9.]+px\]/.exec(line);
        const preset = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/.exec(line);
        const hit = literal ?? preset;
        if (hit) found.push(`${relative(SRC, file)}:${i + 1}  ${hit[0]}`);
      }
    }

    expect(found).toEqual([]);
  });

  it('has no heading line-height written as a literal', () => {
    const found: string[] = [];

    for (const file of JSX) {
      for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        // `leading-[var(--lh-…)]` is the token form and passes; a bare number
        // is a fifth value for a job that already has four too many.
        const hit = /\bleading-\[[0-9.]+\]/.exec(line);
        if (hit) found.push(`${relative(SRC, file)}:${i + 1}  ${hit[0]}`);
      }
    }

    expect(found).toEqual([]);
  });
});
