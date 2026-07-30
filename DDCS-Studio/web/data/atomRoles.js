/**
 * data/atomRoles.js — DECLARED param-key ROLES per emit atom (Universal CAM U1, the DECLARE source of truth).
 *
 * The atom author ALREADY chose each param's role by wrapping it in `val()` (rides a `#var` / `[expr]` through to G-code
 * verbatim — util.js:17) or `num()` (coerces to a number → a `#var` becomes NaN → the default; util.js:2). This table makes
 * that IMPLICIT choice EXPLICIT DATA so the CAM classifier decides which params can be exposed as pendant knobs vs which
 * must be BAKED — WITHOUT re-reading the emit output at runtime (declare, never infer). The emit-probe is DEMOTED to a
 * dev-time TEST (cam-expose-classify.spec.js) that guards this table against the real emit — a spec, not the runtime oracle.
 *
 *   'value'    — rides through emit verbatim (`val()`, OR a raw `${expr}` string interpolation): a coordinate / feed / rpm /
 *                port / target-var / expr. EXPOSABLE (a `#var` survives to F#n / X#n / an address) — UNLESS a blocking fold
 *                sits above the socket (see exposeClassifier.js).
 *   'geometry' — consumed by `num()` / JS math: a loop bound, step, radius, `Math.round` label, count. BAKE-ONLY (a `#var`
 *                → NaN → the default; the intent is destroyed). This holds EVEN when the param emits a real G-word — e.g.
 *                cnc.drillcycle X/Y/Z, progstart rpm, mcode code all emit words yet run through `num()`, so a `#var` breaks.
 *   'other'    — a mode / enum / dir / bool / label-name / comment / selector: NOT a meaningful operator knob → not
 *                exposable (bake-only). NB: 'other' does NOT imply "a #var is destroyed" — a few selectors RAW-interpolate
 *                and a #var would MECHANICALLY ride through (machinemove.axis → `G53 ${axis}`; hmistatus.color → `#2039=${c}`,
 *                which the `Number(c)!==-1` guard passes for a #var). They stay 'other' anyway: a discrete selector is not a
 *                value the operator tunes per-run, and non-'value' keeps it un-exposable (the safe call). Only 'value' exposes.
 *
 * Ground truth: each row was read from the atom's emit in wizards/ops/ (val vs num per key). Keyed by block `type`
 * (wizards/ops/index.js). Any key NOT listed → DEFAULT_ROLE ('geometry') — the SAFE default: never expose a param whose
 * ride-through we have not verified (under-exposing only bakes; over-exposing emits wrong G-code). So an un-enumerated
 * atom (slot / contour / tap / the fold drivers) is entirely bake-only until a row is added — intentional and safe.
 */

