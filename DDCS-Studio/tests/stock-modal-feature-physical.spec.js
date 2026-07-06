import { test, expect } from '@playwright/test';

/**
 * t365 FACE 2 — a feature is PHYSICAL; the datum-relative OFFSET is DERIVED. The M2 mistake stored feature.pos
 * datum-relative, so changing the datum kept the number and MOVED the feature. Now feature.pos is PHYSICAL (stock-local),
 * the offset = physical − datum is derived (the modal's ⌖ number), and changing the datum re-derives the number WITHOUT
 * moving the feature. ASSERT-THE-VALUE: physical pos + the 2D render are INVARIANT across datums; the offset re-derives.
 */
test.use({ viewport: { width: 1200, height: 900 } });

const FEAT = { id: 'p1', shape: 'rect', side: 'inside', pos: { x: 40, y: 25 }, size: { x: 30, y: 18 } };

test('a pocket is PHYSICAL — changing the datum re-derives the offset without moving it (2D invariant); legacy byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  // ── PURE — physical pos INVARIANT across datums; 2D render invariant; the OFFSET re-derives (physical − datum) ──
  const pure = await page.evaluate(async (FEAT) => {
    const { projectWorkpiece, workpieceBackdrop, featureOffset, deriveLegacyFeatures } = await import('/engine/workpiece.js');
    const at = (d) => { const wp = projectWorkpiece({ x: 120, y: 90, z: 20, shape: 'boss', datum: d, features: [FEAT] }); return { pos: wp.features[0].pos, rect: workpieceBackdrop(wp).items[0], off: featureOffset(wp, wp.features[0]) }; };
    return { nnp: at('nnp'), tr: at('ppp'), cc: at('ccp'), legacy: deriveLegacyFeatures({ x: 100, y: 80, z: 20, shape: 'pocket' })[0] };
  }, FEAT);
  // the PHYSICAL pos is the same at every datum — the feature does not move
  expect(pure.tr.pos, 'physical pos invariant at the back-right datum').toEqual({ x: 40, y: 25 });
  expect(pure.cc.pos, 'physical pos invariant at the centre datum').toEqual({ x: 40, y: 25 });
  // the 2D cavity renders at the SAME canvas rect at every datum — it stays put
  expect(pure.tr.rect, 'the 2D cavity stays put at the back-right datum').toEqual(pure.nnp.rect);
  expect(pure.cc.rect, 'the 2D cavity stays put at the centre datum').toEqual(pure.nnp.rect);
  // the DERIVED offset re-derives (physical − datum): nnp dp{0,0}→{40,25}; back-right dp{120,90}→{−80,−65}; centre dp{60,45}→{−20,−20}
  expect(pure.nnp.off, 'front-left datum: offset = physical').toEqual({ x: 40, y: 25 });
  expect(pure.tr.off, 'back-right datum: offset re-derived').toEqual({ x: -80, y: -65 });
  expect(pure.cc.off, 'centre datum: offset re-derived').toEqual({ x: -20, y: -20 });
  // a fresh LEGACY pocket at the default datum = the physical centre (the M2/M1 byte-identical baseline)
  expect(pure.legacy.pos, 'legacy pocket pos = the physical block centre').toEqual({ x: 50, y: 40 });
  expect(pure.legacy.size).toEqual({ x: 60, y: 40 });

  // ── REAL-SYMPTOM — the modal cavity stays at the SAME screen spot when the datum changes (only crosshair/offset move) ──
  const snapshot = await page.evaluate(() => localStorage.getItem('ddcs_studio_settings'));
  const rectAt = async (datum) => {
    await page.evaluate(async ({ datum, FEAT }) => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape: 'boss', show: true, datum, pin: 'origin', features: [FEAT] } }); window.ddcsOpenStock(); }, { datum, FEAT });
    await page.waitForSelector('#se_canvas svg rect.fc-feature-pocket', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(350);
    return page.evaluate(() => { const b = document.querySelector('#se_canvas svg rect.fc-feature-pocket').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; });
  };
  const nnp = await rectAt('nnp');
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/face2_pocket_nnp.png' });
  const tr = await rectAt('ppp');
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/face2_pocket_tr.png' });
  expect(Math.hypot(tr.x - nnp.x, tr.y - nnp.y), 'the pocket stays at the SAME screen spot when the datum changes (physical, not moved)').toBeLessThan(6);

  await page.evaluate((snap) => { const K = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(K, snap); else localStorage.removeItem(K); }, snapshot);
});
