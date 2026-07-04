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
const emitActions = (list, lines) => (list || []).forEach((a) => { if (a && a.code) lines.push(a.code); });

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
            case 'safeZ': case 'retract': lines.push(`G0 Z${r(safeZ)}`); break;
            case 'travelZ': lines.push(`G0 Z${r(p && p.z != null ? p.z : safeZ)}`); break;
            case 'travelXY': if (p) lines.push(`G0 ${xy(p)}`); break;
            case 'descend': if (p) lines.push(`G1 Z${r(p.z)} F800`); break;   // the plunge into the dock/pocket
            case 'orient': lines.push('M19'); break;
            case 'dwell': lines.push('G04 P0.3'); break;
            case 'grip.pre': emitActions(grip.pre, lines); break;
            case 'grip.release': emitActions(grip.release, lines); break;   // empty for a magnet grip (the plunge does it)
            case 'grip.post': emitActions(grip.post, lines); break;
            case 'grip.clamp':
                emitActions(grip.clamp, lines);
                if (ctx.targetTool != null) lines.push(`#1300=${ctx.targetTool}`);   // the pick grabs the new tool → the swap fires
                break;
            case 'rotate': break;   // disk — the ring rotates in the sim; no XY move
            default: break;
        }
    }
    lines.push(`G0 Z${r(safeZ)}`, 'M30');
    return lines.join('\n');
}

/** Build the interpreter context from settings.atc + the resolved pockets (magazinePockets): the first two occupied
 *  pockets become a demo cur→target change, so the wizard preview plays a full plunge + swap. */
export function interpCtxFromAtc(atc, pockets) {
    const pk = (Array.isArray(pockets) ? pockets : []).filter((p) => p && p.tool);
    const cur = pk[0] || null, target = pk[1] || pk[0] || null;
    const toolNum = (p) => (p && p.tool && p.tool.num != null ? p.tool.num : (p && p.tool)) || null;
    const pos = (p) => (p ? { x: p.x, y: p.y, z: p.z } : null);
    return {
        safeZ: num(atc && atc.safeZ, 10),
        cur: pos(cur), target: pos(target), pickup: atc && atc.pickup,
        curTool: toolNum(cur), targetTool: toolNum(target),
    };
}