export const ATOM_ROLES = {
    // — Motion / feed: coordinates + feed + rpm ride val() → value (the classic pendant knobs) —
    move: { x: 'value', y: 'value', z: 'value', a: 'value', b: 'value', feed: 'value', mode: 'other' },
    feed: { rate: 'value' },
    arc: { x: 'value', y: 'value', i: 'value', j: 'value', feed: 'value', arc: 'other' },
    probe: { to: 'value', feed: 'value', port: 'value', level: 'geometry', axis: 'other' },
    spindle: { rpm: 'value', dir: 'other' },

    // — Toolpath kernels: build a JS loop → coords + depth/peck/pitch run num() (loop bounds / pre-rounded) → geometry. FEED
    //   is the exception (t1091): it appears ONLY as a bare `F${feed}` in every kernel — no test, no arithmetic, no loop-bound
    //   — so it rides val() and is a legit pendant knob on the universal arm. `clearance` is ALSO pure `Z${clr}` but stays
    //   geometry: it is a Z WORD that shiftZ (the zOff path-offset) rewrites, so exposing it as a #var would change zOff's
    //   behaviour — GATED to the advisor rather than flipped (t1091 WORK-LOG). —
    line: { x0: 'geometry', y0: 'geometry', x1: 'geometry', y1: 'geometry', depth: 'geometry', stepdown: 'geometry', feed: 'value', clearance: 'geometry' },
    // t1391 — the `drill` and `bore` rows are GONE with their atoms. Their `feed: 'value'` is what t1389's holecycle row
    // had to preserve deliberately (an unlisted successor would have silently de-classified the family's one live knob);
    // the rest were 'geometry' because those kernels ran every number through num() into a JS loop, which is exactly the
    // property `holecycle` replaced and why its depth/peck/pitch could become 'value' at all.
    helix: { cx: 'geometry', cy: 'geometry', radius: 'geometry', depth: 'geometry', pitch: 'geometry', startAngle: 'geometry', seg: 'geometry', clearance: 'geometry' },
    dwell: { sec: 'geometry' },

    /**
     * — holecycle (t1385, THE SWITCH): the folded drill family. Declared because the switch made this atom the emitter for
     *   every drill and bore program, and an UNLISTED atom silently takes DEFAULT_ROLE — safe, but accidentally so. This
     *   row records that each key was LOOKED AT, which is the distinction this table exists to preserve.
     *
     *   `feed` IS THE ONE THAT CHANGES AN OUTCOME, and it is a regression this row repairs rather than a new capability:
     *   the literal `drill`/`bore` rows both declared `feed: 'value'` (t1091 measured it — feed appears only as a bare
     *   `F${feed}`, no test, no arithmetic, no loop bound), and the parametric body emits it exactly the same way. Falling
     *   to the unlisted default would have QUIETLY de-classified a knob the family already had.
     *
     *   THE ENTRY-GATE REASONING, per key — expose where the value genuinely rides through, bake where a pendant edit
     *   would kink the geometry:
     *     depth / peck / pitch  EXPOSABLE as of t1389 (ruled). The body reads `#81`/`#82`, so the loop was always live;
     *                           what blocked a knob was this atom seeding those registers through `r3(num(...))`, which
     *                           destroys a `#var` before it arrives. `val()` at the two assigns fixed that, and it is the
     *                           knob `opToSlot`/`opCamMap` recorded as impossible while the peck ladder was unrolled in
     *                           JS. Two consequences are deliberate and live in holecycle.js: the build-time bite FLOOR
     *                           does not apply to a live bite (the body's own `IF #82 <= 0` refusal covers it at run
     *                           time — the mechanism was written for exactly this), and `@work` is OMITTED whenever one
     *                           of these is live, because expected execution size cannot be known at build time and
     *                           t1383's rule is never to declare wrong.
     *     holeDia / toolDia     The cut RADIUS is (holeDia-toolDia)/2, folded at build into the arc's I/J vector and the
     *                           entry offset. A pendant edit would move the entry without moving the arc it must close —
     *                           a kinked circle. BAKE, and this one is not a limitation to lift later.
     *     the pattern geometry  Multiplied by BAKED trig (the bolt circle's rotation constants), so a #var cannot reach it
     *                           without the controller having verified trig. Already stated as SCOPE in holecycle.js.
     *     clearance             A Z WORD the frame printer folds; same call as every other kernel's clearance (t1091).
     *     the flow labels       Emitter-assigned per program (uniquifyFlowLabels), never operator values.
     */
    /**
     * — surfaceraster (t1399): the surfacing body, DECLARED at last. It was UNLISTED, so every key fell to DEFAULT_ROLE
     *   and read 'geometry' — safe, but by accident rather than by decision, and t1389 recorded that accident as though
     *   the table had an opinion ("atomRoles is RIGHT about surfacing"). It had none. This row is that opinion.
     *
     *   THE FOUR THAT ARE LIVE, and why each genuinely rides:
     *     feed / plunge   Each appears ONLY as a bare `F<word>` — checked, not assumed: neither is read by any
     *                     arithmetic in the file; both are threaded through as opts and printed. t1399 moved them to
     *                     val(), so a #var survives and a literal prints exactly what r3() printed.
     *     depth / stepdown  The body's loops read `#42`/`#43`, so the depth walk was always live at the MACHINE; what
     *                     blocked a knob was the seed printing through r3(num(...)). Now the seed rides a live word and
     *                     keeps the build-time floor for a typed number. The zero-advance hazard is covered by a guard
     *                     that was already in the body — `IF #43 <= 0 GOTO91`, read from the REGISTER at run time.
     *
     *   THE ENTRY-GATE REASONING on the rest — every one BAKES because a #var would be destroyed at BUILD time, not
     *   because it is unimportant:
     *     w / h              read by JS at build (the ring count takes Math.min(w,h); the helix clamp takes the inradius)
     *     toolDia / stepover / stepoverPct   the stepover mm is composed as `[tool * pct / 100]` from BAKED numbers, and
     *                     the helix radius is clamped against the tool at build
     *     rampAngle / helixDia / helixPitch  build-time trig and clamps decide whether the descent even fits
     *     clearance       a Z word the frame printer folds — the same call every kernel's clearance gets (t1091)
     *     confirmEvery    a build-time modulo that decides which levels emit a pause
     *     x / y / z0 / rotAngle / rotPivotX / rotPivotY   the FRAME, folded into every coordinate at build
     *     strategy / direction / entry / zMode  discrete selectors, never operator-tuned values
     *
     *   t1418 — `direction` IS READ BY THE WALK NOW (the row walk emits a one-way body for oneway/otherway), and the
     *   role is UNCHANGED because being read is not the question the role answers. It selects which walk gets WRITTEN,
     *   at build, so it is spent before any register exists: a #var there would be compared against the two one-way
     *   words, match neither, and silently produce the both-ways body. `other` says exactly that, and it says it more
     *   truthfully now than when the atom ignored the word entirely.
     */
    surfaceraster: {
        feed: 'value', plunge: 'value', depth: 'value', stepdown: 'value',   // t1399 — the four the seeds now carry
        w: 'geometry', h: 'geometry', toolDia: 'geometry', stepover: 'geometry', stepoverPct: 'geometry',
        rampAngle: 'geometry', helixDia: 'geometry', helixPitch: 'geometry',
        clearance: 'geometry', confirmEvery: 'geometry',
        x: 'geometry', y: 'geometry', z0: 'geometry', rotAngle: 'geometry', rotPivotX: 'geometry', rotPivotY: 'geometry',
        // t1404 — `inset` BAKES, and listing it is the t1399 lesson applied the moment the key is born rather than two
        // turns later: it is subtracted from w/h and added to x0/y0 at BUILD time, so a #var here becomes NaN before any
        // register exists. Its value comes from the consumer's own inset computation (pocketInsetRegion), which is
        // itself built from toolDia and wallOffset — both already baked, for the same reason.
        inset: 'geometry',
        strategy: 'other', direction: 'other', entry: 'other', zMode: 'other',
    },

    holecycle: {
        feed: 'value',
        depth: 'value', peck: 'value', pitch: 'value',   // t1389 — the two live registers, reachable at last
        holeDia: 'geometry', toolDia: 'geometry',
        x: 'geometry', y: 'geometry', z0: 'geometry', x0: 'geometry', y0: 'geometry', clearance: 'geometry',
        cols: 'geometry', rows: 'geometry', dx: 'geometry', dy: 'geometry', count: 'geometry',
        spacing: 'geometry', angle: 'geometry', dia: 'geometry', startAngle: 'geometry',
        w: 'geometry', h: 'geometry', nx: 'geometry', ny: 'geometry',
        pattern: 'other', cycle: 'other', skip: 'other',
        errLabel: 'geometry', errSkipLabel: 'geometry', skipLabel: 'geometry', reseedLabel: 'geometry', rectHLabel: 'geometry', rectVLabel: 'geometry',
    },

    // — Program framing —
    progstart: { rpm: 'geometry', dir: 'other', spinUp: 'geometry', clearance: 'geometry', skim: 'other' },   // rpm STAYS geometry (contrast spindle.rpm): headerBlock tests `num(rpm)>0` to GATE the M3 (cuttingBlocks.js:23-25), so a #var → NaN>0 false → the spindle-on line is silently DROPPED. t1091 probe confirmed: injecting a #var deletes `M3 S…`. NOT pure interpolation.
    progend: { spindleOff: 'other', coolantOff: 'other', retract: 'other', park: 'other', retractZ: 'geometry', parkX: 'geometry', parkY: 'geometry', end: 'other' },

    // — cnc.js (native canned cycles + I/O): drillcycle emits X/Y/Z/R/Q/P/F words but ALL via num() → geometry —
    pathmode: { mode: 'other', tol: 'geometry' },
    drillcycle: { cycle: 'other', x: 'geometry', y: 'geometry', z: 'geometry', r: 'geometry', q: 'geometry', dwell: 'geometry', feed: 'geometry' },
    outpin: { pin: 'geometry', state: 'other', sync: 'other' },
    waitinput: { pin: 'geometry', mode: 'other', timeout: 'geometry', var: 'other' },   // `var` (#5399) declared but never read in emit → metadata

    // — macro.js: raw / machine-move ride a #var through by string interpolation (NOT val, but still passthrough) → value —
    machinemove: { to: 'value', var: 'value', axis: 'other' },
    mcode: { code: 'geometry', note: 'other' },
    raw: { text: 'value' },   // whole-line escape hatch — anything, incl. a #var, rides through

    // — Variables / expr passthrough (raw `${expr}` interpolation, NOT val() — but a #var/[expr] still rides through) —
    assign: { var: 'value', value: 'value', note: 'other' },
    radiuscomp: { raw: 'value', result: 'value', radius: 'value', rawAxis: 'other', dir: 'other', enable: 'other', note: 'other' },

    // — Coordinates / state (all enum/bool selects) —
    distmode: { dist: 'other' },
    coolant: { flow: 'other' },
    comment: { text: 'other' },
    coordlist: { pts: 'other' },   // JSON metadata, never emitted

    // — HMI (operator strings + a few #var-target registers) —
    message: { text: 'other' },
    pauseconfirm: { msg: 'other' },
    hmiline: { value: 'value', note: 'other', var: 'value' },
    hmiconfirm: { value: 'value', note: 'other', cancel: 'geometry' },
    confirm: { msg: 'other', cancel: 'geometry', mode: 'other', pauseOnDegrade: 'other' },
    hmistatus: { mode: 'geometry', line: 'other', color: 'other', dwell: 'geometry' },   // color raw-interpolates (a #var rides) but is a discrete colour selector → 'other' (see the 'other' NB above)
    hmibeep: { dur: 'geometry', cyc: 'geometry' },
    asknumber: { var: 'value', prompt: 'other' },

    // — Control / data / flow: loop bounds, labels → geometry; reporters compute → geometry; goto targets are int labels —
    count: { var: 'other', from: 'geometry', to: 'geometry', by: 'geometry' },
    math: { a: 'geometry', op: 'other', b: 'geometry' },
    compare: { a: 'geometry', op: 'other', b: 'geometry' },
    label: { n: 'geometry' },
    goto: { n: 'geometry' },
    ifgoto: { lhs: 'value', op: 'other', rhs: 'value', goto: 'geometry' },

    // — Structural transform atoms (t1089 rider). These were the LAST atoms still falling through to DEFAULT_ROLE, so the
    //   fail-safe was silently absorbing them; declared here so the surface is HONEST rather than accidentally complete.
    //   Every row is still 'geometry'/'other' — the declaration changes NO classifier outcome, and that is the point: it
    //   records that we LOOKED, so a future reader can tell "verified bake-only" from "never enumerated". None of these
    //   atoms emits its params as a G-word: they drive JS-side folds/selectors, so a #var would be destroyed.
    toolsel: { toolNum: 'other' },                       // a tool-table INDEX (settings.atc.tools[toolNum]), not a tuned value
    wcs: { wcs: 'other' },                               // G54..G59 select
    entry: { entryX: 'geometry', entryY: 'geometry' },   // a JS-compared waypoint (firstRapidXY within eps), never emitted raw
    // placeonstock (kind 'place') / stepdown ('depth') / array ('container') are ALSO BLOCKING_FOLD_KINDS, so their CHILDREN
    // are blocked regardless; these rows cover the folds' OWN params.
    // t1406 — `role` joins the row THE TURN THE KEY IS BORN (t1399's lesson, applied on time): it is a build-time
    // IDENTITY label a binding spec matches on, never emitted and never an operator value → 'other'.
    placeonstock: { offX: 'geometry', offY: 'geometry', offZ: 'geometry', stockW: 'geometry', stockH: 'geometry', stockZ: 'geometry', bminX: 'geometry', bmaxX: 'geometry', bminY: 'geometry', bmaxY: 'geometry', stockAttach: 'other', pathDatum: 'other', stockDatum: 'other', optIn: 'other', role: 'other' },
    stepdown: { to: 'geometry', by: 'geometry', confirmEvery: 'geometry' },   // JS loop bound + step: the levels are unrolled at build
    array: { x0: 'geometry', y0: 'geometry', cols: 'geometry', rows: 'geometry', dx: 'geometry', dy: 'geometry', count: 'geometry', spacing: 'geometry', angle: 'geometry', dia: 'geometry', startAngle: 'geometry', w: 'geometry', h: 'geometry', nx: 'geometry', ny: 'geometry', pattern: 'other', skip: 'other' },   // patternPoints() computes every point in JS (num + Math.round/trig) and STAMPS the child per point
    contourfill: { x: 'geometry', y: 'geometry', w: 'geometry', h: 'geometry', dia: 'geometry', sides: 'geometry', tool: 'geometry', rampAngle: 'geometry', z: 'geometry', feed: 'geometry', plunge: 'geometry', clearance: 'geometry', shape: 'other', side: 'other', entry: 'other', by: 'other' },   // builds a JS contour region → every key runs num()

    // — measure.js: probe/DRO register targets + seek expr ride through → value; goto/eps are geometry —
    proberead: { axis: 'other', var: 'value' },
    probestart: { axis: 'other' },
    probecheck: { axis: 'other', goto: 'geometry', dir: 'other', seek: 'value', eps: 'geometry' },
    readmachine: { axis: 'other', var: 'value' },
    probeguard: { stopVar: 'value', limitVar: 'value', limitVal: 'value' },
    tooloffset: { tool: 'value', value: 'value' },
};

export const DEFAULT_ROLE = 'geometry';

/** DECLARED role for (atomType, key); any unlisted atom/key → DEFAULT_ROLE ('geometry' — the safe, bake-only default). */
export function paramRole(atomType, key) {
    const a = ATOM_ROLES[atomType];
    return (a && a[key]) || DEFAULT_ROLE;
}
