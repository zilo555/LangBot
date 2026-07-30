import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../src/app/auth/space/callback/page.tsx', import.meta.url),
  'utf8',
);

test('direct launch assertion is fragment-only and removed before exchange', () => {
  assert.doesNotMatch(source, /searchParams\.get\(['"]launch_assertion['"]\)/);
  const readIndex = source.indexOf("fragmentParams.get('launch_assertion')");
  const clearIndex = source.indexOf('window.history.replaceState');
  const exchangeIndex = source.indexOf('handleOAuthCallback(', clearIndex);
  assert.ok(readIndex >= 0, 'fragment assertion read is missing');
  assert.ok(clearIndex > readIndex, 'URL fragment is not cleared after copying the assertion');
  assert.ok(exchangeIndex > clearIndex, 'assertion exchange starts before the fragment is cleared');
});

test('direct launch honors only a local signed return path', () => {
  assert.match(source, /response\.return_path\.startsWith\(['"]\/['"]\)/);
  assert.match(source, /!response\.return_path\.startsWith\(['"]\/\/['"]\)/);
  assert.match(source, /navigate\(returnPath, \{ replace: true \}\)/);
});
