import { test, expect } from '@playwright/test';

// Layer 1: G-code → leaf-atom parser. The inverse of blockModel.emit for line-level atoms. The core guarantee
// is ROUND-TRIP: emit(stack) → parse → emit must be byte-identical for the leaf ops (so editing/projecting
// G-code through blocks loses nothing). Unrecognized lines fall back to a `raw` block (verbatim).
test.use({ viewport: { width: 1000, height: 800 } });

test('leaf stack round-trips: emit → parse → emit is byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
    const stack = [
      { type: 'distmode', params: { dist: 'abs' } },
      { type: 'spindle', params: { rpm: 12000, dir: 'cw' } },
      { type: 'wcs', params: { wcs: 'G55' } },
      { type: 'coolant', params: { flow: 'flood' } },
      { type: 'tool', params: { n: 2 } },
      { type: 'feed', params: { rate: 300 } },
      { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5 } },
      { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 200 } },
      { type: 'move', params: { mode: 'probe', x: 0, y: 0, z: -10, feed: 50 } },
      { type: 'arc', params: { arc: 'cw', x: 20, y: 20, i: 5, j: 5, feed: 100 } },
      { type: 'arc', params: { arc: 'ccw', x: 0, y: 0, i: -5, j: -5, feed: 100 } },
      { type: 'comment', params: { text: 'hello world' } },
      { type: 'mcode', params: { code: 154 } },
      { type: 'spindle', params: { rpm: 0, dir: 'cw' } },   // → M5
      { type: 'endprogram', params: {} },                    // → M30 (default dialect)
    ];
    const text1 = emitMapped(stack).text;
    const parsed = parseGcodeToStack(text1);
    const text2 = emitMapped(parsed).text;
    return { text1, text2, parsedTypes: parsed.map((b) => b.type) };
  });

  expect(r.text2).toBe(r.text1);   // exact round-trip
  // every line became a typed leaf (no raw fallback for known ops)
  expect(r.parsedTypes).not.toContain('raw');
  expect(r.parsedTypes).toEqual([
    'distmode', 'spindle', 'wcs', 'coolant', 'tool', 'feed',
    'move', 'move', 'move', 'arc', 'arc', 'comment', 'mcode', 'spindle', 'endprogram',
  ]);
});

test('#var / [expr] coordinates survive as literals; unknown lines → raw', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { parseLine } = await import('/blocks/gcodeToStack.js');
    return {
      varMove: parseLine('G0 X#9   ( travel )'),
      exprMove: parseLine('G1 X[a+1] Z-3 F200   ( cut )'),
      unknown: parseLine('G65 P8583 A#1 B#2'),
      commentOnly: parseLine('( Surfacing )'),
      blank: parseLine('   '),
    };
  });
  expect(r.varMove).toEqual({ type: 'move', params: { mode: 'rapid', x: '#9' } });   // single-axis kept
  expect(r.exprMove.params.x).toBe('[a+1]');
  expect(r.exprMove.params.z).toBe(-3);
  expect(r.unknown.type).toBe('raw');
  expect(r.unknown.params.text).toContain('G65');
  expect(r.commentOnly).toEqual({ type: 'comment', params: { text: 'Surfacing' } });
  expect(r.blank).toBe(null);
});

test('#5: G28 recovers #var / [expr] axes (the probeAxis twin) — does not drop them to the Z default', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { parseLine } = await import('/blocks/gcodeToStack.js');
    return {
      vars: parseLine('G28 X#5 Y#6'),               // BOTH axes are #vars → must recover 'XY', NOT the 'Z' fallback
      mixed: parseLine('G28 X10 Y#6 Z[#1+1]'),       // literal + #var + [expr] → all three recovered
      literal: parseLine('G28 Z0'),                  // unaffected: a plain literal still recovers
    };
  });
  // Before the fix the #var axes failed the (?=[-+.\d]) lookahead → axes=[] → join||'Z' = 'Z' (the silent drop).
  expect(r.vars, 'both #var axes recovered, not dropped to the Z default').toEqual({ type: 'home', params: { axes: 'XY' } });
  expect(r.mixed.params.axes, 'literal + #var + [expr] axes all recovered').toBe('XYZ');
  expect(r.literal.params.axes, 'plain literal still works').toBe('Z');
});

test('standard atoms (plane / feed-mode / home / call / return) decode instead of falling to raw, and round-trip', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
    const stack = [
      { type: 'plane', params: { plane: 'G18' } },
      { type: 'feedmode', params: { fmode: 'G95' } },
      { type: 'home', params: { axes: 'XYZ' } },
      { type: 'stop', params: { stop: 'M1' } },
      { type: 'call', params: { prog: 9083 } },
      { type: 'return', params: {} },
    ];
    const text1 = emitMapped(stack).text;
    const parsed = parseGcodeToStack(text1);
    const text2 = emitMapped(parsed).text;
    return { text1, text2, types: parsed.map((b) => b.type), homeAxes: parsed[2].params.axes, callProg: parsed[4].params.prog };
  });
  expect(r.types, 'standard codes decode to their atoms, not raw').toEqual(['plane', 'feedmode', 'home', 'stop', 'call', 'return']);
  expect(r.homeAxes).toBe('XYZ');
  expect(r.callProg).toBe(9083);
  expect(r.text2, 'byte-exact round-trip').toBe(r.text1);
});

