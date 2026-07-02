import { test, expect } from '@playwright/test';

/**
 * ③b — corner (FL/FR/BL/BR) + probeSeq (YX/XY) go LIVE on the "Corner (data)" twin, the last structural params. They are
 * VALUE/ORDER swaps (corner flips the probe DIRECTIONS + reposition signs; probeSeq swaps the wall ORDER), NOT prune-add/remove,
 * and they INTERACT — so an 8-WAY corner×probeSeq guard (like wcs, not a value-binding). Combinatorial-but-inert (pruned/build).
 *
 * HARDENED (assert-the-value from the START, per the wcs-harden lesson): read each enum binding's OWN wiring, assert ALL 8
 * combos == cornerStack byte-for-byte (prune correctness), AND pin each combo's DERIVED values (first/second-wall probe var,
 * header dir labels, footer name, reposition default sign) against an INDEPENDENT hardcoded truth table (NOT twin-vs-self).
 */
test('③b corner×probeSeq LIVE: enum bindings drive all 8 combos == cornerStack byte-for-byte + independent-truth derived values', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    const def = CD.cornerDataDef();
    registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const cBind = (def.bindings || []).find((b) => b.param === 'corner');
    const sBind = (def.bindings || []).find((b) => b.param === 'probeSeq');
    const cOpts = ((cBind && cBind.widgetConfig && cBind.widgetConfig.options) || []).map((o) => o[1]);
    const sOpts = ((sBind && sBind.widgetConfig && sBind.widgetConfig.options) || []).map((o) => o[1]);

    const combos = [];
    for (const corner of cOpts) for (const seq of sOpts) {
      const p = S({ corner, probeSeq: seq });
      const emit = emitMapped(build(p)).text;
      combos.push({ corner, seq, equal: emit === emitMapped(cornerStack(p)).text, emit });
    }
    return { cType: cBind && cBind.type, sType: sBind && sBind.type, cDefault: cBind && cBind.default, sDefault: sBind && sBind.default, cOpts, sOpts, combos };
  });

  // (1) the enum bindings declare the wiring
  expect(r.cType, 'corner is an enum binding').toBe('enum');
  expect(r.sType, 'probeSeq is an enum binding').toBe('enum');
  expect(r.cDefault, 'corner defaults FL').toBe('FL');
  expect(r.sDefault, 'probeSeq defaults YX').toBe('YX');
  expect(r.cOpts).toEqual(['FL', 'FR', 'BL', 'BR']);
  expect(r.sOpts).toEqual(['YX', 'XY']);
  expect(r.combos.length, 'all 8 corner×probeSeq combos').toBe(8);

  // INDEPENDENT TRUTH TABLE — computed here, NOT read from cornerStack (kills the twin-vs-self tautology on the values).
  const DIRS = { FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] };
  const pv = (d) => (d === '+' ? 8 : 7);          // probe var: +max #8 / -max #7
  const own = (d) => (d === '+' ? '#15' : '#16'); // signed-travel: own(dir)
  const opp = (d) => (d === '+' ? '#16' : '#15'); // opp(dir)
  const lab = (d) => (d === '+' ? 'pos' : 'neg');

  for (const c of r.combos) {
    // byte-parity (prune correctness — the guard collapses to the right combo)
    expect(c.equal, `combo corner=${c.corner} probeSeq=${c.seq}: twin == cornerStack byte-for-byte`).toBe(true);
    // independent value pins
    const [xd, yd] = DIRS[c.corner];
    const [fA, fD] = c.seq === 'YX' ? ['Y', yd] : ['X', xd];
    const [sA, sD] = c.seq === 'YX' ? ['X', xd] : ['Y', yd];
    expect(c.emit, `${c.corner}/${c.seq}: FIRST wall probes ${fA}#${pv(fD)}`).toMatch(new RegExp(`G31 ${fA}#${pv(fD)} `));
    expect(c.emit, `${c.corner}/${c.seq}: SECOND wall probes ${sA}#${pv(sD)}`).toMatch(new RegExp(`G31 ${sA}#${pv(sD)} `));
    expect(c.emit, `${c.corner}: header dir labels X ${lab(xd)} Y ${lab(yd)}`).toContain(`Corner | ${c.corner} OUTSIDE | X ${lab(xd)} Y ${lab(yd)}`);
    expect(c.emit, `${c.corner}: footer name`).toContain(`Corner ${c.corner} found`);
    // reposition default (unset) = the signed-travel own/opp per the combo (independent)
    expect(c.emit, `${c.corner}/${c.seq}: #23 default ${fA === 'X' ? own(xd) : opp(xd)}`).toContain(`#23=${fA === 'X' ? own(xd) : opp(xd)}`);
    expect(c.emit, `${c.corner}/${c.seq}: #24 default ${fA === 'Y' ? own(yd) : opp(yd)}`).toContain(`#24=${fA === 'Y' ? own(yd) : opp(yd)}`);
  }
});
