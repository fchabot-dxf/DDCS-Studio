/**
 * wizards/stacks/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `pocketStack(params)`. The walk is the tool-CENTRE
 * boundary (inset by the tool radius) so the FINISHED pocket matches the size you type. Strategy raster → parallel
 * rows + a Wall finish; spiral → concentric rings (which reach the wall). A pocket smaller than the tool falls back
 * to a single centre plunge (peck). Form and Blocks view are two editors of this one stack.
 *
 * ── THE SHAPE IT BUILDS, AND WHY THERE ARE TWO OF THEM (t1406 · t1433) ────────────────────────────────────────────
 * ELIGIBLE (rect, big enough, no rest tool, a bridged direction/descent — `pocketRidesRaster`):
 *     Place'clear'{ surfaceraster }   [ + Place'wall'{ wallfinish } on raster ]
 *   two parametric atoms, each ALONE in its own place so the placement is absorbed as params rather than painted
 *   onto macro text (t1349's shear). Each owns its own depth loop; there is no StepDown on this arm at all.
 * REFUSED (everything else):
 *     Place'clear'{ StepDown{ pocketfill [+ pocketwall] [+ REST] } }
 *   the literal transcript, byte-identical to what it has always emitted, which is what makes the boundary testable.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { makeStart, makeEnd, makePlace } from '../../blocks/programFraming.js';
import { num } from '../ops/util.js';
import { regionDesc } from '../ops/region.js';
import { restValid } from '../ops/restmachining.js';   // t871 — REST MACHINING: append a corner-clear pass with a smaller 2nd tool
import { pocketInsetMm } from '../ops/pocketfill.js';   // t1406 — the ONE reading of how far in a pocket's tool centre sits
import { surfaceRasterCovers, surfaceRasterGap } from '../ops/surfaceraster.js';   // t1406 — the atom's own declared envelope decides whether this pocket may ride it
import { toolTooLarge, toolFitRefusal } from '../ops/toolFit.js';   // t1444 — the ONE too-small boundary (strictly smaller refuses, exactly equal is allowed)

/** The TRUE pocket region (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry)) — the size you
 *  type, before insetting. Shape-centred at (originX, originY) except rect (its corner). */
