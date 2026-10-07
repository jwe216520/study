import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionMessage, saveErrorMessage } from '../lib/connection-errors.js';

test('network write failures report an unknown outcome without recommending duplicate writes', () => {
  for (const message of ['Failed to fetch', 'TypeError: Failed to fetch', 'fetch failed', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
    assert.match(saveErrorMessage({ message }), /無法確認是否已寫入/);
    assert.match(saveErrorMessage({ message }), /確認資料是否已更新/);
  }
  assert.equal(saveErrorMessage({ message: '頁碼超出教材範圍' }), '頁碼超出教材範圍');
});

test('usage network failures identify the website endpoint separately from Supabase', () => {
  const message = connectionMessage(new TypeError('Failed to fetch'), '網站統計 API（/api/usage）');
  assert.match(message, /網站統計 API/);
  assert.doesNotMatch(message, /Supabase/);
});
