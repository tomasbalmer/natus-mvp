#!/usr/bin/env node
// Runs the tests that need a real Postgres: the pgTAP policy suite and the
// adapter integration tests, with the Edge Functions served beside them.
// Requires `supabase start` first.
//
// The keys are read from the running stack rather than written here, so the
// script works against whatever `supabase start` produced.

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(cmd, args, env = process.env) {
  execFileSync(cmd, args, { stdio: 'inherit', env });
}

function projectId() {
  const toml = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  return /^project_id\s*=\s*"([^"]+)"/m.exec(toml)[1];
}

/** Served functions answer 401 to an unauthenticated call once they are up. */
async function waitForFunctions(url) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${url}/functions/v1/delete-account`, { method: 'POST' }).catch(() => null);
    if (res?.status === 401) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Functions did not come up within a minute.');
}

let status;
try {
  status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
} catch {
  console.error('No local Supabase stack. Run `supabase start` first.');
  process.exit(1);
}

run('supabase', ['test', 'db']);

const serve = spawn('supabase', ['functions', 'serve'], { stdio: 'ignore' });
try {
  await waitForFunctions(status.API_URL);
  run('pnpm', ['exec', 'vitest', 'run', 'src/store/remote.integration.test.ts'], {
    ...process.env,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_ANON_KEY: status.ANON_KEY,
    SUPABASE_TEST_SERVICE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_TEST_DB_CONTAINER: `supabase_db_${projectId()}`,
  });
} finally {
  serve.kill();
}
