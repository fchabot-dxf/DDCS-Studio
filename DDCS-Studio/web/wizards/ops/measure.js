/**
 * wizards/ops/measure.js — probe/state CAPTURE primitives (the probing layer's reads + status branch).
 *
 *   Probe Read    — copy a G31 latched trigger position into a variable (the whole point of probing).
 *   Probe Check   — branch to a label when the last G31 did NOT trigger (status != 2).
 *   Read Machine  — capture the live machine position (DRO) into a variable.
 *
 * The `#`-numbers below are the DDCS M350 variable namespace. They are kept as small named maps (TRIG/STAT/DRO)
 * precisely so a CONTROLLER PROFILE can override them — a profile = dialect.js `rules`/`fmt` (syntax) + this
 * variable map (the #-namespace). On grbl/Mach these differ or don't exist; wiring them to the profile's
 * `default_vars*` is the next step (see [[blockly-composition-view]] / controller-profiles).
 */
import { num } from './util.js';
import { set, line } from '../words.js';
import { ifGoto } from '../dialect.js';

// --- DDCS M350 variable namespace (profile-overridable) ---
const TRIG = { X: '#1925', Y: '#1926', Z: '#1927' };   // G31 latched trigger position
const STAT = { X: '#1920', Y: '#1921', Z: '#1922' };   // G31 status (== 2 means it triggered)
const DRO = { X: '#880', Y: '#881', Z: '#882', A: '#883' };   // live machine coordinate

export const probeReadBlock = {
    type: 'proberead', label: 'Probe Read', kind: 'leaf', category: 'Machine',
    defaults: { axis: 'Z', var: '#50' }, fields: ['axis', 'var'],
    emit: (p) => [line([set(p.var || '#50', TRIG[p.axis] || TRIG.Z)], `read probe ${p.axis}`)],
};

export const probeCheckBlock = {
    type: 'probecheck', label: 'Probe Check', kind: 'leaf', category: 'Control',
    defaults: { axis: 'Z', goto: 1 }, fields: ['axis', 'goto'],   // jump to label <goto> if the probe didn't trigger
    emit: (p) => [ifGoto(STAT[p.axis] || STAT.Z, '!=', '2', Math.max(0, Math.round(num(p.goto, 1))))],
};

export const readMachineBlock = {
    type: 'readmachine', label: 'Read Machine', kind: 'leaf', category: 'Machine',
    defaults: { axis: 'Z', var: '#57' }, fields: ['axis', 'var'],
    emit: (p) => [line([set(p.var || '#57', DRO[p.axis] || DRO.Z)], `read machine ${p.axis}`)],
};