test('reconcileGcodeToStack: leaf/empty programs re-parse; high-level programs return null', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { reconcileGcodeToStack, isAllLeaf } = await import('/blocks/gcodeToStack.js');
    const { newBlock } = await import('/blocks/blockEmitter.js');
    const leafStack = [{ type: 'move', params: { mode: 'cut', x: 1, y: 2, z: -1, feed: 100 } }];
    // a high-level program: Step Down ▸ Fill ▸ Region
    const sd = newBlock('stepdown'); const f = newBlock('fillzigzag'); const rg = newBlock('region');
    f.params.region = rg; sd.children = [f];
    return {
      emptyIsLeaf: isAllLeaf([]),
      leafIsLeaf: isAllLeaf(leafStack),
      highIsLeaf: isAllLeaf([sd]),
      fromEmpty: reconcileGcodeToStack('G0 X10 Y5\nG1 Z-3 F150', []),
      fromLeaf: reconcileGcodeToStack('G0 X10 Y5', leafStack),
      fromHigh: reconcileGcodeToStack('G1 X40 Y0 F600', [sd]),
    };
  });
  expect(r.emptyIsLeaf).toBe(true);
  expect(r.leafIsLeaf).toBe(true);
  expect(r.highIsLeaf).toBe(false);
  expect(r.fromEmpty.map((b) => b.type)).toEqual(['move', 'move']);   // empty workspace → typed leaves
  expect(r.fromLeaf.map((b) => b.type)).toEqual(['move']);            // leaf program → re-parse
  expect(r.fromHigh).toBe(null);                                      // high-level → not text-reconcilable
});

test('M350 dialect: a probe-style program decodes to proper blocks (no raw) and round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const dialect = getDialect('ddcs-expert-m350');
    const stack = [
      { type: 'assign', params: { var: '#100', value: '500', note: 'feed' } },   // dialect-independent macro write
      { type: 'label', params: { n: 1 } },
      { type: 'move', params: { mode: 'probe', x: 0, y: 0, z: -10, feed: 100 } },
      { type: 'probecheck', params: { axis: 'Z', goto: 9 } },                     // IF #1922!=2 GOTO9 (status var)
      { type: 'proberead', params: { axis: 'Z', var: '#50' } },                   // #50=#1927 (trigger var)
      { type: 'readmachine', params: { axis: 'Z', var: '#57' } },                 // #57=#882 (DRO var)
      { type: 'ifgoto', params: { lhs: '#50', op: '>', rhs: '0', goto: 2 } },
      { type: 'goto', params: { n: 1 } },
    ];
    const text1 = emitMapped(stack, { dialect }).text;
    const parsed = parseGcodeToStack(text1, { dialect });
    const text2 = emitMapped(parsed, { dialect }).text;
    return { text1, text2, types: parsed.map((b) => b.type) };
  });
  expect(r.types, 'every probe-program line decoded to a proper block (no raw fallback)').not.toContain('raw');
  expect(r.types).toEqual(['assign', 'label', 'move', 'probecheck', 'proberead', 'readmachine', 'ifgoto', 'goto']);
  expect(r.text2, 'M350 probe program round-trips byte-identically through the dialect recognizers').toBe(r.text1);
});

// t1650 — a real production defect (preflight-badge-838.spec.js's SEND CONFIRM test): a header line packing a
// G-word AND an M-word ("G21 G90 M3 S1000") was recognized as ONLY the first-matching G-word (distmode), and the
// M3 S1000 (and the G21) were silently DROPPED on re-projection through the editor⇄block-model reconcile — a
// genuinely spindle-on program came back spindle-off. Falls back to `raw` now (verbatim, never loses data), the
// same rule already applied to an M-code carrying arguments it can't reproduce.
test('a G-word sharing a line with an M-word falls back to raw (never silently drops the M-word)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { parseLine } = await import('/blocks/gcodeToStack.js');
    return {
      distmodeAndSpindle: parseLine('G21 G90 M3 S1000'),   // the exact t838 repro line
      rapidAndCoolant: parseLine('G0 X10 Y10 M8'),
      g53AndG0StillWorks: parseLine('G53 G0 Z-5'),          // the intentional G53+G0 companion — unaffected
      spindleAlone: parseLine('M3 S1000'),                  // pure M-code line — unaffected (no G-word present)
    };
  });
  expect(r.distmodeAndSpindle.type, 'a G+M combo falls to raw, not a partial (data-losing) distmode match').toBe('raw');
  expect(r.distmodeAndSpindle.params.text, 'raw preserves the WHOLE line verbatim — G21, G90 AND M3 S1000 all survive').toBe('G21 G90 M3 S1000');
  expect(r.rapidAndCoolant.type, 'the same guard covers any G-word + M-word combo, not just distmode+spindle').toBe('raw');
  expect(r.g53AndG0StillWorks, 'the G53+G0 companion is a G+G combo, not G+M — unaffected by this guard').toEqual({ type: 'machinemove', params: { axis: 'Z', to: -5 } });
  expect(r.spindleAlone, 'a pure M-code line (no G-word) still recognizes normally — the guard requires BOTH').toEqual({ type: 'spindle', params: { rpm: 1000, dir: 'cw' } });
});
