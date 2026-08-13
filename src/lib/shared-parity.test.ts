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
