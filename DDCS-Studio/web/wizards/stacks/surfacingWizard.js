/**
 * wizards/stacks/surfacingWizard.js — face / surfacing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard has ONE implementation — `surfacingStack(params)` builds the
 * primitive stack and `generate()` emits it. The STUDIO form and the Blocks view are two editors of that
 * same stack, so the G-code is identical by construction (no parallel converter). Surfacing = StepDown{
 * StepOver(Region) } with NO radius inset (the area is the tool-CENTRE sweep, so the tool overhangs the edge
 * and faces the whole top) and no wall pass. Rect only; raster → parallel rows, else concentric rings.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { makeStart, makeEnd, makePlace, makeSkim } from '../../blocks/programFraming.js';
import { num, val } from '../ops/util.js';   // t1706 (cycle ACT 3) — val() at the call sites Act 2 declared tokenEligible
import { stepoverPctOf } from '../ops/surfaceraster.js';   // t1363 — the ONE reading of a stored stepover (see its declaration)

/**
 * t1359 — THE SWITCH. Surfacing params → the PARAMETRIC atom, wrapped by the same framing as before.
 *
 *   [ progstart · wcs · placeonstock{ surfaceraster } · progend ]        (Normal)
 *   [ progstart(skim) · wcs · skim{ surfaceraster } · progend ]          (Skim)
 *
 * ONE BLOCK where there were two. `stepdown{ surfacefill }` collapsed into a single `surfaceraster` that carries the
 * depth loop, the row/ring walk, the descent and the confirm cadence itself — so the whole raster is a program the
 * MACHINE derives rather than a transcript this file writes out. Change the tool Ø on the pendant and the rows
 * re-count at the controller.
 *
 * THE FRAME IS PASSED, NOT PAINTED ON. `placeonstock` hands x0/y0/z0 into the atom's params (it declares
 * `absorbsPlacement`), and the `skim` fold hands it `zMode` so the atom reads the live jog position into its own
 * registers. Neither fold rewrites the emitted text any more, which is the whole reason this could land: t1349
 * measured what a text rewrite does to `X[0 + #40]` and `Y#47` — a half-shifted move and a corrupted comment.
 *
 * `stepdown` and `surfacefill` are NOT retired: pocket, slot and contour still emit through them. What retired is
 * surfacing's use of them, and the second source that used to shadow this one (millToSlot's `surfacingSlot`).
 *
 * The equivalence bridges compare this against `surfacingLiteralStack` above — the old emitter, kept as the named
 * test-only reference so the comparison stays real.
 */
export function surfacingStack(params = {}) {
    const tool = Math.max(0.1, num(params.toolDia, 12));
    // The stepover reaches the atom as the two knobs it derives from (tool Ø + %), because that is what the header
    // re-derives at the machine. A caller carrying a flat mm (an op stored before the split) is recovered against the
    // tool it will run — through the atom's own declared `stepoverPctOf` (t1363), so a stored millimetre cannot mean
    // two things depending on which path read it.
    const pct = stepoverPctOf(params, tool);
    const w = num(params.w, 100), h = num(params.h, 80);

    const raster = newBlock('surfaceraster');
    // t1706 (cycle ACT 3) — val() ONLY at depth/stepdown/feed/plunge: the atom itself (surfaceraster.js) already
    // carries a live value through these (depth/stepdown via its own geoTerm/liveWordOf; feed/plunge via its own
    // val() at surfaceraster.js:789) — verified live, not just read, before trusting it. num() stays everywhere
    // else: w/h/toolDia (Act 2, unchanged — decide whether ANY cutting atom exists / feed the stepover derivation)
    // AND, CORRECTING Act 2: rampAngle/helixDia/helixPitch/confirmEvery. Act 2's survey checked only the WIZARD
    // layer; live-testing here (driving the real app, not reading code) found the ATOM's OWN emit bakes
    // rampAngle into a tan()-derived literal (surfaceraster.js ~1045: "the tangent is baked; the angle is a form
    // field, not a knob"), helixPitch/helixDia into the helix's move COUNT and radius (surfaceraster.js:673,
    // 1519-1530, Math.ceil(stepdown/helixPitch)*24 — a real loop count), and confirmEvery into a threshold branch
    // (Math.round+Math.max, gating whether the confirm-pause mechanism exists at all) — none carry a live word.
    raster.params = {
        x: 0, y: 0, z0: 0,                       // the op's own frame; the folds pass the real one in
        w, h, depth: val(params.depth, 0.5), stepdown: val(params.stepdown, 0.5),
        toolDia: tool, stepoverPct: pct,
        feed: val(params.feed, 2000), plunge: val(params.plunge, 200), clearance: num(params.clearance, 5),
        strategy: (params.strategy === 'concentric') ? 'concentric' : 'parallel', direction: 'bothways',
        entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3),
        helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1),
        confirmEvery: num(params.confirmEvery, 0),
    };

    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    if (params.zMode === 'skim') {
        // SKIM: no placement — the jog IS the reference. `skim` sits exactly where `placeonstock` does so the flat
        // block indices stay parallel between the two modes (the twin mirrors this shape through applySkimStructure).
        return [makeStart({ ...params, skim: true }), wcs, makeSkim(params, raster), makeEnd(params)];
    }
    return [makeStart(params), wcs, makePlace(params, { minX: 0, maxX: w, minY: 0, maxY: h }, raster), makeEnd(params)];
}
