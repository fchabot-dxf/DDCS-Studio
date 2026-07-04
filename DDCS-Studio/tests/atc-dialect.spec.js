import { test, expect } from '@playwright/test';

/**
 * ATC DIALECT (P-C.0, t167). The sim engine reads ONE declared ATC_DIALECT table (M-code → {kind wait|output, pin,
 * state}) instead of the old split ATC_WAITS + hand-rolled M154/155/M305/306 if-else. GROUND TRUTH =
 * bridge/controllers/expert-m350/DDCS-ATC-WORKFLOW.md: WAITS M300 spindle-stopped, M301/M302 drawbar released/clamped,
 * M303/M304 magazine open/closed, M305/M306 gripper open/closed; OUTPUTS M154/M155 drawbar release/lock, M162/M163
 * dust-cover open/close, M150/M151 gripper open/close. These assert the SEMANTICS (not just green): M301 parks (was a
 * no-op), M162/M163 toggle the dust-cover OUTPUT (was unimplemented), M305/M306 are gripper WAITS (were driven as a
 * dust-cover output — the OLD WRONG behavior). SIM-side only → the emitted .nc is byte-identical (goldens elsewhere).
 */
test.use({ viewport: { width: 1000, height: 800 } });

test('the ATC_DIALECT table declares the M350 ground truth (one source, real pins)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const d = await page.evaluate(async () => {
    const { ATC_DIALECT } = await import('/engine/GcodeExecutionEngine.js');
    return ATC_DIALECT;
  });
  // OUTPUTS
  expect(d[154], 'M154 drawbar release → OUT_SPINDLE_UNCLAMP').toMatchObject({ kind: 'output', pin: 'OUT_SPINDLE_UNCLAMP', state: true });
  expect(d[155], 'M155 drawbar lock → OUT_SPINDLE_CLAMP').toMatchObject({ kind: 'output', pin: 'OUT_SPINDLE_CLAMP', state: true });
  expect(d[162], 'M162 dust cover OPEN → OUT_DUST_COVER ON').toMatchObject({ kind: 'output', pin: 'OUT_DUST_COVER', state: true });
  expect(d[163], 'M163 dust cover CLOSE → OUT_DUST_COVER OFF').toMatchObject({ kind: 'output', pin: 'OUT_DUST_COVER', state: false });
  expect(d[150], 'M150 gripper open → OUT_GRIPPER_OPEN').toMatchObject({ kind: 'output', pin: 'OUT_GRIPPER_OPEN', state: true });
  expect(d[151], 'M151 gripper close → OUT_GRIPPER_CLOSE').toMatchObject({ kind: 'output', pin: 'OUT_GRIPPER_CLOSE', state: true });
  // WAITS
  expect(d[300], 'M300 wait spindle stopped').toMatchObject({ kind: 'wait', pin: 'IN_SPINDLE_STOPPED', state: true });
  expect(d[301], 'M301 wait drawbar RELEASED (was missing → no-op)').toMatchObject({ kind: 'wait', pin: 'IN_DRAWBAR_OPEN', state: true });
  expect(d[302], 'M302 wait drawbar CLAMPED (was mislabelled tool-locked)').toMatchObject({ kind: 'wait', pin: 'IN_DRAWBAR_CLOSED', state: true });
  expect(d[303], 'M303 wait MAGAZINE open (was mislabelled tool-open)').toMatchObject({ kind: 'wait', pin: 'IN_MAG_OPEN', state: true });
  expect(d[304], 'M304 wait MAGAZINE closed (was mislabelled tool-closed)').toMatchObject({ kind: 'wait', pin: 'IN_MAG_CLOSED', state: true });
  expect(d[305], 'M305 wait GRIPPER open (was driven as a dust-cover OUTPUT)').toMatchObject({ kind: 'wait', pin: 'IN_GRIPPER_OPEN', state: true });
  expect(d[306], 'M306 wait GRIPPER closed (was driven as a dust-cover OUTPUT)').toMatchObject({ kind: 'wait', pin: 'IN_GRIPPER_CLOSED', state: true });
  // FIXED-STATION PNEUMATICS (M350 firmware push, O10102) — OPEN-LOOP outputs (P-C.2a, t177)
  expect(d[19], 'M19 spindle orient (recognized; was a no-op)').toMatchObject({ kind: 'output', pin: 'OUT_SPINDLE_ORIENT', state: true });
  expect(d[156], 'M156 locating pin OPEN').toMatchObject({ kind: 'output', pin: 'OUT_LOCATING_PIN', state: true });
  expect(d[157], 'M157 locating pin CLOSE').toMatchObject({ kind: 'output', pin: 'OUT_LOCATING_PIN', state: false });
  expect(d[158], 'M158 vacuum ON (M159 pair-half)').toMatchObject({ kind: 'output', pin: 'OUT_VACUUM', state: true });
  expect(d[159], 'M159 vacuum OFF').toMatchObject({ kind: 'output', pin: 'OUT_VACUUM', state: false });
  expect(d[160], 'M160 pusher OPEN').toMatchObject({ kind: 'output', pin: 'OUT_PUSHER', state: true });
  expect(d[161], 'M161 pusher CLOSE').toMatchObject({ kind: 'output', pin: 'OUT_PUSHER', state: false });
});

