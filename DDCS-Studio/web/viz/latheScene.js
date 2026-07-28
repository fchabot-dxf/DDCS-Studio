/**
 * viz/latheScene.js — THE LATHE'S 3D SCENE, declared once (t1281).
 *
 * ── WHAT WAS ACTUALLY WRONG (root cause, found by opening the wizard and looking) ────────────────────────────────
 * The 3D preview of a lathe op was not empty — it was the MILL'S WORLD, and the lathe had never been declared into
 * it. Three separate omissions, each of the same kind:
 *
 *   1. THE BAR WAS NEVER FED TO THE SCENE. `settings.stock` stayed the mill's box (100×80×20 `boss`), because
 *      `barToStock()` — which has existed in data/lathe.js since t1267 — had no consumer. None of the five lathe
 *      twins declared `def.simStock`, so the scene drew the only stock it had.
 *   2. EVEN A CYLINDER WOULD HAVE LAIN THE WRONG WAY. gcodeViz3d takes a cylinder's axis from `getRotaryAxes()` —
 *      the declared rotary MOTOR — and falls back to X. A lathe workspace declares no rotary motor, so the bar
 *      would have been drawn across the machine instead of along it.
 *   3. THE TOOL AND THE FRAME WERE THE MILL'S: a vertical Ø6 endmill plunging in −Z over an XY grid.
 *
 * The traced path was never the problem — it drew correctly, in a mill world, at the origin.
 *
 * ── THE FIX IS A DECLARATION, NOT A SPECIAL CASE ────────────────────────────────────────────────────────────────
 * The stock now carries its OWN axis (`stock.axis`), so the renderer reads what the shape says rather than guessing
 * from motor roles. A rotary bar keeps saying 'x' by the same mechanism; a lathe bar says 'z'. One field, read by
 * whoever draws — and the next consumer of a cylinder gets the right answer for free instead of re-deriving it.
 */
import { barToStock, normalizeBar, radiusOf, DEFAULT_BAR } from '../data/lathe.js';
import { isLathe } from '../data/workspaceMachine.js';

/** The bar every lathe op shows, from whatever the op knows about it. Defaults are the op's, not this file's. */
export function latheBarFrom(params, fallback) {
    const p = params || {}, f = fallback || {};
    // t1313/t1315 — THE WORKSPACE BAR REACHES AN OP THROUGH ITS FORM, not around it (advisor ruling). t1313 had this
    // function prefer the workspace bar outright, which fixed the picture and left the emit behind it; the ruling is
    // that the FIELD prefills from the declared bar (a live default) and the emit follows the field, so the G-code
    // only ever moves through a number the operator can see. So the params are the one input again — and the
    // workspace is consulted HERE only when the op passes none at all (a bare sim call, no form behind it).
    const ws = (Number(p.barDiameter) > 0) ? null : (() => {
        try {
            const st = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings().stock : null;
            if (!st || st.shape !== 'cylinder' || st.axis !== 'z' || st.origin !== 'finished-face') return null;
            const face = Number(st.faceZ) || 0;
            return { diameter: Number(st.diameter) || 0, stickOut: (Number(st.z) || 0) - face };
        } catch (_) { return null; }
    })();
    // THE RAW END MUST CONTAIN WHAT THE OP REMOVES. Facing's whole job is the material ahead of the finished face, so
    // its `allowance` IS the bar's raw end — drawing the generic 1mm stub put the first two passes outside the bar,
    // in mid-air. (Caught by the on-the-bar assert, which is exactly what it is for.)
    const raw = Math.max(
        Number(p.barAllowance) != null && Number.isFinite(Number(p.barAllowance)) ? Number(p.barAllowance) : (Number(f.barAllowance) || 1),
        Number(p.allowance) || 0,
    );
    return normalizeBar({
        diameter: (ws && ws.diameter) || Number(p.barDiameter) || Number(f.barDiameter) || 20,
        stickOut: (ws && ws.stickOut) || Number(p.stickOut) || Number(f.stickOut) || 60,
        allowance: raw,
    });
}

/**
 * THE SIM STOCK for a lathe op: the declared bar, as the viz's stock record.
 *
 * `barToStock()` already says the shape (cylinder), the diameter and the length along Z — this adds only what the
 * SCENE needs on top: the axis the cylinder lies along, and where its Z0 face sits. Nothing here re-derives the
 * bar's geometry; if this disagrees with the canvas or the emit, one of the three read the model wrong.
 */
