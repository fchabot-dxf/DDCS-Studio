import { test, expect } from '@playwright/test';

// CAM Builder S1c/S1d — the reusable authoring surface: op-card door (door 1) + editor-toolbar door (door 2), the
// expose/bake table, and (S1d) friendly ENUM DROPDOWNS with the enum→int pendant mapping. Verifies the op-menu gating,
// the modal seeds from the op, numeric all-exposed Build is byte-safe, baking Feed drops its read+eng line, enum fields
// render label dropdowns mapping to their ints (guards Bake-greyed), and door 2 opens the modal. Screenshot = enum.
test.use({ viewport: { width: 1280, height: 1000 } });

const POCKET = { id: 'p1', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } };
const CORNER = { id: 'c1', opType: 'corner', label: 'Probe corner', params: { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 } };

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
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

test('modal (op-card door): seed pocket numeric, bake Feed, Build byte-safe', async ({ page }) => {
  await openCam(page);
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), POCKET);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  const feedIsInput = await page.evaluate(() => document.querySelector('#cbm_table tr[data-fkey="feed"] .cbm-val').tagName);
  expect(feedIsInput, 'numeric field → a number input, not a dropdown').toBe('INPUT');

  // all-exposed Build keeps every read (byte-safe)
  await page.click('[data-act="cbm-build"]');
  await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
  await page.click('.cam-sim-overlay [data-cbm="ok"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  let slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.body, 'all-exposed: Feed read line present').toMatch(/=#\d+\s+;Feed/);

  // bake Feed → its read + eng line vanish + the literal inlines
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), POCKET);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  await page.check('.cbm-eb[data-fkey="feed"][data-mode="bake"]');
  await page.click('[data-act="cbm-build"]');
  await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
  await page.click('.cam-sim-overlay [data-cbm="ok"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.body, 'baked: NO Feed read line').not.toMatch(/=#\d+\s+;Feed/);
  expect(slot.ops[0].baked.feed, 'baked value recorded').toBe(1500);
  const engHasFeed = await page.evaluate((s) => import('/data/slotPack.js').then((m) => /"Feed"/.test(m.slotEng(s))), slot);
  expect(engHasFeed, 'baked: no Feed eng row').toBe(false);
});

test('S1d ENUM: a corner op shows friendly dropdowns mapping to ints; choice params are bakeable; bake corner inlines the int', async ({ page }) => {
  await openCam(page);
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), CORNER);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  const r = await page.evaluate(() => {
    const cell = (k) => document.querySelector(`#cbm_table tr[data-fkey="${k}"] .cbm-val`);
    const sel = (k) => { const s = cell(k); return { tag: s.tagName, value: s.value, label: s.tagName === 'SELECT' ? s.options[s.selectedIndex].textContent : null }; };
    const bakeDisabled = (k) => document.querySelector(`#cbm_table tr[data-fkey="${k}"] .cbm-eb[data-mode="bake"]`).disabled;
    return { corner: sel('corner'), wcs: sel('wcs'), seq: sel('seq'), probeZ: sel('probeZ'), maxProbe: sel('maxProbe'),
      bake: { corner: bakeDisabled('corner'), seq: bakeDisabled('seq'), wcs: bakeDisabled('wcs') } };
  });
  // enum fields → friendly-label dropdowns, selected label maps to the CAM int (grounded)
  expect(r.corner, 'corner → dropdown, Front-Right selected = int 2').toMatchObject({ tag: 'SELECT', value: '2', label: 'Front-Right' });
  expect(r.wcs, 'wcs → dropdown, G55 = int 2').toMatchObject({ tag: 'SELECT', value: '2', label: 'G55' });
  expect(r.seq, 'seq → dropdown, X then Y = int 1').toMatchObject({ tag: 'SELECT', value: '1', label: 'X then Y' });
  expect(r.probeZ, 'probeZ → dropdown, Yes = int 1').toMatchObject({ tag: 'SELECT', value: '1', label: 'Yes' });
  expect(r.maxProbe, 'maxProbe (←dist) → number input = 80').toMatchObject({ tag: 'INPUT', value: '80' });
  // t1047 amend — choice params are BAKEABLE (Bake enabled), the dropdown serves both expose and bake
  expect(r.bake, 'corner/seq/wcs choice enums → Bake ENABLED').toMatchObject({ corner: false, seq: false, wcs: false });

  // demo BOTH on corner: BAKE it (its dropdown-picked int inlines, the row leaves the pendant)
  await page.check('.cbm-eb[data-fkey="corner"][data-mode="bake"]');
  await page.waitForFunction(() => { const tr = [...document.querySelectorAll('#cbm_table tbody tr')].find((x) => x.dataset.fkey === 'corner'); return tr && /baked = Front-Right \(2\)/.test(tr.children[3].textContent); });

  // VIEWED gate screenshot — corner BAKED (Front-Right) + the other choice params as exposed dropdowns
  await page.screenshot({ path: 'test-results/cam-s1d-enum.png' });

  // Build → corner is inlined as the literal 2 (valid G-code), its read + eng line vanish
  await page.click('[data-act="cbm-build"]');
  await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
  await page.click('.cam-sim-overlay [data-cbm="ok"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.ops[0].baked.corner, 'corner baked = int 2 (FR)').toBe(2);
  expect(slot.body, 'baked corner: NO Corner read line').not.toMatch(/=#\d+\s+;Corner/);
  expect(slot.body, 'baked corner constant-folds into the IF (valid G-code)').toContain('IF 2 EQ 2');
  expect(slot.body, 'macro still ends M30 (structurally valid)').toContain('M30');
  const engHasCorner = await page.evaluate((s) => import('/data/slotPack.js').then((m) => /"Corner/.test(m.slotEng(s))), slot);
  expect(engHasCorner, 'baked corner: no Corner eng row').toBe(false);
});

test('door 2: the editor-toolbar button opens the authoring modal with the picker', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  // the editor-toolbar button exists + is wired to ddcsBuildCamSlot; invoking it opens the modal with the picker.
  const wired = await page.evaluate(() => { const b = document.getElementById('editor-cam-btn'); return !!b && /ddcsBuildCamSlot/.test(b.getAttribute('onclick') || '') && typeof window.ddcsBuildCamSlot === 'function'; });
  expect(wired, 'door 2 button present + wired to ddcsBuildCamSlot').toBe(true);
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 100, h: 80, depth: 4, stepdown: 1.5, toolDia: 6, feed: 1000, plunge: 100, clearance: 5, rpm: 8000, stepoverPct: 40 } }]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay', { timeout: 8000 });
  expect(await page.evaluate(() => !!document.getElementById('cbm_seed')), 'door 2 shows the seed picker (no specific op)').toBe(true);
});
