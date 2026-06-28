import { test, expect } from '@playwright/test';

// Per-wizard STICKY probe field. User report: corner/middle MAX PROBE kept reverting to the global 25 — the
// wizard box LOOKED like where you set a default but was a volatile mirror of settings.probes.maxDist (re-seeded
// on every open). The fix: an edited probe field is remembered for THAT wizard (by field id), so it
//   (1) survives a refresh,
//   (2) overrides ONLY its own field — never the global probe-default,
//   (3) a different, un-edited wizard's field still follows the global.
// Values are deliberately distinct (global 33, sticky 77) — applyProbeDefaults always overwrites the HTML
// default, so the only thing the assertions hinge on is global !== sticky.
test.describe.configure({ retries: 2 });

const OVR_KEY = 'ddcs_probe_field_overrides';

async function openWiz(page, type) {
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetSettings);
  await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), type);
}

test('a wizard MAX PROBE edit sticks per-wizard, overrides only its own field, and survives refresh', async ({ page }) => {
  await page.goto('http://localhost:3211');

  // Clean slate: a known global default (33) + no prior override.
  await page.waitForFunction(() => window.ddcsGetSettings);
  await page.evaluate((k) => {
    localStorage.removeItem(k);
    window.ddcsGetSettings().probes.maxDist = 33;
  }, OVR_KEY);

  // Fresh open → MAX PROBE follows the global (33), overwriting the HTML default.
  await openWiz(page, 'middle');
  await expect(page.locator('#wiz_middle')).toBeVisible();
  await expect(page.locator('#m_dist')).toHaveValue('33');

  // Edit it to 77 and commit (change event) — the way a user does on blur/Enter.
  await page.evaluate(() => {
    const e = document.getElementById('m_dist');
    e.value = '77';
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // The edit persisted to the per-field override store, and did NOT touch the global probe-default.
  const ovr = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), OVR_KEY);
  expect(ovr.m_dist).toBe('77');
  const globalAfter = await page.evaluate(() => window.ddcsGetSettings().probes.maxDist);
  expect(globalAfter, 'editing the wizard field must NOT change the global probe-default').toBe(33);

  // Survives a real refresh: reload, re-assert the same global, reopen → MAX PROBE is the sticky 77 (not 33).
  await page.reload();
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { window.ddcsGetSettings().probes.maxDist = 33; });
  await openWiz(page, 'middle');
  await expect(page.locator('#m_dist')).toHaveValue('77');

  // Overrides ONLY its own field: a DIFFERENT, un-edited wizard's MAX PROBE still follows the global (33).
  await openWiz(page, 'corner');
  await expect(page.locator('#c_dist')).toHaveValue('33');
});