export function latheSimStock(params, current, fallback) {
    const bar = latheBarFrom(params, fallback);
    const s = barToStock(bar);
    return {
        ...(current || {}),
        shape: 'cylinder',
        axis: 'z',                 // ← the DECLARED lie of the bar. A rotary bar says 'x'; this one says 'z'.
        x: s.diameter, y: s.diameter, z: s.z,
        diameter: s.diameter,
        // the FINISHED FACE is the datum: the bar runs back into the chuck in −Z, with its raw end in +Z
        origin: 'finished-face',
        faceZ: bar.allowance,
        // t1301 — THE BAR'S DATUM IS ITS CENTRELINE, which is what X being a RADIUS means. It said 'nnp' (a mill's
        // min-XY corner) because that is what every stock before it said, and the consequence was invisible until a
        // probe needed to collide with the bar: the collision put the bar's axis at the stock corner, so a stylus
        // coming in from +X missed it entirely and drew its full seek out through the far side of the centreline.
        datum: 'ccp', pin: 'origin', show: true,
    };
}

/**
 * Attach the lathe's scene declarations to a twin. One call per op, so all five say the same thing.
 *
 * THE TOOL IS DECLARED HERE TOO (t1285), beside the bar, because it is the same kind of fact: what this op puts
 * against the work. Most turning ops are an insert on a holder; a centre drill really is a bit in the tailstock, on
 * the centreline. Declared per op rather than inferred from the program, so nothing has to read a toolpath and guess.
 * @param {'turning'|'centerdrill'} tool
 */
export function withLatheScene(def, fallback, tool = 'turning', probeAxis = null) {
    def.simStock = (params, stock) => latheSimStock(params, stock, fallback);
    def.latheTool = tool;
    if (probeAxis) def.latheProbeAxis = probeAxis;   // t1301 — which way a stylus stands off; only a probe has one
    return def;
}

/**
 * t1301 — THE STYLUS, SIZED AGAINST THE BAR IT TOUCHES.
 *
 * A probe program got the MILL's touch probe: a Ø30-ish body on a 40mm stylus, which against a Ø20 bar is a boulder
 * beside a pencil. Worse, its ball had nothing to do with the stylus radius the operator TYPED INTO THE FORM — the
 * one number the emit compensates by. A picture whose ball is not the ball being compensated teaches the wrong thing.
 *
 * So the render speaks the declaration: the ball IS the declared stylus radius, and the body behind it is scaled to
 * the bar rather than to a mill's spindle. Nothing here is a new fact — it is the form's number and the bar's radius,
 * arranged into the fields toolProfile already reads.
 *
 * IT ALSO SAYS WHICH WAY THE STYLUS COMES IN, because on a lathe that is a fact about the op: the face probe comes
 * along the bed (+Z) and the OD probe comes down onto the round (+X). The mill mesh only knows one direction, so an
 * OD probe drawn with it reads as a face probe hanging in the wrong place.
 *
 * @param {number} tipRadius  the DECLARED stylus radius, straight off the form
 * @param {object} bar        the bar this op shows (its radius sets the body's scale)
 * @param {'x'|'z'} axis      which way the stylus stands off from its touch point
 */
export function latheProbeTool(tipRadius, bar, axis = 'z') {
    const b = normalizeBar(bar || {});
    const R = Math.max(2, radiusOf(b.diameter));
    const ball = Math.max(0.2, Number(tipRadius) || 1) * 2;              // …the DECLARED stylus, as a diameter
    return {
        type: 'probe',
        probeAxis: axis === 'x' ? 'x' : 'z',
        dia: Math.max(2, Math.min(R * 0.8, ball * 3)),                    // the shank: readable beside the bar, never wider than it
        probeDims: {
            ballDia: ball,
            stylusLen: Math.max(ball * 4, R * 1.2),                       // enough stand-off to read as a stylus at this scale
            bodyDia: Math.max(ball * 2, R * 1.1),                         // a body the size of the work, not of a spindle
            bodyLen: Math.max(ball * 4, R * 1.6),
        },
    };
}

