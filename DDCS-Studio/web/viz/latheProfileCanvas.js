/**
 * viz/latheProfileCanvas.js — THE HALF-PROFILE, drawn (t1271). The pilot's marker-derived handle lives here.
 *
 * A lathe part is read as one half of its section: Z across, X (radius) up, the centreline along the bottom. Nobody
 * draws the mirrored half — it is the same profile again, twice the ink for no information.
 *
 * IT DRAWS THE MODEL'S DATA, IT DOES NOT COMPUTE GEOMETRY. `halfProfile()` (data/lathe.js) says where the bar, the
 * datum and the allowance are; this maps that into the shared FeatureCanvas frame and back. If the picture ever
 * disagrees with the emit, exactly one of them read the model wrong — there is no second opinion to reconcile.
 *
 * ── THE FACE LINE IS THE HANDLE (the mechanism the family inherits) ──────────────────────────────────────────────
 * Dragging the face line in Z does not "move a line": it WRITES THE ALLOWANCE — how much material sits ahead of the
 * finished face — and the emit follows, because the allowance is the bound parameter the macro's #var header holds.
 * That is the tieDiagTravel pattern: a handle is a second way to type a number, never a second source of truth. The
 * form mirrors it live, and a test drags it and re-reads the EMIT, because a handle that moves pixels without moving
 * the program is the exact failure this pattern exists to prevent.
 *
 * THE CANVAS FRAME: FeatureCanvas is X-right / Y-up, so the lathe's Z maps to canvas x and its RADIUS to canvas y.
 * That mapping is stated once, here, in zToCanvas/canvasToZ — the two are inverses and are tested as such.
 */
import { halfProfile, normalizeBar, radiusOf, diameterOf } from '../data/lathe.js';
import { polygonPath, polyRadiusAt, polySides } from '../wizards/lathe/polygon.js';   // t1277 — the end view draws the op's OWN r(angle), never its own idea of a hexagon

/** Lathe Z → canvas x. The bar runs left (chuck, −Z) to right (raw face, +Z), which is how a turner faces one. */
export const zToCanvas = (z) => z;
/** …and back. Inverses by construction; a test asserts it rather than trusting the symmetry. */
export const canvasToZ = (x) => x;

export const FACE_HANDLE_ID = 'faceLine';

/** t1680 — click-to-edit for a lathe handle. Every handle below sets `value` to the exact param it represents (by
 *  construction — the same number its own onDrag ultimately writes), so onEdit never needs onDrag's inverse
 *  geometry math (diameterOf/canvasToZ/clamps): a small id→field map is enough. A map entry may be a function
 *  instead of a field name for the one handle (odProfileSpec's shoulder) whose target field depends on a mode flag.
 *  Declared once, reused by every builder in this file — this project's own "declare over hand-roll" move, applied
 *  to the fix the t1678 census exists to enable (buildCanvasWidgets already gets this for free from its `field`
 *  convention; the lathe family hand-builds its handles, so it needs this one small equivalent). */
const onEditFromMap = (map, write) => (id, val) => {
    const f = map[id];
    if (f == null || !Number.isFinite(val)) return;
    write(typeof f === 'function' ? f(val) : { [f]: val });
};

/**
 * Build the canvas spec for a bar.
 * @param {object} bar        {diameter, stickOut, allowance}
 * @param {(allowance:number) => void} onAllowance  called with the NEW allowance while the face line is dragged
 * @returns a FeatureCanvas spec: shapes to draw, one draggable handle, and the drag→parameter write
 */