test('the engine HONORS the dialect — M301 parks, M162/163 toggle the dust OUTPUT, M305 is a gripper WAIT (not dust)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { ioState } = await import('/engine/virtualIO.js');
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    // trace() resetVirtualIO()s each run; trace mode injects a wait's target sensor synchronously, so reading ioState
    // right after a single-M-code trace shows exactly what that code did (outputs are set synchronously by setVirtualOutput).
    const run = (code) => { eng.trace(code + '\nM30'); return { out: Object.fromEntries(ioState.outputs), inp: Object.fromEntries(ioState.inputs) }; };
    return { m162: run('M162'), m163: run('M163'), m305: run('M305'), m301: run('M301'), m154: run('M154'), m303: run('M303') };
  });
  // M162 fires the dust-cover OUTPUT ON (was unimplemented before)
  expect(r.m162.out['OUT_DUST_COVER'], 'M162 → dust-cover output ON').toBe(true);
  // M163 fires it OFF
  expect(r.m163.out['OUT_DUST_COVER'], 'M163 → dust-cover output OFF').toBe(false);
  // M305 is a GRIPPER WAIT — it parks on IN_GRIPPER_OPEN (trace injects it) and does NOT drive the dust-cover output
  expect(r.m305.inp['IN_GRIPPER_OPEN'], 'M305 waits on the gripper-open sensor').toBe(true);
  expect(r.m305.out['OUT_DUST_COVER'], 'M305 did NOT fire the dust-cover output (the OLD WRONG behavior)').toBeUndefined();
  // M301 is a WAIT (was a silent no-op) — trace injects the drawbar-released sensor
  expect(r.m301.inp['IN_DRAWBAR_OPEN'], 'M301 parks on the drawbar-released sensor (no longer a no-op)').toBe(true);
  // M154 drives the drawbar-release OUTPUT (not the removed OUT_TOOL_RELEASE family)
  expect(r.m154.out['OUT_SPINDLE_UNCLAMP'], 'M154 → drawbar-release output').toBe(true);
  expect(r.m154.out['OUT_TOOL_RELEASE'], 'M154 does NOT use the removed hand-rolled tool-release pin').toBeUndefined();
  // M303 is a MAGAZINE wait (not the old tool-open sensor)
  expect(r.m303.inp['IN_MAG_OPEN'], 'M303 waits on the magazine-open sensor').toBe(true);
  expect(r.m303.inp['IN_TOOL_OPEN'], 'M303 does NOT wait on the old tool-open sensor').toBeUndefined();
});

test('the engine HONORS the M350 pneumatics — M156-161 drive the OUTPUT pins + fire io_change (were no-op)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { ioState } = await import('/engine/virtualIO.js');
    const events = [];
    const onIo = (e) => events.push(e.detail);
    window.addEventListener('io_change', onIo);
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    // each single-M-code trace resets the IO; OUTPUTS are set synchronously + now fire io_change (open-loop, no sensor).
    const run = (code) => { events.length = 0; eng.trace(code + '\nM30'); return { out: Object.fromEntries(ioState.outputs), fired: events.some((x) => x && x.pin && x.pin.indexOf('OUT_') === 0) }; };
    const m160 = run('M160'), m161 = run('M161'), m156 = run('M156'), m157 = run('M157'), m159 = run('M159'), m19 = run('M19');
    window.removeEventListener('io_change', onIo);
    return { m160, m161, m156, m157, m159, m19 };
  });
  // M160/M161 drive the pusher output open/close
  expect(r.m160.out['OUT_PUSHER'], 'M160 → pusher OPEN').toBe(true);
  expect(r.m161.out['OUT_PUSHER'], 'M161 → pusher CLOSE').toBe(false);
  // M156/M157 drive the locating pin open/close
  expect(r.m156.out['OUT_LOCATING_PIN'], 'M156 → locating pin OPEN').toBe(true);
  expect(r.m157.out['OUT_LOCATING_PIN'], 'M157 → locating pin CLOSE').toBe(false);
  // M159 turns the vacuum OFF
  expect(r.m159.out['OUT_VACUUM'], 'M159 → vacuum OFF').toBe(false);
  // M19 is recognized (spindle-orient output) — was a no-op
  expect(r.m19.out['OUT_SPINDLE_ORIENT'], 'M19 → spindle-orient output (recognized, was no-op)').toBe(true);
  // and each open-loop output FIRES io_change (so P-C.2b can animate the device) — was a no-op
  expect(r.m160.fired, 'M160 fired an OUT_ io_change (observable, was no-op)').toBe(true);
  expect(r.m19.fired, 'M19 fired an OUT_ io_change').toBe(true);
});
