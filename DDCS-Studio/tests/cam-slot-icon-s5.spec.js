import { test, expect } from '@playwright/test';

// CAM-UX declare-once S5b — the INTEGRATED icon editor: openIconEditor mounts INLINE inside the wizard, side-by-side with
// the expose/bake param table (mirroring the DDCS controller CAM page: camN.bmp + the operator form together = WYSIWYG). The
// editor edits LAYERS; a fresh New slot seeds the auto default (t1175: the op's glyph, centred, no name text); Import BMP adds a tile layer;
// the icon rides _authoring.icon.layers live and is rasterized to the camN.bmp at build; Edit pre-loads + round-trips.
test.use({ viewport: { width: 1400, height: 1000 } });

async function openCam(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsOpenCamAuthoring === 'function');
}
const camPack = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}'));
async function buildFromPocket(page) {
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } }]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
  await page.waitForSelector('#cbm_iconedit #iconed-modal.ie-inline', { timeout: 8000 });
}

test('S5b: New slot mounts the INLINE editor STACKED above the table (t1175 auto op-glyph); ALL tools present; interactions work; Build rasterizes + carries the icon', async ({ page }) => {
  await openCam(page);
  await buildFromPocket(page);
  const ui = await page.evaluate(() => {
    const host = document.getElementById('cbm_iconedit');
    const ed = host && host.querySelector('#iconed-modal.ie-inline');
    const table = document.getElementById('cbm_table');
    // STACKED: the icon editor sits ABOVE the table (as the DDCS CAM page shows it), not side-by-side.
    const stackedAbove = !!(ed && table) && (host.getBoundingClientRect().top < table.getBoundingClientRect().top);
    return {
      inlineMounted: !!ed,
      notFixed: ed ? getComputedStyle(ed).position !== 'fixed' : false,     // inline, NOT a full-screen overlay
      stageRenders: !!(ed && ed.querySelector('.ie-stage svg')),
      stackedAbove,
      headHidden: ed ? getComputedStyle(ed.querySelector('.ie-head')).display === 'none' : false,   // modal chrome hidden inline
      // AMEND 1 — tool-completeness: the REUSED editor keeps every tool (shapes + tiles + Import + layers/props come with it)
      allShapeTools: ['text', 'rect', 'line', 'circle', 'arrow'].every((t) => !!(ed && ed.querySelector(`[data-add="${t}"]`))),
      hasTiles: !!(ed && ed.querySelector('#ie_tiles')),
      hasImport: !!document.querySelector('[data-act="cbm-icon-import"]'),
    };
  });
  expect(ui.inlineMounted, 'the icon editor mounts INLINE in the wizard').toBe(true);
  expect(ui.notFixed, 'the inline editor is not a full-screen overlay').toBe(true);
  expect(ui.stageRenders, 'the editor stage renders the auto icon (t1175: the op glyph, centred, no name text)').toBe(true);
  expect(ui.stackedAbove, 'the icon editor is STACKED ABOVE the expose/bake table (controller layout)').toBe(true);
  expect(ui.allShapeTools, 'ALL shape tools (Text/Rect/Line/Circle/Arrow) present — reuse kept them').toBe(true);
  expect(ui.hasTiles, 'the tileset toolbar is present').toBe(true);
  expect(ui.hasImport, 'Import BMP is present').toBe(true);
  expect(ui.headHidden, 'the modal head chrome is hidden inline').toBe(true);
  // INTERACTIONS work inline (the GATE-IF concern): adding a shape grows the layer list
  const before = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit .ie-lyr').length);
  await page.click('#cbm_iconedit [data-add="rect"]');
  const after = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit .ie-lyr').length);
  expect(after, 'adding a shape updates the layer list — interactions work in the inline box').toBeGreaterThan(before);
  await page.screenshot({ path: 'scratchpad/cam-s5b-inline-icon.png' });
  // Build → the slot carries the rasterized BMP + the editable layers (360×180)
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'), null, { timeout: 8000 });
  const slot = (await camPack(page)).slots.slice(-1)[0];
  expect(!!(slot.icon && slot.icon.data && slot.icon.data.length > 100), 'the built slot carries the rasterized camN.bmp').toBe(true);
  expect(Array.isArray(slot.icon.layers) && slot.icon.layers.length >= 3, 'the slot stores the editable layers (bg + op-glyph + the added rect)').toBe(true);
  expect(slot.icon.w === 360 && slot.icon.h === 180, 'the icon is 360×180').toBe(true);
});

test('S5b: Edit pre-loads the slot icon LAYERS into the inline editor + they round-trip through Update', async ({ page }) => {
  await openCam(page);
  await buildFromPocket(page);
  await page.click('#cbm_iconedit [data-add="rect"]');   // a distinctive extra layer
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'), null, { timeout: 8000 });
  const before = (await camPack(page)).slots.slice(-1)[0];
  const beforeLayers = before.icon.layers.length;
  expect(beforeLayers, 'the built slot saved its layers').toBeGreaterThanOrEqual(3);
  // Edit → the editor pre-loads the SAVED layers
  await page.click('#cam_slots [data-act="editslot"]');
  await page.waitForSelector('#cbm_iconedit #iconed-modal.ie-inline', { timeout: 8000 });
  const loaded = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit .ie-lyr').length);
  expect(loaded, 'Edit pre-loaded the exact saved icon layers into the editor').toBe(beforeLayers);
  // Update → the layers round-trip (in place)
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'), null, { timeout: 8000 });
  const after = (await camPack(page)).slots;
  expect(after.length, 'overwrote in place').toBe(1);
  expect(after[0].icon.layers.length, 'the icon layers round-trip through Edit→Update').toBe(beforeLayers);
});
