/**
 * data/millToSlot.js — generate a CAM-slot starting point from a MILL AREA op (pocket, surfacing).
 *
 * Unlike the wizard (which UNROLLS the toolpath into explicit moves for one fixed size), a CAM slot must be
 * PARAMETRIC: the operator changes the form values on the controller and the macro recomputes the passes with
 * loops. So this is not a verbatim port — it re-expresses the wizard's validated strategy (raster zig-zag rows
 * inset half a stepover + a wall finish pass, per Z layer — see pocketWizard.js) via the shared rasterClear()
 * loop emitter.
 *
 * Runs at the WCS origin corner (the slot's WCS dropdown sets the frame); tool-centre paths are inset by the
 * tool radius so the FINISHED pocket = W x H. Spindle is assumed already running (same as the drill/bore slots).
 * See [[cam-probing-and-simulate]], [[cam-menu-architecture]], [[priorities-friendliness-over-perf]].
 */
import { allocFieldsWith, readLine } from './probeToSlot.js';
import { rasterClear, ringClear, SPINDLE_FIELD, spindleOn, spindleOff, errorEnd } from './camMacroKit.js';
import { surfaceRasterLines } from '../wizards/ops/surfaceraster.js';   // t1429 — the rect pocket's CLEAR is the wizard-path atom now: ONE clearing emitter, with the declared envelope and the equivalence bridges that come with it
import { bandsFor } from './camScratch.js';   // t1083 (slice B) — the DECLARED band this generator writes, so its field vars are minted around it   // t1077 — errorEnd: the declared HALT an error branch must end on (never fall through into the next composed part)

