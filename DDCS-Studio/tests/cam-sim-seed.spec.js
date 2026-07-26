import { test, expect } from '@playwright/test';

// t1189 — the CAM authoring Simulate must show a REAL toolpath for a slot with real values. Two fixes together:
//   (1) cbmSimulate seeds each field's DISPLAYED value (cbmVal, what the param table shows), not the generator default.
//   (2) createPreviewPanel.simConfig now passes createVarStore to the STATIC route trace (was play-only) — so a CAM-slot
//       macro's #2600+ mirrors are seeded and its guards (e.g. the pocket size guard) do not trip → 'No drawable moves'.
test.use({ viewport: { width: 1400, height: 1000 } });

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsBuildCamSlot === 'function');
}
async function buildAndSim(page, op) {
  await page.evaluate((o) => { window.ddcsCbmSimPanel = null; window.ddcsGetBlockProgram = () => ([o]); }, op);
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('#cbm_iconedit #iconed-modal.ie-inline', { timeout: 8000 });
  await page.click('[data-act="cbm-sim"]');
  await page.waitForFunction(() => window.ddcsCbmSimPanel && window.ddcsCbmSimPanel.getSegments && window.ddcsCbmSimPanel.getSegments().length >= 0, null, { timeout: 8000 });
}

test('a Pocket with real values simulates to a REAL toolpath (not "No drawable moves") → Use in icon', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await openCam(page);
  await buildAndSim(page, { id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } });
  await page.waitForFunction(() => window.ddcsCbmSimPanel.getSegments().length > 0, null, { timeout: 8000 });
  const segs = await page.evaluate(() => window.ddcsCbmSimPanel.getSegments().length);
  const before = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit #ie_layers .ie-lyr').length);
  await page.click('[data-act="cbm-use-icon"]');
  await page.waitForFunction((n) => document.querySelectorAll('#cbm_iconedit #ie_layers .ie-lyr').length > n, before, { timeout: 8000 });
  const labels = await page.evaluate(() => [...document.querySelectorAll('#cbm_iconedit #ie_layers .ie-lyr span')].map((s) => s.textContent.trim()));
  expect(segs, 'the pocket simulates to a real raster toolpath').toBeGreaterThan(50);
  expect(labels.includes('imported'), 'Use in icon adds the clean toolpath layer').toBe(true);
});

test('regression: a corner probe + a boss middle still simulate', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await openCam(page);
  await buildAndSim(page, { id: 'c1', type: 'op', opType: 'corner', label: 'Corner', params: { corner: 'FL', probeSeq: 0, dist: 50, travelDist: 5, scanDepth: 2, f_fast: 300, f_slow: 60, wcs: 0, probeZ: 0 } });
  await page.waitForFunction(() => window.ddcsCbmSimPanel.getSegments().length > 0, null, { timeout: 8000 });
  const cornerSegs = await page.evaluate(() => window.ddcsCbmSimPanel.getSegments().length);
  await page.evaluate(() => { const x = document.querySelector('.cam-auth-overlay [data-act="cbm-cancel"]'); if (x) x.click(); });
  await page.waitForTimeout(200);
  await buildAndSim(page, { id: 'm1', type: 'op', opType: 'middle', label: 'Middle', params: { twoAxis: true, findBoth: true, featureType: 'boss', dist: 40, f_fast: 300, f_slow: 60, wcs: 0 } });
  await page.waitForFunction(() => window.ddcsCbmSimPanel.getSegments().length > 0, null, { timeout: 8000 });
  const bossSegs = await page.evaluate(() => window.ddcsCbmSimPanel.getSegments().length);
  expect(cornerSegs, 'corner probe still simulates').toBeGreaterThan(0);
  expect(bossSegs, 'boss middle still simulates').toBeGreaterThan(0);
});
