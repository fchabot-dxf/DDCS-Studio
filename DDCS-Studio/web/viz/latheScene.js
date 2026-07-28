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
import { barToStock, normalizeBar, radiusOf } from '../data/lathe.js';
import { isLathe } from '../data/workspaceMachine.js';

/** The bar every lathe op shows, from whatever the op knows about it. Defaults are the op's, not this file's. */
export function latheBarFrom(params, fallback) {
    const p = params || {}, f = fallback || {};
    // THE RAW END MUST CONTAIN WHAT THE OP REMOVES. Facing's whole job is the material ahead of the finished face, so
    // its `allowance` IS the bar's raw end — drawing the generic 1mm stub put the first two passes outside the bar,
    // in mid-air. (Caught by the on-the-bar assert, which is exactly what it is for.)
    const raw = Math.max(
        Number(p.barAllowance) != null && Number.isFinite(Number(p.barAllowance)) ? Number(p.barAllowance) : (Number(f.barAllowance) || 1),
        Number(p.allowance) || 0,
    );
    return normalizeBar({
        diameter: Number(p.barDiameter) || Number(f.barDiameter) || 20,
        stickOut: Number(p.stickOut) || Number(f.stickOut) || 60,
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
        datum: 'nnp', pin: 'origin', show: true,
    };
}

/** Attach the lathe's scene declarations to a twin. One call per op, so all five say the same thing. */
export function withLatheScene(def, fallback) {
    def.simStock = (params, stock) => latheSimStock(params, stock, fallback);
    return def;
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
