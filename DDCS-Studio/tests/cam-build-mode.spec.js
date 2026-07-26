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
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  let slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.body, 'all-exposed: Feed read line present').toMatch(/=#\d+\s+;Feed/);

  // bake Feed → its read + eng line vanish + the literal inlines
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), POCKET);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  await page.check('.cbm-eb[data-fkey="feed"][data-mode="bake"]');
  await page.click('[data-act="cbm-build"]');
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
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.ops[0].baked.corner, 'corner baked = int 2 (FR)').toBe(2);
  expect(slot.body, 'baked corner: NO Corner read line').not.toMatch(/=#\d+\s+;Corner/);
  expect(slot.body, 'baked corner constant-folds into the IF (valid G-code)').toContain('IF 2 EQ 2');
  expect(slot.body, 'macro still ends M30 (structurally valid)').toContain('M30');
  const engHasCorner = await page.evaluate((s) => import('/data/slotPack.js').then((m) => /"Corner/.test(m.slotEng(s))), slot);
  expect(engHasCorner, 'baked corner: no Corner eng row').toBe(false);
});

test('t1049 FIX: a real data-op TWIN op opens the modal seeded (user_surfacing_data → surface slot)', async ({ page }) => {
  await openCam(page);
  const TWIN = { id: 's1', opType: 'user_surfacing_data', label: 'Surfacing (data)', params: { originX: 0, originY: 0, w: 200, h: 150, depth: 0.8, stepdown: 0.4, stepover: 9.6, strategy: 'parallel', feed: 900, plunge: 180, rpm: 12000, wcs: 'G54' } };
  await page.evaluate((op) => window.ddcsOpenCamAuthoring(op), TWIN);
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  const seeded = await page.evaluate(() => ({
    recognized: document.querySelectorAll('#cbm_table tbody tr').length > 0,   // rows render ⇒ seedFromOp resolved the twin (not "pick an op")
    fromOpSurface: /surface/.test(document.querySelector('.cam-build-mode').textContent),
    stepover: document.querySelector('#cbm_table tr[data-fkey="stepover"] .cbm-val').value,
    depth: document.querySelector('#cbm_table tr[data-fkey="depth"] .cbm-val').value,
  }));
  expect(seeded.recognized, 'the twin resolves to a CAM type (table renders, not unsupported)').toBe(true);
  expect(seeded.fromOpSurface, 'the seed-locked header names the surface CAM type').toBe(true);
  expect(seeded.stepover, 'the twin flat stepover 9.6 seeds the table').toBe('9.6');
  expect(seeded.depth).toBe('0.8');
});

test('door 2 + auto-import: the editor-toolbar button auto-imports CAM-able program ops (no picker)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  // t1191 — the door-2 button is now the '＋ Make ▾' menu (onclick ddcsEditorMakeMenu); its CAM slot item reaches
  // ddcsBuildCamSlot, whose auto-import behaviour (exercised below) is unchanged.
  const wired = await page.evaluate(() => { const b = document.getElementById('editor-cam-btn'); return !!b && /ddcsEditorMakeMenu/.test(b.getAttribute('onclick') || '') && typeof window.ddcsBuildCamSlot === 'function'; });
  expect(wired, 'door 2 button present (＋ Make ▾ menu) + ddcsBuildCamSlot reachable').toBe(true);
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 100, h: 80, depth: 4, stepdown: 1.5, toolDia: 6, feed: 1000, plunge: 100, clearance: 5, rpm: 8000, stepoverPct: 40 } }]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
  expect(await page.evaluate(() => !document.getElementById('cbm_seed')), 'the seed picker is DROPPED (auto-import model)').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('.cbm-op-group').length), 'the pocket op auto-imported as a group').toBe(1);
});

test('S-C multi-op: a program of 3 CAM-able ops auto-imports group-by-op → Build to ONE composed slot', async ({ page }) => {
  await openCam(page);
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([
    { id: 's1', type: 'op', opType: 'surfacing', label: 'Surfacing', params: { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, rpm: 12000 } },
    { id: 'd1', type: 'op', opType: 'drill', label: 'Drill', params: { method: 'peck', pattern: 'grid', x0: 0, y0: 0, originX: 100, originY: 50, cols: 3, rows: 2, dx: 20, dy: 20, depth: 12, peck: 3, feed: 280, rpm: 8000 } },
    { id: 'c1', type: 'op', opType: 'corner', label: 'Probe corner', params: { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 } },
    { id: 'x1', type: 'op', opType: 'contour', label: 'Contour', params: {} },
  ]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());   // door 2 auto-imports
  await page.waitForSelector('.cam-auth-overlay .cbm-eb');
  const groups = await page.evaluate(() => [...document.querySelectorAll('.cbm-op-group')].map((g) => g.firstElementChild.textContent.trim()));
  expect(groups.length, '3 CAM-able ops imported (contour skipped)').toBe(3);
  expect(groups[0]).toContain('Surfacing'); expect(groups[1]).toContain('Drill'); expect(groups[2]).toContain('Probe corner');

  await page.click('[data-act="cbm-sim"]');
  await page.waitForFunction(() => { const h = document.getElementById('cbm_preview'); return h && h.querySelector('canvas'); }, null, { timeout: 8000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/cam-s-c-multiop.png' });

  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const slot = (await camPack(page)).slots.slice(-1)[0];
  expect(slot.ops.length, 'ONE slot composes all 3 ops').toBe(3);
  expect(slot.ops.map((o) => o.type)).toEqual(['surface', 'drill', 'corner']);
  expect(new Set((slot.fields || []).map((f) => f._op)).size, 'the slot fields span all 3 ops (group-by-op)').toBe(3);
});

test('S-C empty-state: a program with NO CAM-able ops shows the empty-state, not a greyed dropdown', async ({ page }) => {
  await openCam(page);
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'x1', type: 'op', opType: 'contour', label: 'Contour', params: {} }]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay');
  const r = await page.evaluate(() => ({ picker: !!document.getElementById('cbm_seed'), groups: document.querySelectorAll('.cbm-op-group').length, text: (document.getElementById('cbm_table') || {}).textContent || '' }));
  expect(r.picker, 'no dropdown').toBe(false);
  expect(r.groups, 'no op groups').toBe(0);
  expect(r.text, 'empty-state message').toContain('No CAM-able ops');
  expect(r.text, 'lists supported ops').toContain('Pocket');
  expect(r.text, 'the present contour shows its unsupported reason').toMatch(/Contour.*NO CAM generator/);
});
