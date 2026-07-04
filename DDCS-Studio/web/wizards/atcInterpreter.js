/**
 * wizards/atcInterpreter.js — the choreography INTERPRETER (RE-PLAN #2, I4).
 *
 * Walks a combo's declared MOTION.steps (atcModel MOTIONS) and produces a SIM-ONLY G-code path that drives the preview:
 * positions resolved from the LAYOUT, grip release/clamp M-codes from the GRIP, the #1300 swap at the pick. So ANY
 * declared combo — including a from-zero / RapidChange config (magnet × plunge × linear) that has no hand-written stack —
 * SIMS by walking its steps, not just the 3 hard-coded presets.
 *
 * SIM-ONLY: this is the VISUALIZATION path, NOT the emit — the real emit is the controller M6 / T.nc call (I5). The 3
 * shipped presets keep their existing played-inline sim (byte + sim identical); the interpreter drives NEW combos only.
 */
import { num } from './ops/util.js';

const r = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Resolve a step's LAYOUT position ref → {x,y,z} (or null).
function resolveRef(ref, ctx) {
    switch (ref) {
        case 'cur.pocket': return ctx.cur;
        case 'target.pocket': return ctx.target;
        case 'pickup': return ctx.pickup || ctx.target;
        case 'station.start': return ctx.station && ctx.station.start;
        case 'station.end': return ctx.station && ctx.station.end;
        case 'station.retreat': return ctx.station && ctx.station.retreat;
        case 'station.z': return ctx.station || null;
        default: return null;
    }
}
const _codeNum = (x) => parseInt(String(x || '').replace(/[^0-9]/g, ''), 10);

// Resolve a grip action's M-code + sensor wait from the USER's ATC I/O table (io = { outputs, inputs } = settings.outputs /
// settings.inputs, NOT settings.atc). ONE SOURCE for the machine's codes (I5b-3 INC1: the drawbar fn). Keeps GRIPS dumb:
// the action declares fn+edge (→ the output row's on/offCode) + waitFn (→ the sensor's waitCode) + a canonical DEFAULT.
// fork A: the drawbar output is matched by row TYPE (stable — survives a code edit, exactly generateToolChangeNc's link).
export function resolveAction(action, io) {
    if (!action) return action;
    const outputs = (io && io.outputs) || [], inputs = (io && io.inputs) || [];
    let code = action.code;
    if (action.fn === 'drawbar') {
        const row = outputs.find((o) => o && o.type === 'drawbar');
        if (row) { const c = action.edge === 'off' ? row.offCode : row.onCode; if (c) code = c; }
    }
    let wait = action.wait;
    if (action.waitFn) {   // the seeded ATC sensor (stable id `<waitFn>_atc`), else an atc input carrying the canonical waitCode
        const row = inputs.find((i) => i && i.group === 'atc' && (i.id === action.waitFn + '_atc' || _codeNum(i.waitCode) === _codeNum(action.wait)));
        if (row && row.waitCode) wait = row.waitCode;
    }
    return { ...action, code, wait };
}

const emitActions = (list, io, lines) => (list || []).forEach((a) => { const rr = resolveAction(a, io); if (rr && rr.code) lines.push(rr.code); });

/** Walk combo.motion.steps → a SIM-ONLY G-code path (drives the played preview). ctx = the resolved LAYOUT positions
 *  (cur/target pockets · pickup · station) + a demo cur→target tool change (curTool/targetTool) + safeZ. */
