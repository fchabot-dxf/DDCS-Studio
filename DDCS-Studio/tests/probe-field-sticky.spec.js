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

// t1730 port note — SIGNIFICANT PRE-EXISTING GAP, confirmed LIVE (not guessed): this whole mechanism —
// applyProbeDefaults() (seed a probe field from settings.probes on open) AND the sticky per-field override store
// (PROBE_FIELD_OVERRIDE_KEY) — is keyed ENTIRELY by a hardcoded map of OLD coded-view field ids
// (wizardManager.js:28-36 PROBE_DEFAULT_FIELDS: m_dist/p_dist/al_dist/rc_dist/rcl_dist/c_dist/circ_dist, same
// pattern for radius/fastFeed/slowFeed/retract/safeZ/qStop). None of those ids exist on the twin's generic form
// (data-param="dist", no id attribute at all) — confirmed live: opening user_middle_data, the MAX PROBE field
// shows the twin's own hardcoded default (200), NOT the global settings.probes.maxDist; editing it writes NOTHING
// to ddcs_probe_field_overrides (the id-in-map check silently fails). This was ALREADY dead for corner + circular
// (retired earlier, same shape) and is now ALSO dead for middle/edge/alignment/rotary_center/rotary_clock as of
// t1730 — but again, UNREACHABLE from the live bar for a while already (opensAs routing predates this act); this
// test's own opening gesture is what newly exposes it. This is a real lost user-facing feature across up to 7
// wizards (seed-from-global-default AND the sticky-override UX), not a one-field edge case — flagged prominently
// in WORK-LOG t1730 for an advisor/human decision on whether PROBE_DEFAULT_FIELDS needs a declared, twin-aware
// replacement (e.g. keyed by opType+param instead of a hardcoded DOM id list).
test.fixme('a wizard MAX PROBE edit sticks per-wizard, overrides only its own field, and survives refresh — t1730: applyProbeDefaults/sticky-override is keyed by dead old-view ids, no twin equivalent', async ({ page }) => {
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
  // (Was 'corner'; the built-in Corner is retired ④ → use edge, another built-in probe wizard with a MAX PROBE field.)
  await openWiz(page, 'edge');
  await expect(page.locator('#p_dist')).toHaveValue('33');
});
