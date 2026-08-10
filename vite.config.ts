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
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
