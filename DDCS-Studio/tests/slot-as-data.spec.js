import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, port #4: SLOT. Its { template, bindings } def (blocks/dataOps/slotData.js) emits
 * BYTE-IDENTICAL G-code to the hand-coded slotStack across a param sweep — including stock-attach with VARIED geometry,
 * which only passes because the slot leaf now declares extent() (the place fold recomputes the bbox live, like array did
 * for drill). Slot needed NO new atom and NO stepover-math move (its leaf was already flat; the band/stepover math is
 * kernel-internal over flat fields). Frontiers held UNBOUND (asserted as divergences): `pattern` (conditional array-wrap
 * structure swap) and `clearance` (fan-out → progstart + the leaf).
 */
test('slot-as-data: byte-identical G-code to slotStack across a param sweep + binding-wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { slotStack } = await import('/wizards/slotWizard.js');
    const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE, SLOT_BINDINGS } = await import('/blocks/dataOps/slotData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(slotDataDef());
    const dataBuilder = builderOf(SLOT_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from slotStack

    const base = SLOT_DEFAULTS;
    const S = (o) => ({ ...base, ...o });              // full param set (wizard names ax/ay/bx/by/toolDia)

    const sweep = [
      S({}),                                                          // defaults
      S({ originX: 13, originY: 7 }),                                 // opt-in raw offset
      S({ originX: -8, originY: 25 }),
      S({ ax: 5, ay: 5, bx: 80, by: 20 }),                           // angled slot
      S({ ax: -10, ay: 4, bx: 50, by: -6 }),
      S({ width: 14, stepoverPct: 30 }),                             // wide band → multiple parallel passes, finer stepover
      S({ width: 18, toolDia: 8 }),
      S({ depth: 8, stepdown: 2 }),                                  // multi-level depth
      S({ depth: 3, stepdown: 0.75 }),
      S({ feed: 900, plunge: 220 }),                                 // feeds
      S({ wcs: 'G54' }),                                             // a WCS line
      S({ ax: 0, ay: 0, bx: 0, by: 0 }),                            // zero-length slot → single-plunge guard path
      // ── stock-ATTACH with VARIED geometry (only byte-identical because the slot leaf declares extent()) ──
      S({ stockAttach: 'pp', stockW: 200, stockH: 150, stockDatum: 'nnp', ax: 10, ay: 10, bx: 70, by: 30, width: 10 }),
      S({ stockAttach: 'cc', stockW: 180, stockH: 140, ax: -5, ay: 5, bx: 55, by: 5, width: 12 }),
      // ── combined ──
      S({ originX: 6, originY: -4, ax: 8, ay: 2, bx: 64, by: 18, width: 11, toolDia: 7, stepoverPct: 35, depth: 6, stepdown: 1.2, feed: 800, plunge: 180, wcs: 'G55' }),
    ];

    const main = emitEquivalence(slotStack, dataBuilder, sweep);   // RAW (slot's comments are static)
    // FRONTIERS — MUST diverge: pattern wraps the leaf in an array (structure swap); clearance fans out to 2 sockets.
    const patternDiv = emitEquivalence(slotStack, dataBuilder, [S({ pattern: 'grid', cols: 2, rows: 2 })]);
    const clearanceDiv = emitEquivalence(slotStack, dataBuilder, [S({ clearance: 25 })]);

    // BINDING WIRING — every binding routes its param to the same socket slotStack uses (slot has no MAPPED enum, so the
    // generic sentinels suffice; the placement datum codes are stored RAW in the socket and only parsed at emit).
    const sentinelFor = (b) => (b.type === 'number' ? 4242 : '__SENTINEL__');
    const wiringFails = [];
    for (const b of SLOT_BINDINGS) {
      const sent = sentinelFor(b);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(slotStack(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const dataOk = dataSock[b.key] === sent, refOk = refSock[b.key] === sent;
      if (!dataOk || !refOk) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, dataOk, refOk });
    }

    const sampleText = emitMapped(dataBuilder(sweep[0])).text;
    return {
      bindingCount: SLOT_BINDINGS.length,
      wiringFails,
      independentPath: dataBuilder !== slotStack,
      pristine: BUILDERS[SLOT_DATA_OPTYPE] === undefined && SCHEMA[SLOT_DATA_OPTYPE] === undefined,
      resolves: typeof dataBuilder === 'function',
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 600), b: main.firstDiff.b.slice(0, 600) } },
      patternPass: patternDiv.pass,
      clearancePass: clearanceDiv.pass,
      sampleHasCut: /G1 X-?\d/.test(sampleText),
      sampleHasPlunge: /G1 Z-/.test(sampleText),
    };
  });

  expect(r.resolves, 'slot-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT slotStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  expect(r.bindingCount, 'all bindable slot params are bound').toBe(21);
  expect(r.wiringFails, 'every binding routes to the same socket slotStack uses').toEqual([]);
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- slotStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(12);
  expect(r.main.pass, 'slot-as-data == slotStack byte-for-byte across the sweep (incl. stock-attach + varied geometry)').toBe(true);
  expect(r.sampleHasCut, 'emits real slot cutting motion').toBe(true);
  expect(r.sampleHasPlunge, 'emits a real plunge to depth').toBe(true);
  // FRONTIERS — must diverge.
  expect(r.patternPass, 'frontier: pattern wraps the leaf in an array (structure swap the static template cannot do)').toBe(false);
  expect(r.clearancePass, 'frontier: clearance fans out to progstart + the leaf, unbound here').toBe(false);
});
