import { test, expect } from '@playwright/test';

// t1187 — 'Use in icon': the CAM sim panel snapshots its CLEAN render (geometry only — stock + toolpath, NO grid/axes/handles/
// HUD/buttons) and drops it into the inline icon builder as a movable, editable imported TILE layer. Currently a 2D-toolpath
// capture (createPreviewPanel.snapshot → toolpath2d.snapshot with clean=true); the WebGL 3D clean-capture is a follow-on.
test.use({ viewport: { width: 1400, height: 1000 } });

test('panel.snapshot() → a clean geometry-only PNG that drops into the icon editor as a tile layer', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  const r = await page.evaluate(async () => {
    const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
    const host = document.createElement('div'); host.style.cssText = 'width:420px;height:230px;position:fixed;left:8px;top:8px;'; document.body.appendChild(host);
    const gcode = 'G21\nG90\nG0 X0 Y0 Z5\nG1 Z-2 F120\nG1 X60 Y0 F600\nG1 X60 Y36\nG1 X0 Y36\nG1 X0 Y0\nG1 X12 Y10\nG1 X48 Y10\nG1 X48 Y26\nG1 X12 Y26\nG1 X12 Y10\nG0 Z5\n';
    const panel = createPreviewPanel(host, { getGcode: () => gcode, createVarStore: () => new Map() });
    panel.setView('2d'); panel.setActive(true);
    await new Promise((res) => setTimeout(res, 350));
    const segs = panel.getSegments().length;
    const url = panel.snapshot();
    // drop it into a real icon editor as a movable tile layer — the SAME path Use-in-icon uses (_iconEditor.addImage → imageTileLayer)
    const { openIconEditor } = await import('/ui/iconEditor.js');
    const mount = document.createElement('div'); mount.style.cssText = 'position:fixed;right:8px;top:8px;width:760px;'; document.body.appendChild(mount);
    const ed = openIconEditor({ layers: [] }, null, { mount });
    const before = ed.getLayers().length;
    if (url) ed.addImage(url);
    const layers = ed.getLayers();
    return { segs, ok: typeof url === 'string' && url.startsWith('data:image/png'), len: (url || '').length, added: layers.length - before, topTile: layers[layers.length - 1] && layers[layers.length - 1].tile };
  });
  expect(r.segs, 'the fed toolpath traced to segments').toBeGreaterThan(0);
  expect(r.ok, 'snapshot() returns a PNG data-URL').toBe(true);
  expect(r.len, 'a non-trivial capture (real pixels)').toBeGreaterThan(1000);
  expect(r.added, 'exactly one tile layer added').toBe(1);
  expect(r.topTile, 'the added layer is an imported tile (imageTileLayer)').toBe('imported');
});

test('Use in icon before Simulate → a gentle notice, no layer added (button wiring)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  await page.waitForFunction(() => typeof window.ddcsBuildCamSlot === 'function');
  await page.evaluate(() => { window.ddcsGetBlockProgram = () => ([{ id: 'p1', type: 'op', opType: 'pocket', label: 'Pocket', params: { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 } }]); });
  await page.evaluate(() => window.ddcsBuildCamSlot());
  await page.waitForSelector('#cbm_iconedit #iconed-modal.ie-inline', { timeout: 8000 });
  const beforeN = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit #ie_layers .ie-lyr').length);
  await page.click('[data-act="cbm-use-icon"]');   // no sim yet
  await page.waitForTimeout(200);
  const afterN = await page.evaluate(() => document.querySelectorAll('#cbm_iconedit #ie_layers .ie-lyr').length);
  const notice = await page.evaluate(() => document.body.textContent.includes('Simulate first'));
  expect(afterN, 'no layer added when not simulated').toBe(beforeN);
  expect(notice, 'a gentle "Simulate first" notice').toBe(true);
});
