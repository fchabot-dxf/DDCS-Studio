/**
 * wizards/drillWizard.js — hole-pattern generator (the first Mill-group op).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `drillStack(params)` → [ Array{ Drill | Bore } ]
 * — an Array container (patternPoints) stamping a hole leaf (peck Drill, or helical Bore) at each point, with
 * `skip` omitting holes by 1-based number. The wizard form and the Blocks view are two editors of this one
 * stack; the kernels (patternPoints / peckDrill / helicalBore) live in ops/ and are shared.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { patternPoints } from './ops/index.js';
import { num } from './ops/util.js';
import { pointsBBox } from './ops/placement.js';

// Re-export so views (drillView) keep importing the pattern geometry from here.
export { patternPoints };

/**
 * THE CYCLE A METHOD MEANS — declared, so the mapping is one table instead of two nested ternaries at the call site.
 *
 * `method` and `ramp` were two independent knobs on two different block types (`drill` had no ramp; `bore` had ramp
 * step|helix). `holecycle` has ONE knob, `cycle`, with three values — which is what the family actually is: peck, or a
 * bore that ring-steps, or a bore that helixes. The wizard's own vocabulary is unchanged (the form still asks for a
 * method and a ramp, and the twins still bind those), so this is a translation at the seam and not a re-spec.
 *
 * IT ACCEPTS BOTH SPELLINGS OF THE RAMP, and that is one declared tolerance rather than a legacy shim: there are two
 * callers with two vocabularies. The WIZARD FORM says `ramp: 'step'|'helix'` (its own historic knob, unchanged for the
 * user), while the BORE TWIN binds the socket directly and therefore has to speak the socket's language,
 * `'bore-step'|'bore-helix'`. Normalising both here is what lets the form keep its words and the twin keep a
 * value-substituting binding — the alternative was a second translation inside the twin, which is the duplicate this
 * avoids.
 */
export const cycleForMethod = (method, ramp) => {
    if (method !== 'helical') return 'peck';
    return (ramp === 'helix' || ramp === 'bore-helix') ? 'bore-helix' : 'bore-step';
};

/**
 * Drill params → [ PlaceOnStock{ HoleCycle } ]. The one source of truth for both displays.
 *
 * ── THE SWITCH (t1385): array{drill|bore} → ONE holecycle ─────────────────────────────────────────────────────────
 * This used to build an `array` CONTAINER stamping a literal hole leaf, so the pattern was walked at BUILD time in
 * JavaScript and every Z was baked. `holecycle` walks the pattern at RUNTIME in the macro, which is what makes the two
 * knobs an operator actually turns on the pendant — total depth `#81` and the bite `#82` — LIVE on a running program.
 * Both `opToSlot.js` and `opCamMap.js` recorded the old shape as the reason the universal CAM path "cannot expose
 * depth/peck AT ALL"; this is what unblocks that.
 *
 * TWO BLOCKS BECAME ONE, which is why the data twins had to convert to identity bindings first (t1385 step 1): the
 * pattern params and the cut params now sit on the SAME block, so a positional binding map could not have survived.
 *
 * WHAT IS UNCHANGED, deliberately: the framing (progstart / wcs / placeonstock / progend), the wizard's params and their
 * names, and the placement contract — `holecycle` declares the same live pattern-point `extent` the `array` container
 * did, so the place fold still recomputes the bbox from params rather than a snapshot.
 */
export function drillStack(params = {}) {
    const hole = newBlock('holecycle');
    hole.params = {
        // the pattern half — the same knobs the `array` container carried, now on the one block that walks them
        pattern: params.pattern || 'single',   // t848 — default = a single hole (the CAM expectation); patterns are opt-in
        x0: num(params.x0, 0), y0: num(params.y0, 0),
        cols: num(params.cols, 3), rows: num(params.rows, 2), dx: num(params.dx, 20), dy: num(params.dy, 20),
        count: num(params.count, 4), spacing: num(params.spacing, 20), angle: num(params.angle, 0),
        dia: num(params.dia, 50), startAngle: num(params.startAngle, 0),
        w: num(params.w, 100), h: num(params.h, 80), nx: num(params.nx, 2), ny: num(params.ny, 2),   // rect-perimeter pattern
        skip: params.skip || '',
        // the cycle half — the hole leaf's own knobs. BOTH cut sets are carried whatever the method, because the Blocks
        // view round-trips every field and a user switching method must not find the other set blanked (the `array` +
        // leaf shape got this for free by having two blocks; one block has to say it).
        x: 0, y: 0,
        cycle: cycleForMethod(params.method, params.ramp),
        depth: num(params.depth, 5), peck: num(params.peck, 5),
        holeDia: num(params.holeDia, 12), toolDia: num(params.toolDia, 6), pitch: num(params.pitch, 0.5),
        feed: num(params.feed, 100), clearance: num(params.clearance, 5),
    };
    // PLACE the pattern on the stock — a C-block carrying the intent + a bbox/stock SNAPSHOT (placeOnStock.js); the
    // emit fold (kind:'place') translates the wrapped op so its datum corner lands on the stock-attach corner.
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    return [makeStart(params), wcs, makePlace(params, pointsBBox(patternPoints(params)), hole), makeEnd(params)];
}

export class DrillWizard {
    generate(params) {
        recordOp('drill', params);   // let the Blocks tab open this op as its stack
        return emitMapped(drillStack(params), activeDialectOpts()).text;   // placement is baked into the stack (drillStack)
    }

    /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
