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

export const probeStartBlock = {
    // t638 — capture the pre-probe machine DRO into the dialect's DECLARED miss-scratch register, so the following probecheck
    // can tell a MISS (the axis reached the FULL commanded travel = no contact) from a real contact. ONLY on DRO-compare posts
    // (V4.1/DM500: a declared `missScratch` + a readable `probeTrigVar`); Expert (status-var check) and posts with no miss-check
    // fold to [] → byte-identical. Emitted BEFORE each probe by probeSurface; the compare is in probecheck (after the probe).
    type: 'probestart', label: 'Probe Start', kind: 'leaf', category: 'Probing',
    defaults: { axis: 'Z' }, fields: ['axis'],
    emit: (p, dx, dy, dialect) => (dialect && dialect.missScratch && typeof dialect.probeTrigVar === 'function'
        ? [`${dialect.missScratch}=${dialect.probeTrigVar(p.axis || 'Z')}`]
        : []),
};

export const probeCheckBlock = {
    type: 'probecheck', label: 'Probe Check', kind: 'leaf', category: 'Control',
    // Branch to <goto> if the probe DIDN'T contact. PROFILE-AWARE, three ways:
    //  (1) STATUS-VAR posts (Expert) → `IF #192x != 2 GOTO<goto>` (dialect.probeStatus; BYTE-IDENTICAL to before).
    //  (2) DRO-COMPARE posts (V4.1/DM500: no status var, a declared `missScratch`) → the probe reached the FULL commanded
    //      travel (start + seek) within `eps` == NO CONTACT: `IF #[dro] >= [#scratch + seek - eps] GOTO<goto>` (dir '+';
    //      mirrored `<=` + `+eps` for '-'). `#scratch` = the pre-probe DRO captured by probestart; `seek`/`dir`/`eps` come from
    //      probeSurface. NOTE: a real touch inside the LAST `eps` of travel reads as a miss — inherent to DRO-compare (eps default 0.05mm).
    //  (3) NEITHER (grbl/rs274/centroid) → an HONEST comment, never a guessed register.
    defaults: { axis: 'Z', goto: 1, dir: '+', seek: '', eps: 0.05 }, fields: ['axis', 'goto', 'dir', 'seek', 'eps'],
    emit: (p, dx, dy, dialect) => {
        const axis = p.axis || 'Z';
        const goto = Math.max(0, Math.round(num(p.goto, 1)));
        const status = (typeof dialect.probeStatus === 'function') ? dialect.probeStatus(axis, goto) : [];
        if (status.length) return status;                                   // (1) Expert status-var check — unchanged
        if (dialect.missScratch && typeof dialect.probeTrigVar === 'function' && p.seek != null && p.seek !== '') {
            const dro = dialect.probeTrigVar(axis), s = dialect.missScratch, eps = num(p.eps, 0.05);
            const op = p.dir === '-' ? '<=' : '>=';
            const rhs = p.dir === '-' ? `[${s}+${p.seek}+${eps}]` : `[${s}+${p.seek}-${eps}]`;
            return dialect.ifGoto(dro, op, rhs, goto);                       // (2) DRO-compare (reached full travel = miss)
        }
        return ['( no probe-miss check on this controller - verify contact )'];   // (3) honest degrade
    },
};

export const readMachineBlock = {
    type: 'readmachine', label: 'Read Machine', kind: 'leaf', category: 'Probing',
    defaults: { axis: 'Z', var: '#57' }, fields: ['axis', 'var'],
    // `mark` (optional, t897) — a DECLARED sim marker appended as a trailing comment (safeZframe saveMachineZNode uses
    // it so the sim records the scene-Z for a paired G53 return). Unset → byte-identical for every existing caller.
    emit: (p, dx, dy, dialect) => {
        const out = dialect.readMachine(p.axis || 'Z', p.var || '#57');
        return p.mark && out.length ? [...out.slice(0, -1), `${out[out.length - 1]} ( ${p.mark} )`] : out;
    },
};

export const probeGuardBlock = {
    // The G31 stop-mode / limit-protection preamble (#1905=0 / #1915=<v>) some probe wizards set before G31. PROFILE-AWARE:
    // Expert's G31 consumes it → dialect.probeGuard emits the two assigns (byte-identical to the old raw ones); a post whose
    // probe form doesn't consume them (V4.1's L#682 G31 / DM500's move-until-input → no dialect.probeGuard) folds to [].
    type: 'probeguard', label: 'Probe Guard', kind: 'leaf', category: 'Probing',
    defaults: { stopVar: '', limitVar: '', limitVal: '' }, fields: ['stopVar', 'limitVar', 'limitVal'],
    emit: (p, dx, dy, dialect) => (dialect && typeof dialect.probeGuard === 'function' ? dialect.probeGuard(p) : []),
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