function trueRegionParams(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle') return { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) };
    if (shape === 'polygon') return { shape: 'polygon', x: ox, y: oy, w: num(params.dia, 50), sides: num(params.sides, 6) };
    if (shape === 'ellipse') return { shape: 'ellipse', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
    return { shape: 'rect', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
}

/** The pocket's outer footprint on the stock (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry))
 *  — shared by the stack (for PlaceOnStock's snapshot) and the 2D view, so 2D and 3D place identically. */
export function pocketBBox(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle' || shape === 'polygon') {
        const R = num(params.dia, 50) / 2;
        return { minX: ox - R, maxX: ox + R, minY: oy - R, maxY: oy + R };
    }
    if (shape === 'ellipse') {
        const rx = num(params.w, 80) / 2, ry = num(params.h, 60) / 2;
        return { minX: ox - rx, maxX: ox + rx, minY: oy - ry, maxY: oy + ry };
    }
    const w = num(params.w, 80), h = num(params.h, 60);
    return { minX: ox, maxX: ox + w, minY: oy, maxY: oy + h };
}

/** Would insetting the TRUE region by `inset` leave a degenerate (≤0) pocket → too small for the tool to clear?
 *  Checked on the unclamped geometry (offsetRegion floors radii at 0.01, which would hide it). */
function insetTooSmall(rg, inset) {
    if (rg.kind === 'circle') return rg.r - inset <= 0;
    if (rg.kind === 'polygon') return rg.r - inset / Math.cos(Math.PI / rg.sides) <= 0;
    if (rg.kind === 'ellipse') return rg.rx - inset <= 0 || rg.ry - inset <= 0;
    return rg.w - 2 * inset <= 0 || rg.h - 2 * inset <= 0;
}

/** Would the pocket inset degenerate (≤0) for these params → too small for the tool to clear (a single centre plunge
 *  instead of a stepover)? The ONE-SOURCE geometry-derived predicate — drives the concrete build AND the E0 tooSmall
 *  guard (the twin injects this into the prune params, since it can't be read off any single user param). */
export function pocketTooSmall(params = {}) {
    const r = Math.max(0.1, num(params.toolDia, 6)) / 2;
    return insetTooSmall(regionDesc(trueRegionParams(params)), r - num(params.wallOffset, 0));
}

/**
 * ── t1444 — THE LARGEST TOOL THIS POCKET CAN HOLD, in mm. The number both the refusal and its SENTENCE read ───────
 *
 * `pocketTooSmall` answers "does the inset degenerate" and that is the right question for the PLUNGE arm, but it
 * cannot tell an operator anything: it is a boolean about an inset nobody typed. The user's ruling needs two things
 * it does not have — the STRICT side of the same boundary (equal is allowed, smaller refuses) and a millimetre to
 * put in the sentence — so the same geometry is expressed as the tool Ø at which the region closes.
 *
 * IT IS `insetTooSmall` SOLVED FOR THE TOOL, not a second opinion about pocket geometry: the inset that closes each
 * shape is its inradius (rect → min(w,h)/2 · circle → r · polygon → r·cos(π/n), the apothem · ellipse → min(rx,ry)),
 * and the inset a pocket walks with is `tool/2 − wallOffset`. Setting them equal gives the Ø below. The 1444 spec
 * sweeps both against each other so the re-expression cannot drift from the predicate that has always shipped.
 */
export function pocketMaxToolDia(params = {}) {
    const rg = regionDesc(trueRegionParams(params));
    const inrad = rg.kind === 'circle' ? rg.r
        : rg.kind === 'polygon' ? rg.r * Math.cos(Math.PI / Math.max(3, Math.round(rg.sides || 6)))
            : rg.kind === 'ellipse' ? Math.min(rg.rx, rg.ry)
                : Math.min(rg.w, rg.h) / 2;
    return 2 * (inrad + num(params.wallOffset, 0));
}

/** Is this pocket STRICTLY smaller than its tool → refuse everywhere? (Exactly tool-size keeps its plunge — the ruling.) */
export function pocketToolRefuses(params = {}) {
    return toolTooLarge(pocketMaxToolDia(params), Math.max(0.1, num(params.toolDia, 6)));
}

/** The operator sentence for a pocket the tool cannot fit, or '' — one wording for emit, preview, twin and CAM pack. */
export function pocketToolRefusal(params = {}) {
    return toolFitRefusal(pocketMaxToolDia(params), Math.max(0.1, num(params.toolDia, 6)), 'pocket');
}

/** The pocket CENTRE (the tooSmall drill-plunge point) — rect = corner+size/2; circle/polygon/ellipse = the shape origin.
 *  ONE-SOURCE: shared by pocketStack (the concrete drill arm) and the twin's postInstantiate (which rewrites the drill x/y
 *  from the resolved params, since the frozen superset template bakes them at the DEFAULT geometry). */
export function pocketDrillCentre(params = {}) {
    const d = regionDesc(trueRegionParams(params));
    return d.kind === 'rect' ? { cx: d.x + d.w / 2, cy: d.y + d.h / 2 } : { cx: d.cx, cy: d.cy };
}

/** The atom's own strategy word for a pocket's strategy fork — raster → parallel rows, spiral → concentric rings.
 *  ONE reading, so the eligibility predicate and the block it builds can never disagree about which walk will run. */
export function pocketRasterStrategy(params = {}) { return (params.strategy || 'spiral') === 'raster' ? 'parallel' : 'concentric'; }

/**
 * ── t1406 — WHY A POCKET'S RECT CLEARING MAY NOT RIDE `surfaceraster`, IN WORDS ────────────────────────────────────
 *
 * Returns '' when the parametric arm applies, else the REASON — never a bare false. Every clause is a NARROWING, and
 * the discipline behind that is the whole lesson of t1402/t1404: the question is never "will something run", it is
 * "will what runs be what was ASKED for". Where the answer is no, the pocket keeps its literal fill, byte-identical,
 * and the boundary says so by name instead of the atom quietly doing something adjacent.
 *
 *   shape        The atom walks a RECTANGLE. Circle / polygon / ellipse clear through JS contour walks
 *                (concentricContour, a scanline over an offset polyline) — not analytic shapes a macro can count.
 *   too small    A pocket narrower than its tool is a single plunge, not a raster; that arm re-pointed at t1391.
 *   rest tool    Ruled untouched this act. Its corner-clear rides INSIDE the clearing place, and the clearing place
 *                must now hold the atom ALONE (absorbingChild is strict, and a mixed body shears a macro — t1349).
 *   envelope     Whatever the atom's OWN table has not earned (surfaceRasterCovers) is refused in its own words. This
 *                is a second consumer of that table, which is exactly what a table is for.
 *
 * ── t1418 — THE `direction` CLAUSE IS GONE, AND ITS REMOVAL IS THE POINT ──────────────────────────────────────────
 * It read: *"the atom's walk is ALWAYS both-ways, so a one-way RASTER keeps its literal fill rather than silently
 * emitting a zig-zag — an operator picks one-way to get a consistent climb cut, and both-ways is not that."* That
 * narrowing was correct and it was always meant to be temporary: the atom now walks all three direction words, so
 * the clause has nothing left to refuse and keeping it would refuse a capability that exists.
 *
 * IT EMPTIED FULLY, NOT HALFWAY. Teaching only `oneway` would have left `otherway` — a conventional cut — on the
 * literal arm while a clause reading "one-way keeps its literal fill" no longer described what happened. `direction`
 * now reaches the atom through the envelope like every other axis (SURFACE_RASTER_AXES), so an unknown direction word
 * still refuses, in the atom's own words, from the same table.
 *
 * A SPIRAL pocket is unaffected and always was: concentric rings ignore `direction` on BOTH sides — `fillStrategy`
 * dispatches to `concentricRect` before it ever reads it — which is why the atom's axis declaration gives concentric
 * no direction axis at all rather than three identical rows.
 */
export function pocketRasterGap(params = {}) {
    const shape = params.shape || 'rect';
    if (shape !== 'rect') return `a ${shape} pocket clears through a JS contour walk, not the atom's analytic rectangle`;
    // t1444 — THE SENTENCE SPLIT WITH THE ARM, and leaving it whole would have made it a lie for half its domain.
    // This read "a pocket narrower than its tool is a single centre plunge, not a raster" for BOTH cases; after the
    // ruling only the exactly-tool-sized one plunges, and the narrower one cuts nothing at all. This string is
    // operator-facing — `armGap` feeds the CAM table's why-column — so a stale half is a wrong operator message, which
    // this project treats as seriously as wrong motion. Found by the t1448 fixture sweep, in the product rather than
    // in a test: the two specs that name this clause still PASSED, because they assert the refusal and not the words.
    if (pocketToolRefuses(params)) return pocketToolRefusal(params) + ' — so there is nothing to clear, by raster or otherwise';
    if (pocketTooSmall(params)) return 'a pocket exactly its tool\'s size is a single centre plunge, not a raster';
    if (restValid(params)) return 'a rest pass rides inside the clearing place, and that place must hold the atom alone';
    const probe = { strategy: pocketRasterStrategy(params), direction: params.direction || 'bothways', entry: params.entry || 'plunge' };
    return surfaceRasterCovers(probe) ? '' : surfaceRasterGap(probe);
}

/** Does this pocket's rect clearing ride the parametric atom? (The predicate half of pocketRasterGap — one source.) */
export function pocketRidesRaster(params = {}) { return pocketRasterGap(params) === ''; }

/**
 * Pocket params → its block stack. The one source of truth for both displays. E0 (t467): the pocket geometry rides
 * FLAT pocketfill/pocketwall leaves (region-pill→flat REFRAME, byte-identical to the stepover+contour region-socket
 * path) so E1 can bind positionally; `opts.superset` carries BOTH structural forks GUARDED so pruneGuards collapses to
 * the concrete shape (the twin seam). The forks: `strategy` (raster → parallel clearing + a wall finish; spiral →
 * concentric clearing, no wall) is a real param → guarded directly; `tooSmall` is GEOMETRY-DERIVED → guarded on the
 * derived `_tooSmall` key (injected into the prune params by pocketTooSmall). Shapes/side/scalars are E1 value-swaps.
 */
export function pocketStack(params = {}, opts = {}) {
    const superset = !!opts.superset;
    const shape = params.shape || 'rect';
    const clr = num(params.clearance, 5), feed = num(params.feed, 2000), plunge = num(params.plunge, 150);
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const raster = (params.strategy || 'spiral') === 'raster';
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    // The pocket centre (the tooSmall drill point) — one source, shared with the twin's postInstantiate.
    const { cx, cy } = pocketDrillCentre(params);
    const tooSmall = pocketTooSmall(params);
    const bbox = pocketBBox(params);

    // The FLAT typed geometry the leaves carry (originX/originY = the shape origin) — one source for both leaves; each
    // recomputes the inset region + the absolute stepover internally (pocketfill.pocketInsetRegion / stepoverMm).
    const geom = { shape, originX: ox, originY: oy, w: num(params.w, 80), h: num(params.h, 60), dia: num(params.dia, 50), sides: num(params.sides, 6), wallOffset: num(params.wallOffset, 0), toolDia: num(params.toolDia, 6) };
    const fillLeaf = (strat) => { const b = newBlock('pocketfill'); b.params = { ...geom, stepoverPct: num(params.stepoverPct, 40), strategy: strat, direction: params.direction || 'bothways', entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1), by: 'by', z: 'z', feed, plunge, clearance: clr }; return b; };   // strat: parallel (raster) | concentric (spiral); direction (t800 P6); entry (t804 P?) = per-level descent, params.entry || plunge → byte-identical; by='by' resolves the StepDown step from scope
    const wallLeaf = () => { const b = newBlock('pocketwall'); b.params = { ...geom, z: 'z', feed, plunge, clearance: clr }; return b; };
    /**
     * ── t1406 — THE RECT CLEARING, RE-POINTED THROUGH `surfaceraster` ─────────────────────────────────────────────
     *
     * `stepdown{ pocketfill }` — a JS transcript of every row at every level — becomes ONE atom that carries the depth
     * loop, the row/ring walk and the descent itself. The pocket does not gain a second parametric raster; it asks the
     * one the app already ships and proves (t1397 measured that a copy would start life identical, and what drifts in
     * a copy is the arithmetic that decides where the tool goes).
     *
     * ⚠ THE GEOMETRY IS THE **GIVEN** RECT, AND THE INSET IS A SEPARATE NUMBER. Handing the atom the pre-inset
     * rectangle would be the obvious move and it is measurably wrong: `extent` (which the place fold reads in
     * preference to its frozen snapshot) would then declare the tool-centre sweep, and t1402 measured what that does —
     * a placed pocket slides by exactly the tool radius. t1404 split the two, so `x/y/w/h` stay the pocket's own
     * outline and `inset` moves only the WALK. The VALUE is never re-derived here: `pocketInsetMm` is the same one
     * source `pocketInsetRegion` uses, so the wall and the fill still trace boundaries that agree by construction.
     *
     * t1418 — `direction` IS PASSED NOW. It used to be pinned to `'bothways'` here because the atom ignored the word,
     * and the arm was narrowed to match (see pocketRasterGap) so a one-way request was never answered with a zig-zag.
     * The atom walks all three words, so pinning it would now be the lie the pin existed to prevent.
     *
     * IT IS CARRIED AT BUILD, NOT LIVE, and that is a real property rather than a caveat: `direction` selects which
     * WALK gets written into the macro text, so it is spent before any register exists. A pendant `#var` cannot reach
     * it — `atomRoles` says `other` (a discrete selector) and the t1418 spec asserts a register in this socket does
     * NOT come out as one. What it stopped being is ARM-DECIDING: it no longer decides literal-vs-parametric.
     */
    const rasterLeaf = (strat) => {
        const b = newBlock('surfaceraster');
        b.params = {
            x: ox, y: oy, z0: 0,                            // the pocket's own outline; the place fold passes the real frame in
            w: num(params.w, 80), h: num(params.h, 60), inset: pocketInsetMm(params),
            depth, stepdown: by,                            // the atom owns the depth loop now — no enclosing StepDown
            toolDia: num(params.toolDia, 6), stepoverPct: num(params.stepoverPct, 40),
            feed, plunge, clearance: clr,
            strategy: strat, direction: params.direction || 'bothways',
            entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3),
            helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1),
            confirmEvery: num(params.confirmEvery, 0),
        };
        return b;
    };
    /** The clearing place: EXACTLY ONE child, so `absorbingChild` hands the atom its frame as params instead of
     *  rewriting a macro body's text (t1349's shear). That is the whole reason the wall needs a place of its own. */
    const rasterPlace = (strat) => makePlace(params, bbox, [rasterLeaf(strat)], 'clear');
    /**
     * ── t1433 — THE WALL FINISH, RE-POINTED THROUGH `wallfinish` ───────────────────────────────────────────────────
     *
     * `stepdown{ pocketwall }` — a JS transcript of the same ring at every level — becomes ONE atom that carries the
     * depth loop and the ring. The place that holds it now ABSORBS (exactly one self-framing child), so the placement
     * arrives as params instead of being painted onto the emitted text: the t1349 shear is not survivable by a body
     * whose coordinates can be registers, and the CAM delegation ahead is what makes them registers.
     *
     * ⚠ THE GEOMETRY IS THE **GIVEN** RECT AND THE INSET IS A SEPARATE NUMBER, the identical split t1404 made for the
     * fill and for the identical reason: `extent` (which the place fold reads in preference to its frozen snapshot)
     * must keep declaring the pocket's own outline, or a placed pocket slides by the tool radius (t1402 measured it).
     * The VALUE is never re-derived here — `pocketInsetMm` is the same one source `pocketInsetRegion` reads, so the
     * wall and the fill still trace boundaries that agree by construction.
     *
     * `confirmEvery` rides here unchanged, and it is now the ATOM's own cadence register rather than a StepDown's.
     * "Pause after every N depth passes" is a statement about a depth walk and after t1405's re-order there are two of
     * them; giving the wall's walk a different cadence from the one the operator typed would invent a rule nobody
     * asked for. (The reverse-sync reads it from here now — see opSession's pocket reader.)
     *
     * NO SECOND FORK. The wall re-points on `_para`, the SAME guard the fill does, because `_para` is a SUPERSET of
     * what this atom needs: it already means rect, big enough for its tool, and no rest pass, and the two clauses it
     * adds (a bridged direction, a bridged descent) are things the wall does not read. One fork in the stack instead
     * of a crossed pair is what keeps the guarded superset collapsible.
     */
    const wallPlace = () => {
        const b = newBlock('wallfinish');
        b.params = {
            x: ox, y: oy, z0: 0,                            // the pocket's own outline; the place fold passes the real frame in
            w: num(params.w, 80), h: num(params.h, 60), inset: pocketInsetMm(params),
            depth, stepdown: by,                            // the atom owns the depth loop now — no enclosing StepDown
            feed, plunge, clearance: clr,
            confirmEvery: num(params.confirmEvery, 0),
        };
        return makePlace(params, bbox, [b], 'wall');
    };
    // (The REFUSED arms keep their literal wall exactly where it has always been — `wallLeaf()` inside the clearing
    // place's own StepDown, below. There is no second wall PLACE on that side, and there never was.)
    /**
     * ── THE TOO-SMALL FALLBACK, RE-POINTED THROUGH holecycle (t1391, ruled) ────────────────────────────────────────
     *
     * A pocket narrower than its tool cannot be cleared, so it becomes a single plunge. That plunge used to be the literal
     * `drill` leaf — which made pocket the last consumer of an atom the whole drill arc had otherwise retired, and the
     * reason `drill.js` could not die. The fork was ruled: NOT a second single-hole emitter beside the parametric family
     * (that hand-rolls exactly what the arc unified), but the family's own `holecycle` degenerated to one hole.
     *
     * ⚠ THE CENTRE GOES IN x0/y0, NOT x/y, AND THAT IS NOT COSMETIC. For the literal leaf, `x`/`y` WERE the hole's
     * position and the place fold rewrote its emitted text. `holecycle` declares `absorbsPlacement`, so the fold hands it
     * the shift THROUGH `x`/`y` as params instead — writing the plunge centre there would collide with the placement.
     * `x0`/`y0` are the pattern's own origin, which folds into the frame at build time, so the hole lands at the centre
     * AND the placement still applies on top. (`postInstantiate` in pocketData writes the same two keys, for the same reason.)
     */
    const drillPlace = () => {
        const hole = newBlock('holecycle');
        hole.params = { pattern: 'single', cycle: 'peck', x0: cx, y0: cy, depth, peck: by, feed: plunge, clearance: clr };
        return makePlace(params, bbox, hole, 'clear');   // t1406 — the too-small arm IS the clearing place for its state
    };
    /**
     * ── t1444 — THE REFUSAL ARM: strictly smaller than the tool cuts NOTHING, and says why (user-ruled) ────────────
     *
     * `_tooSmall` used to mean one thing and now covers two states that the ruling separates: a pocket the tool
     * exactly fills still gets its centre plunge (the normal way to make a tool-sized pocket — nothing about it is
     * approximate), while one the tool CANNOT fit gets no motion at all, because any hole such a cut could make is
     * OVERSIZE BY CONSTRUCTION. Plunging a Ø12.7 tool into a "Ø6.35 pocket" produced a Ø12.7 hole and a program that
     * looked finished, which is the same silent-substitution class as the slot's width clamp.
     *
     * IT RIDES `assign`, NOT A NEW BLOCK, and it labels its message `ERROR:` — the idiom the ATC wizards already use
     * for exactly this (`#1505=1 ( ERROR: Tool Setter missed )`). That label is what the engine reads back to tell a
     * REFUSAL from an HMI prompt on the same register, so the preview gets the sentence for free rather than through
     * a second pocket-shaped code path.
     *
     * ⚠ IT KEEPS ITS PLACE BLOCK, and the first cut of this did not — which the E0 binding derivation caught at once
     * ("spec originX matched 0 blocks"). The reasoning that dropped it ("there is no toolpath to place") was wrong on
     * both counts: every binding spec resolves `originX`/`originY` THROUGH the arm's one `placeonstock`, so an arm
     * without one cannot be instantiated at all — and a refused pocket still HAS an origin and a footprint that the
     * operator can move. What it has no more of is MOTION, which is the child, not the placement.
     */
    const refusePlace = () => {
        const b = newBlock('assign');
        b.params = { var: '#1505', value: '1', note: `ERROR: ${pocketToolRefusal(params)}` };
        return makePlace(params, bbox, [b], 'clear');   // the arm's ONE place — the op still has a position; it just cuts nothing
    };
    const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
    // t871 — the REST section rides INSIDE the main clear's ONE placeonstock (a second place would duplicate the placement
    // bindings): a StepDown of the pocketrest leaf, preceded by a STATIC marker comment (so the twin freezes byte-identically
    // — the tool specifics live on the op + the setup sheet, not the baked text). Only when a valid smaller rest tool is
    // declared on a cornered shape → otherwise ABSENT, so the emit is byte-identical (goldens untouched).
    const restLeaf = () => { const b = newBlock('pocketrest'); b.params = { ...geom, restDia: num(params.restDia, 0), restStepover: num(params.restStepover, 40), depth, by, feed, plunge, clearance: clr }; return b; };   // a LEAF that loops its own depth levels (no 2nd stepdown → no depth-binding collision)
    const restInner = () => {
        const note = newBlock('comment'); note.params = { text: 'REST — smaller tool clears the corners; change tools here' };
        return [note, restLeaf()];
    };
    const clearPlace = (kids, restKids) => { const down = newBlock('stepdown'); down.params = { to: depth, by, confirmEvery: num(params.confirmEvery, 0) }; down.children = kids; return makePlace(params, bbox, restKids ? [down, ...restKids] : [down], 'clear'); };   // t1031 — confirmEvery pause (0 = off → byte-identical)

    if (!superset) {   // concrete: the geometry-derived tooSmall + strategy select the arm directly
        if (pocketToolRefuses(params)) return [makeStart(params), wcs, refusePlace(), makeEnd(params)];   // t1444 — strictly smaller: no motion
        if (tooSmall) return [makeStart(params), wcs, drillPlace(), makeEnd(params)];                     // …exactly tool-size keeps its plunge
        // t1406 — the RE-POINTED arm. The predicate is the one source (pocketRasterGap); everything it refuses falls
        // through to the literal build below, unchanged and byte-identical, which is what makes the boundary testable.
        if (pocketRidesRaster(params)) {
            const arm = [rasterPlace(raster ? 'parallel' : 'concentric')];
            if (raster) arm.push(wallPlace());   // ROUGH ALL, THEN WALL — the finish follows every fill level
            return [makeStart(params), wcs, ...arm, makeEnd(params)];
        }
        const kids = [fillLeaf(raster ? 'parallel' : 'concentric')];
        if (raster) kids.push(wallLeaf());   // raster leaves the wall un-finished → a Contour(on) finish pass
        return [makeStart(params), wcs, clearPlace(kids, restValid(params) ? restInner() : null), makeEnd(params)];   // t871 — rest inside the ONE place (byte-identical when unset)
    }
    // superset: EVERY fork present + guarded — tooSmall (drill vs clearing) on the derived `_tooSmall` key, `_para`
    // (t1406: does the rect clearing ride the atom) also derived, strategy (parallel+wall vs concentric) on the real
    // param. prune keeps one arm at each fork → the concrete shape. `_para` sits INSIDE `_tooSmall:false` because a
    // too-small pocket has no clearing at all: nesting it there keeps the two forks independent rather than crossed.
    const strategyFork = (fillArm, wallArm) => [
        GUARD({ param: 'strategy', is: 'raster' }, fillArm('parallel').concat(wallArm())),
        GUARD({ param: 'strategy', is: 'spiral' }, fillArm('concentric')),
    ];
    return [
        makeStart(params), wcs,
        // t1444 — the REFUSAL fork sits OUTSIDE `_tooSmall` and `_tooSmall` nests inside its false arm, because
        // refuse ⊂ too-small (a pocket the tool cannot fit is certainly one the inset closes). Nesting keeps the two
        // guards independent instead of crossed — the same reason `_para` sits inside `_tooSmall:false` below.
        GUARD({ param: '_refuse', is: true }, [refusePlace()]),
        GUARD({ param: '_refuse', is: false }, [
            GUARD({ param: '_tooSmall', is: true }, [drillPlace()]),
            GUARD({ param: '_tooSmall', is: false }, [
                GUARD({ param: '_para', is: true }, strategyFork((s) => [rasterPlace(s)], () => [wallPlace()])),
                GUARD({ param: '_para', is: false }, [clearPlace(
                    strategyFork((s) => [fillLeaf(s)], () => [wallLeaf()]),
                    [GUARD({ param: '_rest', is: true }, restInner())],
                )]),   // t871 — the rest corner-clear rides the SAME place, on the geometry-derived `_rest` guard (absent → byte-identical)
            ]),
        ]),
        makeEnd(params),
    ];
}
