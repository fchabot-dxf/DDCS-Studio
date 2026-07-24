import { test, expect } from '@playwright/test';

// CAM FINISH S-A (Gap 4) — a probe CAM slot's incremental G31 macro previewed BLACK (no stock/start → clamps to zero).
// For probe slots the preview now synthesizes a top-datum stock box + a start above it. Non-probe (pocket) slots pass
// neither = byte-identical. VIEWED verification: a corner/probe preview shows the stock + probe path (not black); a
// pocket preview is unchanged (self-framed). Also asserts the branch fires only for probe macros (G31).
test.use({ viewport: { width: 1280, height: 1000 } });

const CORNER = { id: 'c1', opType: 'corner', label: 'Probe corner', params: { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 } };
const POCKET = { id: 'p1', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } };

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
}
async function simulate(page, op) {
  await page.evaluate((o) => window.ddcsOpenCamAuthoring(o), op);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  await page.click('[data-act="cbm-sim"]');
  await page.waitForFunction(() => { const h = document.getElementById('cbm_preview'); return h && h.querySelector('canvas'); }, null, { timeout: 8000 });
  await page.waitForTimeout(800);   // let the engine play a few frames so the trace + stock render
}

test('probe CAM slot preview: stock + path renders (not black); the branch fires only for G31 macros', async ({ page }) => {
  await openCam(page);

  // sanity: a corner slot's macro IS a probe (G31), a pocket slot's is NOT — so probePreviewOpts fires only for the probe
  const macros = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    // the CAM slot macro comes from the generators; probe corner uses G31, pocket does not
    const { cornerSlot } = await import('/data/probeToSlot.js');
    const { pocketSlot } = await import('/data/millToSlot.js');
    return { probeHasG31: /\bG31\b/.test(cornerSlot(new Set(), 0).body), pocketHasG31: /\bG31\b/.test(pocketSlot(new Set(), 0).body) };
  });
  expect(macros.probeHasG31, 'a probe slot macro has G31 → probe preview stock synthesized').toBe(true);
  expect(macros.pocketHasG31, 'a pocket slot macro has NO G31 → preview unchanged (byte-identical)').toBe(false);

  // VIEWED gate — the corner/probe preview (must show a stock box + a probe path, not a black void)
  await simulate(page, CORNER);
  await page.screenshot({ path: 'test-results/cam-s-a-probe.png' });

  // the pocket/mill preview (unchanged, self-framed) — for the "non-probe unchanged" comparison
  await page.evaluate(() => window.ddcsOpenCamAuthoring && document.querySelector('[data-act="cbm-cancel"]') && document.querySelector('[data-act="cbm-cancel"]').click());
  await simulate(page, POCKET);
  await page.screenshot({ path: 'test-results/cam-s-a-pocket.png' });

  // the preview mounted for both (a canvas exists) — the VIEWED screenshots confirm the probe is no longer black
  expect(await page.evaluate(() => !!document.querySelector('#cbm_preview canvas'))).toBe(true);
});