export function latheProfileSpec(bar, onAllowance) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const r = radiusOf(b.diameter);

    return {
        // THE DRAWING FRAME IS THE BAR ITSELF — its half-section, Z across and radius up. The canvas draws `stock` as
        // the outline rectangle, so the bar needs no second silhouette on top of it.
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: r },
        items: [
            // the centreline: a lathe drawing is meaningless without it
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // THE ALLOWANCE — the material that gets faced off, between the datum and the raw end.
            // (fc-feature-pocket is the DECLARED class for material coming away. An invented `fc-feature` matched no
            // rule at all: the rects fell back to an unstyled black box and the polygon path, being fill:none with no
            // stroke, drew NOTHING — invisible until a real wizard was opened and looked at.)
            { kind: 'rect', x: zToCanvas(prof.allowance.z1), y: 0, w: prof.allowance.z2 - prof.allowance.z1, h: r, cls: 'fc-feature-pocket' },
            // Z0, the finished face
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: r },
        ],
        handles: [
            // t1684 — emits:true (the SAME declared convention corner's sim-start rows use, unified via opSimStarts.js's
            // makeProvider) marks a handle whose drag writes a bound param that reaches the emit; featureCanvas.js reads
            // it and tints the handle TEAL. It sits on the RAW END, because that is what moves when you decide to remove more or less.
            { id: FACE_HANDLE_ID, x: zToCanvas(prof.allowance.z2), y: r, kind: 'size', axis: 'x', emits: true,
              label: 'face', value: b.allowance },
        ],
        onDrag: (id, world) => {
            if (id !== FACE_HANDLE_ID || typeof onAllowance !== 'function') return;
            // …clamped at the finished face: dragging PAST Z0 would mean negative material, which is not a smaller
            // cut, it is a cut into the finished part. The handle stops where the part starts.
            const z = Math.max(0, canvasToZ(world.x));
            onAllowance(Math.round(z * 1000) / 1000);
        },
        onEdit: (id, val) => { if (id === FACE_HANDLE_ID && typeof onAllowance === 'function' && Number.isFinite(val)) onAllowance(val); },
    };
}

// ── THE WIRING (t1273) ──────────────────────────────────────────────────────────────────────────────────────────
/** The DECLARED layout kind a lathe op puts in its template (`{type:'layout', params:{kind}}`), so the wizard's 2D
 *  pane draws THIS instead of the mill's XY stock rectangle. Declared data — it travels in the `.wiz` like the rest. */
export const LATHE_LAYOUT_KIND = 'lathe_profile';

/**
 * WHICH BAR THE PICTURE SHOWS. A lathe workspace's stock is a cylinder; when one is configured we draw THAT, so the
 * canvas is about the operator's actual bar. With none configured we fall back to the op's own default rather than
 * drawing nothing — an empty pane teaches nobody what the numbers mean.
 */
export function barFromSettings(fallback) {
    let s = null;
    try { s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings().stock || null) : null; } catch (_) { s = null; }
    const dia = s && (s.shape === 'cylinder') && Number(s.diameter) > 0 ? Number(s.diameter) : null;
    return normalizeBar({
        diameter: dia || (fallback && fallback.diameter) || 20,
        stickOut: (dia && Number(s.z) > 0) ? Number(s.z) : ((fallback && fallback.stickOut) || 60),
        allowance: (fallback && fallback.allowance) != null ? fallback.allowance : 1,
    });
}

/**
 * THE ONE ENTRY the wizard panel calls: an op declaring the lathe layout → its half-profile spec, with every drag
 * routed to `setFields` (the same writer every other canvas handle uses, so a lathe drag and a mill drag reach the
 * form the same way). An op that does not declare it → null, and the mill layout runs untouched.
 * @param {object} def       the user-op def (its layout kind + opType)
 * @param {object} params    the live form params
 * @param {(patch:object)=>void} setFields  writes {param: value} into the form fields
 */
