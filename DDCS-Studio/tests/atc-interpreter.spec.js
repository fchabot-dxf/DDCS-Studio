import { test, expect } from '@playwright/test';

/**
 * CHOREOGRAPHY INTERPRETER (RE-PLAN #2, I4) — walks a combo's declared MOTION.steps → a SIM-ONLY path that drives the
 * preview, so a from-zero / RapidChange config (magnet × plunge × linear, no hand-written stack) SIMS by walking its
 * steps. SIM-ONLY (the emit is the M6/T.nc call, I5). The 3 shipped presets keep their played-inline sim (unaffected —
 * their motions aren't `candidate`). Asserts the VALUE: the plunge path + the tool swap.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const RAPID = {
  grip: 'magnet', motion: 'plunge', layout: 'linear', magType: 'straight', safeZ: 10,
  magazine: [{ pocket: 1, tool: 2, x: 100, y: 100, z: -40 }, { pocket: 2, tool: 5, x: 200, y: 100, z: -40 }],
  tools: [{ num: 2, type: 'endmill', dia: 8, length: 40 }, { num: 5, type: 'ballnose', dia: 6, length: 50 }],
};

test('the interpreter walks a PLUNGE motion → a sim path (plunge + swap, NO drawbar/pneumatic I/O)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const path = await page.evaluate(async (atc) => {
    const { atcCombo } = await import('/wizards/atcModel.js');
    const { motionToSimGcode, interpCtxFromAtc } = await import('/wizards/atcInterpreter.js');
    const { magazinePockets } = await import('/wizards/views/atcViews.js');
    const cmb = atcCombo({}, atc);   // the declared config (no method) → magnet × plunge
    return motionToSimGcode(cmb, interpCtxFromAtc(atc, magazinePockets(atc)));
  }, RAPID);
  expect(path, 'the plunge descends into the dock (pocket Z)').toContain('G1 Z-40');
  expect(path, 'travels to the target dock XY').toMatch(/G0 X200 Y100/);
  expect(path, 'starts holding the current tool (2)').toContain('#1300=2');
  expect(path, 'the swap fires at the pick (→ tool 5)').toContain('#1300=5');
  expect(path, 'the magnet grip has NO drawbar I/O — empty release/clamp').not.toContain('M154');
  expect(path, 'and no pusher/pneumatic codes').not.toMatch(/M15[6-9]|M16[0-3]/);
});

test('a RapidChange config (from-zero) SIMS via the interpreter — the tool plunges + swaps', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate((atc) => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.preview = s.preview || {}; s.preview.autoLoop = false;
    s.atc = Object.assign(s.atc || {}, atc);
  }, RAPID);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(300);
  // the preview is now playing the INTERPRETER's plunge path (not a hand-written stack)
  const host = () => document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
  const gc = await page.evaluate(() => document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__gcode);
  expect(gc, 'the preview plays the interpreter walk, not a stack').toContain('interpreter walk');
  expect(gc, 'with the plunge descend').toContain('G1 Z-40');
  // the FORK/DOCK stations render (magnet grip → fork device) at the dock positions
  const hasFork = await page.evaluate(() => !!document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz._forkGroup);
  expect(hasFork, 'the fork/dock stations render for the magnet grip').toBe(true);
  // ▶ run it → the #1300 flip at the plunge fires the swap
  await page.evaluate(() => document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').querySelector('.pp-run').click());
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._simTool && Number(v._simTool.num) === 5; }, null, { timeout: 20000 });
  const spindle = await page.evaluate(() => Number(document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz._simTool.num));
  expect(spindle, 'the tool swapped to the target (5) at the plunge — a config-only changer SIMS').toBe(5);
});
