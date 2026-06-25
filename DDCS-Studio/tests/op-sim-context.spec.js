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
    const { opSimContext } = await import('/viz/opSimContext.js');
    const { BUILDERS } = await import('/blocks/opBuilders.js');
    const ctxFor = {};
    for (const opType of Object.keys(BUILDERS)) ctxFor[opType] = opSimContext(opType);
    return { ctxFor, sample: {
      rotary_clock: opSimContext('rotary_clock'),
      rotary_center: opSimContext('rotary_center'),
      atc_change: opSimContext('atc_change'),
      atc_table: opSimContext('atc_table'),
      atc_warmup: opSimContext('atc_warmup'),
      atc_length: opSimContext('atc_length'),
      homing: opSimContext('homing'),
      pocket: opSimContext('pocket'),
      surfacing: opSimContext('surfacing'),
      edge: opSimContext('edge'),
      unknown: opSimContext('not_a_real_op'),
    } };
  });

  const s = r.sample;
  // Rotary probe ops → the 4th-axis rig (and NOT a machine/magazine op).
  for (const op of ['rotary_clock', 'rotary_center']) {
    expect(s[op]).toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false });
  }
  // ATC tool-moving ops → machine frame + magazine.
  for (const op of ['atc_change', 'atc_table']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: true });
  }
  // ATC ops without a tool move + homing → machine frame, NO magazine.
  for (const op of ['atc_warmup', 'atc_length', 'homing']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: false });
  }
  // Cutting ops + non-rotary probes → plain local-frame preview (all false).
  for (const op of ['pocket', 'surfacing', 'edge', 'unknown']) {
    expect(s[op]).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false });
  }

  // Invariants across EVERY built-in op (no throw, 3 booleans, and the structural rules hold).
  for (const [opType, c] of Object.entries(r.ctxFor)) {
    expect(typeof c.showRotaryRig, opType).toBe('boolean');
    expect(typeof c.forceMachine, opType).toBe('boolean');
    expect(typeof c.showMagazine, opType).toBe('boolean');
    if (c.showMagazine) expect(c.forceMachine, `${opType}: a magazine renders on the machine frame`).toBe(true);
    expect(c.showRotaryRig && c.showMagazine, `${opType}: an op is not both rotary-rig and ATC-magazine`).toBe(false);
  }
});