export function latheLayoutSpec(def, params, setFields) {
    const kind = def && def.layout && def.layout.kind;
    if (kind !== LATHE_LAYOUT_KIND) return null;
    const p = params || {};
    const write = (patch) => { if (typeof setFields === 'function') setFields(patch); };
    // FACING: the face line writes the allowance. OD: the shoulder corner writes the diameter and the length.
    if (/facing/.test(String(def.opType || ''))) {
        const bar = barFromSettings({ allowance: Number(p.allowance) || 0 });
        return latheProfileSpec(bar, (allowance) => write({ allowance }));
    }
    if (/parting/.test(String(def.opType || ''))) {
        return partProfileSpec(barFromSettings(null), {
            kind: p.kind, zFace: p.zFace, floorDiameter: p.floorDiameter, width: p.width,
        }, write);
    }
    if (/centerdrill/.test(String(def.opType || ''))) {
        return drillProfileSpec(barFromSettings(null), { depth: p.depth }, write);
    }
    if (/polygon/.test(String(def.opType || ''))) {
        return polygonProfileSpec(barFromSettings(null), {
            sides: p.sides, acrossFlats: p.acrossFlats, depth: p.depth, segmentsPerFace: p.segmentsPerFace,
        }, write);
    }
    if (/faceprobe/.test(String(def.opType || ''))) {
        return faceProbeSpec(barFromSettings(null), { ahead: p.ahead, tipRadius: p.tipRadius }, write);
    }
    if (/odprobe/.test(String(def.opType || ''))) {
        return odProbeSpec(barFromSettings(null), { caliperDiameter: p.caliperDiameter, tipRadius: p.tipRadius }, write);
    }
    const bar = barFromSettings(null);
    return odProfileSpec(bar, {
        kind: p.kind, targetDiameter: p.targetDiameter, endDiameter: p.endDiameter, depth: p.depth,
    }, write);
}

// ── OD TURNING (t1273) ──────────────────────────────────────────────────────────────────────────────────────────
/** The shoulder corner: where the turned diameter meets the untouched bar. It IS the op — both its numbers. */
export const SHOULDER_HANDLE_ID = 'shoulder';
/** The face corner. A taper only: it is where the SECOND diameter lives, so it only exists when there are two. */
export const FACE_DIA_HANDLE_ID = 'faceDia';

const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * The half-profile with the FINISHED SHAPE drawn on it, and the corner handles that define it.
 *
 * ── ONE HANDLE, TWO OUTPUTS (the tieDiagTravel pattern the pilot proved) ─────────────────────────────────────────
 * The shoulder corner is a single grab that writes BOTH numbers: its X is the diameter being turned, its Z is how
 * far along the bar the turn runs. That is not a convenience — it is what the corner IS. Splitting it into two
 * sliders would ask a person to describe a point they can already see.
 *
 * A TAPER ADDS THE SECOND CORNER, and each diameter sits on the corner it physically belongs to: on a taper the
 * shoulder is the FAR end (so it carries the far-end Ø) and the added face corner carries the target Ø. Labelling
 * them the other way round would put a number on a corner that is not at that diameter — a picture that lies.
 *
 * CLAMPED INSIDE THE BAR: a target at or outside the bar diameter is a pass that never touches metal, and a depth
 * of zero or less is not a turn. The handle stops at what the machine can actually do.
 *
 * @param {object} bar   {diameter, stickOut, allowance}
 * @param {object} od    {kind, targetDiameter, endDiameter, depth}
 * @param {(patch:object) => void} onChange  called with the changed FIELDS ({targetDiameter, depth, …}) on a drag
 */
