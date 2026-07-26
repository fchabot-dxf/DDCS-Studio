import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './playwright.config.js';
import { SMOKE_SPECS } from './tests/smoke.manifest.mjs';

// The FAST tier (t1195). Reuses the base config verbatim (same mem-server, workers, timeouts) and only narrows the run
// to the declared smoke specs. VALID BY CONSTRUCTION: a listed spec that no longer exists fails loudly here, so a
// rename/removal can never silently drop smoke coverage.
const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tests');
const missing = SMOKE_SPECS.filter((n) => !fs.existsSync(path.join(testsDir, n)));
if (missing.length) throw new Error('smoke.manifest.mjs lists specs that do not exist: ' + missing.join(', '));

export default defineConfig({
  ...base,
  testMatch: SMOKE_SPECS.map((n) => '**/' + n),
});