const CIRCLE_POCKET_FIELDS = [
    { key: 'dia', label: 'Diameter', units: 'mm', def: 60, min: 1, max: 99999, type: 1 },
    { key: 'depth', label: 'Depth', units: 'mm', def: 4, min: 0.1, max: 9999, type: 1 },
    { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 999, type: 1 },
    { key: 'stepover', label: 'Stepover', units: 'mm', def: 2.4, min: 0.1, max: 999, type: 1 },
    { key: 'toolDia', label: 'Tool Ø', units: 'mm', def: 6, min: 0.1, max: 999, type: 1 },
    { key: 'feed', label: 'Feed', units: 'mm/min', def: 600, min: 1, max: 99999, type: 0 },
    { key: 'plunge', label: 'Plunge feed', units: 'mm/min', def: 150, min: 1, max: 99999, type: 0 },
    { key: 'clearance', label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    SPINDLE_FIELD,
];

const POCKET_FIELDS = [
    { key: 'w', label: 'Width (X)', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    { key: 'h', label: 'Height (Y)', units: 'mm', def: 60, min: 1, max: 99999, type: 1 },
    { key: 'depth', label: 'Depth', units: 'mm', def: 4, min: 0.1, max: 9999, type: 1 },
    { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 999, type: 1 },
    // t1429 (ruled) — THE STEPOVER IS A PERCENTAGE HERE TOO, which is t1325's change arriving at the second slot that
    // exposes Tool Ø, for word-for-word its reason. MEASURED at t1427 before it was ruled: this field was millimetres
    // while the atom composes `#44 = [tool Ø × % / 100]` and has no live-mm path at all, so a dialled mm register was
    // DROPPED and the 60% recovery default used instead — on a Ø6 tool, 3.6mm of stepover where the operator typed
    // 2.4. And the deeper reason is t1325's: dial Tool Ø from 6 to 12 at the pendant and a stored millimetre silently
    // becomes a different fraction of the tool than was meant. Two knobs that must agree is one knob too many, so only
    // the intent is exposed and the machine re-derives the mm. 40% = POCKET_DEFAULTS.stepoverPct, the op's own default.
    { key: 'stepoverPct', label: 'Stepover', units: '%', def: 40, min: 1, max: 100, type: 1 },
    { key: 'toolDia', label: 'Tool Ø', units: 'mm', def: 6, min: 0.1, max: 999, type: 1 },
    { key: 'feed', label: 'Feed', units: 'mm/min', def: 600, min: 1, max: 99999, type: 0 },
    { key: 'plunge', label: 'Plunge feed', units: 'mm/min', def: 150, min: 1, max: 99999, type: 0 },
    { key: 'clearance', label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    SPINDLE_FIELD,
];

const SURFACE_FIELDS = [
    { key: 'w', label: 'Area X', units: 'mm', def: 100, min: 1, max: 99999, type: 1 },
    { key: 'h', label: 'Area Y', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    { key: 'depth', label: 'Depth', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    // t1325 — STEPOVER IS A PERCENTAGE OF THE TOOL, the CAM convention, and the mm is DERIVED in the header below.
    // Stored as mm it was a number computed for ONE tool: expose Tool Ø as a pendant knob, dial it from 12 to 8 at the
    // machine, and a 7.2mm stepover silently becomes 90% of the new tool instead of the 60% that was meant. Two knobs
    // that must agree is one knob too many, so only the intent is exposed and the machine re-derives the rest.
    { key: 'stepoverPct', label: 'Stepover', units: '%', def: 60, min: 1, max: 100, type: 1 },
    { key: 'toolDia', label: 'Tool Ø', units: 'mm', def: 12, min: 0.1, max: 999, type: 1 },
    { key: 'feed', label: 'Feed', units: 'mm/min', def: 800, min: 1, max: 99999, type: 0 },
    { key: 'plunge', label: 'Plunge feed', units: 'mm/min', def: 200, min: 1, max: 99999, type: 0 },
    { key: 'clearance', label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    SPINDLE_FIELD,
];

/** Shared raster params from the allocated field map. `dir` = 'x'|'y' raster row axis. */
const rasterOpts = (v, bounds, wall, dir) => ({
    ...bounds, depth: v.depth, stepdown: v.stepdown, stepover: v.stepover,
    feed: v.feed, plunge: v.plunge, clearance: v.clearance, wall, dir: dir === 'y' ? 'y' : 'x',
});
/** Human label for a raster direction, for the body header comment. */
const dirLabel = (dir) => (dir === 'y' ? 'rows ∥ Y' : 'rows ∥ X');

/**
 * ── t1429 — THE DELEGATION. The rect pocket's clearing body IS the raster atom now ────────────────────────────────
 *
 * WHAT THIS ENDS. Studio held TWO clearing emitters: `surfaceRasterLines` (the wizard/Blocks path, parametric, with a
 * declared envelope and equivalence bridges to the literal kernel) and `rasterClear` (this slot's, hand-written). Two
 * emitters for one operation is the split this whole arc exists to close, and it had already produced the divergence
 * t1412 measured: the packed body was BYTE-IDENTICAL for `strategy: spiral|raster` and for `direction:
 * bothways|oneway` — one hand-written zig-zag — while the CAM table displayed the operator's pick beside it. A spiral
 * pocket packed a slot that cuts a raster, and the surface agreed with the request.
 *
 * WHAT THE OPERATOR GETS THAT THEY DID NOT HAVE: `strategy` (concentric rings, genuinely), `direction` (the one-way
 * climb / conventional walks t1418 taught the atom), the row axis this slot has always exposed, the atom's declared
 * envelope, and a stepover that follows the tool. What they LOSE is an unrequested ramp lead-in: `rasterClear` always
 * ramped into each layer whatever the op's Depth Entry said, so the pick reached the macro nowhere. It is carried now,
 * and the common (plunge) case therefore descends the way the wizard's preview has always shown it.
 *
 * THE GEOMETRY IS LIVE END TO END — every POCKET_FIELDS knob drives the traced motion, which is the requirement this
 * act was gated on and the reason t1425 and t1429's first half had to land first: `w`/`h`/`toolDia`/`stepoverPct` ride
 * registers into the atom's header, the tool-radius inset rides `#22`, and the retract height rides `clearance`.
 *
 * THE WALL MOVED, and it had to. It used to be emitted INSIDE `rasterClear`'s Z loop — fill(L1), wall(L1), fill(L2)…
 * The atom OWNS the depth loop now, so a wall interleaved inside a loop this file no longer controls is not
 * expressible; it becomes its OWN depth loop after the clear. That is not a new decision, it is exactly the
 * rough-all-then-wall re-order t1405 ruled for the wizard path, arriving at the slot for the same mechanical reason.
 * And it follows the STRATEGY, because that is what carrying the pick means: the concentric walk's outermost ring already
 * IS the wall (the op's own help says so — *"Spiral = concentric offset rings inward (no wall pass)"*), so a spiral
 * pocket emits no second pass.
 */
export function pocketSlot(used = new Set(), varOffset = 0, dir = 'x', decl) {
    const { fields, v } = allocFieldsWith(POCKET_FIELDS, used, varOffset, decl, bandsFor('pocket'));
    /**
     * THE OP'S BUILD-TIME PICKS, READ FROM THE DECLARATION THE PACK ALREADY CARRIES. `decl` is the expose/bake map
     * (macrosApp's `declFromOp`), and a pick the generator bakes arrives in it as a baked row — see
     * `GENERATOR_BAKES_PICK` in opCamMap, which is what puts `direction`/`entry` there beside the `strategy` that was
     * already arriving. A generator NEVER reads the op's params directly; it reads what the pack declared, so the
     * table the operator is looking at and the macro that gets built cannot say different things.
     */
    const pick = (k, dflt) => { const d = decl && decl[k], x = d && d.value; return (x == null || x === '') ? dflt : String(x); };
    const strategy = pick('strategy', 'raster') === 'spiral' ? 'concentric' : 'parallel';
    const wall = strategy !== 'concentric';
    // The atom's own params, seeded LIVE: every geometry input is the slot's field register, never a build-time number.
    const clear = {
        x: '#20', y: '#21', w: v.w, h: v.h, inset: '#22',
        depth: v.depth, stepdown: v.stepdown, toolDia: v.toolDia, stepoverPct: v.stepoverPct,
        feed: v.feed, plunge: v.plunge, clearance: v.clearance,
        strategy, direction: pick('direction', 'bothways'), rowAxis: dir === 'y' ? 'y' : 'x', entry: pick('entry', 'plunge'),
    };
    const body = [
        `( Rectangular pocket — ${wall ? `raster clear (${dirLabel(dir)}) + wall finish` : 'concentric-ring clear'}, layer by layer. Runs at the WCS origin corner. )`,
        '( Spindle must already be running. Edit #20/#21 to offset the pocket within the WCS. )',
        ...fields.map(readLine),
        '',
        '#20=0   ;origin X (edit to offset)',
        '#21=0   ;origin Y',
        '( tool-centre clearing region, inset by the tool radius → finished size = W x H )',
        `#22=[${v.toolDia}/2]`,
        `#23=[#20+#22]   ;x0`,
        `#24=[#20+${v.w}-#22]   ;x1`,
        `#25=[#21+#22]   ;y0`,
        `#26=[#21+${v.h}-#22]   ;y1`,
        '( guard: the pocket must be larger than the tool )',
        'IF #24 LE #23 GOTO 8',
        'IF #26 LE #25 GOTO 8',
        // t1429 — THE POSITIVE GUARDS, and this is a SAFETY consequence of composing the atom rather than a tidy-up.
        // The atom's own refusals (`IF #44 <= 0 GOTO91`) set #1505 and then CONTINUE — right for a body that ends a
        // wizard program, and wrong inside a slot, where the next thing after the atom is the wall pass: a tripped
        // guard would flag the error and then cut the wall anyway. That is the fall-through t1077 built `errorEnd` to
        // stop. So the slot refuses FIRST, before any motion, and ends on M30 — which makes the atom's own guards
        // unreachable belt-and-braces rather than the last line of defence. Same four checks, same wording, as the
        // surface slot's N7 (a 0 stepover divides by zero, a 0 stepdown loops the Z pass forever, a 0 clearance is not
        // a safe retract) — with the tool Ø added because the pocket derives BOTH its inset and its stepover from it.
        '( guard: step / tool / clearance must be positive — a 0 stepover div-by-zeros the row count, a 0 stepdown loops the Z pass forever, and a 0 clearance is not a safe retract. Clean error, not a runaway. )',
        `IF ${v.stepoverPct} LE 0 GOTO 7`,
        `IF ${v.stepdown} LE 0 GOTO 7`,
        `IF ${v.toolDia} LE 0 GOTO 7`,
        `IF ${v.clearance} LE 0 GOTO 7`,
        '',
        ...spindleOn(v.rpm),
        ...surfaceRasterLines(clear),
        ...(wall ? wallFinish(v) : []),
        ...spindleOff(),
        'GOTO 9',
        '( errors )',
        'N7',
        '#1505=1   ;ERROR: stepover / stepdown / tool / clearance must be > 0',
        errorEnd('stepover / stepdown / tool / clearance must be > 0'),
        'N8',
        '#1505=1   ;ERROR: pocket smaller than the tool',
        errorEnd('pocket smaller than the tool'),
        'N9',
        'M30',
    ].join('\n');
    return { name: 'Pocket (rect)', fields, body };
}

/**
 * THE WALL FINISH — its own depth loop, over the tool-centre rectangle the guard above already computed into
 * #23-#26. Same four cutting moves, same plunge and same retract the interleaved version emitted; what changed is
 * WHEN, and only because the atom owns the clear's depth loop now (see the note on pocketSlot).
 *
 * #27-#28 are the kit's raster band, declared for this generator in camScratch and dead by the time this runs — the
 * clear finished before the wall starts, which is the whole point of the re-order.
 */
function wallFinish(v) {
    return [
        '( wall finish pass at the inset boundary — its OWN depth loop, after the clear (rough all, then wall) )',
        '#28=0   ;wall level',
        `WHILE #28 LT ${v.depth} DO1`,
        `  #28=[#28+${v.stepdown}]`,
        `  IF #28 GT ${v.depth} THEN #28=${v.depth}`,
        '  G0 X#23 Y#25',
        `  G1 Z[0-#28] F${v.plunge}`,
        `  G1 X#24 Y#25 F${v.feed}`,
        '  G1 X#24 Y#26',
        '  G1 X#23 Y#26',
        '  G1 X#23 Y#25',
        `  G0 Z${v.clearance}`,
        'END1',
    ];
}

/**
 * Build the "Pocket (circle)" CAM slot — concentric-ring clear of a round pocket, layer by layer. Tool-centre
 * paths inset by the tool radius so the finished bore Ø = the form value. Runs at the WCS origin (centre).
 */
export function circlePocketSlot(used = new Set(), varOffset = 0, arc = 'G3', decl) {
    const { fields, v } = allocFieldsWith(CIRCLE_POCKET_FIELDS, used, varOffset, decl, bandsFor('cpocket'));
    const dirName = arc === 'G2' ? 'CW / conventional' : 'CCW / climb';
    const body = [
        `( Round pocket — concentric-ring clear (${dirName}), layer by layer. Runs at the WCS origin (pocket centre). )`,
        '( Spindle must already be running. Edit #20/#21 to offset the centre within the WCS. )',
        ...fields.map(readLine),
        '',
        '#20=0   ;centre X (edit to offset)',
        '#21=0   ;centre Y',
        `#22=[[${v.dia}-${v.toolDia}]/2]   ;max tool-centre radius (so finished bore = Diameter)`,
        'IF #22 LE 0 GOTO 8',
        '',
        ...spindleOn(v.rpm),
        ...ringClear({ cx: '#20', cy: '#21', maxR: '#22', depth: v.depth, stepdown: v.stepdown, stepover: v.stepover, feed: v.feed, plunge: v.plunge, clearance: v.clearance, arc: arc === 'G2' ? 'G2' : 'G3' }),
        ...spindleOff(),
        'GOTO 9',
        '( error )',
        'N8',
        '#1505=1   ;ERROR: pocket smaller than the tool',
        errorEnd('pocket smaller than the tool'),
        'N9',
        'M30',
    ].join('\n');
    return { name: 'Pocket (circle)', fields, body };
}

/**
 * Build the "Surface / face" CAM slot — raster the top of the stock flat. Like the pocket raster but with NO
 * radius inset (the area is the tool-CENTRE sweep, so the tool overhangs the edges and faces the whole top)
 * and NO wall pass. Shallow Z (skim). Runs at the WCS origin corner; spindle assumed running.
 */
export function surfacingSlot(used = new Set(), varOffset = 0, dir = 'x', decl) {
    const { fields, v } = allocFieldsWith(SURFACE_FIELDS, used, varOffset, decl, bandsFor('surface'));
    const body = [
        `( Surface / face mill — raster the top flat (${dirLabel(dir)}). Tool-centre sweeps Area X x Y; the tool overhangs the edges. )`,
        '( Spindle must already be running. Edit #20/#21 to offset within the WCS. )',
        ...fields.map(readLine),
        '',
        '#20=0   ;origin X (edit to offset)',
        '#21=0   ;origin Y',
        '( tool-centre sweep area — no inset, the tool overhangs by its radius on all sides )',
        '#23=#20   ;x0',
        `#24=[#20+${v.w}]   ;x1`,
        '#25=#21   ;y0',
        `#26=[#21+${v.h}]   ;y1`,
        '( t1325 — the raster overlap, DERIVED here from the two pendant knobs. Change Tool Ø at the machine and the )',
        '( stepover follows it, because the % is the intent and the mm is only its consequence. )',
        // #22 — the CALLER'S band. camMacroKit declares the split in its own header: callers own #20–#26 and the kit
        // owns #27–#33. This was written as #27 first, and rasterClear promptly overwrote it with the raster ROW
        // COUNT one line later — the ramp length, the first row and the WHILE bound all then ran on that number. It
        // emitted clean-looking G-code that cut a different part, which is why the fix was to read the emitted text
        // rather than trust the variable name.
        `#22=[${v.toolDia} * ${v.stepoverPct} / 100]   ;stepover mm = tool Ø · %`,
        'IF #24 LE #23 GOTO 8',
        'IF #26 LE #25 GOTO 8',
        '( guard: step / tool / clearance must be positive — a 0 stepover div-by-zeros the row count, a 0 stepdown loops the Z pass forever, and a 0 clearance is not a safe retract. Clean error, not a runaway. )',
        'IF #22 LE 0 GOTO 7',
        `IF ${v.stepdown} LE 0 GOTO 7`,
        `IF ${v.toolDia} LE 0 GOTO 7`,
        `IF ${v.clearance} LE 0 GOTO 7`,
        '',
        ...spindleOn(v.rpm),
        // the raster steps by the DERIVED mm — one source, so the guard above and the motion below cannot disagree
        ...rasterClear(rasterOpts({ ...v, stepover: '#22' }, { x0: '#23', x1: '#24', y0: '#25', y1: '#26' }, false, dir)),
        ...spindleOff(),
        'GOTO 9',
        '( errors )',
        'N7',
        '#1505=1   ;ERROR: stepover / stepdown / tool / clearance must be > 0',
        errorEnd('stepover / stepdown / tool / clearance must be > 0'),
        'N8',
        '#1505=1   ;ERROR: zero area',
        errorEnd('zero area'),
        'N9',
        'M30',
    ].join('\n');
    return { name: 'Surface / face', fields, body };
}
