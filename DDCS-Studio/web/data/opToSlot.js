/**
 * data/opToSlot.js — generate a CAM-slot starting point from a Studio op (drill/bore × pattern).
 *
 * This is the wizard→CAM bridge ("Add from op"): instead of hand-entering form fields, pick an op + pattern
 * and get a filled slot — form fields (label/units/default/min/max/var) + a small, EDITABLE macro body that
 * reads the #2600 mirrors and cuts each hole inline. The author then tweaks.
 *
 * Per the project priority (friendliness/customization first): one small SELF-CONTAINED per-slot loop per
 * pattern, with the per-hole cut inlined — no shared sub to install, no monolithic dispatcher. DDCS has no
 * named M-codes (M-codes are numeric: M15 → O10015), so a "sub" would be a numeric O-program the operator must
 * install separately — fragile and easy to forget; inlining keeps every slot runnable on its own.
 * See the cam-menu-architecture memory + docs/archive/CAM-MENU-RESEARCH.md.
 */
import { nextParam, mirrorVar } from './slotPack.js';
import { nextLocalVar, bandsFor } from './camScratch.js';   // t1083 (slice B) — mint local body vars around drill/bore/slot's own scratch band
import { spindleOn, spindleOff, errorEnd } from './camMacroKit.js';   // t1512 — errorEnd: the packed arm refuses BEFORE any motion and must HALT, never fall through into the clear
import { surfaceRasterLines } from '../wizards/ops/surfaceraster.js';   // t1512 — the packed slot's clearing IS the wizard-path atom, exactly as the rect pocket's is (t1429)
import { slotRasterParams, SLOT_CAM_LIVE_KNOBS, SLOT_CAM_BAKED_FRAME } from '../wizards/ops/slot.js';   // t1512 — ONE source for the frame formula and for which knobs go live

