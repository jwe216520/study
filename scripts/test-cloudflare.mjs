import { spawn } from 'node:child_process';

// Test against real Workers runtime while all browser data requests are mocked.
const env = {
  ...process.env,
  STUDY_WORKERS_TEST: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://study-test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ui-test-public-key',
  // Only fixtures: browser management requests are mocked. Never use real Tokens in UI tests.
  MONITOR_ADMIN_USER_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  MONITOR_CF_ACCOUNT_ID: '00000000000000000000000000000000',
  MONITOR_CF_API_TOKEN: 'test-only-not-a-real-token',
  MONITOR_SUPABASE_TOKEN: 'test-only-not-a-real-token',
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
