import { test, expect } from '@playwright/test';

/**
 * TOOL-SETTER MODEL — the fixed touch-off block the Tool Length + Tool Check wizards probe against now RENDERS in
 * their previews, at its configured machine position, on the fixed machine frame. ONE-SOURCE: the setter position
 * comes from settings.probes ({ setterX/Y/Z/W/H }, synced from the setter Input row) — the same config the sim's
 * probe collision already reads, no duplication. SIM/VISUAL only → emit byte-identical. Asserts the VALUE (position).
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function openWithSetter(page, opType, vizId, setter) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate((setter) => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.probes = Object.assign(s.probes || {}, setter);
    s.atc = Object.assign(s.atc || {}, { blockHeight: 50, safeZ: 10, maxDist: 100 });
    window.ddcsSaveSettings && window.ddcsSaveSettings();
  }, setter);
  await page.evaluate((op) => window.ddcsStudio.wizardManager.open(op), opType);
  await page.waitForFunction((vizId) => { const h = document.getElementById(vizId).parentElement.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, vizId, { timeout: 8000 });
  await page.waitForFunction((vizId) => { const v = document.getElementById(vizId).parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v.setterMesh; }, vizId, { timeout: 8000 });
}

const readSetter = (page, vizId) => page.evaluate((vizId) => {
  const v = document.getElementById(vizId).parentElement.querySelector('.wiz-viz3d').__panel.viz;
  const p = v.setterMesh.position;
  return { x: p.x, y: p.y, z: p.z, hasEdges: !!v.setterEdges };
}, vizId);

test('Tool LENGTH preview renders the setter at its configured machine position (fixed frame)', async ({ page }) => {
  await openWithSetter(page, 'atc_length', 'atcLengthViz', { setterX: 300, setterY: 200, setterZ: -40, setterW: 34, setterH: 34, setterPin: 3, setterLevel: 0 });
  const r = await readSetter(page, 'atcLengthViz');
  // the mesh centre = (X, Y, Z − H/2) since setterZ is the TOP surface (H = 34 → centre at −40 − 17 = −57)
  expect(Math.round(r.x), 'setter X = the configured machine X').toBe(300);
  expect(Math.round(r.y), 'setter Y = the configured machine Y').toBe(200);
  expect(Math.round(r.z), 'setter centre Z = setterZ − H/2 (top surface at the configured Z)').toBe(-57);
  expect(r.hasEdges, 'the setter block is drawn (mesh + edges)').toBe(true);
});

test('Tool CHECK preview renders the same setter at its configured position', async ({ page }) => {
  await openWithSetter(page, 'atc_check', 'atcCheckViz', { setterX: 120, setterY: 80, setterZ: -50, setterW: 20, setterH: 20, setterPin: 3, setterLevel: 0 });
  const r = await readSetter(page, 'atcCheckViz');
  expect(Math.round(r.x), 'setter X').toBe(120);
  expect(Math.round(r.y), 'setter Y').toBe(80);
  expect(Math.round(r.z), 'setter centre Z = −50 − 10').toBe(-60);
});

test('ONE-SOURCE: the setter render tracks settings.probes (change the config → the mesh moves)', async ({ page }) => {
  await openWithSetter(page, 'atc_length', 'atcLengthViz', { setterX: 100, setterY: 100, setterZ: -30, setterW: 24, setterH: 24, setterPin: 3, setterLevel: 0 });
  const before = await readSetter(page, 'atcLengthViz');
  expect(Math.round(before.x)).toBe(100);
  // move the setter in the config and re-run the wizard update — the render must follow (no duplicated position)
  await page.evaluate(() => { window.ddcsGetSettings().probes.setterX = 250; window.ddcsStudio.wizardManager.update(); });
  await page.waitForFunction(() => { const v = document.getElementById('atcLengthViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v.setterMesh && Math.round(v.setterMesh.position.x) === 250; }, null, { timeout: 8000 });
  const after = await readSetter(page, 'atcLengthViz');
  expect(Math.round(after.x), 'the mesh followed the config change to X=250').toBe(250);
});
