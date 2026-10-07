import { defineConfig } from '@playwright/test';
const workers = process.env.STUDY_WORKERS_TEST === '1';
export default defineConfig({
 testDir:'tests/browser',workers:1,timeout:60000,
 use:{baseURL:workers?'http://127.0.0.1:3101':'http://localhost:3101',browserName:'chromium',channel:'msedge',trace:'retain-on-failure',timezoneId:'Asia/Taipei'},
 webServer:{command:workers?'npm run start:vinext -- --host 127.0.0.1 --port 3101 --strictPort':'node scripts/dev-ui.mjs',url:workers?'http://127.0.0.1:3101':'http://localhost:3101',reuseExistingServer:false,timeout:120000},
 reporter:'list'
});