export function motionToSimGcode(combo, ctx = {}) {
    if (!combo || !combo.motion || !Array.isArray(combo.motion.steps)) return '';
    const grip = combo.grip || {};
    const safeZ = num(ctx.safeZ, 10);
    const lines = [`( ${combo.motionKind} sim - ${combo.gripKind} grip - interpreter walk )`];
    if (ctx.curTool != null) lines.push(`#1300=${ctx.curTool}`);
    const xy = (p) => `X${r(p.x)} Y${r(p.y)}`;
    for (const st of combo.motion.steps) {
        const p = st.ref ? resolveRef(st.ref, ctx) : null;
        switch (st.step) {
            case 'safeZ': case 'retract': lines.push(`G53 G0 Z${r(safeZ)}`); break;   // G53 — the ATC positions are MACHINE coords (robust to a WCS offset)
            case 'travelZ': lines.push(`G53 G0 Z${r(p && p.z != null ? p.z : safeZ)}`); break;
            case 'travelXY': if (p) lines.push(`G53 G0 ${xy(p)}`); break;
            case 'descend': if (p) lines.push(`G53 G1 Z${r(p.z)} F800`); break;   // the plunge into the dock/pocket
            case 'orient': lines.push('M19'); break;
            case 'dwell': lines.push('G04 P0.3'); break;
            case 'grip.pre': emitActions(grip.pre, ctx.io, lines); break;
            case 'grip.release': emitActions(grip.release, ctx.io, lines); break;   // empty for a magnet grip (the plunge does it)
            case 'grip.post': emitActions(grip.post, ctx.io, lines); break;
            case 'grip.clamp':
                emitActions(grip.clamp, ctx.io, lines);
                if (ctx.targetTool != null) lines.push(`#1300=${ctx.targetTool}`);   // the pick grabs the new tool → the swap fires
                break;
            case 'rotate': break;   // disk — the ring rotates in the sim; no XY move
            default: break;
        }
    }
    lines.push(`G53 G0 Z${r(safeZ)}`, 'M30');
    return lines.join('\n');
}

// Grip actions → G-code lines (the M-code + its DECLARED settle dwell + its sensor wait, all optional). Generic — no
// gripKind branch: a drawbar action declares {code,dwell,wait} → M154/G04 P500/M301; a magnet action list is empty.
const gripLines = (list, io) => (list || []).flatMap((a0) => {
    const a = resolveAction(a0, io);
    if (!a || !a.code) return [];
    const out = [a.code];
    if (a.dwell != null && a.dwell !== '') out.push(`G04 P${a.dwell}                          ; settle dwell`);
    if (a.wait) out.push(`${a.wait}                              ; wait sensor`);
    return out;
});
// The OPEN-to-proceed form (fetch pre-open): actuate + wait, but NO settle dwell — you open the collet + wait for it,
// then descend ONTO the tool (no dwell needed; the dwell is for actuate-and-hold: the return-release + the clamp).
const gripOpen = (list, io) => (list || []).flatMap((a0) => { const a = resolveAction(a0, io); return (a && a.code) ? (a.wait ? [a.code, `${a.wait}                              ; wait sensor`] : [a.code]) : []; });

/**
 * The interpreter EMIT path (I5) — walk a combo's MOTION + GRIP → a T.nc O-PROGRAM (a STANDALONE tool-change macro),
 * NOT inline: an O-number header + the per-dock tool-change G-code (G53 moves; the descend is a G1 PLUNGE for a plunge
 * motion, else a G0; the grip release/clamp M-codes + waits — empty for a magnet grip) + M99 (subprogram return). The
 * controller runs it on `Tn M6` (#1504=requested, #1300=spindle); a cutting program CALLS it via `T# M6`, never inlines
 * it. This makes a from-zero / RapidChange config FULLY functional (sim I4 + emit I5). The 3 shipped presets keep their
 * own emit (generateToolChangeNc / the stacks) — converging them onto this is a separate byte-tested step (I5b).
 */
