import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, the 3rd port: SURFACING (facing), the first FILL-family op. Its { template, bindings }
 * def (blocks/dataOps/surfacingData.js, via the federated user layer + instantiate) emits BYTE-IDENTICAL G-code to the
 * hand-coded surfacingStack across a param sweep — proven with the same harness drill/atc_warmup use.
 *
 * This port validates the restructure-to-flat reframe end-to-end: the geometry was lifted out of a Region PILL into a
 * flat `surfacefill` atom, the tool·% math moved to the FORM (a flat `stepover` socket), the 'raster' label maps to the
 * 'parallel' socket value, and the originX FAN-OUT was resolved by defining the region LOCALLY at (0,0) so PlaceOnStock
 * owns the position (offX = originX) — a clean 1-socket binding like drill, byte-identical because placementShift
 * anchors the bbox min-corner. The ONE remaining frontier (intentional): clearance fans out to progstart + the leaf.
 */
test('surfacing-as-data: byte-identical G-code to surfacingStack across a param sweep + binding-wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const { surfacingDataDef, SURFACING_DEFAULTS, SURFACING_DATA_OPTYPE, SURFACING_BINDINGS } = await import('/blocks/dataOps/surfacingData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(surfacingDataDef());
    const dataBuilder = builderOf(SURFACING_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from surfacingStack

    // t945 — the data-op now inherits the machine Head at BUILD (spindleHeadPatch), exactly as the FORM path does at insert
    // (surfacingView passes spindle: s.spindle → makeStart). Seed the SAME live Head here so the reference surfacingStack spins
    // up identically → the M3 header is byte-matched on both sides (the comparison now proves the twin == the FORM path).
    const base = { ...SURFACING_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const S = (o) => ({ ...base, ...o });                   // full FLAT param set (stepover/strategy, not toolDia/% or 'raster')

    // The sweep spans every bound dimension: placement offset (originX/originY → the placement, region is local-0),
    // size, stepover, parallel/concentric, depth pass, feeds, WCS line, and stock-ATTACH placement. clearance is held
    // at its default (the one frontier — see below).
    const sweep = [
      S({}),                                                            // defaults
      S({ originX: 13, originY: 7 }),                                   // placement offset (region local → placement owns it)
      S({ originX: -8, originY: 25 }),
      S({ w: 150, h: 60 }),                                            // size
      S({ w: 64, h: 120 }),
      S({ stepover: 4 }),                                              // finer stepover
      S({ stepover: 11 }),
      S({ strategy: 'concentric' }),                                   // concentric rings (analytic rect kernel)
      S({ strategy: 'concentric', w: 90, h: 90 }),
      S({ depth: 3, stepdown: 0.8 }),                                 // multi-level depth pass
      S({ depth: 1.2, stepdown: 0.4 }),
      S({ feed: 1200, plunge: 300 }),                                // feeds
      S({ wcs: 'G54' }),                                              // a WCS that emits a line
      S({ wcs: 'G55', depth: 2, stepover: 6 }),
      // ── stock-ATTACH placement (the live bbox positions the local region on the stock) ──
      S({ stockAttach: 'pp', stockW: 200, stockH: 150, stockDatum: 'nnp' }),
      S({ stockAttach: 'cc', stockW: 180, stockH: 140, originX: 10, originY: -5 }),
      // ── combined ──
      S({ originX: -8, originY: 25, w: 90, h: 90, stepover: 6, strategy: 'concentric', depth: 2, stepdown: 0.6, feed: 700, plunge: 180, wcs: 'G56' }),
    ];

    const main = emitEquivalence(surfacingStack, dataBuilder, sweep);   // RAW (no normalizer) — surfacing's comments are static
    // STILL-OPEN FRONTIER — fan-out clearance (feeds progstart + the surfacefill leaf; unbound here → varying it diverges).
    const clearance = emitEquivalence(surfacingStack, dataBuilder, [S({ clearance: 25 })]);

    // BINDING WIRING — every binding routes its param to the SAME socket surfacingStack uses (structural, independent of
    // emit). The `strategy` socket MAPS its input ('concentric'→concentric, else→parallel), so its sentinel must be a
    // VALID alternate value ('concentric' ≠ the 'parallel' default); pass-through enums/numbers use the generic sentinels.
    const sentinelFor = (b) => (b.type === 'number' ? 4242 : (b.param === 'strategy' ? 'concentric' : '__SENTINEL__'));
    const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
    const wiringFails = [];
    for (const b of SURFACING_BINDINGS) {
      const sent = sentinelFor(b);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(surfacingStack(S({ [b.param]: sent })))[b.blockIndex - WRAP_PREFIX_COUNT] || {}).params || {};
      const dataOk = dataSock[b.key] === sent;   // the binding wrote the sentinel where it claims
      const refOk = refSock[b.key] === sent;     // surfacingStack ALSO routes b.param to that exact socket
      if (!dataOk || !refOk) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, dataOk, refOk });
    }

    const sampleText = emitMapped(dataBuilder(sweep[0])).text;
    return {
      bindingCount: SURFACING_BINDINGS.length,
      wiringFails,
      independentPath: dataBuilder !== surfacingStack,
      pristine: BUILDERS[SURFACING_DATA_OPTYPE] === undefined && SCHEMA[SURFACING_DATA_OPTYPE] === undefined,
      resolves: typeof dataBuilder === 'function',
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 600), b: main.firstDiff.b.slice(0, 600) } },
      clearancePass: clearance.pass,
      sampleHasFill: /G1 X-?\d/.test(sampleText),    // real lateral clearing passes
      sampleHasPlunge: /G1 Z-/.test(sampleText),     // plunge to a cut depth
    };
  });

  // Independent, non-polluting path.
  expect(r.resolves, 'surfacing-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT surfacingStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  // Every binding wired to the same socket surfacingStack routes its param to.
  expect(r.bindingCount, 'all surfacing params are bound (t842 +4 depth-entry; t996 +1 rpm → progstart; t1031 +1 confirmEvery → stepdown)').toBe(24);
  expect(r.wiringFails, 'every binding routes to the same socket surfacingStack uses').toEqual([]);
  // The core claim: byte-identical across the whole sweep (placement offsets, size, parallel/concentric, depth, stock-attach).
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- surfacingStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(14);
  expect(r.main.pass, 'surfacing-as-data == surfacingStack byte-for-byte across the sweep').toBe(true);
  // The emit is real (not vacuously empty).
  expect(r.sampleHasFill, 'emits real lateral clearing passes').toBe(true);
  expect(r.sampleHasPlunge, 'emits a real plunge to depth').toBe(true);
  // STILL-OPEN frontier — clearance fans out to two sockets, unbound here, so varying it MUST diverge.
  expect(r.clearancePass, 'frontier: clearance fans out to progstart + the leaf, unbound here (varying it diverges)').toBe(false);
});

