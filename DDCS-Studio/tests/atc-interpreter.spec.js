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

test('I5: the interpreter EMITS a T.nc O-program for a new combo (plunge macro + M99, a STANDALONE subprogram)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const nc = await page.evaluate(async (atc) => {
    const { atcCombo } = await import('/wizards/atcModel.js');
    const { motionToTnc } = await import('/wizards/atcInterpreter.js');
    return motionToTnc(atcCombo({}, atc), atc);
  }, RAPID);
  expect(nc, 'an O-number header — a standalone macro, NOT inline').toMatch(/^O\d+/m);
  expect(nc.trim().endsWith('M99'), 'ends with M99 (subprogram return)').toBe(true);
  expect(nc, 'the plunge descend (G1 feed into the dock)').toContain('G53 G1 Z#3 F800');
  expect(nc, 'dispatched by the requested tool (#1504) — runs on Tn M6').toContain('IF #1504==');
  expect(nc, 'records the new tool (#1300 = #1504)').toContain('#1300 = #1504');
  expect(nc, 'the linear docks come from the magazine (dock 1 = T2)').toContain('return T2 to dock 1');
  expect(nc, 'the magnet grip emits NO drawbar M154 (empty release/clamp)').not.toContain('M154');
  expect(nc, 'and no pneumatic M-codes').not.toMatch(/M15[6-9]|M16[0-3]/);
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

test('I5b-1: motionToTnc emits a SAFETY-COMPLETE drawbar T.nc from the DECLARATION (matches the DDCS dance)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const out = await page.evaluate(async () => {
    const { atcCombo } = await import('/wizards/atcModel.js');
    const { motionToTnc } = await import('/wizards/atcInterpreter.js');
    const atc = { grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10, magazine: [{ pocket: 1, tool: 1, x: 100, y: 50, z: -40 }, { pocket: 2, tool: 2, x: 150, y: 50, z: -40 }] };
    const drawbar = motionToTnc(atcCombo({}, atc), atc);
    const magnet = motionToTnc(atcCombo({}, { grip: 'magnet', motion: 'plunge', layout: 'linear', magazine: atc.magazine }), atc);
    return { drawbar, magnet };
  });
  const lines = out.drawbar.split('\n').map((l) => l.trim());
  const idx = (re) => lines.findIndex((l) => re.test(l));
  // structure: O-header + M99 (a standalone subprogram, NOT inline)
  expect(out.drawbar, 'O-number header').toMatch(/^O\d+/);
  expect(out.drawbar.trim().endsWith('M99'), 'ends with M99').toBe(true);
  expect(idx(/^IF #1504==#1300 GOTO999/), 'skip if already loaded').toBeGreaterThanOrEqual(0);
  // SAFETY #1: the spindle-STOP wait (M300) comes AFTER M5 M9 — the element a naive route would DROP
  expect(idx(/^M300\b/), 'M300 spindle-stop wait comes after M5 M9').toBeGreaterThan(idx(/^M5\s+M9/));
  // in-order matcher over a block
  const inOrder = (from, seq) => { const blk = lines.slice(idx(from)); let i = 0; for (const l of blk) { if (i < seq.length && l.startsWith(seq[i])) i++; if (i === seq.length) break; } return i; };
  // RETURN: XY → descend → M154 → G04 P500 (settle) → M301 (wait) → lift
  expect(inOrder(/^N101 /, ['G53 G0 X#1 Y#2', 'G53 G0 Z#3', 'M154', 'G04 P500', 'M301', 'G53 G0 Z#4']), 'RETURN drawbar dance in order (M154 + settle dwell + wait)').toBe(6);
  // FETCH: XY → M154 (open) → M301 (WAIT before descend — safety) → descend → M155 → G04 P500 → M302 → lift → record
  expect(inOrder(/^N201 /, ['G53 G0 X#1 Y#2', 'M154', 'M301', 'G53 G0 Z#3', 'M155', 'G04 P500', 'M302', 'G53 G0 Z#4', '#1300 = #1504']), 'FETCH dance: open+wait BEFORE descend, then clamp+settle+wait, record').toBe(9);
  // the safety fields are DECLARATION-driven (per grip): a magnet grip declares no stopWait/dwell → its macro has NO M300
  expect(out.magnet, 'the magnet macro has no drawbar dwell/wait').not.toContain('M301');
  expect(out.magnet.includes('M300'), 'no spindle-stop wait for a magnet grip (no such sensor declared)').toBe(false);
});

test('I5b-3 INC1: a custom drawbar code SOURCES from the I/O table in BOTH the sim and the emit; default byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { atcCombo } = await import('/wizards/atcModel.js');
    const { motionToTnc, motionToSimGcode, interpCtxFromAtc } = await import('/wizards/atcInterpreter.js');
    const { magazinePockets } = await import('/wizards/views/atcViews.js');
    const atc = { grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10, magazine: [{ pocket: 1, tool: 1, x: 100, y: 50, z: -40 }, { pocket: 2, tool: 2, x: 150, y: 50, z: -40 }], tools: [{ num: 1 }, { num: 2 }] };
    const cmb = atcCombo({}, atc);
    // a CUSTOM machine's I/O: drawbar output onCode M158 / offCode M159; a custom released-sensor waitCode M310
    const io = { outputs: [{ type: 'drawbar', onCode: 'M158', offCode: 'M159' }], inputs: [{ id: 'drawbar_released_atc', group: 'atc', waitCode: 'M310' }] };
    return {
      simCustom: motionToSimGcode(cmb, interpCtxFromAtc(atc, magazinePockets(atc), io)),
      tncCustom: motionToTnc(cmb, atc, { io }),
      simDefault: motionToSimGcode(cmb, interpCtxFromAtc(atc, magazinePockets(atc), null)),
      tncDefault: motionToTnc(cmb, atc, { io: null }),
    };
  });
  // the CUSTOM drawbar codes flow to BOTH the sim AND the emit (one source, one seam)
  expect(r.simCustom, 'the SIM uses the custom drawbar release M158').toContain('M158');
  expect(r.simCustom, 'not the hardcoded M154').not.toContain('M154');
  expect(r.tncCustom, 'the EMIT uses the custom drawbar release M158').toContain('M158');
  expect(r.tncCustom, 'and the custom clamp M159').toContain('M159');
  expect(r.tncCustom, 'a custom sensor waitCode (M310) flows too').toContain('M310');
  // a DEFAULT machine (no custom I/O) → M154/M155/M301/M302, byte-identical to before
  expect(r.simDefault, 'default sim = M154').toContain('M154');
  expect(r.simDefault, 'default sim has no custom code').not.toContain('M158');
  expect(r.tncDefault, 'default emit = M154 then M155').toMatch(/M154[\s\S]*M155/);
  expect(r.tncDefault, 'default emit waits M301 then M302').toMatch(/M301[\s\S]*M302/);
  expect(r.tncDefault, 'default emit has no custom code').not.toContain('M158');
});
