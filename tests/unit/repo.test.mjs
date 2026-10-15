import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('D2: no server, Docker or Railway files in the repo root', () => {
  const banned = /^(dockerfile|docker-compose.*|\.dockerignore|railway\.(json|toml)|procfile|server\.(m?js|ts)|nixpacks\.toml)$/i;
  const hits = readdirSync(ROOT).filter((f) => banned.test(f));
  assert.deepEqual(hits, []);
});
