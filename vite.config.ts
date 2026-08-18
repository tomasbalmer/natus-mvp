import { fileURLToPath, URL } from 'node:url';
// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` is intentionally an environment variable, not a literal.
//
//   custom domain            -> VITE_BASE unset, resolves to '/'
//   <owner>.github.io/<repo> -> VITE_BASE='/natus-mvp/'
//
// Attaching a domain, or transferring the repository to a new owner, is a
// change of environment rather than a change of source. See docs/HANDOFF.md.
export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Split by how often the code changes, not by route.
        //
        // Route splitting would buy almost nothing here: the application is
        // ~140 kB of source against ~2 MB of dependencies, and every screen
        // reaches the same zod schemas and the same store, so each route
        // chunk would drag the whole vendor graph in behind it.
        //
        // These three groups have three different lifetimes. React and the
        // router change when a dependency is bumped; supabase-js changes
        // even less often and, in the fixture build, is never called at all;
        // the application changes on every deploy. Separating them keeps a
        // returning visitor from re-downloading 300 kB because a paragraph
        // of Spanish moved.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/\.pnpm\/(react|react-dom|react-router|scheduler)@/ },
            { name: 'supabase', test: /node_modules\/\.pnpm\/(@supabase\+|iceberg-js@)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
