import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, port #4: SLOT. Its { template, bindings } def (blocks/dataOps/slotData.js) emits
 * BYTE-IDENTICAL G-code to the hand-coded slotStack across a param sweep — including stock-attach with VARIED geometry,
 * which only passes because the slot leaf declares extent() (the place fold recomputes the bbox live, like array did
 * for drill). Slot needed NO new atom and NO stepover-math move (its leaf was already flat; the band/stepover math is
 * kernel-internal over flat fields).
 *
 * ── t1500 — THE CONTRACT CHANGED SHAPE, because the template did ──────────────────────────────────────────────────
 *
 * `slotStack` forks now: an eligible slot's clearing IS the parametric `surfaceraster` atom, and everything the
 * measured gate refuses keeps the literal leaf. A FROZEN positional template cannot express that, so this def became
 * a SUPERSET twin — both arms guarded on a derived `_para`, value sockets bound BY IDENTITY (`bindingSpecs`,
 * re-derived over the PRUNED stack every build).
 *
 * ⚠ SO THE ASSERTIONS BELOW MOVED FROM POSITION TO IDENTITY, AND THAT IS THE POINT RATHER THAN A CHORE. The old
 * wiring check pinned each param to a frozen (blockIndex, key); a guarded template has no stable indices, and a check
 * that kept pinning them would have gone green by testing a structure the builder no longer produces. Each binding is
 * now asserted to reach the socket on the block TYPE that carries it, in whichever arm the params select.
 *
 * FRONTIER, still held UNBOUND (asserted as a divergence tripwire):
 *   • `pattern` — slotStack wraps the op in an `array` only when patterned (a CONDITIONAL STRUCTURE swap instantiate
 *     can't do). This def is the SINGLE-slot template; pattern stays 'single'. (Array-slot = a future port.)
 * `clearance` IS NO LONGER A FRONTIER — see the CLOSED-FRONTIER test at the bottom, which asserts it positively
 * rather than deleting the old expectation quietly.
 */
test('slot-as-data: byte-identical G-code to slotStack across a param sweep + binding-wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { slotStack, slotStackRidesRaster } = await import('/wizards/slotWizard.js');
    const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE, SLOT_BINDINGS } = await import('/blocks/dataOps/slotData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(slotDataDef());
    const dataBuilder = builderOf(SLOT_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from slotStack

    // t945 — the data-op inherits the machine Head at BUILD (spindleHeadPatch), like the FORM path at insert; seed the SAME
    // live Head here so the reference slotStack (via makeStart) spins up identically → the M3 header is not a spurious diff.
    const base = { ...SLOT_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const S = (o) => ({ ...base, ...o });              // full param set (wizard names ax/ay/bx/by/toolDia)

    const sweep = [
      S({}),                                                          // defaults — width == tool, the ZERO BAND → LITERAL arm
      S({ originX: 13, originY: 7 }),                                 // opt-in raw offset
      S({ originX: -8, originY: 25 }),
      S({ ax: 5, ay: 5, bx: 80, by: 20 }),                           // angled slot
      S({ ax: -10, ay: 4, bx: 50, by: -6 }),
      S({ width: 14, stepoverPct: 30 }),                             // wide band → the PARAMETRIC arm (the t1498 case)
      S({ width: 18, toolDia: 8 }),
      S({ depth: 8, stepdown: 2 }),                                  // multi-level depth
      S({ depth: 3, stepdown: 0.75 }),
      S({ feed: 900, plunge: 220 }),                                 // feeds
      S({ wcs: 'G54' }),                                             // a WCS line
      S({ ax: 0, ay: 0, bx: 0, by: 0 }),                            // zero-length slot → single-plunge guard path
      // ── t1500 — BOTH SIDES OF EVERY GATE, so the sweep cannot pass by staying on one arm ──
      S({ width: 14, entry: 'helix' }),                              // helix → refused → LITERAL
      S({ width: 14, entry: 'ramp', depth: 4, stepdown: 1.5 }),      // PARTIAL last bite → refused → LITERAL
      S({ width: 14, entry: 'ramp', depth: 3, stepdown: 1.5 }),      // FULL last bite → accepted → PARAMETRIC
      S({ width: 16, ax: 5, ay: 5, bx: 57, by: 35, toolDia: 8 }),   // angled + wide → PARAMETRIC
      S({ clearance: 25 }),                                          // t1500 — the closed fan-out frontier, in the main sweep now
      // ── stock-ATTACH with VARIED geometry (only byte-identical because the geometry declares extent()) ──
      S({ stockAttach: 'pp', stockW: 200, stockH: 150, stockDatum: 'nnp', ax: 10, ay: 10, bx: 70, by: 30, width: 10 }),
      S({ stockAttach: 'cc', stockW: 180, stockH: 140, ax: -5, ay: 5, bx: 55, by: 5, width: 12 }),
      // …and a stock-attached PARAMETRIC slot: the atom absorbs its own frame, so this proves the OTHER placement path
      S({ stockAttach: 'pp', stockW: 200, stockH: 150, ax: 10, ay: 10, bx: 70, by: 30, width: 16, toolDia: 6 }),
      // ── combined ──
      S({ originX: 6, originY: -4, ax: 8, ay: 2, bx: 64, by: 18, width: 11, toolDia: 7, stepoverPct: 35, depth: 6, stepdown: 1.2, feed: 800, plunge: 180, wcs: 'G55' }),
    ];

    const main = emitEquivalence(slotStack, dataBuilder, sweep);   // RAW (slot's comments are static)
    // FRONTIER — MUST diverge: pattern wraps the op in an array (a structure swap the single-slot template cannot do).
    const patternDiv = emitEquivalence(slotStack, dataBuilder, [S({ pattern: 'grid', cols: 2, rows: 2 })]);

    /**
     * BINDING WIRING, BY IDENTITY. Each binding gets a sentinel and must land on the socket of the block TYPE that
     * carries it — in BOTH builders. Resolving by type (rather than by a frozen index) is what makes this check
     * survive the fork; resolving the DATA side the same way is what makes it a real check rather than a restatement.
     *
     * ⚠ PINNED TO THE LITERAL ARM, and the reason is a real property of a value-driven fork rather than a convenience.
     * A sentinel of 4242 in `width` does not just set a socket — it makes the slot enormously wide, which SELECTS THE
     * PARAMETRIC ARM, where no `slot` leaf exists to check. The sentinel would be testing a different structure than
     * the one it was written for. So the base pins `entry: 'helix'`, which the gate always routes literal whatever
     * else a sentinel does to the geometry (and when `entry` itself is the param under test, the base's width == tool
     * ZERO BAND pins it instead — so every row really is on the literal arm).
     *
     * The PARAMETRIC arm's sockets are covered better elsewhere than a per-param sentinel could: the "DERIVED SOCKETS
     * ARE LIVE" test in slot-twin-repoint-1500 asserts the atom's WHOLE param set equals `slotRasterParams` of the
     * resolved op — which is the right check there, because most of those sockets are derived (an atan2 bearing, a
     * hypot length) rather than copied from any one field.
     */
    const PIN = { entry: 'helix' };   // always literal — see above
    const sentinelFor = (b) => (b.type === 'number' ? 4242 : '__SENTINEL__');
    const OWNER = {   // param → the block TYPE whose socket it drives, and the socket key there
      wcs: ['wcs', 'wcs'], rpm: ['progstart', 'rpm'], clearance: ['progstart', 'clearance'],
      originX: ['placeonstock', 'offX'], originY: ['placeonstock', 'offY'],
      stockAttach: ['placeonstock', 'stockAttach'], pathDatum: ['placeonstock', 'pathDatum'],
      stockDatum: ['placeonstock', 'stockDatum'], stockW: ['placeonstock', 'stockW'],
      stockH: ['placeonstock', 'stockH'], stockZ: ['placeonstock', 'stockZ'], offZ: ['placeonstock', 'offZ'],
      ax: ['slot', 'x0'], ay: ['slot', 'y0'], bx: ['slot', 'x1'], by: ['slot', 'y1'],
      width: ['slot', 'width'], toolDia: ['slot', 'tool'], stepoverPct: ['slot', 'stepoverPct'],
      depth: ['slot', 'depth'], stepdown: ['slot', 'stepdown'], entry: ['slot', 'entry'],
      rampAngle: ['slot', 'rampAngle'], helixDia: ['slot', 'helixDia'], helixPitch: ['slot', 'helixPitch'],
      feed: ['slot', 'feed'], plunge: ['slot', 'plunge'],
      // ⚠ TWIN-ONLY, and declared as such rather than skipped quietly: the entry-point and tool-selection MARKERS are
      // appended by the twin's template (appendEntry/appendToolSel) and have no counterpart in slotStack, which is the
      // op's cutting body alone. Both markers emit nothing. So the data side must wire; the reference side must have
      // no such block at all — asserted in that direction, so a marker leaking into slotStack would show up here.
      entryX: ['entry', 'entryX', 'twinOnly'], entryY: ['entry', 'entryY', 'twinOnly'], toolNum: ['toolsel', 'toolNum', 'twinOnly'],
    };
    const sockOf = (stack, type, key) => {
      const hits = flattenBlocks(stack).filter((b) => b.type === type);
      return { n: hits.length, val: hits.length === 1 ? (hits[0].params || {})[key] : undefined };
    };
    const wiringFails = [], unowned = [], wiredOnParametric = [];
    for (const b of SLOT_BINDINGS) {
      const own = OWNER[b.param];
      if (!own) { unowned.push(b.param); continue; }
      const sent = sentinelFor(b);
      const p = S({ ...PIN, [b.param]: sent });
      if (slotStackRidesRaster(p)) { wiredOnParametric.push(b.param); continue; }   // the pin failed → say so, don't hide it
      const [type, key, twinOnly] = own;
      const dataSock = sockOf(dataBuilder(p), type, key), refSock = sockOf(slotStack(p), type, key);
      const refOk = twinOnly ? (refSock.n === 0) : (refSock.val === sent);
      if (dataSock.val !== sent || !refOk) {
        wiringFails.push({ param: b.param, type, key, twinOnly: !!twinOnly, data: dataSock, ref: refSock });
      }
    }

    const sampleText = emitMapped(dataBuilder(sweep[0])).text;
    // which ARM each sweep row took — a byte-identity pass means nothing if every row stayed literal
    let para = 0, lit = 0;
    for (const p of sweep) (slotStackRidesRaster(p) ? para++ : lit++);
    return {
      bindingCount: SLOT_BINDINGS.length,
      wiringFails, unowned, wiredOnParametric, para, lit,
      independentPath: dataBuilder !== slotStack,
      pristine: BUILDERS[SLOT_DATA_OPTYPE] === undefined && SCHEMA[SLOT_DATA_OPTYPE] === undefined,
      resolves: typeof dataBuilder === 'function',
      // the def really is the SUPERSET-twin shape, not a frozen one that happens to agree today
      hasSpecs: Array.isArray(slotDataDef().bindingSpecs) && slotDataDef().bindingSpecs.length > 0,
      hasGuards: typeof slotDataDef().deriveGuards === 'function',
      frozenBindingsGone: !SLOT_BINDINGS.some((b) => b.blockIndex === undefined),
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 600), b: main.firstDiff.b.slice(0, 600) } },
      patternPass: patternDiv.pass,
      sampleHasCut: /G1 X-?\d/.test(sampleText),
      sampleHasPlunge: /G1 Z-/.test(sampleText),
    };
  });

  expect(r.resolves, 'slot-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT slotStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  // t1500 — the SUPERSET-twin mechanisms are present by name, so a silent regression to a frozen template is caught
  // here rather than as a puzzling diff in the sweep below.
  expect(r.hasSpecs, 'the def binds BY IDENTITY (bindingSpecs), not by frozen index').toBe(true);
  expect(r.hasGuards, 'and derives its `_para` arm guard from geometry').toBe(true);
  expect(r.unowned, 'every binding has a declared owning block type in this check').toEqual([]);
  // ⚠ the literal-arm pin really held for every param — otherwise a row was silently skipped, and a wiring check that
  // quietly tests fewer params than it lists is exactly the vacuity this rewrite exists to remove.
  expect(r.wiredOnParametric, 'the literal-arm pin held for every binding (none silently skipped)').toEqual([]);
  // 26 as of t842, +1 for the clearance frontier this act closes, + entryX/entryY/toolNum (now in the specs so they
  // re-derive over the pruned stack, where they used to be appended by their own helpers).
  expect(r.bindingCount, 'all bindable slot params are bound (27 + entryX/entryY + toolNum, deduped by param)').toBe(30);
  expect(r.wiringFails, 'every binding routes to the same socket slotStack uses').toEqual([]);
  // ⚠ BOTH ARMS ARE REALLY IN THE SWEEP — without this, byte-identity could hold by never re-pointing at all
  expect(r.para, 'the sweep really exercises the PARAMETRIC arm').toBeGreaterThan(3);
  expect(r.lit, 'and the LITERAL one').toBeGreaterThan(3);
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- slotStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(18);
  expect(r.main.pass, 'slot-as-data == slotStack byte-for-byte across the sweep (incl. stock-attach + varied geometry + BOTH arms)').toBe(true);
  expect(r.sampleHasCut, 'emits real slot cutting motion').toBe(true);
  expect(r.sampleHasPlunge, 'emits a real plunge to depth').toBe(true);
  // FRONTIER — must diverge.
  expect(r.patternPass, 'frontier: pattern wraps the op in an array (structure swap the single-slot template cannot do)').toBe(false);
});

