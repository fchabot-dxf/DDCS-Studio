/**
 * viz/canvasWidgets.js — reusable CANVAS-HANDLE gestures for the FeatureCanvas (the canvas analogue of formWidgets.js).
 *
 * FeatureCanvas already gives the generic drag PLUMBING (hit-test a handle, hand back a world point via spec.onDrag).
 * What every wizard view currently HAND-ROLLS is the param MATH — where to place each handle from the current value,
 * and how a drag maps back to the field. This registry owns that math ONCE, keyed by gesture type, so a view (or, later,
 * an end user in the wizard maker) DECLARES its handles:
 *
 *     const { handles, onDrag, onEdit } = buildCanvasWidgets([
 *         { type: 'point',  fx: 'tx_x', fy: 'tx_y', x: ox, y: oy, label: 'pos' },
 *         { type: 'length', field: 'tx_height', ax: ox, ay: oy, axis: 'y', value: H, min: 2, label: 'height' },
 *         { type: 'scaleX', field: 'tx_width',  ax: ox, edgeX: ox + lineW, ay: oy, value: width, min: 0.2, label: 'width' },
 *         { type: 'shear',  field: 'tx_slant',  ax: ox + lineW, ay: oy, h: H, value: slant, label: 'slant°' },
 *     ], setFields);
 *
 * GOLDEN RULE (same as FeatureCanvas): a handle drives a PARAM (a form field), never freeform geometry. The view passes
 * the geometry CONTEXT it computed from its params (anchors / edge / height); the gesture does place + drag + click-to-edit.
 * Add a gesture = one entry here; every view AND every custom op gets it for free. Reused across milling wizards.
 */

const DEG = 180 / Math.PI;
// t2489 — COMPLETES the clamp vocabulary: was clampMin(v, lo), a lower bound only, at all 7 of its call sites
// below (d.min/d.minw/d.minh/d.minR). A bound with only one side was an OMISSION, not a decision — the missing
// upper half is what BACKLOG #61's own odTurn/parting pilots needed ("never drag a turned diameter past the
// bar's own surface") and neither could express. Declare-over-hand-roll's own "free" condition is met exactly:
// the slot (a clamp parameter per axis) and the shape (mirroring the existing min* names) already existed, so
// this is DATA completing an existing mechanism, not a new one — and it is symmetric across every call site,
// not shaped around the one op that forced the question. Backward-compatible by construction: an omitted `hi`
// clamps nothing (`m == null` behaved identically before this turn), so all 7 existing sites are unchanged
// unless a caller starts passing the new max-side param.
const clamp = (v, lo, hi) => {
    let r = lo == null ? v : Math.max(lo, v);
    r = hi == null ? r : Math.min(hi, r);
    return r;
};

/** Each gesture: place(d) → a handle {x,y,kind,label?,value?}; drag(d, world) → a {field: value} map (or null). `d` is
 *  the view's declaration (the field id(s) + the geometry context). FeatureCanvas renders kind 'move' as a snapping
 *  square and anything else as a circle (with a click-to-edit value label when `value` + spec.onEdit are present). */
