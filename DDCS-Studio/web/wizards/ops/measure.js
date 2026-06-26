/**
 * wizards/ops/measure.js — probe/state CAPTURE primitives. PROFILE-AWARE: the #-numbers + form come from the
 * active controller's dialect (wizards/dialects/*), so probe-read is #1925 on Expert, #1500 on V4.1, #864 on
 * DM500 — the same block, the right G-code per profile. (probe-check folds to nothing on controllers with no
 * status var, e.g. DM500/V4.1.) See [[ddcs-ground-truth-reference]].
 */
import { num } from './util.js';

export const probeReadBlock = {
    type: 'proberead', label: 'Probe Read', kind: 'leaf', category: 'Probing',
    defaults: { axis: 'Z', var: '#50' }, fields: ['axis', 'var'],
    emit: (p, dx, dy, dialect) => dialect.probeRead(p.axis || 'Z', p.var || '#50'),
};

export const probeCheckBlock = {
    type: 'probecheck', label: 'Probe Check', kind: 'leaf', category: 'Control',
    defaults: { axis: 'Z', goto: 1 }, fields: ['axis', 'goto'],   // jump to label <goto> if the probe didn't trigger
    emit: (p, dx, dy, dialect) => dialect.probeStatus(p.axis || 'Z', Math.max(0, Math.round(num(p.goto, 1)))),
};

export const readMachineBlock = {
    type: 'readmachine', label: 'Read Machine', kind: 'leaf', category: 'Probing',
    defaults: { axis: 'Z', var: '#57' }, fields: ['axis', 'var'],
    emit: (p, dx, dy, dialect) => dialect.readMachine(p.axis || 'Z', p.var || '#57'),
};

export const toolOffsetBlock = {
    type: 'tooloffset', label: 'Tool Offset', kind: 'leaf', category: 'Coordinates',
    defaults: { tool: '#1300', value: '#102' }, fields: ['tool', 'value'],
    // Write a tool-length offset into the controller's tool table. PROFILE-AWARE: the table base comes from
    // dialect.vars.toolTable (Expert/DM500 #1430, V4.1 #1560), addressed by tool number → #[base + T - 1] = value.
    emit: (p, dx, dy, dialect) => {
        const base = (dialect.vars && dialect.vars.toolTable) || 1430;
        return [`#[${base}+${p.tool || '#1300'}-1]=${p.value || '#102'}`];
    },
};