export function odProfileSpec(bar, od, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const o = od || {};
    const taper = o.kind === 'taper';
    const targetR = radiusOf(Number(o.targetDiameter) || 0);
    // AN UNSET FAR END FOLLOWS THE TARGET, exactly as the emit does (the socket holds the reference until someone
    // types or drags a number). Reading it as 0 would draw a cone to a point the moment you picked Taper — a picture
    // of something the program was never going to cut.
    const endR = (taper && Number(o.endDiameter) > 0) ? radiusOf(Number(o.endDiameter)) : targetR;
    const depth = Math.max(0, Number(o.depth) || 0);
    const zEnd = -depth;                         // the turn runs from the finished face TOWARD the chuck

    const lo = Math.min(targetR, endR);
    const items = [
        { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
        // THE MATERIAL THIS OP REMOVES — between the finished surface and the bar, over the turned length
        { kind: 'rect', x: zToCanvas(zEnd), y: lo, w: depth, h: Math.max(0, barR - lo), cls: 'fc-feature-pocket' },
        // THE FINISHED SURFACE: one line from the face end to the far end. Sloped when the two radii differ — the
        // taper is drawn by the same line, because a taper is not a different shape, it is different numbers.
        { kind: 'line', x1: zToCanvas(0), y1: targetR, x2: zToCanvas(zEnd), y2: endR },
        // the shoulder itself: where the turned surface climbs back to the untouched bar
        { kind: 'line', x1: zToCanvas(zEnd), y1: endR, x2: zToCanvas(zEnd), y2: barR },
        // Z0, the finished face
        { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: barR },
    ];

    const handles = [
        { id: SHOULDER_HANDLE_ID, x: zToCanvas(zEnd), y: endR, kind: 'size', emits: true,
          label: taper ? 'far end' : 'shoulder', value: taper ? o.endDiameter : o.targetDiameter },
    ];
    if (taper) handles.push({ id: FACE_DIA_HANDLE_ID, x: zToCanvas(0), y: targetR, kind: 'size', axis: 'y', emits: true,
                              label: 'face Ø', value: o.targetDiameter });

    return {
        // the frame IS the bar's half-section — the canvas draws it as the outline, so no second silhouette
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items,
        handles,
        onDrag: (id, world) => {
            if (typeof onChange !== 'function') return;
            // …a hair inside the bar, never AT it: a pass at exactly the bar radius cuts nothing but air.
            const insideBar = (r) => Math.min(Math.max(0, r), barR - 0.001);
            if (id === SHOULDER_HANDLE_ID) {
                const dia = r3(diameterOf(insideBar(world.y)));
                const len = r3(Math.max(0.001, -canvasToZ(world.x)));    // depth grows into −Z; zero is not a turn
                onChange(taper ? { endDiameter: dia, depth: len } : { targetDiameter: dia, depth: len });
                return;
            }
            if (id === FACE_DIA_HANDLE_ID) onChange({ targetDiameter: r3(diameterOf(insideBar(world.y))) });
        },
        onEdit: onEditFromMap({
            [SHOULDER_HANDLE_ID]: (v) => (taper ? { endDiameter: v } : { targetDiameter: v }),
            [FACE_DIA_HANDLE_ID]: 'targetDiameter',
        }, onChange),
    };
}

// ── PARTING / GROOVING + CENTRE DRILLING (t1275) ────────────────────────────────────────────────────────────────
/** The slot's position along the bar — dragging it moves the FEATURE, not the blade. */
export const PART_POS_HANDLE_ID = 'partPos';
/** The bottom of the slot: how deep the plunge goes, said as a diameter. */
export const PART_FLOOR_HANDLE_ID = 'partFloor';
/** t1321 (user) — THE BLADE'S WIDTH, dragged on the wall it cuts. The slot IS the blade, so the far wall — the
 *  chuck-side edge, at face − width — is the width made visible; there was no handle for it at all (form-only). */
export const PART_WIDTH_HANDLE_ID = 'partWidth';
/** The bottom of the hole, on the centreline. */
export const DRILL_DEPTH_HANDLE_ID = 'drillDepth';

/**
 * THE SLOT, drawn where the blade will actually cut it.
 *
 * The rectangle spans the KERF — from the typed face back by the blade width — because that is the metal that goes
 * away, and drawing the operator's single Z line would hide the one thing this op's geometry is about. Two handles,
 * each on the thing it names: the FACE (drag along Z → where the feature sits) and the FLOOR corner (drag in radius →
 * the diameter it stops at). A part-off has no floor to drag: it stops at the centre, and a handle that only ever
 * reports zero is a control pretending to be a choice.
 */
export function partProfileSpec(bar, part, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const o = part || {};
    const groove = o.kind !== 'part';
    const width = Math.max(0, Number(o.width) || 0);
    const zFace = Number(o.zFace) || 0;
    const zBlade = zFace - width;                 // the far side of the kerf — where the blade body sits
    const floorR = groove ? radiusOf(Math.max(0, Number(o.floorDiameter) || 0)) : 0;

    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items: [
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // THE KERF — the metal this op removes, as wide as the blade and as deep as the plunge
            { kind: 'rect', x: zToCanvas(zBlade), y: floorR, w: width, h: Math.max(0, barR - floorR), cls: 'fc-feature-pocket' },
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: barR },
        ],
        handles: [
            { id: PART_POS_HANDLE_ID, x: zToCanvas(zFace), y: barR, kind: 'size', axis: 'x', emits: true, label: 'face', value: zFace },
            // …the FAR WALL is the blade's width: drag it and the kerf widens. It sits at the same Z as the stop-Ø
            // handle but up on the bar's surface, so the two never fight for the same grab.
            { id: PART_WIDTH_HANDLE_ID, x: zToCanvas(zBlade), y: barR, kind: 'size', axis: 'x', emits: true,
              label: 'blade', value: r3(width) },
            ...(groove ? [{ id: PART_FLOOR_HANDLE_ID, x: zToCanvas(zBlade), y: floorR, kind: 'size', axis: 'y', emits: true,
                            label: 'stop Ø', value: o.floorDiameter }] : []),
        ],
        onDrag: (id, world) => {
            if (typeof onChange !== 'function') return;
            if (id === PART_POS_HANDLE_ID) { onChange({ zFace: r3(canvasToZ(world.x)) }); return; }
            // t1321 — the width is the distance from the FACE to this wall. HANDLES ARE INDEPENDENT: this writes the
            // blade width alone and never the face, so widening the kerf does not walk the slot along the bar.
            // Clamped to a real blade: a zero-width parting tool is not a tool.
            if (id === PART_WIDTH_HANDLE_ID) { onChange({ width: r3(Math.max(0.2, zFace - canvasToZ(world.x))) }); return; }
            // …clamped INSIDE the bar and at the centre: a groove wider than the bar is not a groove, and one that
            // passes the centreline is a part-off wearing a groove's name.
            if (id === PART_FLOOR_HANDLE_ID) onChange({ floorDiameter: r3(diameterOf(Math.min(Math.max(0, world.y), barR - 0.001))) });
        },
        onEdit: onEditFromMap({ [PART_POS_HANDLE_ID]: 'zFace', [PART_WIDTH_HANDLE_ID]: 'width', [PART_FLOOR_HANDLE_ID]: 'floorDiameter' }, onChange),
    };
}

