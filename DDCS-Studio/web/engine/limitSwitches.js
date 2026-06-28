/**
 * engine/limitSwitches.js — pure limit/home-switch trip model for the machine envelope.
 *
 * MIRRORS engine/probeGeometry.js (`stockProbeStop`): a self-contained, settings/DOM/THREE-free
 * function the execution engine and the sim can both call so the simulated switch and the drawn
 * envelope can't drift. The probe trips against the STOCK; the limit/home switches trip against the
 * MACHINE ENVELOPE EDGES.
 *
 * Frame = MACHINE coords (G53). Home is at machine-0; the far edge is at the SIGNED travel
 * (settings.machine.x/y/z). The sign of the travel encodes which side home is on:
 *   • travel > 0  → axis runs 0 … +travel; home edge = the 0 (min) side, far/limit edge = +travel (max).
 *   • travel < 0  → axis runs travel … 0 (e.g. Z = -120 … 0); home edge = the 0 (max) side,
 *                   far/limit edge = travel (min).  (Z homes at the TOP = machine 0 and travels down.)
 *
 * KEY FACT (human): HOME == the LIMIT position — the home switch IS the limit switch at the envelope
 * edge. So one switch per axis-end serves both roles; an axis has two ends (min / max), and the
 * end that contains machine-0 is the HOME end. Whichever end the tool reaches/exceeds trips that
 * end's switch.
 *
 * ioConfig = the flat `settings.limits` object (the same one ui/ioTable.js + settingsPanel
 * syncFlatFromIO maintain): { xMinPin, xMinLevel, xMaxPin, xMaxLevel, yMin…, zMin… }. A pin of ''
 * / null means that switch isn't fitted, so it never trips.
 */

/** The six envelope edges, in the order ioTable/settingsPanel use, with their flat-config keys. */
export const LIMIT_EDGES = [
    { edge: 'x_min', axis: 'x', side: 'min', pinKey: 'xMinPin', levelKey: 'xMinLevel' },
    { edge: 'x_max', axis: 'x', side: 'max', pinKey: 'xMaxPin', levelKey: 'xMaxLevel' },
    { edge: 'y_min', axis: 'y', side: 'min', pinKey: 'yMinPin', levelKey: 'yMinLevel' },
    { edge: 'y_max', axis: 'y', side: 'max', pinKey: 'yMaxPin', levelKey: 'yMaxLevel' },
    { edge: 'z_min', axis: 'z', side: 'min', pinKey: 'zMinPin', levelKey: 'zMinLevel' },
    { edge: 'z_max', axis: 'z', side: 'max', pinKey: 'zMaxPin', levelKey: 'zMaxLevel' },
];

const EPS = 1e-6;

/**
 * The [min, max] machine-coordinate span of an axis from its signed travel, plus which end is HOME.
 * Always returns lo ≤ hi; `homeSide` is the end that contains machine-0.
 * @param {number} travel - signed travel for the axis (settings.machine[axis])
 * @returns {{ lo: number, hi: number, homeSide: 'min'|'max' }}
 */
export function axisSpan(travel) {
    const t = Number(travel) || 0;
    // 0 is always one end of the span; +t or -t is the other. Home is the end at machine-0.
    return t >= 0
        ? { lo: 0, hi: t, homeSide: 'min' }     // 0 … +t  → home at the min (0) end
        : { lo: t, hi: 0, homeSide: 'max' };    // -|t| … 0 → home at the max (0) end (e.g. Z top)
}

/**
 * Which home/limit switches are tripped by the tool at `toolPosMachine` (machine frame).
 *
 * For each axis, the tool at-or-beyond the min edge trips that axis's MIN switch, and at-or-beyond
 * the max edge trips the MAX switch. A switch only trips if it has a pin assigned in ioConfig (an
 * un-fitted edge can't trip). Because HOME == LIMIT, the tripped edge is also the home edge when it
 * is the machine-0 end (reported via `isHome`).
 *
 * Pure — no settings/DOM/THREE. Symmetric with probeGeometry.stockProbeStop so the engine hookup is
 * the same shape as the G31 path.
 *
 * @param {{x:number,y:number,z:number}} toolPosMachine - tool position in MACHINE coords (G53)
 * @param {{x:number,y:number,z:number}} machine        - signed travel per axis (settings.machine)
 * @param {object} [ioConfig]                           - flat settings.limits (pin/level per edge)
 * @returns {Array<{edge:string, axis:string, side:'min'|'max', pin:(number|string), level:number,
 *                   isHome:boolean, pos:number, edgePos:number}>}  the tripped switches (possibly empty)
 */
export function limitSwitchTrips(toolPosMachine, machine, ioConfig = {}) {
    const P = toolPosMachine || {};
    const M = machine || {};
    const trips = [];

    for (const ax of ['x', 'y', 'z']) {
        const pos = Number(P[ax]);
        if (!Number.isFinite(pos)) continue;
        const { lo, hi, homeSide } = axisSpan(M[ax]);

        // min edge: tool at/below lo. max edge: tool at/above hi.
        const atMin = pos <= lo + EPS;
        const atMax = pos >= hi - EPS;
        for (const hit of [atMin && 'min', atMax && 'max']) {
            if (!hit) continue;
            const def = LIMIT_EDGES.find((e) => e.axis === ax && e.side === hit);
            const pin = ioConfig[def.pinKey];
            if (pin === '' || pin == null) continue;   // switch not fitted on this edge → can't trip
            trips.push({
                edge: def.edge,
                axis: ax,
                side: hit,
                pin,
                level: Number(ioConfig[def.levelKey]) || 0,
                isHome: hit === homeSide,              // the machine-0 end is the home switch
                pos,
                edgePos: hit === 'min' ? lo : hi,
            });
        }
    }
    return trips;
}

/**
 * Convenience: does ANY fitted limit/home switch trip at this machine position? (e.g. a fast guard
 * before building the detailed list.)
 * @returns {boolean}
 */
export function anyLimitTripped(toolPosMachine, machine, ioConfig = {}) {
    return limitSwitchTrips(toolPosMachine, machine, ioConfig).length > 0;
}
