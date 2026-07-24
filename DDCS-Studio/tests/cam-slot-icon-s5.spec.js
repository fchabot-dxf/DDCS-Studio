import { test, expect } from '@playwright/test';

// CAM-UX declare-once S5 — the icon editor INTO the wizard (LAUNCH-modal + LARGE preview). mountAuthoringSurface shows a
// 360×180 icon preview beside the slot-name row + "🎨 Draw/Edit icon" (launches openIconEditor as a modal) + "🖼 Import BMP".
// A fresh New slot AUTO-ICONS (never blank). The icon rides _authoring.icon through Build (New) AND Update (Edit); Edit
// pre-loads slot.icon so the preview shows it + it is re-editable.
test.use({ viewport: { width: 1280, height: 1000 } });

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
}

test('S5: a fresh New slot AUTO-ICONS — the wizard shows a LARGE 360×180 preview + Draw/Import; the slot carries the icon', async ({ page }) => {
  await openCam(page);
  await buildFromPocket(page);
  const step = await page.evaluate(() => {
    const el = document.getElementById('cbm_iconstep');
    const img = el && el.querySelector('img');
    return {
      hasStep: !!el,
      hasPreview: !!(img && img.src && img.src.length > 100),
      width: img ? Math.round(img.getBoundingClientRect().width) : 0,
      hasDraw: !!(el && el.querySelector('[data-act="cbm-icon-edit"]')),
      hasImport: !!(el && el.querySelector('[data-act="cbm-icon-import"]')),
    };
  });
  expect(step.hasStep, 'the wizard icon step renders').toBe(true);
  expect(step.hasPreview, 'a fresh New slot auto-icons — the preview is NOT blank').toBe(true);
  expect(step.width, 'the preview is LARGE (not the tiny settings thumbnail)').toBeGreaterThan(150);
  expect(step.hasDraw && step.hasImport, 'Draw/Edit + Import BMP buttons present').toBe(true);
  await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/cam-s5-iconstep.png' });   // VIEWED — the wizard icon step (large preview + Draw/Import), surfaced to the advisor/user
  // Build → the built slot carries the auto-icon (360×180)
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const slot = (await camPack(page)).slots.slice(-1)[0];
  expect(!!(slot.icon && slot.icon.data && slot.icon.data.length > 100), 'the built slot carries the icon').toBe(true);
  expect(slot.icon.w === 360 && slot.icon.h === 180, 'the icon is 360×180').toBe(true);
});

test('S5: Edit PRE-LOADS the slot icon into the wizard preview + it round-trips through Update', async ({ page }) => {
  await openCam(page);
  await buildFromPocket(page);
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const before = (await camPack(page)).slots.slice(-1)[0];
  expect(!!(before.icon && before.icon.data), 'the built slot has an icon to pre-load').toBe(true);
  // Edit → the icon step preview shows the PRE-LOADED slot icon
  await page.click('#cam_slots [data-act="editslot"]');
  await page.waitForSelector('.cam-auth-overlay .cbm-eb', { timeout: 8000 });
  const preloaded = await page.evaluate(() => { const img = document.querySelector('#cbm_iconstep img'); return img ? img.src : ''; });
  expect(preloaded === before.icon.data, 'Edit pre-loaded the exact slot icon into the wizard preview').toBe(true);
  // Update → the icon round-trips (in place)
  await page.click('[data-act="cbm-build"]');
  await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
  const after = (await camPack(page)).slots;
  expect(after.length, 'still ONE slot — overwrote in place').toBe(1);
  expect(after[0].icon.data === before.icon.data, 'the icon round-trips through Edit→Update').toBe(true);
});