/**
 * THE HOLE, on the centreline, with one handle: its bottom. There is nothing else to drag — the drill has no radius
 * to choose, and the whole point of this op's frame is that it never leaves X0.
 */
export function drillProfileSpec(bar, drill, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const depth = Math.max(0, Number((drill || {}).depth) || 0);
    const holeR = Math.max(0.4, barR * 0.06);     // drawn thin: the hole's SIZE is the drill's, not this op's to say

    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items: [
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // the hole, running INTO the work from the face
            { kind: 'rect', x: zToCanvas(-depth), y: 0, w: depth, h: holeR, cls: 'fc-feature-pocket' },
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: barR },
        ],
        handles: [
            { id: DRILL_DEPTH_HANDLE_ID, x: zToCanvas(-depth), y: 0, kind: 'size', axis: 'x', emits: true, label: 'depth', value: depth },
        ],
        onDrag: (id, world) => {
            if (id !== DRILL_DEPTH_HANDLE_ID || typeof onChange !== 'function') return;
            // depth grows into −Z, and a hole of zero depth is not a hole
            onChange({ depth: r3(Math.max(0.001, -canvasToZ(world.x))) });
        },
        onEdit: onEditFromMap({ [DRILL_DEPTH_HANDLE_ID]: 'depth' }, onChange),
    };
}

// ── THE STOCK MODAL'S BAR (t1313) ───────────────────────────────────────────────────────────────────────────────
/** The bar's diameter, dragged on its surface — the number a turner reads off the stock rack. */
export const BAR_DIA_HANDLE_ID = 'barDia';
/** How far it stands out of the chuck, dragged at the grip end. */
export const BAR_OUT_HANDLE_ID = 'barOut';
/** …and the raw end still ahead of the finished face — the same grab facing's allowance handle uses. */
export const BAR_RAW_HANDLE_ID = 'barRaw';