export function motionToTnc(combo, atc = {}, opts = {}) {
    if (!combo || !combo.motion) return '';
    const grip = combo.grip || {};
    const mag = (Array.isArray(atc.magazine) ? atc.magazine : []).filter((p) => p && p.tool !== '' && p.tool != null);
    const safeZ = num(atc.safeZ, 10), oNum = opts.oNumber || 1000, feed = num(opts.feed, 800), io = opts.io;   // io = { outputs, inputs } → resolveAction reads the user's codes
    const isPlunge = combo.motionKind === 'plunge';
    const descend = (z) => isPlunge ? `G53 G1 Z${z} F${feed}         ; plunge into the dock (magnet grabs/releases mechanically)` : `G53 G0 Z${z}`;
    const preOpen = (grip.release || []).length > 0 && !isPlunge;   // the FETCH opens the grip before descending (drawbar), not a magnet

    const L = []; const w = (s) => L.push(s);
    w(`O${oNum} (${combo.gripKind} x ${combo.motionKind} tool-change macro - DDCS Studio)`);
    w('(GENERATED from the composable ATC config - review every line + dry-run before cutting. NOT validated on a live ATC.)');
    w(`(STANDALONE macro: the controller runs it on Tn M6. #1504=requested  #1300=spindle  ${mag.length} docks)`);
    w('IF #1504==#1300 GOTO999            ; requested tool already in spindle');
    w('M5  M9                             ; spindle + coolant OFF');
    if (grip.stopWait) w(`${grip.stopWait}                              ; wait: spindle stopped (SAFETY)`);   // declared grip.stopWait — never dropped
    w(`#4 = ${safeZ}`);
    w('G53 G0 Z#4                         ; lift to safe Z');
    w('(===== return the current tool to its dock =====)');
    w('IF #1300==0 GOTO500               ; spindle empty - nothing to return');
    mag.forEach((p, i) => w(`IF #1300==${num(p.tool, 0)} GOTO${101 + i}`));
    w('GOTO500');
    mag.forEach((p, i) => {
        w(`N${101 + i} (return T${num(p.tool, 0)} to dock ${num(p.pocket, i + 1)})`);
        w(`#1 = ${num(p.x, 0)}  #2 = ${num(p.y, 0)}  #3 = ${num(p.z, 0)}`);
        w('G53 G0 X#1 Y#2'); w(descend('#3')); gripLines(grip.release, io).forEach(w); w('G53 G0 Z#4'); w('GOTO500');
    });
    w('N500 (===== fetch the requested tool =====)');
    mag.forEach((p, i) => w(`IF #1504==${num(p.tool, 0)} GOTO${201 + i}`));
    w('#1505 = 1(Tool not in magazine!) ; requested tool has no dock');
    w('GOTO999');
    mag.forEach((p, i) => {
        w(`N${201 + i} (fetch T${num(p.tool, 0)} from dock ${num(p.pocket, i + 1)})`);
        w(`#1 = ${num(p.x, 0)}  #2 = ${num(p.y, 0)}  #3 = ${num(p.z, 0)}`);
        w('G53 G0 X#1 Y#2'); if (preOpen) gripOpen(grip.release, io).forEach(w); w(descend('#3')); gripLines(grip.clamp, io).forEach(w);
        w('G53 G0 Z#4'); w('#1300 = #1504               ; record the new tool'); w('GOTO999');
    });
    w('N999'); w('M99');
    return L.join('\n');
}

/** Build the interpreter context from settings.atc + the resolved pockets (magazinePockets): the first two occupied
 *  pockets become a demo cur→target change, so the wizard preview plays a full plunge + swap. */
export function interpCtxFromAtc(atc, pockets, io) {
    const pk = (Array.isArray(pockets) ? pockets : []).filter((p) => p && p.tool);
    const cur = pk[0] || null, target = pk[1] || pk[0] || null;
    const toolNum = (p) => (p && p.tool && p.tool.num != null ? p.tool.num : (p && p.tool)) || null;
    const pos = (p) => (p ? { x: p.x, y: p.y, z: p.z } : null);
    // The firmware PUSH station (settings.atc.firmwareStation, GUI-1) → ctx.station, so the push motion's
    // station.start/end/retreat/z refs resolve to the taught points (else no station travel — INC-A firmware degrade).
    const fw = atc && atc.firmwareStation;
    const station = fw ? { start: fw.pushStart || null, end: fw.pushEnd || null, retreat: fw.retreat || null, z: num(fw.safeZ, 0) } : null;
    return {
        safeZ: num(atc && atc.safeZ, 10),
        cur: pos(cur), target: pos(target), pickup: atc && atc.pickup, station,
        curTool: toolNum(cur), targetTool: toolNum(target),
        io: io || null,   // { outputs, inputs } → resolveAction reads the user's M-codes (INC1: drawbar)
    };
}
