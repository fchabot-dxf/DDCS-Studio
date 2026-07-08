/**
 * engine/switchTypes.js — the DECLARED limit/home SWITCH-TYPE catalog (H2, t483). Pure + DOM-free (parallels
 * engine/limitSwitches.js), so the sim (limitSwitchTrips) and the ioTable per-edge picker read ONE source.
 *
 * A MECHANICAL switch trips AT the envelope edge (contact; standoff 0). A PROXIMITY sensor (inductive/capacitive) trips
 * at its sensing distance Sn BEFORE the edge (non-contact) — so in the sim the trip position shifts INWARD by Sn. The
 * catalog mirrors ioTable's INPUT_TYPES shape ({type,label,help}) + adds `standoff` (mm, the sim trip-offset) and
 * `render` (the 3D glyph the preview draws for this switch — H3 wires it). SIM-CONFIG only: no emitted macro reads it.
 */
export const SWITCH_TYPES = [
    { type: 'mechanical', label: 'Mechanical', help: 'A contact switch (micro / roller / plunger) — trips AT the envelope edge.', standoff: 0, render: 'plunger' },
    { type: 'proximity',  label: 'Proximity',  help: 'A non-contact inductive / capacitive sensor — trips at its sensing distance (Sn) BEFORE the edge.', standoff: 3, render: 'sensor-face' },
    { type: 'optical',    label: 'Optical',    help: 'A non-contact photo-interrupter (optical slot / beam-break) — trips just BEFORE the edge as the flag breaks the beam.', standoff: 1, render: 'sensor-face' },
    { type: 'hall',       label: 'Hall effect', help: 'A non-contact hall-effect / magnetic sensor — trips just BEFORE the edge as the magnet nears it.', standoff: 1, render: 'sensor-face' },
];

/** The switch-type def for a stored type value — MECHANICAL is the default (for '' / unknown / a legacy row). */
export function switchTypeOf(type) {
    return SWITCH_TYPES.find((s) => s.type === type) || SWITCH_TYPES[0];
}

/** The sim trip STANDOFF (mm) for a stored switch-type — 0 (mechanical, at the edge) unless a proximity Sn is declared. */
export function switchStandoff(type) {
    return switchTypeOf(type).standoff || 0;
}