/**
 * THE BAR, AS THE STOCK MODAL EDITS IT. The mill's top view is a box seen from above; a bar has nothing useful to
 * show that way (a circle that never changes), so the modal draws the same HALF-PROFILE every lathe wizard draws —
 * one picture of the workpiece across the whole app — with a handle on each of the three numbers.
 *
 * Every drag writes a FIELD, through the writer the caller passes: this canvas has no opinion about the record, and
 * the modal's commit is the one place a bar is built. GUI over fields, without a second source.
 */
export function barStockSpec(bar, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const r = radiusOf(b.diameter);
    const write = (patch) => { if (typeof onChange === 'function') onChange(patch); };
    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: r },
        items: [
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // the raw end — what facing takes off, between Z0 and the sawn face
            { kind: 'rect', x: zToCanvas(prof.allowance.z1), y: 0, w: prof.allowance.z2 - prof.allowance.z1, h: r, cls: 'fc-feature-pocket' },
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: r },   // Z0, the finished face
        ],
        handles: [
            // …on the SURFACE, halfway along, because that is where a diameter is measured
            { id: BAR_DIA_HANDLE_ID, x: zToCanvas(-b.stickOut / 2), y: r, kind: 'size', axis: 'y', emits: true, label: 'Ø', value: r3(b.diameter) },
            // …at the grip end: how much bar is out of the chuck
            { id: BAR_OUT_HANDLE_ID, x: zToCanvas(prof.bounds.z1), y: r / 2, kind: 'size', axis: 'x', emits: true, label: 'stick-out', value: r3(b.stickOut) },
            // …and the sawn end, the same grab facing's allowance uses
            { id: BAR_RAW_HANDLE_ID, x: zToCanvas(prof.allowance.z2), y: r, kind: 'size', axis: 'x', emits: true, label: 'raw end', value: r3(b.allowance) },
        ],
        onDrag: (id, world) => {
            if (id === BAR_DIA_HANDLE_ID) { write({ diameter: r3(diameterOf(Math.max(0.05, world.y))) }); return; }
            // the chuck end runs in −Z, so the stick-out is how far BACK the grip end is from the finished face
            if (id === BAR_OUT_HANDLE_ID) { write({ stickOut: r3(Math.max(1, -canvasToZ(world.x))) }); return; }
            // …and the raw end cannot be behind the finished face: that is not less material, it is a cut into the part
            if (id === BAR_RAW_HANDLE_ID) write({ allowance: r3(Math.max(0, canvasToZ(world.x))) });
        },
    };
}

/**
 * A MILL'S ROUND BLANK, seen from above: the circle it really is, with its radius on a handle. The datum crosshair
 * sits at the CENTRE because that is where a round blank's datum is (data/stockShape.js says so once).
 */
export function roundBlankSpec(diameter, onChange) {
    const d = Math.max(0.001, Number(diameter) || 0), r = d / 2;
    return {
        stock: { ox: -r, oy: -r, w: d, h: d },
        items: [{ kind: 'circle', cx: 0, cy: 0, r, cls: 'fc-feature-pocket' }],
        handles: [{ id: 'blankDia', x: r, y: 0, kind: 'size', axis: 'x', emits: true, label: 'Ø', value: r3(d) }],
        onDrag: (id, world) => { if (typeof onChange === 'function') onChange({ diameter: r3(Math.max(0.1, Math.abs(world.x) * 2)) }); },
    };
}

// ── THE PROBE FAMILY (t1299) ────────────────────────────────────────────────────────────────────────────────────
/** The face the stylus touches — dragging it says how far AHEAD of Z0 that face is. */
export const FACE_PROBE_HANDLE_ID = 'probeFace';
/** The measured bar diameter, dragged on the surface the stylus touches. */
export const OD_PROBE_HANDLE_ID = 'probeOD';

/** A stylus ball sitting ON a surface, with the direction it came from. Drawn the same way in both probe pictures. */
function touchMarker(z, r, axis, tip) {
    const t = Math.max(0.4, Number(tip) || 1);
    return axis === 'z'
        // …touching the FACE: the ball sits at +Z of it, and the approach runs in −Z
        ? [{ kind: 'circle', cx: zToCanvas(z) + t, cy: r, r: t, cls: 'fc-probe-touch' },
           { kind: 'line', x1: zToCanvas(z) + t * 5, y1: r, x2: zToCanvas(z) + t, y2: r, cls: 'fc-probe-approach' }]
        // …touching the OUTSIDE: the ball sits at +X of it, and the approach runs inward
        : [{ kind: 'circle', cx: zToCanvas(z), cy: r + t, r: t, cls: 'fc-probe-touch' },
           { kind: 'line', x1: zToCanvas(z), y1: r + t * 5, x2: zToCanvas(z), y2: r + t, cls: 'fc-probe-approach' }];
}