/**
 * ── t1500 — THE FRONTIER THAT CLOSED, ASSERTED POSITIVELY ─────────────────────────────────────────────────────────
 *
 * `clearance` was held unbound because ONE frozen binding could reach ONE socket and it fans out to the framing
 * progstart AND the cutting body. Identity specs bind both. That is not a bonus here, it is REQUIRED: on the
 * re-pointed arm the atom carries its own `clearance`, so a still-frozen binding would have left the twin retracting
 * to 5mm while the form retracted to whatever the operator typed.
 *
 * A frontier that quietly stops being a frontier is indistinguishable from one that was silently dropped, so it is
 * asserted as a positive capability — the value reaches BOTH sockets, on BOTH arms — rather than by deleting a line.
 */
test('slot-as-data: the CLEARANCE fan-out frontier is CLOSED — one field, every socket, on both arms', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { slotStack } = await import('/wizards/slotWizard.js');
    const { slotDataDef, SLOT_DEFAULTS, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(slotDataDef());
    const build = builderOf(SLOT_DATA_OPTYPE);
    const base = { ...SLOT_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const look = (o) => {
      const p = { ...base, clearance: 25, ...o };
      const grab = (stack) => Object.fromEntries(flattenBlocks(stack).filter((b) => b.params && 'clearance' in b.params).map((b) => [b.type, b.params.clearance]));
      return { twin: grab(build(p)), form: grab(slotStack(p)), same: emitMapped(build(p)).text === emitMapped(slotStack(p)).text };
    };
    return { literal: look({}), para: look({ width: 16, toolDia: 6 }) };
  });
  // LITERAL arm: the framing progstart AND the slot leaf both carry the typed clearance
  expect(r.literal.twin, 'the twin drives every clearance socket on the literal arm').toEqual({ progstart: 25, slot: 25 });
  expect(r.literal.twin, '…exactly as the form path does').toEqual(r.literal.form);
  // PARAMETRIC arm: the progstart AND the atom, which carries its own retract height
  expect(r.para.twin, 'and every clearance socket on the re-pointed arm').toEqual({ progstart: 25, surfaceraster: 25 });
  expect(r.para.twin, '…exactly as the form path does').toEqual(r.para.form);
  expect(r.literal.same && r.para.same, 'and both arms emit identically').toBe(true);
});
