import { test, expect } from '@playwright/test';

/**
 * ATC FIRMWARE tool-SWAP visual (P-C.1b, t175) — valid-by-construction (purist, NO sim-only target). The swap fires
 * ONLY on a REAL tool change (#1300 flips from a program T#/M6) during play: the OLD tool is retired to the push STATION
 * (fixed machine frame) + the NEW tool goes on the spindle (setSimTool). An isolated firmware op (no tool change) shows
 * push+highlight but NO swap. SIM/VISUAL only → emit byte-identical. Asserts the VALUE (retired-tool identity + position;
 * spindle tool = new; no swap when there's no change).
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function viz(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
}

test('(1) showRetiredTool places the OLD tool at the push station — raw machine coords, WCS-independent', async ({ page }) => {
  await viz(page);
  const place = (g54) => page.evaluate((off) => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setStock({ show: false });
    v.setMachine({ x: 600, y: 400, z: -150, show: true, workOrigin: off, wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    v.showRetiredTool({ type: 'endmill', dia: 8, length: 40 }, { z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
    const p = v._retiredTool.position;
    return { x: +p.x.toFixed(0), y: +p.y.toFixed(0) };
  }, g54);
  const a = await place({ x: 0, y: 0, z: 0 });
  const b = await place({ x: 200, y: 150, z: -40 });
  expect(a, 'retired tool at the push-END station coords (250,150)').toEqual({ x: 250, y: 150 });
  expect(b, 'station is WCS-independent (fixed frame)').toEqual(a);
  // clearing removes it
  const cleared = await page.evaluate(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; v.showRetiredTool(null); return !!v._retiredTool; });
  expect(cleared, 'null clears the retired tool').toBe(false);
});

test('(2) a REAL tool change (T# M6) during play retires the OLD tool to the station + swaps the spindle to the NEW tool', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.atc = s.atc || {};
    s.atc.tools = [{ num: 2, type: 'endmill', dia: 8, length: 40 }, { num: 5, type: 'ballnose', dia: 6, length: 50 }];
    s.preview = s.preview || {}; s.preview.autoLoop = false;
    s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  // Arm a KNOWN station + play a full-program flow: a move (sets the OLD tool #1300=2) → T5 M6 (change) → the push moves.
  await page.evaluate(async () => {
    const { atcChoreography, atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    const region = { z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } };
    host.__panel.setAtcSwap(atcChoreography({ method: 'firmware' }), region);
    const stationVars = '#1306=-10\n#1320=200\n#1321=150\n#1322=100\n#1323=250\n#1324=150\n#1325=300\n#1326=150\n#563=3000\n#1327=500\n';
    // #1300=2 (old), a MOVE (so lastTool=2 before the change), T5 M6 (2→5), then the firmware push (moves to the station)
    host.__gcode = '#1300=2\n' + stationVars + 'G0 X100 Y100 Z10\nT5 M6\n' + emitMapped(atcChangeStack({ method: 'firmware' })).text;
    host.querySelector('.pp-run').click();   // ▶ play
  });
  // wait for the swap to land (the retired tool appears during play)
  await page.waitForFunction(() => { const h = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d'); const v = h && h.__panel && h.__panel.viz; return !!(v && v._retiredTool); }, null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz;
    const p = v._retiredTool.position;
    return { retiredX: +p.x.toFixed(0), retiredY: +p.y.toFixed(0), spindleTool: v._simTool && v._simTool.num };
  });
  expect({ x: r.retiredX, y: r.retiredY }, 'the OLD tool (2) is retired to the push station (250,150)').toEqual({ x: 250, y: 150 });
  expect(r.spindleTool, 'the NEW tool (5) is on the spindle').toBe(5);
});

test('(3) the ISOLATED firmware op (no tool change) shows NO swap — push + highlight only', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.autoLoop = false; s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  // play the op's OWN code (the isolated firmware push, NO tool change) → #1300 never flips → NO swap
  await page.evaluate(() => { const h = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d'); h.querySelector('.pp-run').click(); });
  await page.waitForFunction(() => { const h = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d'); const el = h && h.querySelector('.pp-status'); return el && /complete/i.test(el.textContent || ''); }, null, { timeout: 8000 });
  const hasSwap = await page.evaluate(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return !!v._retiredTool; });
  expect(hasSwap, 'no tool change → no retired tool (valid-by-construction; the op has no target)').toBe(false);
});