/**
 * THE FACE PROBE PICTURE. Two lines matter: the face the stylus will touch, and Z0. The distance between them is the
 * op's one real decision, so it is what the handle writes — the same grab, on the same line, as facing's allowance.
 * With the default of zero they coincide, which is the picture of "the face I touch IS zero".
 */
export function faceProbeSpec(bar, probe, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const p = probe || {};
    const ahead = Math.max(0, Number(p.ahead) || 0);
    const tip = Math.max(0.3, Number(p.tipRadius) || 2);

    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items: [
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // what still sits AHEAD of the datum being set — nothing at all when the touched face is Z0
            ...(ahead > 1e-9 ? [{ kind: 'rect', x: zToCanvas(0), y: 0, w: ahead, h: barR, cls: 'fc-feature-pocket' }] : []),
            { kind: 'line', x1: zToCanvas(0), y1: 0, x2: zToCanvas(0), y2: barR },              // Z0, what gets written
            ...touchMarker(ahead, barR * 0.55, 'z', tip),
        ],
        handles: [
            { id: FACE_PROBE_HANDLE_ID, x: zToCanvas(ahead), y: barR, kind: 'size', axis: 'x', emits: true,
              label: 'touched face', value: ahead },
        ],
        onDrag: (id, world) => {
            if (id !== FACE_PROBE_HANDLE_ID || typeof onChange !== 'function') return;
            // …never behind Z0: a face BEHIND the datum would mean the finished face is still to be found, which the
            // probe cannot know. Dragging stops where the two coincide — the ordinary touch-off.
            onChange({ ahead: r3(Math.max(0, canvasToZ(world.x))) });
        },
        onEdit: onEditFromMap({ [FACE_PROBE_HANDLE_ID]: 'ahead' }, onChange),
    };
}

/**
 * THE OD PROBE PICTURE. The bar is drawn at the MEASURED diameter, because that is what the op declares and what the
 * DRO will read afterwards; the handle IS that measurement. It is a DIAMETER on the way in and out — the halving
 * happens once, on the controller.
 */
export function odProbeSpec(bar, probe, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const p = probe || {};
    const dia = Math.max(0.001, Number(p.caliperDiameter) || b.diameter);
    const measuredR = radiusOf(dia);
    const tip = Math.max(0.3, Number(p.tipRadius) || 2);
    const zTouch = -Math.max(2, (prof.bounds.z2 - prof.bounds.z1) * 0.15);   // …on the round, a little back from the face

    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: Math.max(measuredR, radiusOf(b.diameter)) },
        items: [
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // THE MEASURED SURFACE — the line the datum is about, drawn the length of the bar
            { kind: 'line', x1: zToCanvas(prof.bounds.z1), y1: measuredR, x2: zToCanvas(prof.bounds.z2), y2: measuredR },
            { kind: 'line', x1: zToCanvas(0), y1: 0, x2: zToCanvas(0), y2: measuredR },
            ...touchMarker(zTouch, measuredR, 'x', tip),
        ],
        handles: [
            { id: OD_PROBE_HANDLE_ID, x: zToCanvas(zTouch), y: measuredR, kind: 'size', axis: 'y', emits: true,
              label: 'measured Ø', value: r3(dia) },
        ],
        onDrag: (id, world) => {
            if (id !== OD_PROBE_HANDLE_ID || typeof onChange !== 'function') return;
            // a diameter out, because a diameter went in: diameterOf is the one converter, and it runs once
            onChange({ caliperDiameter: r3(diameterOf(Math.max(0.001, world.y))) });
        },
        onEdit: onEditFromMap({ [OD_PROBE_HANDLE_ID]: 'caliperDiameter' }, onChange),
    };
}

