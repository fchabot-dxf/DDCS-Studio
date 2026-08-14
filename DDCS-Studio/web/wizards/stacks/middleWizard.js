/**
 * wizards/stacks/middleWizard.js — find the centre of a pocket (inside) or boss (outside).
 *
 * REWRITTEN AS A BLOCK STACK: `middleStack(params)` builds the probe macro from atoms (Comment / Set# /
 * Probe / If Goto / Move / Machine Move / Distance / Label / Goto / End Program) and `generate()` emits it.
 * A snippet (its own confirm + N1/N2 error handler + M30). Two-pass probe each wall, average to the centre;
 * 2-axis repeats on the perpendicular axis (in the chosen secondary direction) after a reposition.
 *
 * ── SUPERSET (E0, t371) ──────────────────────────────────────────────────────────────────────────────────
 * `middleStack(params, { superset:true })` seeds the data-TWIN as an ALL-ARMS-PRESENT template: every
 * STRUCTURAL fork (featureType / inAxis / transAxis / twoAxis / circular / probeZ / wcs / syncA) emits BOTH
 * arms, each wrapped in a `guard` block, so instantiate()/pruneGuards collapses it to either concrete shape.
 * Superset OFF (the built-in wizard + every existing caller/test) is BYTE-IDENTICAL to today. The same
 * cornerStack pattern (② B4 M2): a structural toggle becomes a re-authorable prune-selected branch of pure
 * DATA, not JS-locked structure. NOTE: axis / dir1 / dir2 and the numeric scalars are VALUE/order swaps, not
 * structural forks — they stay baked here and become bindings in E1 (the data-op + the feature-read slice).
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, stop #1905/#1906, limit #1915/#1916.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { num } from '../ops/util.js';
import { probeSurfaceStack, safeTraverseStack } from '../ops/probeSurface.js';   // the shared probe + travel primitives (middle composes them — t131 inc1, ① auto/manual travel)
import { safeRetractNode, clearTraverseParams, clearModeOf, resolveClearMode } from '../ops/safeZframe.js';   // t961 — resolveClearMode = the plane-guarantee backstop (folds plane->hop when WCS!=Active or no Z-first)   // t822 machine-frame safe-height retract; t909 B2 the declared clearance mode (t919 B2b-2a retired the frame-toggle park → always Max)

const AX = {
    X: { stop: '#1905', limit: '#1915', status: '#1920', result: '#1925', off: 0 },
    Y: { stop: '#1906', limit: '#1916', status: '#1921', result: '#1926', off: 1 },
    Z: { stop: '#1907', limit: '#1917', status: '#1922', result: '#1927', off: 2 },   // Z-surface (probe-Z-first) — reuses twoPass
};
const WCS_VALUES = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];

/** Middle params → its probe-macro block stack. The one source of truth for both displays.
 *  `opts.superset` (E0) seeds the TWIN with every structural arm present (each guarded) so pruneGuards can
 *  collapse it to any concrete shape. OFF is byte-identical to today (the built-in + all existing callers). */
/**
 * t1211 — THE ONE MIDDLE AXIS-ORDER RESOLVER (corner's `axesOf` counterpart).
 *
 * Which axis probes FIRST used to be re-derived, verbatim, at SEVEN sites — both sim providers, the two 2D handle
 * declarations, the built-in view, the legacy SVG animator, and the emit — each recomputing
 * `second = axis === 'X' ? 'Y' : 'X'` / `primaryX = axis !== 'Y'` from `params.axis`. Corner re-derives its order ZERO
 * times because it has one resolver; middle now does too, so the emit and the markers CANNOT disagree (the t1201
 * marker↔path symptom) and a declared order reaches every surface through a single expression.
 *
 * `axisOrder` ('XY' | 'YX') is the DECLARED param. Back-compat: when it is absent the order falls out of the legacy
 * `axis` (the old "primary axis" field), so every stored op and every existing caller resolves exactly as before —
 * the default is byte-identical. dir1 stays the first wall's direction; dir2 keeps its DERIVED default (the opposite
 * of dir1) rather than becoming a second stored constant.
 */
export const middleAxes = (p = {}) => {
    const order = ({ XY: 'XY', YX: 'YX' }[p.axisOrder]) || ((p.axis === 'Y') ? 'YX' : 'XY');
    const fA = order === 'YX' ? 'Y' : 'X';          // the FIRST-probed (primary) axis
    const sA = fA === 'X' ? 'Y' : 'X';              // the second-probed axis
    const dir1 = (p.dir1 || 'pos');
    const dir2 = (typeof p.dir2 === 'string') ? p.dir2 : (dir1 === 'pos' ? 'neg' : 'pos');
    return { order, fA, sA, dir1, dir2, dir1Plus: dir1 === 'pos', dir2Plus: dir2 === 'pos', primaryX: fA === 'X' };
};

