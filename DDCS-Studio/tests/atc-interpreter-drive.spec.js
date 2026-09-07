import { test, expect } from '@playwright/test';

/**
 * CHOREOGRAPHY INTERPRETER (RE-PLAN #2, I4) — split from atc-interpreter.spec.js at the tier migration. 4 of the
 * file's 6 tests moved to tests/node/atc-interpreter.test.mjs (pure — call motionToSimGcode/motionToTnc directly and
 * assert on the returned text). These two stayed: each opens a real live panel and reads real DOM (a `.wiz-viz3d`
 * canvas host via wizardManager.open, or the Settings panel's `#atc_gen_tnc` button + `#atc_tnc_out` textarea) —
 * register.mjs's document is structural-only (querySelector/getElementById always return null), so neither can run
 * in the node tier.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const RAPID = {
  grip: 'magnet', motion: 'plunge', layout: 'linear', magType: 'straight', safeZ: 10,
  magazine: [{ pocket: 1, tool: 2, x: 100, y: 100, z: -40 }, { pocket: 2, tool: 5, x: 200, y: 100, z: -40 }],
  tools: [{ num: 2, type: 'endmill', dia: 8, length: 40 }, { num: 5, type: 'ballnose', dia: 6, length: 50 }],
};

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

test('I5b-2a: Generate T.nc routes a candidate combo AND the DRAWBAR changer through the interpreter (safety-complete shipped route)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate((atc) => {
    const s = window.ddcsGetSettings();
    s.hardwareTabs = s.hardwareTabs || {}; s.hardwareTabs.atc = true;
    s.atc = Object.assign(s.atc || {}, atc);
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    window.openSettings({ group: 'hardware', panel: 'set_tab_atc' });
  }, RAPID);
  await page.waitForSelector('#atc_gen_tnc', { timeout: 8000 });
  // RapidChange (candidate motion) → the interpreter O-program
  await page.click('#atc_gen_tnc');
  const rapidNc = await page.evaluate(() => document.querySelector('#atc_tnc_out').value);
  expect(rapidNc, 'RapidChange → the interpreter O-program (plunge)').toMatch(/^O\d+/m);
  expect(rapidNc).toContain('G53 G1 Z#3 F800');
  expect(rapidNc, 'no drawbar in a magnet changer').not.toContain('M154');
  // I5b-2a CUTOVER: the DRAWBAR changer now ALSO routes through the INTERPRETER (the shipped route) — a safety-complete
  // O-program whose executable program is byte-identical to generateToolChangeNc + the O-header. Assert the SHIPPED
  // output (the button) is safety-complete (this is where the safety assertion now lives — the shipped route).
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.atc.grip = 'drawbar'; s.atc.motion = 'pick-place'; s.atc.layout = 'linear';
  });
  await page.click('#atc_gen_tnc');
  const drawbarNc = await page.evaluate(() => document.querySelector('#atc_tnc_out').value);
  expect(drawbarNc, 'the shipped drawbar route now emits the interpreter O-program (O-header — a standalone macro)').toMatch(/^O\d+/);
  expect(drawbarNc, 'SAFETY: the M300 spindle-stop wait (the element a naive route would have dropped)').toContain('M300');
  expect(drawbarNc, 'the drawbar dance — release M154 then clamp M155').toMatch(/M154[\s\S]*M155/);
  expect(drawbarNc, 'the settle dwells (G04 P500)').toContain('G04 P500');
  expect(drawbarNc, 'the released + clamped sensor waits (M301 then M302)').toMatch(/M301[\s\S]*M302/);
  expect(drawbarNc, 'a drawbar descend is a rapid G0, NOT the plunge G1 feed').not.toContain('G53 G1 Z#3 F800');
});
