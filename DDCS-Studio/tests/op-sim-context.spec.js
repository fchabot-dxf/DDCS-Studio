import { test, expect } from '@playwright/test';

/**
 * opSimContext — the SIM INTENT layer contract. Locks the declared op-type → preview-render-intent translation so
 * a generic preview consumer (the Blocks tab) and the per-op wizard views can't drift. The op TYPE decides the rig
 * / machine-frame / magazine — never the stock shape.
 */
test('opSimContext: declared op-type → preview intent', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { opSimContext, programSimContext } = await import('/viz/opSimContext.js');
    const { BUILDERS } = await import('/blocks/opBuilders.js');
    const ctxFor = {};
    for (const opType of Object.keys(BUILDERS)) ctxFor[opType] = opSimContext(opType);
    return {
      ctxFor,
      program: {
        empty: programSimContext([]),
        millOnly: programSimContext(['pocket', 'surfacing']),
        millPlusAtc: programSimContext(['pocket', 'atc_change']),
        millPlusRotary: programSimContext(['surfacing', 'rotary_clock']),
        rotaryAndAtc: programSimContext(['rotary_center', 'atc_table']),
      },
      sample: {
      rotary_clock: opSimContext('rotary_clock'),
      rotary_center: opSimContext('rotary_center'),
      atc_change: opSimContext('atc_change'),
      atc_table: opSimContext('atc_table'),
      atc_test: opSimContext('atc_test'),
      atc_warmup: opSimContext('atc_warmup'),
      atc_length: opSimContext('atc_length'),
      atc_check: opSimContext('atc_check'),
      homing: opSimContext('homing'),
      alignment: opSimContext('alignment'),
      pocket: opSimContext('pocket'),
      surfacing: opSimContext('surfacing'),
      edge: opSimContext('edge'),
      unknown: opSimContext('not_a_real_op'),
    } };
  });

  const s = r.sample;
  // t714 (R-A) — opSimContext now MIRRORS each op's data-twin sim{} declaration, so the built-in view + the twin read the
  // SAME intent (retiring the imperative-vs-declared drift). Rotary probe ops → the 4th-axis RIG only (PART-frame, NO
  // forceMachine — the rig frames the bar; the twins' old machine:true was latent-dead and was corrected to false at t714).
  for (const op of ['rotary_clock', 'rotary_center']) {
    expect(s[op]).toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  }
  // ATC tool-moving ops (change/table/test) → machine frame + magazine + the tool in RAW machine coords (twins: toolMachine:true).
  for (const op of ['atc_change', 'atc_table', 'atc_test']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: true, toolMachineFrame: true, seatAtStart: true });
  }
  // ATC warmup → machine frame + magazine (the rack tiles, twin: magazine:true), NO tool-machine-frame.
  expect(s.atc_warmup).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: true, toolMachineFrame: false, seatAtStart: false });
  // ATC length/check → machine frame only (no magazine, no tool move).
  for (const op of ['atc_length', 'atc_check']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  }
  // HOMING → machine frame + the tool in RAW machine coords (t552 toolMachineFrame).
  expect(s.homing).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: false, toolMachineFrame: true, seatAtStart: true });
  // ALIGNMENT → SEAT at marker A (twin: seatStart:true), PART-frame (NO forceMachine — the seat is the intent; machine:true
  // was latent-dead, corrected to false at t714), no tool-machine-frame.
  expect(s.alignment).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: true });
  // Cutting ops + non-rotary probes → plain local-frame preview (all false).
  for (const op of ['pocket', 'surfacing', 'edge', 'unknown']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  }

  // programSimContext: the UNION across a multi-op program (the Blocks-tab preview renders the whole stack). t714 (R-B #6) —
  // the union now KEEPS toolMachineFrame + seatAtStart, so a whole-program consumer can seat + machine-frame the tool.
  const pg = r.program;
  expect(pg.empty).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  expect(pg.millOnly).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  expect(pg.millPlusAtc).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: true, toolMachineFrame: true, seatAtStart: true });
  expect(pg.millPlusRotary).toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false });
  expect(pg.rotaryAndAtc).toEqual({ showRotaryRig: true, forceMachine: true, showMagazine: true, toolMachineFrame: true, seatAtStart: true });   // a program CAN need both

  // Invariants across EVERY built-in op (no throw, 3 booleans, and the structural rules hold).
  for (const [opType, c] of Object.entries(r.ctxFor)) {
    expect(typeof c.showRotaryRig, opType).toBe('boolean');
    expect(typeof c.forceMachine, opType).toBe('boolean');
    expect(typeof c.showMagazine, opType).toBe('boolean');
    if (c.showMagazine) expect(c.forceMachine, `${opType}: a magazine renders on the machine frame`).toBe(true);
    expect(c.showRotaryRig && c.showMagazine, `${opType}: an op is not both rotary-rig and ATC-magazine`).toBe(false);
  }
});