/**
 * t1349 — THE BINDINGS ARE POSITION-INDEPENDENT, and this asserts it the only way that is not vacuous: by MOVING
 * every body block and requiring each param to land on the same block TYPE and the same socket KEY anyway.
 *
 * A test that merely re-ran the derivation on the unchanged stack would pass identically for hand-counted indices —
 * it would prove nothing. The property the parametric switch depends on is that a change to the stack's SHAPE (it
 * collapses `stepdown{ surfacefill }` into one block, so every index from 3 down moves) cannot silently re-aim a
 * binding at whatever now sits at its old index. So the shape is really changed here, and the invariant checked is
 * param → (block type, socket key) — an independent truth, not the number the derivation happens to return.
 */
test('t1349 — a shape change MOVES every index and re-aims NO binding (identity, not position)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { buildSurfacingTwinStack, surfacingBindingsFor } = await import('/blocks/dataOps/surfacingData.js');
    const { flattenBlocks } = await import('/blocks/userOps.js');

    // param → the block TYPE + socket KEY it resolves to, over a given stack. The invariant.
    const aimOf = (stack) => {
      const flat = flattenBlocks(stack);
      const out = {};
      for (const b of surfacingBindingsFor(stack)) out[b.param] = { type: (flat[b.blockIndex] || {}).type, key: b.key, at: b.blockIndex };
      return out;
    };

    const base = aimOf(buildSurfacingTwinStack());

    // THE SHAPE CHANGE: a block ahead of the body, so every body index shifts by one — the same class of move the
    // switch makes when two blocks become one. (An unregistered filler type: flattenBlocks walks structure, and the
    // point is the POSITION shift, not what the filler emits.)
    const shifted = buildSurfacingTwinStack();
    shifted[0].children = [{ type: '__filler__', params: {} }, ...shifted[0].children];
    const after = aimOf(shifted);

    // AND THE AMBIGUITY GUARD: two blocks of a matched type must THROW, not silently take the first one.
    const dup = buildSurfacingTwinStack();
    dup[0].children = [...dup[0].children, { type: 'surfacefill', params: { w: 1, h: 1 } }];
    let ambiguous = null;
    try { surfacingBindingsFor(dup); } catch (e) { ambiguous = String(e.message || e); }

    return { base, after, ambiguous, params: Object.keys(base) };
  });

  expect(r.params.length, 'the whole binding set is under test').toBe(24);
  // EVERY index really moved — otherwise the invariant below would be trivially true.
  const movedBy = r.params.map((p) => r.after[p].at - r.base[p].at);
  expect([...new Set(movedBy)], 'the shape change shifted every body binding by exactly one').toEqual([1]);
  // …AND NOT ONE BINDING CHANGED WHAT IT AIMS AT.
  for (const p of r.params) {
    expect(r.after[p].type, `${p} still resolves to a ${r.base[p].type} block`).toBe(r.base[p].type);
    expect(r.after[p].key, `${p} still drives the "${r.base[p].key}" socket`).toBe(r.base[p].key);
  }
  // A duplicate is an authoring error, and it says so loudly rather than binding to the first hit.
  expect(r.ambiguous, 'two blocks of a matched type THROW at build time').toMatch(/matched 2 blocks/);
});
