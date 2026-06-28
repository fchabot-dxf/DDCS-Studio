/**
 * wizards/probeBlocks.js — shared G-code building blocks for probe wizards.
 *
 * The two-pass probe (fast touch → retract → slow precision touch) is the
 * heart of every probing wizard. It lived in 5 near-identical copies before
 * this module existed — which is how the corner/ATC wizards ended up with a
 * probe-status check (`==0`) different from the edge/middle/alignment ones
 * (`!=2`, the correct DDCS form). One implementation, one truth.
 *
 * DDCS per-axis G31 variables (official Variables-ENG list):
 *   status  #1920/#1921/#1922  (0 none, 1 started/no trigger, 2 SUCCESS, 3/4 limit)
 *   result  #1925/#1926/#1927  (trigger position, machine coordinates)
 *   stop    #1905/#1906/#1907  (0 decelerate, 1 emergency)
 *   limit   #1915/#1916/#1917  (0 off, 1 negative, 2 positive protection)
 */
import { w, G, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto } from './dialect.js';

/** Per-axis DDCS G31 system variables. */
export const AXIS_VARS = {
    X: { status: '#1920', result: '#1925', stop: '#1905', limit: '#1915' },
    Y: { status: '#1921', result: '#1926', stop: '#1906', limit: '#1916' },
    Z: { status: '#1922', result: '#1927', stop: '#1907', limit: '#1917' },
};

/** Defensive numeric coercion for wizard params (was copied in every wizard). */
export function toNum(v, def = 0) {
    if (v === undefined || v === null) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

/**
 * Probe-config source helpers (PROBE-CONFIG-SOURCE.md). Views pass
 * params.sources = { field: {ctrl,pr,label} } for the fields the user flipped to
 * "read from controller" (resolved against the active controller profile).
 * srcVal picks the runtime var over the literal; srcNote annotates the comment so
 * generated code documents where each value comes from.
 */
export function srcVal(src, literal) { return src ? src.ctrl : literal; }
export function srcNote(src, note) { return src ? `${note} - controller ${src.pr}` : note; }

/**
 * Diagonal-traverse leg direction, shared by the CORNER and the MIDDLE (boss-both) wizards. After probing a wall, the
 * connecting move to the next wall is a 2-axis diagonal; each axis leg travels EITHER in its probe direction or the
 * opposite. `travelOwn` = travel IN the probe direction; `travelOpp` = the OTHER way. `plus` is the probe direction
 * (true = +), `posExpr`/`negExpr` are the +/- travel distance expressions (e.g. '#15'/'#16' for the corner's travelDist,
 * '#21'/'[0-#21]' for the middle's Diag-travel). One source of truth for "which sign does this leg get".
 */
export const travelOwn = (plus, posExpr, negExpr) => (plus ? posExpr : negExpr);
export const travelOpp = (plus, posExpr, negExpr) => (plus ? negExpr : posExpr);

/**
 * Two-pass probe block: [safety setup] → fast probe → check → retract →
 * slow probe → check → [save result] → [retract].
 *
 * Convention (kept from the original wizards): #7/#8 are the negative/positive
 * max-probe distances, #9/#10 the negative/positive retracts, #3/#4 the
 * fast/slow feeds, #5 the probe port.
 *
 * @param {object} o
 * @param {'X'|'Y'|'Z'} o.axis
 * @param {'+'|'-'} o.dirSign            probe travel direction
 * @param {string} [o.probeVar]          default '#8' (+) / '#7' (-)
 * @param {string} [o.retractVar]        default: retract opposite to travel ('#9' for '+', '#10' for '-')
 * @param {string|null} [o.resultVar]    if set, save the axis trigger position into it
 * @param {number} [o.level=0]           G31 L (polarity)
 * @param {number} [o.qStop=1]           G31 Q (stop mode)
 * @param {boolean} [o.safety=true]      emit stop-mode + limit-protection setup
 * @param {boolean} [o.finalRetract=true] retract again after the slow touch
 * @param {number} [o.errLabel=1]        GOTO label on probe failure
 * @param {object} [o.comments]          override comment strings
 */
export function twoPassProbe(o) {
    const {
        axis, dirSign,
        probeVar = dirSign === '+' ? '#8' : '#7',
        retractVar = dirSign === '+' ? '#9' : '#10',
        resultVar = null,
        level = 0, qStop = 1,
        safety = true,
        finalRetract = true,
        errLabel = 1,
        comments = {},
    } = o;

    const av = AXIS_VARS[axis];
    const cm = {
        fast: 'Fast probe',
        retract: 'Retract',
        slow: 'Slow probe',
        save: 'Save contact position - machine coord',
        finalRetract: 'Retract from wall',
        ...comments,
    };

    let c = '';
    if (safety) {
        c += line([set(av.stop, '0')], 'Stop mode: decelerate') + '\n';
        c += line([set(av.limit, dirSign === '+' ? '2' : '1')], `Limit protect: ${dirSign === '+' ? 'positive' : 'negative'}`) + '\n';
    }
    c += line([G(31), w(axis, probeVar), F('#3'), P('#5'), L(level), Q(qStop)], cm.fast) + '\n';
    c += ifGoto(av.status, '!=', '2', errLabel) + '\n';
    c += line([G(0), w(axis, retractVar)], cm.retract) + '\n';
    c += line([G(31), w(axis, probeVar), F('#4'), P('#5'), L(level), Q(qStop)], cm.slow) + '\n';
    c += ifGoto(av.status, '!=', '2', errLabel) + '\n';
    if (resultVar) {
        c += line([set(resultVar, av.result)], cm.save) + '\n';
    }
    if (finalRetract) {
        c += line([G(0), w(axis, retractVar)], cm.finalRetract) + '\n';
    }
    c += '\n';
    return c;
}

/** Standard "operator confirm" block: #1505 message, wait for Enter. */
export function confirmStart(message) {
    return `( Confirm Start )\n` + line([set('#1505', '1')], message) + '\n\n';
}