// Field specs: label / units / default / min / max / type (1=decimal, 0=integer). `def` may depend on method.
const SPEC = {
    posX: { label: 'Centre X', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    posY: { label: 'Centre Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    dia: { label: 'Bolt-circle Ø', units: 'mm', def: 50, min: 1, max: 99999, type: 1 },
    count: { label: 'Hole count', units: '', def: 6, min: 1, max: 999, type: 0 },
    startAngle: { label: 'Start angle', units: 'deg', def: 0, min: 0, max: 360, type: 1 },
    cols: { label: 'Columns', units: '', def: 3, min: 1, max: 999, type: 0 },
    rows: { label: 'Rows', units: '', def: 3, min: 1, max: 999, type: 0 },
    dx: { label: 'X spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    dy: { label: 'Y spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    spacing: { label: 'Spacing', units: 'mm', def: 20, min: 0, max: 99999, type: 1 },
    angle: { label: 'Line angle', units: 'deg', def: 0, min: 0, max: 360, type: 1 },
    w: { label: 'Width', units: 'mm', def: 100, min: 1, max: 99999, type: 1 },
    h: { label: 'Height', units: 'mm', def: 80, min: 1, max: 99999, type: 1 },
    nx: { label: 'Holes / width', units: '', def: 3, min: 2, max: 999, type: 0 },
    ny: { label: 'Holes / height', units: '', def: 2, min: 2, max: 999, type: 0 },
    holeDia: { label: 'Hole Ø', units: 'mm', def: 6, min: 0.1, max: 9999, type: 1 },
    toolDia: { label: 'Tool Ø', units: 'mm', def: 6, min: 0.1, max: 9999, type: 1 },
    depth: { label: 'Depth', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    peck: { label: 'Peck', units: 'mm', def: 3, min: 0.1, max: 9999, type: 1 },
    pitch: { label: 'Pitch (Z/turn)', units: 'mm', def: 0.5, min: 0.05, max: 999, type: 1 },
    feed: { label: 'Feed', units: 'mm/min', def: 300, min: 1, max: 99999, type: 0 },
    clearance: { label: 'Clearance Z', units: 'mm', def: 5, min: 0, max: 9999, type: 1 },
    ax: { label: 'A — X', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    ay: { label: 'A — Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    bx: { label: 'B — X', units: 'mm', def: 60, min: -99999, max: 99999, type: 1 },
    by: { label: 'B — Y', units: 'mm', def: 0, min: -99999, max: 99999, type: 1 },
    stepdown: { label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 9999, type: 1 },
    rpm: { label: 'Spindle RPM', units: 'rpm', def: 8000, min: 1, max: 60000, type: 0 },
    // t1512 — THE THREE (four, with plunge) THAT JOIN THE #2600 LAYOUT on the packed arm. `width` defaults WIDER than
    // the tool on purpose: at width == tool the band the tool centre must sweep is zero, which is the arm's own
    // ineligible degenerate — a default sitting on it would seed the field table from a config that cannot pack.
    width: { label: 'Slot width', units: 'mm', def: 12, min: 0.1, max: 99999, type: 1 },
    stepoverPct: { label: 'Stepover', units: '%', def: 40, min: 1, max: 100, type: 1 },
    plunge: { label: 'Plunge feed', units: 'mm/min', def: 150, min: 1, max: 99999, type: 0 },
    rampAngle: { label: 'Ramp angle', units: 'deg', def: 3, min: 0.1, max: 89, type: 1 },
};

/**
 * ── t1516 — "`def` MAY DEPEND ON METHOD" BECOMES A DECLARATION INSTEAD OF A TERNARY ────────────────────────────────
 *
 * The header above has promised this since SPEC was written, and exactly one case implemented it — inline in the field
 * loop, as `key === 'holeDia' ? (method === 'bore' ? 12 : 6) : s.def`. One hand-rolled case is a one-off; the second
 * one is the rule-of-three's first warning, and the shape it wants is DATA: a per-method override map the loop reads.
 * Nothing new is built for it — the loop's one line changes from a comparison to a lookup.
 *
 * ⚠ ONLY WHERE THE VALUE DIFFERS, so each number keeps one source. `drill`'s hole Ø was written out in the ternary as
 * 6 — which is `SPEC.holeDia.def` — so it is absent here and falls through, rather than existing twice and inviting the
 * two copies to drift.
 *
 * ── THE SLOT'S TWO SEEDS, and why they were wrong ──────────────────────────────────────────────────────────────────
 * `SPEC.feed` (300) and `SPEC.depth` (5) are DRILL numbers: a peck-drill descends slowly and a hole is deep. A slot's
 * are its wizard's own — `slotLeafParams` seeds feed 2000 and depth 4 — and the seeds are what an operator sees in the
 * `#2600` field table before they change anything, so a slot arriving at 300mm/min proposes a feed six times slow. Not
 * a wrong CUT (every real flow overrides them from the op) but a wrong PROPOSAL, and the table is a control surface.
 *
 * MEASURED, because "give the slot its own" is only safe if nobody else moves: `feed` and `depth` are read by drill
 * (every pattern), bore (every pattern) and slot (both arms) — the three methods `slotFromOp` takes. The override is
 * keyed by method, so drill and bore keep 300/5 by construction, and the spec asserts their whole seeded row sets are
 * byte-for-byte what they were.
 */
const SPEC_DEF_BY_METHOD = {
    bore: { holeDia: 12 },                    // a bore needs hole Ø > tool Ø, else the cut radius is 0 (drill bores at tool Ø)
    slot: { feed: 2000, depth: 4 },           // the Slot wizard's own seeds — see slotLeafParams
};

/**
 * ── t1512 — THE SLOT HAS TWO ARMS, AND THE ARM IS THE `variant` ────────────────────────────────────────────────────
 *
 * `SLOT_ARM.atom` packs the PARAMETRIC RASTER ATOM as the slot's clearing — the same delegation the rect pocket took
 * at t1429 — so a slot WIDER than its tool finally has a correct CAM macro and the t1444 width gate lifts for it.
 * `SLOT_ARM.centreline` is the one-pass-per-level body this file has always emitted, kept for everything the atom's
 * envelope refuses.
 *
 * ⚠ WHICH ARM IS **NOT DECIDED HERE**, and not by a bearing check anywhere. `opCamMap.slotPackArm` asks the ATOM'S OWN
 * ENVELOPE (`slotStackArmGap` → `surfaceRasterCovers` + the live-geometry/bearing refusals), which is the advisor's
 * t1511 condition and the reason this arm needs no revisiting when C5 lands: the day the atom learns to rotate a live
 * frame, angled slots start packing because the ENVELOPE opens, with not one line of this file changed.
 *
 * ⚠ t1514 — **AND THAT DAY CAME.** C5 landed, angled slots pack, and this file is untouched by it — the paragraph
 * above is a prediction that was paid rather than a hope that was kept. It stays as written because the condition it
 * describes is a standing one: the next capability the atom learns reaches the CAM arm the same way, or the arm has
 * grown a check of its own that nobody declared.
 */
export const SLOT_ARM = { atom: 'atom', centreline: '' };

// Standalone ops (not point-patterns) — each: the form fields it exposes + a parametric body builder(v).
const STANDALONE = {
    slot: {
        label: 'Slot',
        fields: ['ax', 'ay', 'bx', 'by', 'depth', 'stepdown', 'feed', 'clearance', 'rpm'],
        /**
         * THE PACKED ARM'S FIELD LIST, and BOTH halves of the delta are in it (t1508's correction, t1511's ruling):
         *   JOIN the live #2600 layout   width · toolDia · stepoverPct · plunge
         *   LEAVE it                     ax · ay · bx · by — forced BAKED, with the bearing and length they derive
         * `plunge` is the fourth addition the scout's own delta line omitted: the centreline body has no plunge field
         * at all (it descends at `feed`), and the atom takes a real one, so it joins rather than being aliased away.
         * `rampAngle` bakes for the same reason the endpoints do — build-time geometry, and carrying it is what stops
         * a non-default ramp angle from being silently dropped on the way into the pack.
         */
        atom: {
            label: 'Slot (parametric clear)',
            fields: ['ax', 'ay', 'bx', 'by', 'rampAngle', 'width', 'toolDia', 'stepoverPct', 'depth', 'stepdown', 'feed', 'plunge', 'clearance', 'rpm'],
            bake: [...SLOT_CAM_BAKED_FRAME, 'rampAngle'],
        },
        body: (v) => ['( slot A->B centerline, stepping down. For width > tool, add perpendicular offset passes. )',
            '#50=0',
            `WHILE #50 LT ${v.depth} DO1`,
            `  #50=#50+${v.stepdown}`,
            `  IF #50 GT ${v.depth} THEN #50=${v.depth}`,
            `  G0 X${v.ax} Y${v.ay}`,
            `  G1 Z[-#50] F${v.feed}`,
            `  G1 X${v.bx} Y${v.by} F${v.feed}`,
            `  G0 Z${v.clearance}`,
            'END1'].join('\n'),
    },
};

// `single` (t1089) is the DEGENERATE pattern: count 1, at the anchor. It adds NO pattern fields — posX/posY already ARE
// the hole position — so the slot is posX/posY + the hole fields + feed/clearance/rpm. It exists so the DEFAULT drill twin
// (DRILL_DEFAULTS.pattern === 'single') reaches this GENERATOR instead of the universal unroll: the universal arm cannot
// expose depth/peck at all (drill.js peckDrill DROVE a JS while loop — retired t1391 — so the peck sequence was unrolled and every Z baked
// at BUILD), whereas here they are live #2600 knobs driven by a MACRO loop the operator can actually turn.
const PATTERN_FIELDS = { single: [], circle: ['dia', 'count', 'startAngle'], grid: ['cols', 'rows', 'dx', 'dy'], line: ['count', 'spacing', 'angle'], rect: ['w', 'h', 'nx', 'ny'] };
const HOLE_FIELDS = { drill: ['holeDia', 'depth', 'peck'], bore: ['holeDia', 'toolDia', 'depth', 'pitch'] };
const PATTERN_LABEL = { single: 'single hole', circle: 'bolt circle', grid: 'grid', line: 'line', rect: 'rectangle' };

/** The inline per-hole cut at the CURRENT X/Y — no named sub (DDCS has no named M-codes). `doN` is the DO/END
 *  number for the cut's own inner loop; it must be deeper than the surrounding pattern loop's nesting (the cut
 *  sits inside DO1 → use DO2, inside DO2 → use DO3). Uses scratch #40/#41 only (volatile, never persisted). */
function cutLines(method, v, doN) {
    if (method === 'bore') {
        // Ring-step: plunge in Z (G1) then a planar full-circle G3 at that depth — no helical G3. holeDia >= toolDia.
        return ['( bore one hole at current X/Y — ring-step down, no helical G3. Assumes hole Ø >= tool Ø. )',
            `#40=[${v.holeDia}-${v.toolDia}]/2   ;cut radius`, '#41=0',
            `G90 G0 Z${v.clearance}`, 'G91 G0 X#40 Y0   ;out to cut radius (relative to centre)',
            `WHILE #41 LT ${v.depth} DO${doN}`, `  #41=#41+${v.pitch}`, `  IF #41 GT ${v.depth} THEN #41=${v.depth}`,
            `  G90 G1 Z[-#41] F${v.feed}`, `  G91 G3 X0 Y0 I[-#40] J0 F${v.feed}   ;full circle`, `END${doN}`,
            `G90 G0 Z${v.clearance}`, 'G91 G0 X[-#40] Y0   ;back to centre', 'G90'];
    }
    return ['( peck-drill one hole at current X/Y — full retract each peck to clear chips )',
        '#41=0', `G90 G0 Z${v.clearance}`,
        `WHILE #41 LT ${v.depth} DO${doN}`, `  #41=#41+${v.peck}`, `  IF #41 GT ${v.depth} THEN #41=${v.depth}`,
        `  G1 Z[-#41] F${v.feed}`, `  G0 Z${v.clearance}   ;full retract to clear chips`, `END${doN}`];
}

const indent = (lines, pad) => lines.map((l) => pad + l);

/**
 * WHY EACH BAKED ROW IS BAKED, in the words the operator reads on the greyed control. postGating's rule is grey and
 * say why, never hide — an endpoint that simply vanished from the table would leave them wondering where the geometry
 * went, and this arm's whole point is that the geometry is build-time ON PURPOSE.
 */
export const SLOT_FRAME_BAKE_REASON = {
    _default: 'BAKED into this slot: build-time geometry the controller cannot recompute.',
    ax: 'BAKED into this slot: A and B set the walk\'s BEARING (atan2 of B-A) and its LENGTH (|B-A|), and the controller cannot compute either — ATAN and SQRT are community-referenced only. Dialling an endpoint would cut the OLD angle through the NEW point. Every other value here IS a live knob; move the slot by building it from the Slot wizard.',
    rampAngle: 'BAKED into this slot: the ramp\'s angle sets the descent length the atom lays out at build. It is carried from the op rather than dropped, but it is not a pendant knob.',
};
SLOT_FRAME_BAKE_REASON.ay = SLOT_FRAME_BAKE_REASON.ax;
SLOT_FRAME_BAKE_REASON.bx = SLOT_FRAME_BAKE_REASON.ax;
SLOT_FRAME_BAKE_REASON.by = SLOT_FRAME_BAKE_REASON.ax;

/** The refusal a packed slot emits INSTEAD of a body when a caller has exposed an endpoint — `refusalIfExposed`, wired. */
export const SLOT_FRAME_EXPOSED_REFUSAL = 'a packed slot\'s A/B endpoints must be BAKED: the walk\'s bearing is '
    + 'atan2(B-A) and its length is |B-A|, and the controller cannot recompute either (ATAN and SQRT are '
    + 'community-referenced only — V13_trig.nc decides them). Dial an endpoint at the pendant and the slot would cut '
    + 'the OLD angle through the NEW point, which is clean G-code and the wrong part. Bake the endpoints, or build '
    + 'this slot from the Slot wizard';

/**
 * ── THE PACKED BODY — the slot's clearing IS `surfaceRasterLines`, with the pendant knobs riding in as registers ────
 *
 * Everything geometric comes from `slotRasterParams`, called with the arm's own body vars as its `regs` map, so this
 * function contains NO frame arithmetic of its own: the bearing, the length and the near-edge-midpoint placement are
 * the wizard path's, read once. That is what makes the arm a DELEGATION rather than a second slot emitter — the thing
 * two of this project's measured defects (t1412, t1442) came from not having.
 *
 * THE GUARDS REFUSE **FIRST**, AND THAT IS A SAFETY CONSEQUENCE OF COMPOSING THE ATOM rather than a tidy-up — the same
 * reasoning `pocketSlot` records at t1429. The atom's own refusals (`IF #44 <= 0 GOTO91`) set `#1505` and then
 * CONTINUE, which is right for a body that ends a wizard program and wrong inside a slot. So the slot checks before
 * any motion and ends on `errorEnd`, which makes the atom's guards unreachable belt-and-braces.
 *
 * ⚠ AND THE ZERO BAND IS A **RUNTIME** GUARD HERE, not a build-time one. `width` and `toolDia` are both pendant knobs
 * now, so the arm cannot know at build time that the operator will not dial the width down onto the tool — the very
 * degenerate `slotRasterArmGap` routes to the literal arm at build. At run time it is one subtraction, and refusing it
 * loudly is the honest answer.
 */
function slotAtomBody(v, fields, pick) {
    const n = (w, dflt) => { const x = Number(w); return Number.isFinite(x) ? x : dflt; };
    // the live knobs → their body vars. A key the arm BAKED is a literal here, so it is not a register and not passed.
    const regs = {};
    SLOT_CAM_LIVE_KNOBS.forEach((k) => { if (/^#/.test(String(v[k]))) regs[k] = String(v[k]); });
    const clear = slotRasterParams({
        // the BAKED frame — literals substituted for the #vars the exposed arm would have used
        x0: n(v.ax, 0), y0: n(v.ay, 0), x1: n(v.bx, 60), y1: n(v.by, 0),
        // the numeric fallbacks matter only where a knob is NOT live; the live ones override them by name
        width: n(v.width, 12), tool: n(v.toolDia, 6), stepoverPct: n(v.stepoverPct, 40),
        depth: n(v.depth, 4), stepdown: n(v.stepdown, 1.5),
        feed: n(v.feed, 2000), plunge: n(v.plunge, 150), clearance: n(v.clearance, 5),
        // the op's BUILD-TIME picks, read from the declaration the pack already carries (never from op.params direct)
        entry: pick('entry', 'plunge'), rampAngle: n(v.rampAngle, 3),
    }, regs);
    return [
        `( Slot A->B — the PARAMETRIC RASTER ATOM clears the channel, wall to wall, layer by layer. )`,
        `( A (${n(v.ax, 0)}, ${n(v.ay, 0)}) -> B (${n(v.bx, 60)}, ${n(v.by, 0)}) is BAKED, with the bearing ${Number(clear.bearing).toFixed(3)} deg and the length ${Number(clear.w).toFixed(3)}mm it derives. )`,
        `( The controller cannot recompute those (ATAN/SQRT unverified), so they are build-time — every OTHER value below is a live knob. )`,
        ...fields.map((f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`),
        '',
        '( guard: step / tool / clearance must be positive — a 0 stepover divides by zero, a 0 stepdown loops the Z pass forever, and a 0 clearance is not a safe retract. Clean error, not a runaway. )',
        `IF ${v.stepoverPct} LE 0 GOTO 7`,
        `IF ${v.stepdown} LE 0 GOTO 7`,
        `IF ${v.toolDia} LE 0 GOTO 7`,
        `IF ${v.clearance} LE 0 GOTO 7`,
        '( guard: the slot must be WIDER than the tool — at equal width the band the tool centre sweeps is zero, and one centreline pass is a different program )',
        `IF [${v.width} - ${v.toolDia}] LE 0 GOTO 8`,
        '',
        ...spindleOn(v.rpm),
        ...surfaceRasterLines(clear),
        ...spindleOff(),
        'GOTO 9',
        '( errors )',
        'N7',
        '#1505=1   ;ERROR: stepover / stepdown / tool / clearance must be > 0',
        errorEnd('stepover / stepdown / tool / clearance must be > 0'),
        'N8',
        '#1505=1   ;ERROR: slot no wider than the tool',
        errorEnd('slot no wider than the tool — one centreline pass is a different program'),
        'N9',
        'M30',
    ].join('\n');
}

/** The pattern loop body (uses the var map; positions each point + inlines the per-hole cut). */
function loopBody(pattern, v, method) {
    // single — no loop at all: rapid to the anchor, then the SAME per-hole cut every other pattern inlines. cutLines takes
    // the DO nesting depth, so with no surrounding pattern loop it gets DO1 (the shallowest) rather than DO2.
    if (pattern === 'single') {
        return [`G0 X${v.posX} Y${v.posY}`, ...cutLines(method, v, 1)].join('\n');
    }
    if (pattern === 'circle') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`, `  #51=${v.startAngle}+#50*360/${v.count}`,
            `  G0 X[${v.posX}+[${v.dia}/2]*COS[#51]] Y[${v.posY}+[${v.dia}/2]*SIN[#51]]`,
            ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'line') {
        return ['#50=0', `WHILE #50 LT ${v.count} DO1`,
            `  G0 X[${v.posX}+#50*${v.spacing}*COS[${v.angle}]] Y[${v.posY}+#50*${v.spacing}*SIN[${v.angle}]]`,
            ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1'].join('\n');
    }
    if (pattern === 'grid') {
        return ['#52=0', `WHILE #52 LT ${v.rows} DO1`, '  #50=0', `  WHILE #50 LT ${v.cols} DO2`,
            `    G0 X[${v.posX}+#50*${v.dx}] Y[${v.posY}+#52*${v.dy}]`,
            ...indent(cutLines(method, v, 3), '    '), '    #50=#50+1', '  END2', '  #52=#52+1', 'END1'].join('\n');
    }
    // rect perimeter: top+bottom rows (nx each), then interior left+right columns (ny, skip shared corners)
    return ['#50=0', `WHILE #50 LT ${v.nx} DO1`, `  #53=${v.posX}+${v.w}*#50/[${v.nx}-1]`,
        `  G0 X#53 Y${v.posY}`, ...indent(cutLines(method, v, 2), '  '),
        `  G0 X#53 Y[${v.posY}+${v.h}]`, ...indent(cutLines(method, v, 2), '  '), '  #50=#50+1', 'END1',
        '#52=1', `WHILE #52 LT [${v.ny}-1] DO1`, `  #54=${v.posY}+${v.h}*#52/[${v.ny}-1]`,
        `  G0 X${v.posX} Y#54`, ...indent(cutLines(method, v, 2), '  '),
        `  G0 X[${v.posX}+${v.w}] Y#54`, ...indent(cutLines(method, v, 2), '  '), '  #52=#52+1', 'END1'].join('\n');
}

/**
 * Build a slot starting point. method 'drill'|'bore', pattern 'circle'|'grid'|'line'|'rect'.
 * `used` = Set of #11xx already taken in the pack (for collision-free allocation).
 * Returns { name, fields:[{idx,label,units,def,min,max,type,var}], body }  — plugs straight into slotPack.
 */
export function slotFromOp(method, pattern, used = new Set(), varOffset = 0, decl) {
    const std = STANDALONE[method];
    // t1512 — the ARM rides the `variant` slot. Only the standalone slot has a second arm; every other method ignores it.
    const arm = (std && std.atom && pattern === SLOT_ARM.atom) ? std.atom : null;
    const order = arm ? arm.fields : std ? std.fields : ['posX', 'posY', ...PATTERN_FIELDS[pattern], ...HOLE_FIELDS[method], 'feed', 'clearance', 'rpm'];
    /**
     * `refusalIfExposed`, WIRED — the surfaceRasterLiveGap pattern, one surface along.
     *
     * A build call declares the frame BAKED (`makeAuthOp` writes it from the field's own `bakeOnly` flag, so the
     * operator never had a control to get wrong). A decl that carries entries but NOT the four frame keys is a caller
     * that deliberately exposed one — and the arm REFUSES in the design's words rather than emitting a slot that cuts
     * the old angle through the new point. An ABSENT decl is the SEED call (`genFieldsFor` asks for the field list with
     * nothing declared yet), which is not an exposure and must not refuse.
     */
    const frameBaked = arm && SLOT_CAM_BAKED_FRAME.every((k) => decl && decl[k] && decl[k].exposed === false);
    const frameExposed = !!arm && !!decl && Object.keys(decl).length > 0 && !frameBaked;
    const taken = new Set(used);
    // S1a — the expose/bake hook (the inline twin of allocFieldsWith), preserving the `order` composition + the holeDia
    // default override. A BAKED param (decl[key].exposed === false) takes no #11xx param and pushes no field; its literal
    // substitutes for the #var at every interpolation site. decl absent / all-exposed → byte-identical to the old order.map.
    const fields = [];
    const v = {};
    let cur = varOffset;
    const avoid = bandsFor(method === 'bore' ? 'bore' : (std ? 'slot' : 'drill'));   // all three share one declared band; keyed for clarity
    order.forEach((key) => {
        const s = SPEC[key];
        // t1516 — the per-method default, READ from the declaration above rather than compared for here.
        const over = SPEC_DEF_BY_METHOD[method];
        const def = (over && over[key] != null) ? over[key] : s.def;
        const d = decl && decl[key];
        /**
         * t1512 — A FIELD THE **ARM** BAKES, which is a different fact from a field the OPERATOR baked. The four frame
         * keys (and the ramp angle) are build-time geometry on the packed arm, not a default someone may flip: they take
         * no #11xx param and push no field row into the macro, exactly as an operator-baked param does, but the choice
         * is the arm's. On the SEED call there is no decl yet, so the literal falls to the SPEC default and the row is
         * still declared to the table (`bakeOnly`) — which is what makes `makeAuthOp` bake it at the OP'S value.
         */
        const armBakes = !!arm && arm.bake.includes(key);
        if (armBakes || (d && d.exposed === false)) {
            const lit = (d && d.value != null && d.value !== '') ? d.value : def;
            v[key] = String(lit);
            if (armBakes) fields.push({ key, idx: null, var: null, label: s.label, units: s.units, def, min: s.min, max: s.max, type: s.type,
                bakeOnly: true, exposable: false, _exposeTip: SLOT_FRAME_BAKE_REASON[key] || SLOT_FRAME_BAKE_REASON._default });
            return;
        }
        const idx = nextParam(taken); if (idx != null) taken.add(idx);        // EXPOSED — identical alloc order
        cur = nextLocalVar(cur + 1, avoid);   // t1083 — step OVER this generator's own scratch band
        fields.push({ key, idx, var: '#' + cur, label: s.label, units: s.units, def, min: s.min, max: s.max, type: s.type });
        v[key] = '#' + cur;
    });
    // the LIVE rows only — a `bakeOnly` row is a table row with no #11xx param, so it never reaches the macro's reads
    const liveFields = fields.filter((f) => f.idx != null);
    if (arm) {   // t1512 — the PACKED arm: the clearing IS the parametric raster atom
        const pick = (k, dflt) => { const d = decl && decl[k], x = d && d.value; return (x == null || x === '') ? dflt : String(x); };
        const body = frameExposed
            ? ['( Slot A->B — REFUSED, no motion emitted. )', `( ${SLOT_FRAME_EXPOSED_REFUSAL} )`,
                '#1505=1   ;ERROR: a packed slot\'s endpoints must be baked', errorEnd('a packed slot\'s A/B endpoints must be baked')].join('\n')
            : slotAtomBody(v, liveFields, pick);
        return { name: arm.label, fields, body };
    }
    if (std) {   // standalone op (slot) — no pattern, no shared sub
        const reads = liveFields.map((f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`);
        const body = [`( ${std.label} )`, ...reads, '', ...spindleOn(v.rpm), '', std.body(v), ...spindleOff()].join('\n');
        return { name: std.label, fields, body };
    }
    // The body IS the scannable macro: structured mirror-read header (so "Refresh fields" can re-derive the
    // form) + the pattern loop with the per-hole cut inlined. All scratch vars (#1-#54) are < #500 = safe/volatile.
    const reads = fields.map((f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`);
    const body = [`( ${method} ${PATTERN_LABEL[pattern]} — self-contained, no sub to install )`, ...reads, '', ...spindleOn(v.rpm), '', loopBody(pattern, v, method), ...spindleOff()].join('\n');
    const name = method === 'bore' ? `Bore — ${PATTERN_LABEL[pattern]}` : `Drill — ${PATTERN_LABEL[pattern]}`;
    return { name, fields, body };
}

export { mirrorVar };   // re-export for callers that show the #11xx→#2600 mapping