export const CANVAS_GESTURES = {
    // POSITION → two fields. Square 'move' handle (FeatureCanvas snaps it to stock anchors).
    // Optional anchor ax/ay makes it RELATIVE: the fields hold world − anchor (a delta, e.g. a G91 incremental
    // reposition offset from the previous pass's start). Absent anchor → absolute (back-compat: ax/ay default 0).
    point: {
        place: (d) => ({ x: (d.ax || 0) + d.x, y: (d.ay || 0) + d.y, kind: 'move', label: d.label, labelDir: d.labelDir }),
        drag: (d, w) => ({ [d.fx]: w.x - (d.ax || 0), [d.fy]: w.y - (d.ay || 0) }),
    },
    // 1D LENGTH from an anchor along an axis (e.g. height). Handle at anchor + value·axis; drag → the axis distance.
    length: {
        place: (d) => ({ x: d.ax + (d.axis === 'x' ? d.value : 0), y: d.ay + (d.axis === 'x' ? 0 : d.value), kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: clamp(d.axis === 'x' ? w.x - d.ax : w.y - d.ay, d.min, d.max) }),
    },
    // Horizontal SCALE factor about an x-anchor. Handle at the current right edge; drag scales proportionally (so the
    // tracking/constant part of the span is preserved — the factor follows the cursor's fraction of the current span).
    scaleX: {
        place: (d) => ({ x: d.edgeX, y: d.ay, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => { const span = d.edgeX - d.ax; if (Math.abs(span) < 1e-6) return null; return { [d.field]: clamp(d.value * (w.x - d.ax) / span, d.min, d.max) }; },
    },
    // SHEAR / skew angle (deg): horizontal offset over a height `h` about a baseline anchor. Handle rides the slanted top.
    shear: {
        place: (d) => ({ x: d.ax + Math.tan(d.value / DEG) * d.h, y: d.ay + d.h, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: Math.atan2(w.x - d.ax, d.h) * DEG }),
    },
    // 2D SIZE / corner from an anchor → two fields. The handle sits at anchor + extents (ex/ey); a drag maps the corner
    // offset back to each field through a per-axis DIVISOR `sx`/`sy` (1 = literal W/H · `cols-1` = grid pitch · 0.5 =
    // half-extent radius), and clamps with `minw`/`minh` (and, t2489, the symmetric `maxw`/`maxh`). A zero divisor
    // skips that axis (e.g. a single-column grid).
    rect: {
        place: (d) => {
            const vx = d.vx !== undefined ? d.vx : 1;
            const vy = d.vy !== undefined ? d.vy : 1;
            const h = { x: d.ax + d.ex * vx, y: d.ay + d.ey * vy, kind: 'size', label: d.label, value: d.value, labelDir: d.labelDir };
            if (d.label === 'W×H' && d.sx && d.sy) {
                h.displayVals = [Math.abs(d.ex / d.sx), Math.abs(d.ey / d.sy)];
            }
            return h;
        },
        drag: (d, w) => {
            const m = {};
            const vx = d.vx !== undefined ? d.vx : 1;
            const vy = d.vy !== undefined ? d.vy : 1;
            if (d.sx) {
                const nw = clamp((w.x - d.ax) / (d.sx * vx), d.minw, d.maxw);
                m[d.field] = nw;
                if (d.fx) m[d.fx] = d.ax - nw * d.sx;
            }
            if (d.sy) {
                const nh = clamp((w.y - d.ay) / (d.sy * vy), d.minh, d.maxh);
                m[d.fieldH] = nh;
                if (d.fy) m[d.fy] = d.ay - nh * d.sy;
            }
            return m;
        },
    },
    // POLAR handle about a center → a radius field + an angle field (the "rotate" gesture, fused with radius like a
    // drill ring/line-end). Handle at center + r·(cos,sin)a; a drag sets the angle (atan2) and scales the dragged
    // distance into the radius field via `rScale` (2 = Ø from a radius · 1/(n-1) = pitch). Omit `fieldA` for radius-only,
    // or `rScale` for angle-only (pure rotate). `minR`/`maxR` (t2489) clamp the radius.
    radial: {
        // t2327 (BACKLOG #33) — `shape: 'diamond'` swaps the rendered kind so a Ø/pitch-only handle (no `fieldA`)
        // never reads as a hole (FeatureCanvas draws every plain 'size' handle as a circle, the same shape holes
        // use). Byte-identical for every existing caller, which never sets `shape` (fillText's txt_rot,
        // drillView's ring/end, drillData's own dr_line/dr_dia).
        place: (d) => ({ x: d.cx + d.r * Math.cos(d.a), y: d.cy + d.r * Math.sin(d.a), kind: d.shape === 'diamond' ? 'diamond' : 'size', label: d.label, value: d.value }),
        drag: (d, w) => {
            const dx = w.x - d.cx, dy = w.y - d.cy, m = {};
            if (d.fieldA) m[d.fieldA] = Math.atan2(dy, dx) * DEG;
            if (d.rScale) {
                // t2327 (BACKLOG #33) — `lockA`: a fused Ø+angle handle (field AND fieldA both present) meant ANY
                // drag rotated the whole pattern, since the angle came from atan2 of the raw cursor bearing and
                // radius from raw distance-from-centre — moving the "diameter" handle sideways silently moved
                // every hole. The decided fix splits the field: the point that's ALREADY the pattern's own
                // orientation (drill's hole #1, a line's end point) becomes the angle handle (fieldA alone, no
                // rScale — the existing "angle-only" shape this gesture already supported, matching fillText's
                // txt_rot); the Ø/pitch handle keeps `field`+`rScale` but drops `fieldA`, and locks its own
                // bearing (`d.a`, fixed by the caller, not recomputed from the cursor) — `lockA` makes ITS drag
                // PROJECT onto that fixed arm (`dot(cursorOffset, armDirection)`) instead of using raw hypot
                // distance, so a sideways nudge off the arm changes the radius ~0 rather than jumping to
                // whatever the raw distance happens to be — "it slides along the arm only." Omitting `lockA`
                // (every existing radius-only caller) keeps the original isotropic hypot() math, unchanged.
                const proj = d.lockA ? (dx * Math.cos(d.a) + dy * Math.sin(d.a)) : Math.hypot(dx, dy);
                m[d.field] = clamp(proj * d.rScale, d.minR, d.maxR);
            }
            return m;
        },
    },
    // PERPENDICULAR projection onto an axis `(nx,ny)` about an anchor → one symmetric field (e.g. a slot width measured
    // off its centreline). The handle rides the axis at `off` (the current half-extent); a drag projects the cursor onto
    // the axis (signed distance), takes |·|·`scale` (2 = a half-distance → full width), and clamps to `min`/`max`
    // (t2489) — `min` is the tool Ø.
    projLength: {
        place: (d) => ({ x: d.cx + d.nx * d.off, y: d.cy + d.ny * d.off, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: clamp(d.scale * Math.abs((w.x - d.cx) * d.nx + (w.y - d.cy) * d.ny), d.min, d.max) }),
    },
    // MIDDLE ② DIAGONAL-AIM: the trans-axial diagonal ends ON ②. The handle sits at the diagonal target — on the PRIMARY axis
    // at `prim` (diagPrimary #22, numeric; the stock centre at rest when it holds '#53'), on the SECONDARY axis at
    // centre ± diagTravel (`sign` from dir2 — the emit's travelOpp side). A drag DECOMPOSES ②'s world into diagPrimary
    // (#22 = the primary coord) + diagTravel (#21 = |secondary out-distance from the centre|) — the SAME mapping the built-in
    // middleView.tieDiagTravel used, so the diagonal JOINS ②. `primaryX` = the primary axis is X (so the secondary is Y).
    diagAim: {
        place: (d) => { const sec = d.centreSec + d.sign * d.travel; return { x: d.primaryX ? d.prim : sec, y: d.primaryX ? sec : d.prim, kind: 'move', label: d.label }; },
        drag: (d, w) => { const sec = d.primaryX ? w.y : w.x, prim = d.primaryX ? w.x : w.y; return { [d.fieldTravel]: Math.max(1, Math.round(Math.abs(sec - d.centreSec))), [d.fieldPrimary]: Math.round(prim) }; },
    },
    // t1201 — MIDDLE in-axis CROSS-OVER AIM (user: the traverse target needs a GUI): a boss in-axis AUTO crossover
    // traverses wall1→wall2 by the cross-over distance (#19/#20 = crossX/crossY — numeric-only fields until now). The
    // handle rides the FIRST-axis probe line at wallFace + sign·cross (the traverse TARGET past the far wall); a drag
    // re-derives the distance = |along − wallFace| (min 1). The perpendicular component is ignored — the traverse rides
    // the probe line (a handle drives a PARAM, never freeform geometry).
    // GUI DIFFERENTIATION (user): the trans-axial end (②) is a POSITION marker (square, 2 params); an in-axis traverse end
    // is a DISTANCE handle → kind 'size' (circle) + the mm value shown (click-to-edit via onEdit → the cross field).
    crossAim: {
        place: (d) => { const along = d.wallFace + d.sign * d.cross; return { x: d.axisX ? along : d.lineAt, y: d.axisX ? d.lineAt : along, kind: 'size', label: d.label, value: d.cross }; },
        drag: (d, w) => ({ [d.field]: Math.max(1, Math.round(Math.abs((d.axisX ? w.x : w.y) - d.wallFace))) }),
    },
    // PROBE-VECTOR about an anchor → an axis ENUM + a dir ENUM + a reach scalar (ONE drag = three controls). The handle is
    // the arrow TIP: a probe is AXIS-ALIGNED, so the drag angle SNAPS to the nearest cardinal (|dx|≥|dy| → X else Y; the
    // sign → pos/neg), and the length sets the reach (`d.field`). Anchor (cx,cy) = the probe start; the view draws the
    // shaft. NOTE: axis/dir are STRINGS — the view's setFields must pass enums through (not round them like a number).
    probeVector: {
        place: (d) => {
            const ux = d.axis === 'Y' ? 0 : (d.dir === 'neg' ? -1 : 1);
            const uy = d.axis === 'Y' ? (d.dir === 'neg' ? -1 : 1) : 0;
            return { x: d.cx + ux * d.dist, y: d.cy + uy * d.dist, kind: 'size', label: d.label, value: d.dist };
        },
        drag: (d, w) => {
            const dx = w.x - d.cx, dy = w.y - d.cy, horiz = Math.abs(dx) >= Math.abs(dy);
            return {
                [d.fieldAxis]: horiz ? 'X' : 'Y',
                [d.fieldDir]: (horiz ? dx : dy) >= 0 ? 'pos' : 'neg',
                [d.field]: clamp(Math.hypot(dx, dy), d.minR, d.maxR),
            };
        },
    },
    // t716 — TRANSLATE ANCHOR: move a SET of x-fields + y-fields by the drag DELTA, so the whole feature SHIFTS while its
    // SHAPE is unchanged (a 5in slot at 45° stays 5in/45°). `xs`/`ys` = [[field, currentValue], …] (the coord params to
    // translate); the handle sits at the current centroid (cx,cy); on drag each field += (cursor − centroid). Used where a
    // feature has NO single position param to write (slot's absolute A/B) — the pos `point` handle covers the origin-based ops.
    translate: {
        place: (d) => ({ x: d.cx, y: d.cy, kind: 'move', label: d.label }),
        drag: (d, w) => { const dx = w.x - d.cx, dy = w.y - d.cy, m = {}; (d.xs || []).forEach(([f, v]) => { m[f] = v + dx; }); (d.ys || []).forEach(([f, v]) => { m[f] = v + dy; }); return m; },
    },
};

/** Declarations → { handles, onDrag, onEdit } for a FeatureCanvas spec. `setFields(map, opts)` writes the op's form
 *  fields (id → value) and triggers the normal update()/redraw loop; `opts.preview` (t2429, BACKLOG #46) marks a
 *  mid-drag frame — the redraw still runs every frame (setFields still sets the DOM value), but panelTypes.js's
 *  own `_writeParam` withholds the actual model write for it until its OWN `onDragEnd` (wired directly into
 *  `layoutSpecFromOp`'s spec objects, not here — see that file's own comment for why: a per-drag "what's pending"
 *  map tracked in THIS function's own closure cannot survive the gesture, since `_mgr.update()`'s own synchronous
 *  re-render calls `buildCanvasWidgets` fresh on EVERY frame, discarding whatever closure computed the previous
 *  frame's pending value before `onDragEnd` could ever see it — found live, the first working version of this
 *  fix). Unknown gesture types are skipped (defensive). */
export function buildCanvasWidgets(widgets, setFields) {
    const byId = {};
    const handles = [];
    (widgets || []).forEach((d, i) => {
        const g = CANVAS_GESTURES[d.type];
        if (!g) return;
        const id = d.id || (d.type + ':' + (d.field || d.fx || i));
        byId[id] = d;
        // t1674 — noSnap is a GENERIC, gesture-independent handle property (matching id/color's treatment) — a free
        // position with no feature-corner semantics (mirrors panelTypes.js's simMarkers, built outside this helper,
        // which already sets it directly) opts OUT of _snapToAnchor's stock-anchor magnetism, including the itemsBBox-
        // derived "other corners of this feature" offsets. Previously silently dropped here (only id/color passed
        // through `g.place(d)`'s result) — the same declared-but-unread gap t1638 named for block mouths.
        // t1684 — emits is the SAME generic forward: a decl may declare "does dragging this write a value that reaches
        // the emitted G-code" (census finding 2 — lathe's teal and corner's emits, unified); FeatureCanvas reads it.
        // t1688 — manual joins the same generic forward: a THIRD instance of the identical drop (noSnap/t1674,
        // emits/t1684) — panelTypes.js:394 already declares `manual: reposManual` on corner's reposition decls, and
        // this hand-picked spread was silently discarding it, forcing FeatureCanvas to infer manual-ness from a
        // colour-string match instead of reading the declared field (the glyph resolver, t1688, needs the real one).
        handles.push({ id, color: d.color, noSnap: d.noSnap, emits: d.emits, manual: d.manual, ...g.place(d) });   // t81 — a decl may carry a SOURCE colour (auto/manual) for the FeatureCanvas
    });
    // t2429 (BACKLOG #46) — `commitNow` (3rd arg, optional): panelTypes.js's own `spotOnDrag` wrapper passes
    // `true` for a handle it recognises as one of corner's own datum-relative reposition-chain markers
    // (`repoGroups`, backed by `spotStore`/`pinnedStartsFor`) — that mechanism has its own pre-existing,
    // separately-tested "freeze the OTHER markers' world, then re-derive this one's increment against it"
    // compensation, proven live to assume every frame's write lands in the model synchronously. Still excluded
    // — deliberately not revisited this turn (`corner-marker-independence.spec.js`'s 5 tests protect exactly
    // this, unrelated to the fix below).
    //
    // ⭐ t2447 — 'move'-kind handles (`point`/`diagAim`/`translate`) ARE NOW ON commit-on-release too. t2429's
    // own exclusion (a 'move' handle committed the CORRECT final value on release, yet the CANVAS rendered it
    // well short of the actual drag distance — a 256px drag settling ~35px away, general not an edge case) is
    // RESOLVED: root CONFIRMED by measurement (`?debug=feat`, per the dispatch's own hard-won instruction —
    // this bug had already outlived four advisor theories and one of t2429's own), not reasoned to. It was
    // never about 'move'/`_snapToAnchor` specifically — `featureCanvas.js`'s own `render()` auto-refits the
    // viewport whenever nothing is being dragged and the user hasn't manually panned/zoomed
    // (`!_userAdjusted && !this.active`). For an EVERY-FRAME-COMMIT drag (the old default here), by the time
    // `this.active` goes null on release, `onDragEnd`'s own flush finds NOTHING left to write (already
    // committed continuously) — no extra render happens, so that auto-refit condition never gets a chance to
    // fire, confirmed directly: the transform is byte-identical before/after release. For a DEFERRED drag, the
    // model has been frozen the WHOLE gesture — `onDragEnd`'s flush is the FIRST change it ever sees, and that
    // one render lands EXACTLY when `this.active` has just gone null, firing the auto-refit against a geometry
    // that just jumped in one step instead of drifting gradually — landing the fitted transform somewhere the
    // FROZEN mid-drag one never anticipated. Fixed at the actual source, `featureCanvas.js`'s own `end()` +
    // `render()` (`_suppressFitOnCommit` — see `end()`'s own comment for the full mechanism), not here; this
    // file needed no change beyond removing the exclusion below, once that render-path fix was confirmed live.
    const onDrag = (id, world, commitNow) => {
        const d = byId[id]; if (!d) return;
        const updates = CANVAS_GESTURES[d.type].drag(d, world);
        const commit = commitNow;
        if (updates) setFields(updates, commit ? undefined : { preview: true });
    };
    // t2495 (BACKLOG #61 / L5) — WHICH declared field the displayed `value` writes back to, when a gesture can
    // drive TWO (`rect`'s own `field`+`fieldH`). Reached rule-of-three honestly: three real ops (odTurn's own
    // shoulder, odProbe, parting's own floor) all needed this, counted one at a time across three separate
    // turns rather than argued for in one — see BACKLOG #61's own t2489/t2491/t2493 entries for the count.
    //   - DERIVED, no declaration needed, for the single-axis-active case (odProbe / parting's own floor): only
    //     ONE of `field`/`fieldH` is ever set on these decls (the other axis's own divisor, `sx`/`sy`, is
    //     omitted too) — so "whichever one exists" is unambiguous BY CONSTRUCTION, not a guess.
    //   - DECLARED via `valueField` ('field' or 'fieldH'), only where BOTH are genuinely active (odTurn's own
    //     shoulder: X writes depth, Y writes a diameter, and the handle's own displayed number is the diameter,
    //     not the depth — nothing about the declaration alone says which, so it has to be said).
    // DEFAULTS TO TODAY'S BEHAVIOUR, unconditionally: `field` wins whenever it's set and `valueField` is absent
    // — byte-identical to the pre-t2495 `d.field`-only version for every one of this registry's OTHER existing
    // callers (pocket/drill/contour/surfacing's own fused W×H handles, panelTypes.js's own generic W/H decl,
    // this file's own `rect.onEdit` unit test) — confirmed inert via the snapshot gate BEFORE any declaration
    // anywhere in the app set `valueField` for real.
    const onEdit = (id, value) => {   // click-to-type a dimension's value (FeatureCanvas inline editor) — a single
        // discrete action, not a drag stream — commits immediately, unchanged.
        const d = byId[id]; if (!d || !Number.isFinite(value)) return;
        const targetField = d.valueField ? d[d.valueField] : (d.field != null ? d.field : d.fieldH);
        if (targetField == null) return;
        setFields({ [targetField]: d.editMin != null ? Math.max(d.editMin, value) : value });
    };
    return { handles, onDrag, onEdit };
}