export function middleStack(params = {}, opts = {}) {
    const featureType = params.featureType === 'boss' ? 'boss' : 'pocket';
    const approach = params.approach === 'manual' ? 'manual' : 'auto';   // LEGACY single toggle — the per-traverse default (back-compat)
    const oneMode = (v) => (v === 'manual' || v === 'auto') ? v : approach;
    const inAxis = oneMode(params.inAxis);        // INC3: wall1→wall2 WITHIN an axis — auto cross-over (#19/#20) vs manual jog
    const transAxis = oneMode(params.transAxis);   // INC3: X→Y BETWEEN axes — auto traverse (#21) vs manual jog
    const travelShape = params.travelShape === 'diagonal' ? 'diagonal' : 'dogleg';   // t383 (human) — the TRANS-axis AUTO route: dogleg (DEFAULT, routes AROUND the boss like corner) vs a single straight diagonal
    const _ax = middleAxes(params);   // t1211 — the ONE order source (emit + every sim/2D site read this)
    const axis = _ax.fA;
    const dir1Plus = _ax.dir1Plus;
    const twoAxis = !!params.twoAxis || !!params.findBoth;
    const circular = !!params.circular;   // round bore/boss: report the diameter (opposite-touch span) + re-centre between axes
    const probeZ = !!params.probeZ;   // probe-Z-first: two-pass the TOP surface + set Z0 BEFORE the XY centre-finding (its own declared sim pass)
    const second = _ax.sA;
    const resolvedDir2 = _ax.dir2;
    const dir2Plus = _ax.dir2Plus;
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const dist = num(params.dist, 200), retract = num(params.retract, 2);   // MAX PROBE default 200 (t381 — 20 was too small to reach the wall → the probe fired short + retracted → "retract-only")
    // t919 B2b-2a — RETIRED params.safeZ + params.safeZFrame: the end PARK now ALWAYS takes Max safe height (the ratified reading —
    // the relative park was the ORIGINAL crash cause), so there's no user Safe-Z field + no rel|mach toggle. #17 survives ONLY as
    // the DM500 work-frame degrade clearance (below), a WORK height distinct from the machine safe-Z margin.
    // t961 — the plane-guarantee BACKSTOP (one source: resolveClearMode): Plane needs the Active WCS + a Z datum first, else the
    // WORK-frame G90 Z<planeZ> traverse reads an unset WCS-Z and DESCENDS → fold to Hop + an honest comment (below).
    const requestedMode = clearModeOf(params.clearMode);
    const clearMode = resolveClearMode(params.clearMode, { wcs, zFirst: probeZ });
    const planeFellBack = requestedMode === 'plane' && clearMode !== 'plane';
    const hopDist = num(params.hopDist, 15);   // t913 B2b-1 — Hop mode: how far to lift (capped at the machine margin). Only emitted when clearMode==='hop'
    const planeZ = num(params.planeZ, 10);     // t913 B2b-1 — Plane mode: the absolute work-Z clearance plane. Only emitted when clearMode==='plane' (B2b-2 adds the not-below-stock floor)
    // t923 B2b-2b-cov — RETIRED clearOver/#18 (the TRAVERSE HEIGHT field): the in-axis cross-over now follows the CLEARANCE mode
    // (Max/Hop/Plane) like the trans-axis, so there's no separate traverse-height knob (one clearance concept, the user's decision).
    // Boss-AUTO probe-both: the in-axis wall1→wall2 cross-over — the straight TRAVERSE that spans the feature, SEPARATE
    // per axis (non-square boss). DECOUPLED from MAX PROBE: max-probe (#1) is the probe REACH (how far G31 searches);
    // the cross-over is the TRAVERSE DISTANCE (how far to move across) — different things. It can't be computed before
    // the probe (wall 2 is unknown), so it's USER-SET: a clean declared number ≈ feature width + 2×approach. Default 80
    // (a moderate feature ~50 + 2×15 approach); the user tunes it to span THEIR feature. (Was [#1+#2] — that conflated
    // reach with traverse and overshot when max-probe >> the feature.) String type → a raw expression still round-trips.
    const crossX = (params.crossX === '' || params.crossX == null) ? '80' : String(params.crossX);
    const crossY = (params.crossY === '' || params.crossY == null) ? '80' : String(params.crossY);
    // INC3: the TRANS-axis (X→Y) auto-traverse distance — a raw diagonal probe-move to the perpendicular walls. Default
    // 50 (a SANE fixed value, like the corner's travelDist) — NOT [#19+#20]/2 (≈ max-probe), which scaled with the probe
    // distance and overshot FAR off-stock when max-probe >> the feature. EDITABLE (the human tunes it so the 2nd-axis
    // probe reaches ②); the direction is verified-correct for all dir1/dir2 — only this magnitude was wrong. #21.
    const diagTravel = (params.diagTravel === '' || params.diagTravel == null) ? '50' : String(params.diagTravel);
    // B-TRANS fix (b): the diagonal's PRIMARY target — a #21-PEER for the primary axis. Default '#53' = re-centre to the
    // MEASURED centre (value-identical at rest); when the ② marker is placed it becomes ②'s primary coord (drag-derived,
    // like #21 derives the secondary) so the diagonal runs END-OF-X-PROBE → ②'s FULL position. Avoids the (separate-bug)
    // degenerate sim #53 on drag because #52 cancels: pmove = [#22-#52-rv±#6], tool at #52+rv+#6 → lands at #22.
    const diagPrimary = (params.diagPrimary === '' || params.diagPrimary == null) ? '#53' : String(params.diagPrimary);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const radius = num(params.radius, 2);   // stylus tip radius (#6) — for the DIAMETER (∓2r) + Z-surface (−r) comp; the CENTRE (bisect) needs none

    const superset = !!opts.superset;

    const S = [];
    // Returning block factories (return ONE block) — every arm composes these, then a fork helper decides guard-vs-concrete.
    const mkC = (t) => { const b = newBlock('comment'); b.params = { text: t }; return b; };
    const mkA = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; return b; };
    const mkGO = (n) => { const b = newBlock('goto'); b.params = { n }; return b; };
    const mkLB = (n) => { const b = newBlock('label'); b.params = { n }; return b; };
    const mkMM = (ax, ref, restore) => { const b = newBlock('machinemove'); b.params = { axis: ax, to: ref }; if (restore) b.params.restore = restore; return b; };
    const mkMV = (ax, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [ax.toLowerCase()]: v }; return b; };
    const mkMSG = (text) => { const b = newBlock('message'); b.params = { text }; return b; };
    const mkDM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; return b; };
    const mkEND = () => newBlock('endprogram');
    // F1/E3 — the proven profile-aware seams (inherited from corner/edge). Expert byte-identical; V4.1/DM500 fold. Middle's
    // WCS base is the BARE variant (no annotation comments); its WCS writes are DIRECT `#[#70+off]`; the sync is the indirect #883.
    const mkWcsBase = (w) => { const b = newBlock('wcsbaseinto'); b.params = { wcs: w, base: '#70', bare: true }; return b; };
    const mkWcsWrite = (spec) => { const b = newBlock('wcswrite'); b.params = { ...spec }; return b; };
    const wcsArgOf = (w) => (w === 'active' ? '#578' : String(parseInt(String(w).replace('G', ''), 10) - 53));
    const mkHMI = (value, note) => { const b = newBlock('hmiline'); b.params = { value: String(value), note: note || '' }; return b; };
    const mkConfirm = (value, note, cancel) => { const b = newBlock('hmiconfirm'); b.params = { value: String(value), note: note || '', cancel }; return b; };

    // ── SUPERSET fork helpers (E0) — each RETURNS the arm block(s): superset → guarded arms; concrete → the selected arm.
    // The GUARD wraps one fork arm gated by { param, is }; pruneGuards drops the false arms + unwraps the true one at build.
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    // t1211 — THE AXIS-ORDER FORK (corner's csFork counterpart). Which axis probes FIRST is a VALUE/ORDER swap: it changes
    // the G31 axis letters, the #51-#56 register order and the per-axis WCS writes. instantiate() prunes a STATIC template
    // and never rewrites params — a `move` block's x/y sockets are NAMED, so no binding can rename x→y — therefore BOTH
    // orders must be pre-built as guarded arms, exactly as corner does for corner×probeSeq. 2-WAY only: dir1/dir2 stay
    // baked (the user asked for the ORDER, not the directions). The guard reads `axisOrder`; a LEGACY op that stored only
    // the old `axis` gets it filled in by the twin's deriveGuards (middleAxes normalises axis→order), because whenOk is a
    // strict === and an absent key would drop BOTH arms.
    // t1237 — …and the DIRECTIONS join it. dir1/dir2 are the same class of thing as the order: a VALUE/ORDER swap that
    // changes G31 signs, the wall-face expressions and the register writes, none of which a binding can rewrite after
    // instantiate() prunes a static template. So the superset carries every combination as a nested guard chain
    // (order × dir1 × dir2 = 8 arms) and pruneGuards keeps the declared one. CONCRETE MODE IS UNTOUCHED — it still
    // calls fn(_ax) exactly once, so the default emit is byte-identical.
    // dir2's guard needs a VALUE even when the op never stored one (its default is DERIVED — the opposite of dir1), so
    // the twin's deriveGuards fills both through middleAxes; whenOk is a strict === and an absent key would drop every
    // arm (the trap axisOrder already taught us).
    const orderFork = (fn) => superset
        ? ['XY', 'YX'].flatMap((o) => ['pos', 'neg'].flatMap((d1) => ['pos', 'neg'].map((d2) =>
            GUARD({ param: 'axisOrder', is: o }, [
                GUARD({ param: 'dir1', is: d1 }, [
                    GUARD({ param: 'dir2', is: d2 }, fn(middleAxes({ ...params, axisOrder: o, dir1: d1, dir2: d2 }))),
                ]),
            ]))))
        : fn(_ax);
    const featBossOnly = (kids) => superset ? [GUARD({ param: 'featureType', is: 'boss' }, kids)] : (featureType === 'boss' ? kids : []);
    const inAxisFork = (autoKids, manualKids) => superset ? [GUARD({ param: 'inAxis', is: 'auto' }, autoKids), GUARD({ param: 'inAxis', is: 'manual' }, manualKids)] : (inAxis === 'manual' ? manualKids : autoKids);
    const inAxisAutoOnly = (kids) => superset ? [GUARD({ param: 'inAxis', is: 'auto' }, kids)] : (inAxis === 'auto' ? kids : []);
    const transAxisFork = (autoKids, manualKids) => superset ? [GUARD({ param: 'transAxis', is: 'auto' }, autoKids), GUARD({ param: 'transAxis', is: 'manual' }, manualKids)] : (transAxis === 'manual' ? manualKids : autoKids);
    const transAxisAutoOnly = (kids) => superset ? [GUARD({ param: 'transAxis', is: 'auto' }, kids)] : (transAxis === 'auto' ? kids : []);
    // travelShape (dogleg|diagonal) is an ENUM fork NESTED inside the trans-axis AUTO arm (the trans-axis DIAGONAL route only).
    const tsPair = (doglegKids, diagKids) => superset ? [GUARD({ param: 'travelShape', is: 'dogleg' }, doglegKids), GUARD({ param: 'travelShape', is: 'diagonal' }, diagKids)] : (travelShape === 'diagonal' ? diagKids : doglegKids);
    const twoAxisFork = (onKids, offKids) => superset ? [GUARD({ param: 'twoAxis', is: true }, onKids), GUARD({ param: 'twoAxis', is: false }, offKids)] : (twoAxis ? onKids : offKids);
    const twoAxisOnly = (kids) => superset ? [GUARD({ param: 'twoAxis', is: true }, kids)] : (twoAxis ? kids : []);
    const circularOnly = (kids) => superset ? [GUARD({ param: 'circular', is: true }, kids)] : (circular ? kids : []);
    const probeZFork = (onKids, offKids) => superset ? [GUARD({ param: 'probeZ', is: true }, onKids), GUARD({ param: 'probeZ', is: false }, offKids)] : (probeZ ? onKids : offKids);
    const probeZOnly = (kids) => superset ? [GUARD({ param: 'probeZ', is: true }, kids)] : (probeZ ? kids : []);
    const wcsLabelOf = (w) => (w === 'active' ? 'Active WCS' : w);
    // wcs is a 7-way enum fork: the base-address block ('active' reads #578 → computes #70; a fixed G54..G59 uses the literal
    // base) PLUS the derived wcsLabel (bleeds into the probeZ Z-save note). Returns fn(w,label) per value.
    const wcsFork = (fn) => superset ? WCS_VALUES.map((w) => GUARD({ param: 'wcs', is: w }, fn(w, wcsLabelOf(w)))) : fn(wcs, wcsLabel);

    // One two-pass wall touch via the shared PROBE-SURFACE BLOCK (t131), comp ON → the TRUE wall (the read becomes
    // `#result=[#trigger±#6]`). The centre bisect cancels the ∓#6 (same centre); the diameter ABS[s1-s2] is true (the old
    // ∓2#6 EVAPORATES); the Z-first comp relocates here from its inline −#6. All VALUE-IDENTICAL. RETURNS one touch.
    const touchR = (ax, plus, resultVar) => {
        const av = AX[ax];
        return probeSurfaceStack({
            axis: ax, dir: plus ? '+' : '-', probeVar: plus ? '#8' : '#7', retractVar: plus ? '#9' : '#10',
            stopVar: av.stop, limitVar: av.limit, limitVal: plus ? '2' : '1',
            feedFast: '#3', feedSlow: '#4', port: '#5', level: 0, twoPass: true,
            raw: av.result, rawAxis: ax, result: resultVar, radius: '#6', compEnable: true,   // rawAxis → trigger folds per post
        });
    };
    // t824/t826 — the retreat-to-clear before the operator jogs was an incremental G0 Z#17 lift (compounds into the top
    // switch from a high start). It now retracts to the DECLARED MACHINE MARGIN (machineLift → safeRetractNode → G53,
    // limit-proof); the sim preview MODELS this mid-program G53 (t826), so each pass stays anchored to its own start marker
    // (the "REPOSITION:" comment still delimits the pass).
    // t897 — the drop-back is now HONEST: the old −#17 (`[0-#17]`) was a RELATIVE drop off an ABSOLUTE margin lift → it landed
    // an arbitrary Z (the user's "Safe-Z changes nothing" symptom). returnZ '#95' saves the pre-lift Z (doLift → saveMachineZNode)
    // and returns to it (G53 Z#95), so the next wall probes from the SAME Z. drop=true is now a presence gate (the target is #95).
    const repositionR = (msg) => {   // t901 — the safetraverse BUNDLE (manual jog reposition: machine lift + jog + honest return)
        const b = newBlock('safetraverse');
        b.params = { to: 'next-wall', shape: 'jog' };
        b.children = safeTraverseStack({
            approach: 'manual', lift: true, machineLift: true, drop: true, returnZ: '#95',   // t919 — lift is just a presence GATE (machineLift → the #520 margin); #17's value no longer feeds the reposition lift
            comment: `REPOSITION: ${msg || 'jog the probe to the next wall'}`,
        });
        return [b];
    };
    // Boss, AUTO in-axis: clear over the feature to the far side, hands-free (the #19/#20 cross-over spans the feature). RETURNS.
    // t923 B2b-2b-cov — the in-axis cross-over now READS THE CLEARANCE MODE (clearTraverseParams), exactly like the trans-axis
    // traverse, so the CLEARANCE dropdown drives it too (closing the single-axis coverage gap). The #19/#20 HORIZONTAL cross is
    // PRESERVED (the X/Y CROSS-OVER distance fields stay); the old relative Z#18 lift/drop is replaced by the mode's lift + the
    // honest save #95 / G53 return pairing (Max = the #520 machine margin; Hop = the capped hop; Plane = the absolute work-Z).
    // Retired #18/clearOver (the TRAVERSE HEIGHT field) — Max is now the full-retract safe default; Hop restores the fast ~15mm.
    const traverseOverR = (ax, firstPlus) => {
        const cv = ax === 'X' ? '#19' : '#20';
        const b = newBlock('safetraverse');
        b.params = { to: 'opposite-wall', shape: 'cross' };
        b.children = safeTraverseStack({
            mode: 'in-axis', axis: ax,
            move: firstPlus ? cv : `[0-${cv}]`,   // the #19/#20 in-axis cross (PRESERVED — the CROSS-OVER distance)
            ...clearTraverseParams(clearMode, { hopDist, planeZ }),   // Max/Hop/Plane lift + honest save/return (like transTraverseR)
        });
        return [b];
    };
    // Boss, AUTO trans-axis: the X→Y CONNECTING move (lift → re-centre-primary + travel-out-secondary → return → REPOSITION mark).
    // Routed through the shared safeTraverseStack `mode:'center'` — middle no longer hand-rolls the diagonal: it assigns #22
    // (=diagPrimary; #53 re-centre at rest, ②'s primary coord when placed), moves the primary to #22 (the #52/retract/±#6
    // cancel so it lands exactly on #22) + the secondary out by the Diag-travel #21, then marks the REPOSITION so the trace
    // anchors the NEXT pass to ②. RETURNS.
    // t909 B2 — THE UNIFICATION: the lift/drop is now the DECLARED clearance mode (clearTraverseParams, `max` default) instead
    // of the old +#18/-#18 relative hop that FROZE the divergence from corner. `max` lifts to the #520 MACHINE MARGIN + returns
    // to the SAVED probe Z (the same t826/t897 machineLift+returnZ pairing corner's repoTraverse + middle's manual reposition
    // already use) — so the trans-axis traverse clears the boss by the SAME margin as everything else (higher = safer), and the
    // drop-back is honest by construction (never lift-to-margin + a relative drop = an arbitrary Z). Emit DELIBERATELY changes
    // (row-4 golden regenerates — byte-identity was what held the divergence). t923 — the in-axis traverse-OVER now reads it too.
    const transTraverseR = (shape, ax = _ax) => {   // t901 — the safetraverse BUNDLE (auto trans-axis connect: lift + shaped re-centre/travel + honest return); t1211 — per resolved order
        const b = newBlock('safetraverse');
        b.params = { to: 'perp-walls', shape };
        b.children = safeTraverseStack({
            mode: 'center', axis: ax.fA, second: ax.sA,
            dir1Plus: ax.dir1Plus, dir2Plus: ax.dir2Plus, diagPrimary, diagTravel: '#21', wall2Var: '#52', radiusVar: '#6',
            ...clearTraverseParams(clearMode, { hopDist, planeZ }),   // t909 B2 — UNIFY to the declared clearance (max = the #520 machine margin + honest save/return, like corner); t913 — hop/plane read their fields
            comment: 'REPOSITION: auto-traverse to the perpendicular walls',
            dogleg: shape === 'dogleg',   // t383 — DOGLEG (default): secondary out first, then re-centre primary; diagonal: one straight move
        });
        return [b];
    };
    // The two opposite walls' BETWEEN move. POCKET probes both from the centre (nothing). BOSS needs the 2nd face from the
    // far side: the IN-AXIS toggle — MANUAL pauses for the operator to jog over, AUTO traverses over hands-free. RETURNS.
    const betweenR = (ax, firstPlus) => featBossOnly(inAxisFork(traverseOverR(ax, firstPlus), repositionR('jog clear, around to the opposite wall')));
    // One axis's two-wall sequence: touch → between → touch → centre-bisect (∓#6 cancels). RETURNS.
    const seqR = (ax, firstPlus, base) => [
        ...touchR(ax, firstPlus, `#${base}`),
        ...betweenR(ax, firstPlus),
        ...touchR(ax, !firstPlus, `#${base + 1}`),
        mkA(`#${base + 2}`, `[#${base}+#${base + 1}]/2`),   // centre = midpoint of the two (now radius-comped) walls — ∓#6 cancels
    ];

    // ── Configuration ──
    if (planeFellBack) S.push(mkC('Clearance plane needs the Active WCS + a Z datum - using Hop'));   // t961 — the plane-guarantee backstop's honest comment (middle has no data-op twin, so it stands alone here)
    S.push(mkA('#1', dist, 'Max probe distance'), mkA('#2', retract, 'Retract distance'));
    S.push(mkA('#3', fFast, 'Fast feedrate'), mkA('#4', fSlow, 'Slow feedrate'), mkA('#5', port, 'Probe port'));
    S.push(mkA('#6', radius, 'Probe stylus radius'));   // declared ONE source for the comp — now EVERY wall touch comps via the block (not just circular/Z)
    S.push(mkA('#51', 0, 'Wall 1 pos'), mkA('#52', 0, 'Wall 2 pos'), mkA('#53', 0, 'Center pos'));
    S.push(mkA('#54', 0, 'Wall 3 pos'), mkA('#55', 0, 'Wall 4 pos'), mkA('#56', 0, 'Center pos 2'));
    S.push(mkA('#7', '[0-#1]', 'Negative max probe'), mkA('#8', '#1', 'Positive max probe'));
    // t919 B2b-2a — #17 is now ONLY the DM500 work-frame degrade clearance (DM500 has no G53 → safeRetract degrades to G0 Z#17).
    // A sensible fixed WORK height (mm above work-0), distinct from the machine safe-Z margin (a below-home machine Z) — sourcing
    // it from abs(margin) would be a category-confusion that silently shrinks the DM500 clearance, so keep the established 10.
    S.push(mkA('#9', '[0-#2]', 'Negative retract'), mkA('#10', '#2', 'Positive retract'), mkA('#17', 10, 'DM500 work-frame safe clearance (mm above work-0; DM500 has no G53) - other posts park at the machine margin'));
    // t923 — #18 (Traverse-over clearance) RETIRED: the in-axis cross-over reads the clearance MODE (machine margin / hop / plane).
    // #19/#20 = the IN-axis cross-over (traverseOver — boss + inAxis auto ONLY); #21 = the TRANS-axis Diag travel
    // (transTraverse — boss + transAxis auto + twoAxis ONLY). Each present only when its own auto-traverse is active, so
    // pocket/manual macros stay unchanged. (#21 is a fixed default; the trans-axis re-centres to #53, so it no longer needs #19/#20.)
    S.push(...featBossOnly(inAxisAutoOnly([
        mkA('#19', crossX, 'X cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)'),
        mkA('#20', crossY, 'Y cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)'),
    ])));
    S.push(...featBossOnly(transAxisAutoOnly(twoAxisOnly([
        mkA('#21', diagTravel, 'Diag travel: X→Y trans-axis auto-traverse distance (default 50; tune so the 2nd-axis probe reaches ②)'),
    ]))));
    // NOTE: #22 (the diagonal's primary target) is assigned INSIDE transTraverse — AFTER the primary seq measures #53 —
    // because at rest diagPrimary='#53' and #53 is only known post-probe (assigning it here would capture #53's initial 0).
    // ── WCS base address ── 7-way wcs fork via the wcsbaseinto atom (bare: middle omits the comments): Expert 'active' reads
    // #578→#70 / a fixed G54..G59 uses the literal base (byte-identical); posts with no WCS table (V4.1/DM500 G92) emit nothing.
    S.push(...wcsFork((w) => [mkWcsBase(w)]));
    // ── Confirm start ── KIND-B, 2-way: the prompt text forks on probeZ (Hover OVER the top vs Press Enter to probe). The
    // spaced prompt + the ESC IF are ONE hmiconfirm now → off-HMI BOTH fold to a comment (KILLS the live V4.1/DM500 mis-branch:
    // today the ESC `IF #1505==0 GOTO2` emitted with #1505 never set → the probe was SKIPPED). Expert byte-identical.
    S.push(...probeZFork(
        [mkConfirm('1', 'Hover OVER the stock top (Z datum first). Press Enter - ESC=cancel', 2)],
        [mkConfirm('1', 'Press Enter to probe - ESC=cancel', 2)],
    ));
    S.push(mkDM('inc'));

    // PROBE-Z-FIRST (declaration): set the Z datum BEFORE the XY work, REUSING middle's own twoPass (no corner copy / no dup),
    // then REUSE reposition() to move to the first wall. The Z probe is its OWN pass (the "REPOSITION:" reposition emits marks
    // the XY as the next pass) → opSimStarts declares a leading Z-pass start so the sim renders Z-pass → reposition → XY faithfully.
    // The Z-save NOTE carries wcsLabel → forks on wcs (via wcsFork inside the probeZ guard).
    S.push(...probeZOnly([
        mkC('Z Surface - set Z datum first'),
        ...touchR('Z', false, '#57'),                       // two-pass down-probe the top → #57 = the TRUE surface (the block comps it; −#6 relocated here)
        // t1868 — restore:'inc': repositionR below runs in the same G91 body; same machine-safety gap as
        // corner's own wall writes (G90/G91 are persistent modal codes on real hardware, not just in the sim).
        ...wcsFork((w, label) => [mkWcsWrite({ axis: 'Z', wcs: wcsArgOf(w), offset: 2, value: '#57', note: `Save ${label} Z offset`, direct: true, restore: 'inc' })]),   // Z0 write (#57 comped); Expert #[#70+2]=#57 / else G92 Z#57 + G91 restore
        ...repositionR('jog clear, to the first wall'),      // Z pass done → reposition to the XY start (existing helper)
    ]));

    // t1211 — THE ORDER-DEPENDENT REGION, built per axis order. Everything below reads the RESOLVED order (ax) instead of
    // the outer `axis`/`second`, so `orderFork` can emit both arms into the superset and pruneGuards keeps the declared one.
    // In concrete mode this runs exactly once with the resolved order → byte-identical to before.
    const orderRegion = (ax) => {
        const a1 = ax.fA, a2 = ax.sA;
        const twoAxisOn = [
            ...featBossOnly(transAxisFork(tsPair(transTraverseR('dogleg', ax), transTraverseR('diagonal', ax)), repositionR('jog clear, around to the perpendicular walls'))),
            ...circularOnly([mkMM(a1, '#53')]),
            mkC(`2axis_${a1 === 'X' ? 'XtoY' : 'YtoX'}_${ax.dir2}`),
            ...seqR(a2, ax.dir2Plus, 54),
            safeRetractNode({ restore: 'inc' }),   // t919 B2b-2a — the end PARK always takes MAX safe height (per-post: G53 posts → #520 machine margin; DM500 → work-frame degrade). Retired the rel|mach frame toggle (the relative park was the crash cause). t856 — inside the G91 body → G90-wrap, restore G91
            // #53 = centre of the PRIMARY axis, #56 = centre of the SECONDARY — write each to ITS axis's WCS offset
            // (not hardcoded X=0/Y=1, which swapped them when the primary axis was Y).
            mkWcsWrite({ axis: a1, wcs: wcsArgOf(wcs), offset: AX[a1].off, value: '#53', direct: true }), mkWcsWrite({ axis: a2, wcs: wcsArgOf(wcs), offset: AX[a2].off, value: '#56', direct: true }),
        ];
        const twoAxisOff = [
            safeRetractNode({ restore: 'inc' }),
            mkWcsWrite({ axis: a1, wcs: wcsArgOf(wcs), offset: AX[a1].off, value: '#53', direct: true }),
        ];
        return [...seqR(a1, ax.dir1Plus, 51), ...twoAxisFork(twoAxisOn, twoAxisOff)];
    };
    S.push(...orderFork(orderRegion));

    // ── Circular (optional) ── round feature: the opposite-touch span IS the diameter (walls already radius-comped, so the old
    // ∓2#6 EVAPORATES). #58 = primary Ø; with 2-axis, #59 = perpendicular Ø, #60 the mean, #61 out-of-round. ABS → dir-agnostic.
    S.push(...circularOnly([
        mkA('#58', 'ABS[#51-#52]', 'Primary-axis diameter (walls already radius-comped)'),
        ...twoAxisOnly([
            mkA('#59', 'ABS[#54-#55]', 'Secondary-axis diameter (walls already radius-comped)'),
            mkA('#60', '[#58+#59]/2', 'Mean diameter'),
            mkA('#61', '[#58-#59]', 'Out-of-round (primary dia - secondary dia)'),   // roundness metric (same as the Circular wizard)
        ]),
        ...twoAxisFork([mkMSG('Centre #53/#56 - mean dia #60 - round #61')], [mkMSG('Centre #53 - dia #58')]),
    ]));

    // ── Dual-gantry sync (optional) ── a bool block-add guarded on syncA, gated ALSO by (axis==='Y' || twoAxis). axis is baked
    // here (a value swap, not a structural fork), so in the superset the (axis==='Y') half is a compile-time constant: axis 'Y'
    // → syncA-only; axis 'X' → syncA nested in twoAxis. Concrete matches the same condition. (slave stays baked — a value follow-on.)
    const slave = params.slave || '3';
    // Expert `#74=[#70+slave]`+`#[#74]=#883` (byte-identical); #883 has no cross-post equivalent → honest comment off-Expert.
    const syncKids = [mkWcsWrite({ axis: 'A', wcs: wcsArgOf(wcs), offset: Number(slave), addrVar: '#74', value: '#883', offComment: 'Dual-gantry A sync skipped — no #883 slave-DRO equivalent on this controller' })];
    if (superset) {
        // t1211 — the A-sync applies when the Y axis is probed at all: as the PRIMARY (order YX) or as the secondary
        // (twoAxis). This used to bake `axis === 'Y'` at TEMPLATE-BUILD time, so with a declared order the twin would
        // silently diverge from the built-in for order=YX ∧ syncA ∧ !twoAxis. Guard it on the derived order instead.
        const gated = [
            GUARD({ param: 'axisOrder', is: 'YX' }, syncKids),
            GUARD({ param: 'axisOrder', is: 'XY' }, [GUARD({ param: 'twoAxis', is: true }, syncKids)]),
        ];
        S.push(GUARD({ param: 'syncA', is: true }, gated));
    } else if (params.syncA && (axis === 'Y' || twoAxis)) {
        S.push(...syncKids);
    }

    // ── Footer + error handler ── the bare #1505 success/fail codes via hmiline (Expert #1505=<v>; off-HMI nothing, no text).
    S.push(mkDM('abs'), mkHMI('-5000', ''), mkGO(2));
    S.push(mkLB(1), safeRetractNode(), mkHMI('1', ''), mkLB(2), mkEND());   // t822 — machine-frame G53 retract (was mkDM inc/mkMV Z#17/mkDM abs — incremental crash vector)
    return S;
}
