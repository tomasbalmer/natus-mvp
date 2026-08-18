import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `supabase/functions/_shared/lib` is a copy of this directory, and
 * `docs/MIGRATION.md` says it is copied *unchanged*. That sentence is a
 * promise about the boundary: nothing in here may reach for React, for
 * `localStorage`, or for anything else the server does not have.
 *
 * A promise nobody checks is a comment. This checks it.
 *
 * The failure it exists to catch is not a bad copy — it is a good edit made
 * in one place six weeks from now. Change `matching.ts` to fix a filter, ship
 * it, and the Edge Function keeps running the old rule: the client shows one
 * set of modalities and the server clears a different one. The clinical
 * exclusions live in that file, so the two disagreeing is not a cosmetic bug.
 *
 * Regenerate after any change here:
 *   pnpm sync:shared
 */

const SRC = 'src/lib';
const COPY = 'supabase/functions/_shared/lib';
const DATA_SRC = 'data';
const DATA_COPY = 'supabase/functions/_shared/data';

/**
 * Prompts cross too, and for the same reason the library does: an Edge
 * Function that answers with a prompt one revision behind the browser's is
 * two products wearing one name. Only the portable ones are copied — see the
 * list in `sync:shared` — so this asserts the copy matches rather than that
 * every prompt travels.
 */
const PROMPT_SRC = 'src/ai/prompts';
const PROMPT_COPY = 'supabase/functions/_shared/prompts';

/** Relative paths of every file under `dir`, sorted, excluding tests. */
function sources(dir: string, filter: (f: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (filter(entry)) out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

const isPortableSource = (f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts');
const isJson = (f: string) => f.endsWith('.json');

describe('the shared library is a faithful copy', () => {
  const libFiles = sources(SRC, isPortableSource);
  const copyFiles = sources(COPY, isPortableSource);

  it('has something to compare', () => {
    // Guards against the whole suite passing because a path went wrong and
    // both sides read as empty.
    expect(libFiles.length).toBeGreaterThan(5);
  });

  it('contains exactly the same files', () => {
    // Both directions. A file added to src/lib and never copied is the more
    // likely mistake, but a stale file left behind in the copy is the more
    // dangerous one — it would still be imported.
    expect(copyFiles).toEqual(libFiles);
  });

  it.each(libFiles)('%s is byte-identical', (file) => {
    expect(readFileSync(join(COPY, file), 'utf8')).toBe(readFileSync(join(SRC, file), 'utf8'));
  });
});

describe('the seeds travel with the code that reads them', () => {
  const dataFiles = sources(DATA_SRC, isJson);
  const dataCopy = sources(DATA_COPY, isJson);

  it('contains exactly the same files', () => {
    expect(dataCopy).toEqual(dataFiles);
  });

  it.each(dataFiles)('%s is byte-identical', (file) => {
    expect(readFileSync(join(DATA_COPY, file), 'utf8')).toBe(
      readFileSync(join(DATA_SRC, file), 'utf8'),
    );
  });
});

describe('the prompts that cross are a faithful copy', () => {
  const copied = sources(PROMPT_COPY, isPortableSource);

  it('has something to compare', () => {
    expect(copied.length).toBeGreaterThan(1);
  });

  it.each(copied)('%s is byte-identical', (file) => {
    expect(readFileSync(join(PROMPT_COPY, file), 'utf8')).toBe(
      readFileSync(join(PROMPT_SRC, file), 'utf8'),
    );
  });

  it.each(copied)('%s reaches for nothing the server lacks', (file) => {
    const source = readFileSync(join(PROMPT_SRC, file), 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);

    for (const specifier of specifiers) {
      // Looser than the rule for src/lib, and deliberately so: `@/lib/` is
      // mapped in `supabase/functions/deno.json` and resolves to the copy.
      // Nothing else is — a prompt that reaches into `@/store` or `@/audio`
      // is one that cannot travel, and the failure would otherwise appear at
      // runtime on the server rather than here.
      expect(
        specifier.startsWith('./') || specifier.startsWith('@/lib/'),
        `${specifier} is not resolvable from _shared/prompts`,
      ).toBe(true);

      // Learned the hard way: the Edge runtime refused to boot on `./shared`,
      // and `deno.json` declaring `sloppy-imports` did not save it. Nothing in
      // the type checker or the test suite saw it — only serving the function
      // did. So the extension is required here rather than hoped for, and
      // `@/lib/schemas` must name `index.ts` rather than lean on directory
      // resolution that the runtime does not perform.
      expect(specifier, `${specifier} needs an explicit extension`).toMatch(/\.ts$/);
    }
  });
});

describe('the boundary itself', () => {
  it.each(sources(SRC, isPortableSource))('%s imports nothing the server lacks', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);

    for (const specifier of specifiers) {
      // The rule docs/MIGRATION.md states: "If anything in there ever imports
      // from src/store, this document stops being true." Extended to React
      // and to @/ generally, since neither exists on the other side.
      expect(specifier).not.toMatch(/^@\/store\//);
      expect(specifier).not.toMatch(/^react/);
      expect(specifier).not.toMatch(/^@\//);
    }
  });

  it.each(sources(SRC, isPortableSource))('%s resolves under Deno too', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);

    for (const specifier of specifiers) {
      // Two conventions Vite forgives and Deno does not. Both are written the
      // standard way here so the copy needs no transform: relative imports
      // carry their extension, and JSON imports carry an import attribute.
      if (specifier.startsWith('.')) {
        expect(specifier, `${specifier} needs an explicit extension`).toMatch(/\.(ts|json)$/);
      }
      if (specifier.endsWith('.json')) {
        expect(source, `${specifier} needs with { type: 'json' }`).toMatch(
          new RegExp(`from '${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' with \\{ type: 'json' \\}`),
        );
      }
    }
  });
});
