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

    // — Toolpath kernels: build a JS loop → EVERY key runs num() (incl. feed + the X/Y coord words) → geometry —
    line: { x0: 'geometry', y0: 'geometry', x1: 'geometry', y1: 'geometry', depth: 'geometry', stepdown: 'geometry', feed: 'geometry', clearance: 'geometry' },
    drill: { x: 'geometry', y: 'geometry', depth: 'geometry', peck: 'geometry', feed: 'geometry', clearance: 'geometry', zOff: 'geometry' },
    bore: { x: 'geometry', y: 'geometry', holeDia: 'geometry', toolDia: 'geometry', depth: 'geometry', pitch: 'geometry', feed: 'geometry', clearance: 'geometry', ramp: 'other', zOff: 'geometry' },
    helix: { cx: 'geometry', cy: 'geometry', radius: 'geometry', depth: 'geometry', pitch: 'geometry', startAngle: 'geometry', seg: 'geometry', clearance: 'geometry' },
    dwell: { sec: 'geometry' },

    // — Program framing —
    progstart: { rpm: 'geometry', dir: 'other', spinUp: 'geometry', clearance: 'geometry', skim: 'other' },   // rpm is num() here (contrast spindle.rpm)
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
    placeonstock: { offX: 'geometry', offY: 'geometry', offZ: 'geometry', stockW: 'geometry', stockH: 'geometry', stockZ: 'geometry', bminX: 'geometry', bmaxX: 'geometry', bminY: 'geometry', bmaxY: 'geometry', stockAttach: 'other', pathDatum: 'other', stockDatum: 'other', optIn: 'other' },
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
