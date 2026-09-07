import { test, expect } from './support/harness.mjs';

/**
 * CHOREOGRAPHY INTERPRETER (RE-PLAN #2, I4) — walks a combo's declared MOTION.steps → a SIM-ONLY path that drives the
 * preview, so a from-zero / RapidChange config (magnet × plunge × linear, no hand-written stack) SIMS by walking its
 * steps. SIM-ONLY (the emit is the M6/T.nc call, I5). The 3 shipped presets keep their played-inline sim (unaffected —
 * their motions aren't `candidate`). Asserts the VALUE: the plunge path + the tool swap.
 *
 * TIER MIGRATION — moved browser→node. Two tests stayed (each opens a real wizard/settings panel and reads live DOM —
 * a `.wiz-viz3d` canvas host, `#atc_gen_tnc` button clicks, `#atc_tnc_out` textarea value — the node tier's
 * structural-only `document` cannot fake any of that): "a RapidChange config (from-zero) SIMS via the interpreter"
 * and "I5b-2a: Generate T.nc routes a candidate combo AND the DRAWBAR changer through the interpreter". Both moved to
 * tests/atc-interpreter-drive.spec.js. The remaining 4 tests here call `motionToSimGcode`/`motionToTnc` directly and
 * assert on the returned G-code text — no DOM involved.
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

test('INC-A: the FIRMWARE interpreter preview walks the STATION dance (G53 machine frame, station from firmwareStation)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const sim = await page.evaluate(async () => {
    const { atcCombo } = await import('/wizards/atcModel.js');
    const { motionToSimGcode, interpCtxFromAtc } = await import('/wizards/atcInterpreter.js');
    const { magazinePockets } = await import('/wizards/views/atcViews.js');
    const atc = { safeZ: 10, firmwareStation: { safeZ: -10, pushStart: { x: 300, y: 200 }, pushEnd: { x: 340, y: 200 }, retreat: { x: 340, y: 160 } } };
    return motionToSimGcode(atcCombo({ method: 'firmware' }, atc), interpCtxFromAtc(atc, magazinePockets(atc), { outputs: [], inputs: [] }));
  });
  // the station travel now RESOLVES (was undefined → no travel, the INC-A degrade) — push-start → push-end → retreat
  expect(sim, 'travels to push-start (from firmwareStation.pushStart)').toContain('G53 G0 X300 Y200');
  expect(sim, 'to push-end').toContain('G53 G0 X340 Y200');
  expect(sim, 'to retreat').toContain('G53 G0 X340 Y160');
  expect(sim, 'the pneumatic dance fires (pusher M160 … M161)').toMatch(/M160[\s\S]*M161/);
  // MACHINE frame: G53, not the bare part-frame G0 (robust to a WCS offset — the ATC positions are machine coords)
  expect(sim, 'machine-frame moves (G53), not part-frame G0').not.toMatch(/(^|\n)G0 [XZ]/);
});
