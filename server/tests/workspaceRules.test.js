import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildIgnore, classifySyncPath, hasPrivateKeyBlock, isSensitivePath, scanSecrets } from '../src/utils/workspaceRules.js';

test('the server copy of the rules is byte-identical to the shared source', () => {
  assert.equal(
    readFileSync(new URL('../src/utils/workspaceRules.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../../shared/workspace/rules.js', import.meta.url), 'utf8')
  );
});

test('sensitive files', () => {
  for (const path of ['.env', '.env.local', 'app/.env.production', 'prod.env', 'id_rsa', 'x/server.pem', '.ssh/config', '.aws/credentials', 'service-account-1.json', 'terraform.tfvars']) assert.equal(isSensitivePath(path), true, path);
  for (const path of ['.env.example', '.env.sample', 'id_rsa.pub', 'src/main.js', 'src/credentials.js', 'environment.ts', 'README.md']) assert.equal(isSensitivePath(path), false, path);
});

test('secret scanning is advisory and content based', () => {
  assert.equal(hasPrivateKeyBlock('-----BEGIN OPENSSH PRIVATE KEY-----\nabc'), true);
  assert.equal(hasPrivateKeyBlock('-----BEGIN PUBLIC KEY-----'), false);
  assert.ok(scanSecrets('const t = "ghp_' + 'a'.repeat(36) + '"').length > 0);
  assert.deepEqual(scanSecrets('const x = 1'), []);
});

test('gitignore semantics: defaults, anchoring, negation, directories', () => {
  const ig = buildIgnore({ gitignore: '/docs/\n*.tmp\n!keep.tmp\nsecret.txt\n', playgroundignore: '!build/\n' });
  const ignored = (p, d = false) => ig.ignores(p, d);
  assert.equal(ignored('node_modules/a/b.js'), true);
  assert.equal(ignored('a/.git/config'), true);
  assert.equal(ignored('.gitignore'), false);
  assert.equal(ignored('docs/a.md'), true);
  assert.equal(ignored('src/docs/a.md'), false);
  assert.equal(ignored('x.tmp'), true);
  assert.equal(ignored('keep.tmp'), false);
  assert.equal(ignored('.DS_Store'), true);
  assert.equal(ignored('build/out.js'), false); // re-included by .playgroundignore
  assert.equal(ignored('dist/out.js'), true);
  assert.equal(classifySyncPath('.env', { ignore: ig }).kind, 'sensitive');
  assert.equal(classifySyncPath('.env', { ignore: ig, includeSensitive: true }).sync, true);
  assert.equal(classifySyncPath('img/logo.png', { ignore: ig }).kind, 'binary');
});
