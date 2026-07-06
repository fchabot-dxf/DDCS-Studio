import { test, expect } from '@playwright/test';

/**
 * t367 (LAST blocker) — a BOSS stock must show NO inside cavity (human: "boss is showing a pocket, not correct"). The
 * shape/features[] leak: a materialized/declared pocket in features[] overrode the shape dropdown, so a boss rendered a
 * pocket. FIX (transitional reconcile): projectWorkpiece RESPECTS the shape — only a `pocket` OUTER shows an interior
 * cavity; boss/box/cylinder filter inside cavities (VIEW-filter, non-destructive → the pocket data is PRESERVED for a
 * toggle back). ASSERT-THE-VALUE: boss → 0 cavities, pocket → 1, in the projection AND the modal; toggling reconciles.
 */
test.use({ viewport: { width: 1200, height: 900 } });

const FEAT = { id: 'p1', shape: 'rect', side: 'inside', pos: { x: 40, y: 25 }, size: { x: 30, y: 18 } };

test('boss/box/cylinder show NO inside cavity; pocket shows one; the shape dropdown toggle reconciles (data preserved)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  // ── PURE — the shape gates the interior cavity even when features[] holds one ──
  const pure = await page.evaluate(async (FEAT) => {
    const { projectWorkpiece, deriveLegacyFeatures } = await import('/engine/workpiece.js');
    const inside = (wp) => wp.features.filter((f) => f.side === 'inside').length;
    return {
      boss: inside(projectWorkpiece({ x: 120, y: 90, z: 20, shape: 'boss', features: [FEAT] })),      // a stored pocket under a boss
      cyl: inside(projectWorkpiece({ x: 120, y: 90, z: 20, shape: 'cylinder', features: [FEAT] })),
      pocket: inside(projectWorkpiece({ x: 120, y: 90, z: 20, shape: 'pocket', features: [FEAT] })),
      legacyPos: deriveLegacyFeatures({ x: 100, y: 80, z: 20, shape: 'pocket' })[0].pos,               // byte-identical baseline
    };
  }, FEAT);
  expect(pure.boss, 'a boss shows NO inside cavity (the leak is gated)').toBe(0);
  expect(pure.cyl, 'a cylinder shows NO inside cavity').toBe(0);
  expect(pure.pocket, 'a pocket shows the inside cavity').toBe(1);
  expect(pure.legacyPos, 'a fresh legacy pocket is byte-identical (physical centre)').toEqual({ x: 50, y: 40 });

  // ── REAL-SYMPTOM — the modal: a boss renders solid (no fc-feature-pocket); a pocket renders the cavity ──
  const snapshot = await page.evaluate(() => localStorage.getItem('ddcs_studio_settings'));
  const cavities = () => page.evaluate(() => document.querySelectorAll('#se_canvas svg rect.fc-feature-pocket').length);
  const setShape = async (v) => { await page.evaluate((v) => { const s = document.querySelector('#se_shape'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v); await page.waitForTimeout(350); };

  // open a POCKET carrying a declared feature → the cavity shows
  await page.evaluate(async (FEAT) => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'origin', features: [FEAT] } }); window.ddcsOpenStock(); }, FEAT);
  await page.waitForSelector('#se_canvas svg', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(350);
  expect(await cavities(), 'pocket → the cavity is drawn').toBe(1);
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/pocket_cavity.png' });

  // switch the SHAPE dropdown to boss → the cavity disappears (features[] preserved, just view-filtered)
  await setShape('boss');
  expect(await cavities(), 'switch to boss → NO cavity (the leak fixed)').toBe(0);
  expect(await page.evaluate(() => (window.ddcsGetSettings().stock.features || []).length), 'the pocket feature DATA is preserved (non-destructive)').toBe(1);
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/boss_no_cavity.png' });

  // switch back to pocket → the cavity is restored (the preserved feature reappears)
  await setShape('pocket');
  expect(await cavities(), 'switch back to pocket → the cavity is restored').toBe(1);

  // EMIT byte-identical — the shape/features are display-only for a probe op (never in the G-code)
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); try { localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); } catch (_) {} });
  const emitAt = (shape) => page.evaluate(async (shape) => {
    const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape, show: true, datum: 'nnp', pin: 'origin', features: [] } });
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    return emitMapped(builderOf('user_corner_data')({ ...CORNER_DEFAULTS })).text;
  }, shape);
  expect(await emitAt('boss'), 'emit byte-identical: boss == pocket (shape is display-only)').toBe(await emitAt('pocket'));

  await page.evaluate((snap) => { const K = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(K, snap); else localStorage.removeItem(K); }, snapshot);
});
