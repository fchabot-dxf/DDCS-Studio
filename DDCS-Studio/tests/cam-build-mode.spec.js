import { test, expect } from '@playwright/test';

// CAM Builder S1c — the reusable authoring surface + its op-card door (door 1). A per-op "▸ Build CAM slot" action
// (only on CAM-able ops) opens the SAME modal, pre-seeded from that op. Verifies: the op-menu action gating, the modal
// seeds from the op (picker hidden), all-exposed Build is byte-safe, baking Feed drops its read+eng line, and a
// screenshot for the VIEWED gate.
test.use({ viewport: { width: 1280, height: 1000 } });

const POCKET = { id: 'p1', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } };

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));   // inits macrosApp -> window.ddcsOpenCamAuthoring + ddcsCamTypeOf
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
}
const camPack = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}'));

test('op-card CAM action: enabled for CAM-able ops, greyed for unsupported, absent for non-CAM types', async ({ page }) => {
  await openCam(page);
  const r = await page.evaluate(async () => {
    const { showOpMenu, hideOpMenu } = await import('/ui/opContextMenu.js');
    window.ddcsGetBlockProgram = () => ([
      { id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 100, h: 80, depth: 4, stepdown: 1.5, toolDia: 6, feed: 1000, plunge: 100, clearance: 5, rpm: 8000, stepoverPct: 40 } },
      { id: 'm1', type: 'op', opType: 'middle', label: 'Middle', params: { featureType: 'pocket', twoAxis: false } },
      { id: 'c1', type: 'op', opType: 'contour', label: 'Contour', params: {} },
    ]);
    const camItem = (op) => { showOpMenu(op, 50, 50); const it = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].filter((b) => /Build CAM slot/.test(b.textContent)).map((b) => ({ t: b.textContent, d: b.disabled })); hideOpMenu(); return it[0] || null; };
    return { pocket: camItem({ id: 'p1', opType: 'pocket', label: 'Pocket' }), middle: camItem({ id: 'm1', opType: 'middle', label: 'Middle' }), contour: camItem({ id: 'c1', opType: 'contour', label: 'Contour' }) };
  });
  expect(r.pocket, 'pocket (CAM-able) → enabled CAM action').toMatchObject({ d: false });
  expect(r.middle && r.middle.d, 'middle single-axis → CAM action greyed').toBe(true);
  expect(r.contour, 'contour (non-CAM type) → NO CAM action').toBeNull();
});

test('CAM authoring modal (op-card door): seed pocket, bake Feed, Build to slot', async ({ page }) => {
  await openCam(page);

  // door 1: open the modal pre-seeded from the pocket op (picker hidden)
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), POCKET);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  const surface = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cbm_table tbody tr')].map((tr) => ({ key: tr.dataset.fkey, val: tr.querySelector('.cbm-val').value }));
    return { fromOp: /From op/.test(document.querySelector('.cam-build-mode').textContent), hasPicker: !!document.getElementById('cbm_seed'), rows };
  });
  expect(surface.fromOp, 'seed-locked: shows "From op", not the picker').toBe(true);
  expect(surface.hasPicker, 'op-card door hides the picker').toBe(false);
  expect(surface.rows.find((r) => r.key === 'feed').val, 'feed seeded from the op').toBe('1500');
  expect(surface.rows.find((r) => r.key === 'stepover').val, 'stepover DERIVED (8*45/100)').toBe('3.6');

  // inline preview docks + renders
  await page.click('[data-act="cbm-sim"]');
  await page.waitForFunction(() => { const h = document.getElementById('cbm_preview'); return h && h.querySelector('canvas'); }, null, { timeout: 8000 });

  // VIEWED gate screenshot — the op-card modal authoring surface + docked preview
  await page.screenshot({ path: 'test-results/cam-s1c-authoring.png' });

  // all-exposed Build (new slot) → every field read survives (byte-safe) + manifest all-exposed
  await page.click('[data-act="cbm-build"]');
  await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
  await page.click('.cam-sim-overlay [data-cbm="ok"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const afterExposed = await camPack(page);
  const exposedSlot = afterExposed.slots[afterExposed.slots.length - 1];
  expect(exposedSlot.body, 'all-exposed: Feed read line present').toMatch(/=#\d+\s+;Feed/);
  expect(exposedSlot.ops[0], 'all-exposed manifest carries empty exposed/baked').toMatchObject({ type: 'pocket', exposed: {}, baked: {} });

  // re-open (op-card door), BAKE Feed, Build → the Feed read + eng line vanish + the literal inlines
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), POCKET);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  await page.check('.cbm-eb[data-fkey="feed"][data-mode="bake"]');
  await page.waitForFunction(() => { const tr = [...document.querySelectorAll('#cbm_table tbody tr')].find((x) => x.dataset.fkey === 'feed'); return tr && /baked = /.test(tr.children[3].textContent); });
  await page.click('[data-act="cbm-build"]');
  await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
  await page.click('.cam-sim-overlay [data-cbm="ok"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const afterBake = await camPack(page);
  const bakedSlot = afterBake.slots[afterBake.slots.length - 1];

  expect(bakedSlot.body, 'baked: NO Feed read line').not.toMatch(/=#\d+\s+;Feed/);
  expect(bakedSlot.body, 'baked: the 1500 literal is inlined').toContain('1500');
  expect(bakedSlot.ops[0].baked.feed, 'the op manifest records the baked value').toBe(1500);
  const engHasFeed = await page.evaluate((s) => import('/data/slotPack.js').then((m) => /"Feed"/.test(m.slotEng(s))), bakedSlot);
  expect(engHasFeed, 'baked: the pendant eng has no Feed row').toBe(false);
});
