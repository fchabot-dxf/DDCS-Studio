import { test, expect } from '@playwright/test';

/**
 * t2445 — BACKLOG #40, surfaced by a community post: an M350 V2 owner with a two-head machine drives his DUST
 * COLLECTOR from `M151`, which the sim insisted was a gripper-close output and would confidently assert an
 * `IN_GRIPPER_CLOSED` sensor that machine never has. A program doing `M151` then `M306` (wait: gripper closed)
 * would sim-proceed cleanly while the real machine parks forever — a FALSE GREEN in a safety-adjacent surface.
 *
 * THE THREE LAYERS (why this is a real bug, not a wrong label): layer 1 (M-code → intent) is the VENDOR
 * dialect, correctly hardcoded (`ATC_DIALECT`, GcodeExecutionEngine.js). Layer 3 (pin → physical port) is the
 * user's, correctly untouched. Layer 2 — "…and 450ms later a gripper-closed sensor asserts" — is a claim
 * about THAT MACHINE'S WIRING made from the M-code alone; the user's own `settings.outputs[]` (ioTable.js,
 * user-editable, persisted) already had the answer and nothing read it (`getOutputs()` had zero callers under
 * `web/engine/`) — a declared seam (`settingsPanel.js`'s own "stage 3" comment) left unfinished.
 *
 * THE FIX, three parts: (1) `ATC_DIALECT`'s handshake-bearing entries (150/151/154/155/162/163) now carry an
 * `expectedType`; the engine's own `_declaredOutputType(mcode)` checks `settings.outputs[]` (injected via a
 * new constructor option, `outputsForViz()` in createPreviewPanel.js) for a row whose onCode/offCode matches
 * — no row at all (nothing declared) leaves behavior BYTE-IDENTICAL to before this turn (the regression-risk
 * case); a row that AGREES also leaves it unchanged; only a row that DISAGREES (repurposed) declines the
 * handshake — `virtualIO.js`'s `setVirtualOutput(pin, state, {skipHandshake:true})`. (2) a `gripper` row
 * added to `OUTPUT_TYPES` (ioTable.js) — drawbar/dustcover/carousel were already catalogued, M150/M151
 * weren't. (3) CHECKED (not assumed): the open-loop pneumatic family (M19, M156-161) has NO entry in
 * `virtualIO.js`'s own `M3K_TRUTH_TABLE` at all — already a genuine no-op, nothing to fix there.
 *
 * ⭐⭐ THE PART THAT MAKES THIS A REAL FIX, NOT A COSMETIC ONE: declining just the specific handshake was not
 * enough on its own — `_scheduleAutoAnswer` (a SEPARATE, blanket "a virtual sensor satisfies any wait after
 * autoAnswerMs" safety net, unconditional on which M-code is involved) would otherwise fabricate the exact
 * same sensor ~350ms later regardless (450ms handshake vs 800ms default autoAnswerMs — close enough that a
 * shallow fix would be nearly invisible in a quick manual check). `_noAutoAnswer` — a set the engine populates
 * via `virtualIO.js`'s new `handshakeTargetInput()` (a read-only peek at what the handshake WOULD have
 * asserted, so it can never drift from the real truth table) — exempts that specific pin from the auto-answer
 * safety net too. Verified directly below: waiting well past BOTH delays, a declared-elsewhere output's wait
 * still never resolves — the sim genuinely parks, matching what the real machine would do.
 */
test.use({ viewport: { width: 1000, height: 800 } });

test('nothing declared: byte-identical to before this turn — the handshake still fires normally (regression-risk case)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { getVirtualInput } = await import('/engine/virtualIO.js');
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stepDelay: 10, outputs: [] });
    eng.run('M151\nM306\nM30');
    await new Promise((res) => setTimeout(res, 1500));   // > the handshake's own 450ms delay
    return { gripperClosed: getVirtualInput('IN_GRIPPER_CLOSED'), running: eng.running };
  });
  expect(r.gripperClosed, 'the handshake asserted the sensor exactly as before this turn').toBe(true);
  expect(r.running, 'the program finished (M30 reached) — no false park').toBe(false);
});

