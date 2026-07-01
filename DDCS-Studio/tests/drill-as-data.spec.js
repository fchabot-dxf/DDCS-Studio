import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 4 (ROADMAP STRATEGIC #2). The DRILL built-in, expressed as a pure DATA definition
 * ({ template, bindings } via the federated user layer + instantiate — blocks/dataOps/drillData.js), emits
 * BYTE-IDENTICAL G-code to the hand-coded drillStack across a param sweep. Proven with the reusable equivalence
 * harness (blocks/dataOps/equivalence.js) that every future Stage-5 port will reuse.
 *
 * Also pins the FRONTIER: three things a pure {template,bindings} def cannot yet express (method swap, live bbox,
 * fan-out clearance) are demonstrated as EXECUTABLE divergences — turning the documented limits into regression
 * tripwires (if a future format extension closes one, the matching divergence test fails and flags the win).
 */
test('drill-as-data: the data def emits byte-identical G-code to drillStack across a param sweep', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { drillStack } = await import('/wizards/drillWizard.js');
    const { drillDataDef, DRILL_DEFAULTS, DRILL_DATA_OPTYPE } = await import('/blocks/dataOps/drillData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { DRILL_BINDINGS } = await import('/blocks/dataOps/drillData.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');

    // Register the drill-as-data op into the federated USER layer (runtime only — no persistence).
    const def = drillDataDef();
    registerUserOp(def);
    const dataBuilder = builderOf(DRILL_DATA_OPTYPE);     // === instantiate(def, …) — an INDEPENDENT path from drillStack

    const base = DRILL_DEFAULTS;
    const S = (o) => ({ ...base, ...o });                 // full param set so both builders agree on every unbound default

    // The sweep now spans EVERYTHING the placement-portable def reproduces — frontier #2 (live bbox) is SOLVED, so
    // off-origin x0/y0, circle/line/rect SHAPES, and stock-ATTACH placement all emit byte-identical (the place fold
    // recomputes the bbox live from the array's params). Plus cut params, skip and a WCS line. method=peck,
    // clearance=5 are held constant (the two remaining frontiers — see below).
    const sweep = [
      S({}),                                                         // defaults
      S({ cols: 2, rows: 1 }),
      S({ cols: 5, rows: 4 }),
      S({ cols: 4, rows: 3, dx: 15, dy: 25 }),
      S({ cols: 3, rows: 3, skip: '2 5 8' }),                        // skip omits holes 2,5,8
      S({ depth: 12, peck: 3, feed: 250 }),                          // cut-param variety
      S({ wcs: 'g54' }),                                             // a WCS that emits a line
      S({ wcs: 'g55', depth: 6, feed: 320, cols: 2, rows: 2 }),
      // ── frontier #2 territory (was divergent, now byte-identical) ──
      S({ x0: 8, y0: 4 }),                                           // off-origin grid → live -bbox.min shift
      S({ x0: -12, y0: 7, cols: 4, rows: 3, dx: 15, dy: 25 }),
      S({ pattern: 'circle', count: 6, dia: 40 }),                   // a different pattern SHAPE
      S({ pattern: 'circle', count: 8, dia: 80, startAngle: 30, depth: 7 }),
      S({ pattern: 'circle', count: 6, dia: 50, x0: 20, y0: -10 }),  // OFF-ORIGIN circle (x0→cx mirror must match emit)
      S({ pattern: 'line', count: 5, spacing: 12, angle: 30, x0: 4, y0: -3 }),
      S({ pattern: 'rect', w: 120, h: 60, nx: 3, ny: 2, x0: 2, y0: 2 }),
      // ── stock-ATTACH placement (the live bbox positions the moved/shaped pattern on the stock) ──
      S({ stockAttach: 'cc', stockW: 120, stockH: 120, pattern: 'circle', count: 6, dia: 60 }),
      S({ stockAttach: 'tr', stockW: 140, stockH: 110, pattern: 'circle', count: 7, dia: 70, x0: 15, y0: 8 }),
      S({ stockAttach: 'nn', stockW: 100, stockH: 80, x0: 5, y0: 5, cols: 4, rows: 3 }),
      S({ stockAttach: 'pp', stockW: 150, stockH: 90, originX: 10, originY: -5, pattern: 'rect', w: 80, h: 40, nx: 3, ny: 2 }),
    ];

    const main = emitEquivalence(drillStack, dataBuilder, sweep);

    // FRONTIER #2 — SOLVED. These two USED to diverge (frozen snapshot); they must now CONVERGE (live bbox).
    const bboxOffset = emitEquivalence(drillStack, dataBuilder, [S({ x0: 8, y0: 4 })]);
    const bboxShape = emitEquivalence(drillStack, dataBuilder, [S({ pattern: 'circle', count: 6, dia: 40 })]);
    // STILL-OPEN FRONTIER #1 — method swap (helical → a `bore` child the static template can't become).
    const helical = emitEquivalence(drillStack, dataBuilder, [S({ method: 'helical', holeDia: 12, toolDia: 6, pitch: 0.5 })]);
    // STILL-OPEN FRONTIER #3 — fan-out clearance (feeds progstart + the drill leaf; unbound here).
    const clearance = emitEquivalence(drillStack, dataBuilder, [S({ clearance: 25 })]);

    // BINDING WIRING — prove EVERY binding routes its param to the SAME socket drillStack does, INDEPENDENT of emit.
    // The emit sweep now covers the geometry/placement bindings (frontier #2 solved), but this structural check is
    // belt-and-suspenders + covers the unbound method/clearance sockets: set ONE param to a distinctive sentinel and
    // assert BOTH the data def's instantiate AND drillStack land that sentinel in the binding's (blockIndex,key)
    // socket. A mis-keyed binding fails refOk (drillStack routes the param elsewhere) or dataOk (the binding wrote elsewhere).
    const sentinelFor = (t) => (t === 'number' ? 4242 : '__SENTINEL__');   // never a drill default
    const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
    const wiringFails = [];
    for (const b of DRILL_BINDINGS) {
      const sent = sentinelFor(b.type);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(drillStack(S({ [b.param]: sent })))[b.blockIndex - WRAP_PREFIX_COUNT] || {}).params || {};
      const dataOk = dataSock[b.key] === sent;   // the binding wrote the sentinel where it claims
      const refOk = refSock[b.key] === sent;     // drillStack ALSO routes b.param to that exact socket
      if (!dataOk || !refOk) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, dataOk, refOk });
    }

    // A real, non-vacuous emit (sanity): the first sweep entry produces actual drill G-code.
    const sampleText = (await import('/blocks/blockEmitter.js')).emitMapped(dataBuilder(sweep[0])).text;

    return {
      bindingCount: DRILL_BINDINGS.length,
      wiringFails,
      independentPath: dataBuilder !== drillStack,
      pristine: BUILDERS[DRILL_DATA_OPTYPE] === undefined && SCHEMA[DRILL_DATA_OPTYPE] === undefined,
      resolves: typeof dataBuilder === 'function',
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 600), b: main.firstDiff.b.slice(0, 600) } },
      helicalPass: helical.pass,
      clearancePass: clearance.pass,
      bboxOffsetPass: bboxOffset.pass,
      bboxShapePass: bboxShape.pass,
      sampleHasArray: /\( Array \d+ @/.test(sampleText),
      sampleHasMotion: /G1 Z-/.test(sampleText),
    };
  });

  // The data def is a genuinely independent path that does NOT pollute the pristine built-in registries.
  expect(r.resolves, 'drill-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT drillStack (independent code path)').toBe(true);
  expect(r.pristine, 'drill-as-data lives in the user layer, built-in BUILDERS/SCHEMA untouched').toBe(true);
  // EVERY binding is wired to the same socket drillStack routes its param to (belt-and-suspenders alongside the emit sweep).
  expect(r.bindingCount, 'all drill params are bound').toBeGreaterThanOrEqual(28);
  expect(r.wiringFails, 'every binding routes to the same socket drillStack uses').toEqual([]);
  // The core claim: byte-identical G-code across the whole sweep — now incl. off-origin, circle/line/rect, stock-attach.
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- drillStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(15);
  expect(r.main.pass, 'drill-as-data == drillStack byte-for-byte across the sweep').toBe(true);
  // The emit is real (not vacuously empty).
  expect(r.sampleHasArray, 'emits the array stamp markers').toBe(true);
  expect(r.sampleHasMotion, 'emits real plunge motion').toBe(true);
  // FRONTIER #2 — SOLVED: the placement now tracks the pattern live, so these previously-divergent cases CONVERGE.
  expect(r.bboxOffsetPass, 'frontier #2 SOLVED: an x0/y0 offset now emits byte-identical (live bbox)').toBe(true);
  expect(r.bboxShapePass, 'frontier #2 SOLVED: a circle pattern now emits byte-identical (live bbox)').toBe(true);
  // STILL-OPEN frontiers — MUST currently diverge (what the {template,bindings} format cannot yet express).
  expect(r.helicalPass, 'frontier #1: a pure data def cannot swap the drill→bore child (helical diverges)').toBe(false);
  expect(r.clearancePass, 'frontier #3: clearance fans out to two sockets, unbound here (varying it diverges)').toBe(false);
});