// ── POLYGON TURNING: THE END VIEW (t1277) ───────────────────────────────────────────────────────────────────────
/** The Z extent of the polygon section, dragged on the half-profile. */
export const POLY_DEPTH_HANDLE_ID = 'polyDepth';
/** The across-flats size, dragged on the END VIEW — the only place that number is visible as what it is. */
export const POLY_FLATS_HANDLE_ID = 'polyFlats';

/**
 * TWO VIEWS ON ONE SHEET, which is how this shape has to be read.
 *
 * The half-profile says WHERE along the bar the section is; it cannot show a hexagon, because a half-profile of a
 * hexagon is just a band. The END VIEW says what the section IS, and cannot show where it sits. Neither is optional,
 * so both are drawn — side by side in one canvas, laid out like a drawing sheet, rather than as a second panel the
 * layout seam does not have.
 *
 * THE END VIEW DRAWS THE OP'S OWN r(angle). It calls polygonPath — the same function the emit unrolls — so the
 * picture cannot show a shape the program will not cut. If they ever disagree, one consumer read the model wrong;
 * there is no second opinion to reconcile.
 */
export function polygonProfileSpec(bar, poly, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const o = poly || {};
    const sides = polySides(o.sides);
    const across = Math.max(0, Number(o.acrossFlats) || 0);
    const depth = Math.max(0, Number(o.depth) || 0);
    const apothem = across / 2;

    // the end view sits to the RIGHT of the bar, clear of it, centred on its own axis
    const gap = Math.max(6, barR * 0.6);
    const cx = prof.bounds.z2 + gap + barR;
    const cy = barR;                                  // …lifted so the circle sits beside the profile, not on it

    const path = polygonPath({ acrossFlats: across, sides, segmentsPerFace: o.segmentsPerFace });
    const pts = path.map((pt) => ({
        x: cx + pt.x * Math.cos(pt.a * Math.PI / 180),
        y: cy + pt.x * Math.sin(pt.a * Math.PI / 180),
    }));

    return {
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items: [
            // ── the half-profile: where the section is ──
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            { kind: 'rect', x: zToCanvas(-depth), y: apothem, w: depth, h: Math.max(0, barR - apothem), cls: 'fc-feature-pocket' },
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: barR },
            // ── the end view: what the section IS ──
            { kind: 'circle', cx, cy, r: barR },                       // the bar, seen down the axis
            { kind: 'circle', cx, cy, r: Math.max(0.3, barR * 0.03) }, // …and its centre
        ],
        // the polygon itself, from the op's own r(angle) — a path, because that is what it is
        paths: [{ pts, cls: 'fc-path' }],
        handles: [
            { id: POLY_DEPTH_HANDLE_ID, x: zToCanvas(-depth), y: apothem, kind: 'size', axis: 'x', emits: true, label: 'extent', value: depth },
            // …on the middle of a flat, where the across-flats size IS the distance from the centre
            { id: POLY_FLATS_HANDLE_ID, x: cx, y: cy + apothem, kind: 'size', axis: 'y', emits: true, label: 'across flats', value: across },
        ],
        onDrag: (id, world) => {
            if (typeof onChange !== 'function') return;
            if (id === POLY_DEPTH_HANDLE_ID) { onChange({ depth: r3(Math.max(0.001, -canvasToZ(world.x))) }); return; }
            if (id === POLY_FLATS_HANDLE_ID) {
                // clamped inside the bar: a polygon whose CORNERS stand outside the stock has flats that were never
                // cut — the corner radius, not the apothem, is what has to fit.
                const wantApothem = Math.max(0.001, world.y - cy);
                const corner = polyRadiusAt(0, wantApothem * 2, sides);
                const scale = corner > barR ? barR / corner : 1;
                onChange({ acrossFlats: r3(wantApothem * 2 * scale) });
            }
        },
        onEdit: onEditFromMap({ [POLY_DEPTH_HANDLE_ID]: 'depth', [POLY_FLATS_HANDLE_ID]: 'acrossFlats' }, onChange),
    };
}