test('declared as the correct gripper type: unchanged, handshake still fires', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { getVirtualInput } = await import('/engine/virtualIO.js');
    const outputs = [{ id: 'out_1', type: 'gripper', label: 'Gripper', pin: 3, onCode: 'M150', offCode: 'M151' }];
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stepDelay: 10, outputs });
    eng.run('M151\nM306\nM30');
    await new Promise((res) => setTimeout(res, 1500));
    return { gripperClosed: getVirtualInput('IN_GRIPPER_CLOSED'), running: eng.running };
  });
  expect(r.gripperClosed, 'a correctly-agreeing declaration still asserts the sensor').toBe(true);
  expect(r.running, 'the program finished normally').toBe(false);
});

test('declared as something else (the community dust-collector case): the sim genuinely parks — no handshake, no auto-answer fallback either', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { getVirtualInput } = await import('/engine/virtualIO.js');
    const outputs = [{ id: 'out_1', type: 'custom', label: 'Dust Collector', pin: 3, onCode: 'M150', offCode: 'M151' }];
    const eng = new GcodeExecutionEngine({ autoAnswer: true, autoAnswerMs: 400, stepDelay: 10, outputs });
    eng.run('M151\nM306\nM30');
    await new Promise((res) => setTimeout(res, 900));   // past BOTH the 450ms handshake AND the 400ms auto-answer window
    return { gripperClosed: getVirtualInput('IN_GRIPPER_CLOSED'), running: eng.running, waitPin: eng._waitPin };
  });
  expect(r.gripperClosed, 'the fabricated sensor is NEVER asserted').toBe(false);
  expect(r.running, "the sim genuinely parks -- matching the real machine's own hang, not a false green").toBe(true);
  expect(r.waitPin && r.waitPin.pinName, 'parked specifically on the gripper-closed wait').toBe('IN_GRIPPER_CLOSED');
});

test('the output itself still fires even when declared elsewhere — M151 really does drive SOMETHING (the dust collector), only the fabricated sensor is withheld', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { ioState } = await import('/engine/virtualIO.js');
    const outputs = [{ id: 'out_1', type: 'custom', label: 'Dust Collector', pin: 3, onCode: 'M150', offCode: 'M151' }];
    const eng = new GcodeExecutionEngine({ autoAnswer: false, stepDelay: 10, outputs });
    eng.trace('M151\nM30');   // trace mode: outputs are set synchronously (t2397-era convention this file's own sibling atc-dialect.spec.js already uses)
    return { out: Object.fromEntries(ioState.outputs) };
  });
  expect(r.out['OUT_GRIPPER_CLOSE'], "M151's own output state is still recorded true — declining the SENSOR claim is not the same as declining the OUTPUT itself").toBe(true);
});

test('an EXISTING gripper wired through the ATC pin-picker (group:"atc", stored type:"custom" — the pre-this-turn default) is NOT treated as repurposed — no regression for machines that already worked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { getVirtualInput } = await import('/engine/virtualIO.js');
    // exactly what ioTable.js's own _makeAtcRow produced for the gripper function BEFORE this turn added a
    // dedicated OUTPUT_TYPES entry — group:'atc', type:'custom' (the historical fallback)
    const outputs = [{ id: 'out_1', type: 'custom', label: 'Gripper (open / close)', pin: 3, onCode: 'M150', offCode: 'M151', group: 'atc' }];
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stepDelay: 10, outputs });
    eng.run('M151\nM306\nM30');
    await new Promise((res) => setTimeout(res, 1500));
    return { gripperClosed: getVirtualInput('IN_GRIPPER_CLOSED'), running: eng.running };
  });
  expect(r.gripperClosed, 'an ATC-picker-created row is trusted regardless of its stored type string').toBe(true);
  expect(r.running, 'the program finished normally — no false park for an actually-correct configuration').toBe(false);
});

test('OUTPUT_TYPES carries a dedicated gripper row (was falling back to "custom", no honest home)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const gripper = await page.evaluate(async () => {
    const { OUTPUT_TYPES } = await import('/ui/ioTable.js');
    return OUTPUT_TYPES.find((t) => t.type === 'gripper');
  });
  expect(gripper, 'a dedicated gripper type exists in the general I/O output-type catalog').toBeTruthy();
  expect(gripper.onCode).toBe('M150');
  expect(gripper.offCode).toBe('M151');
});