/**
 * THE CAMERA a lathe wants: looking at the ZX plane from +Y, which is how a turner stands at the machine — the bar
 * running left-to-right, X up off the centreline. The mill's default looks down at an XY table, where a bar along Z
 * is a circle pointing at you.
 * @returns {{az:number, el:number, up:string}|null} null when this is not a lathe (the mill default is untouched)
 */
export function latheCameraDefault() {
    if (!isLathe()) return null;
    return { az: -90, el: 0, up: 'z', why: 'the turner\'s view: Z along the bed, X up off the centreline' };
}

/** How tall the scene is, for framing: the bar's radius is the whole of it. */
export const latheSceneRadius = (bar) => radiusOf(normalizeBar(bar).diameter);

/**
 * t1297 — THE WORKSPACE'S OWN BAR. A lathe workspace's WORKPIECE is a bar, so the GLOBAL stock is one — and the main
 * preview, where the user actually lives, draws the same thing the wizards draw instead of a toolpath and a tool in
 * empty air.
 *
 * IT IS NOT A SECOND BAR CONCEPT. The stock is built by `latheSimStock`, the same function every wizard pane calls;
 * this simply calls it with no op params, so the workspace holds the bar and `def.simStock` refines an op's values on
 * top of it. One builder, one shape, nothing to drift.
 *
 * IT NEVER OVERWRITES A BAR THE USER ALREADY HAS. Switching kind must not silently retype someone's workpiece, so an
 * existing bar is left exactly as it is; only a workspace still holding a mill's box gets one.
 * @returns {boolean} whether it wrote
 */
export function applyLatheWorkspaceStock() {
    if (typeof window === 'undefined' || !window.ddcsGetSettings) return false;
    let s = null;
    try { s = window.ddcsGetSettings(); } catch (_) { return false; }
    if (!s || !isLathe()) return false;
    const cur = s.stock || {};
    if (cur.shape === 'cylinder' && cur.axis === 'z' && cur.origin === 'finished-face') return false;   // already a bar
    // THE DECLARED DEFAULT BAR — not the mill box's width read as a diameter. A 100mm block is not a 100mm bar; the
    // box says nothing about the stock a turner has in the chuck, and inferring one from the other invents a fact.
    //
    // t1313 — …but a CYLINDER already carries one. A round blank opened on a lathe becomes a bar of the SAME
    // diameter rather than the default: the user declared that size, and the shapes are close enough that resetting
    // it would be throwing away a fact we have. (A box still gets the default, for the reason above.)
    const round = cur.shape === 'cylinder' && Number(cur.diameter) > 0;
    const fallback = {
        barDiameter: round ? Number(cur.diameter) : DEFAULT_BAR.diameter,
        stickOut: round && Number(cur.z) > 0 ? Number(cur.z) : DEFAULT_BAR.stickOut,
        barAllowance: DEFAULT_BAR.allowance,
    };
    s.stock = { ...latheSimStock(null, cur, fallback), features: [] };
    try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
    return true;
}

if (typeof window !== 'undefined') {
    // …applied when the workspace BECOMES a lathe, and once at boot for one that already is (app.js).
    window.addEventListener('ddcs:machine-changed', () => { try { applyLatheWorkspaceStock(); } catch (_) {} });
    window.ddcsApplyLatheStock = applyLatheWorkspaceStock;
}

/**
 * t1305 — THE BAR AN OP SHOWS, read back out of the op's own declared sim stock.
 *
 * A consumer that needs the bar (the probe render, to size a stylus against it) asks the DECLARED hook rather than a
 * second copy of the defaults. The first version of this stored the fallback on the def — which broke the `.wiz`
 * round trip, because plain fields travel and that one had no reason to: `simStock` is re-attached on import, so
 * deriving from it is both shorter and the only version that survives an export.
 */
export function latheBarOf(def, params, simStock) {
    try {
        // …the RESOLVED sim stock when the caller has one (the view resolves it through the registry, since a stored
        // def carries data and not functions), else the def's own hook. Either way it is the op's DECLARED bar.
        const st = simStock || ((def && typeof def.simStock === 'function') ? def.simStock(params || {}, null) : null);
        if (!st) return normalizeBar({});
        const face = Number(st.faceZ) || 0;
        return normalizeBar({ diameter: st.diameter, stickOut: (Number(st.z) || 0) - face, allowance: face });
    } catch (_) { return normalizeBar({}); }
}
