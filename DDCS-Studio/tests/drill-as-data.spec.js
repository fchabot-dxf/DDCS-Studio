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

    // The sweep covers everything the static {template,bindings} form faithfully reproduces: grid geometry AT ORIGIN
    // (cols/rows/dx/dy — keeps bbox.min=(0,0) so the baked placement shift is a no-op on both sides), skip, the cut
    // params (depth/peck/feed) and a WCS that emits a line. method=peck, clearance=5 are held constant.
    // (Off-origin x0/y0 and circle/line/rect patterns MOVE bbox.min → the frozen-snapshot placement diverges; those
    //  live in the FRONTIER block below — they are not binding failures, they are the placeOnStock blocker.)
    const sweep = [
      S({}),                                                         // defaults
      S({ cols: 2, rows: 1 }),
      S({ cols: 5, rows: 4 }),
      S({ cols: 4, rows: 3, dx: 15, dy: 25 }),
      S({ dx: 10, dy: 10 }),
      S({ cols: 3, rows: 3, skip: '2 5 8' }),                        // skip omits holes 2,5,8 (doesn't move the bbox)
      S({ depth: 12, peck: 3, feed: 250 }),                          // cut-param variety
      S({ depth: 8, peck: 2, feed: 180, cols: 4, rows: 2 }),
      S({ wcs: 'g54' }),                                             // a WCS that emits a line
      S({ wcs: 'g55', depth: 6, feed: 320, cols: 2, rows: 2 }),
      S({ cols: 6, rows: 1, dx: 12, skip: '1 6' }),
      S({ rows: 5, cols: 1, dy: 18 }),
    ];

    const main = emitEquivalence(drillStack, dataBuilder, sweep);

    // FRONTIER #2 (PRIMARY) — live bbox. Same grid shape, just OFFSET (x0/y0): the bbox moves, drillStack's baked
    // placement shifts by -bbox.min while the data def's frozen snapshot shifts by the author-time min → divergence.
    const bboxOffset = emitEquivalence(drillStack, dataBuilder, [S({ x0: 8, y0: 4 })]);
    // …and a different pattern SHAPE (circle) whose bbox.min ≠ the default grid's → same blocker, second face.
    const bboxShape = emitEquivalence(drillStack, dataBuilder, [S({ pattern: 'circle', count: 6, dia: 40 })]);
    // FRONTIER #1 — method swap (helical → a `bore` child the static template can't become).
    const helical = emitEquivalence(drillStack, dataBuilder, [S({ method: 'helical', holeDia: 12, toolDia: 6, pitch: 0.5 })]);
    // FRONTIER #3 — fan-out clearance (feeds progstart + the drill leaf; unbound here).
    const clearance = emitEquivalence(drillStack, dataBuilder, [S({ clearance: 25 })]);

    // BINDING WIRING — prove EVERY binding routes its param to the SAME socket drillStack does, INDEPENDENT of emit.
    // This is the rigorous half the emit sweep can't reach: the sweep only varies the params a static template can
    // reproduce (grid-at-origin/cut/skip/wcs), so x0/y0 and the pattern-SHAPE params (which always move the frozen
    // bbox → frontier #2) are emit-unprovable. The structural check catches a wrong/dropped/swapped (blockIndex,key)
    // for ALL bindings: set ONE param to a distinctive sentinel and assert BOTH the data def's instantiate AND
    // drillStack land that sentinel in the binding's (blockIndex,key) socket. A mis-keyed binding fails refOk
    // (drillStack routes the param elsewhere) or dataOk (the binding wrote elsewhere). No placement/bbox involved.
    const sentinelFor = (t) => (t === 'number' ? 4242 : '__SENTINEL__');   // never a drill default
    const wiringFails = [];
    for (const b of DRILL_BINDINGS) {
      const sent = sentinelFor(b.type);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(drillStack(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
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
  // EVERY binding is wired to the same socket drillStack routes its param to (covers the params the emit sweep can't —
  // x0/y0 + pattern-shape — so a wrong/dropped/swapped (blockIndex,key) can't hide behind frontier #2).
  expect(r.bindingCount, 'all drill params are bound').toBeGreaterThanOrEqual(20);
  expect(r.wiringFails, 'every binding routes to the same socket drillStack uses').toEqual([]);
  // The core claim: byte-identical G-code across the whole sweep.
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- drillStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(10);
  expect(r.main.pass, 'drill-as-data == drillStack byte-for-byte across the sweep').toBe(true);
  // The emit is real (not vacuously empty).
  expect(r.sampleHasArray, 'emits the array stamp markers').toBe(true);
  expect(r.sampleHasMotion, 'emits real plunge motion').toBe(true);
  // FRONTIER — these MUST currently diverge (documenting what the {template,bindings} format cannot yet express).
  expect(r.bboxOffsetPass, 'frontier #2 (primary): the placeOnStock bbox is frozen at author-time — an x0/y0 offset moves bbox.min so the baked placement shift diverges').toBe(false);
  expect(r.bboxShapePass, 'frontier #2: a different pattern SHAPE (circle) moves the bbox → same placement blocker').toBe(false);
  expect(r.helicalPass, 'frontier #1: a pure data def cannot swap the drill→bore child (helical diverges)').toBe(false);
  expect(r.clearancePass, 'frontier #3: clearance fans out to two sockets, unbound here (varying it diverges)').toBe(false);
});
