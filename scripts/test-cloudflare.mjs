import { spawn } from 'node:child_process';

// Test against real Workers runtime while all browser data requests are mocked.
const env = {
  ...process.env,
  STUDY_WORKERS_TEST: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://study-test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ui-test-public-key',
};
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Workers 測試失敗，exit ${code}`)));
  });
}
await run('node_modules/vite/bin/vite.js', ['build']);
await run('node_modules/@playwright/test/cli.js', ['test']);
