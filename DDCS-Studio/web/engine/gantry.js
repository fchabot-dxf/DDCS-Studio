/**
 * engine/gantry.js — the ONE SOURCE for the dual-axis GANTRY topology (t648, user-ruled design).
 *
 * A gantry SLAVE is declared ON THE AXIS ITSELF: settings.motors[ax] = { role: 'slave', follows: 'x'|'y' } — offered on
 * A and B (full generality). Everything downstream DERIVES from this declaration, never a free per-op assumption:
 *   - HOMING (homingWizard/settingsPanel): a slave axis is NEVER independently homed; the MASTER's homing emits the
 *     slave sync (homeAxisBlocks.syncSlave), with the slaveFollows INJECTED from this declaration.
 *   - MIDDLE (middleWizard): the #883 dual-gantry sync arm gates on machine-has-a-Y-slave (slaveFollowing(motors,'y')).
 *   - PULL (settingsPanel): seeds motors[ax] from the dump's dual binding (pa.dual.slaveIdx).
 *   - SIM: a slave role is NOT 'rotary', so getRotaryAxes never spins on its moves (inert, like a linear axis).
 *
 * Parallels engine/limitSwitches.js (the declared home-switch one-source, t628). Pure data derivation — no side effects.
 */
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };
const MASTERS = ['x', 'y', 'z'];

/** Is this axis a DECLARED gantry slave? */
export function isSlaveAxis(motors, ax) {
    const m = motors && motors[ax];
    return !!(m && m.role === 'slave');
}

/** The slave axes declared on the machine → [{ ax, idx, follows }]. Only A/B can be slaves, and the master must be a
 *  real linear axis (a slave following an unset/invalid master is ignored — no spurious sync). */
export function slaveAxes(motors = {}) {
    return ['a', 'b']
        .filter((ax) => motors[ax] && motors[ax].role === 'slave' && MASTERS.includes(motors[ax].follows))
        .map((ax) => ({ ax, idx: AX_IDX[ax], follows: motors[ax].follows }));
}

/** The AXIS INDEX of the slave that follows `masterName` (x/y/z), or null. homeAxisBlocks.syncSlave reads the slave IDX
 *  (it writes #[880+idx]=masterCoord and #[1515+idx]=1). */
export function slaveFollowing(motors, masterName) {
    const s = slaveAxes(motors).find((v) => v.follows === masterName);
    return s ? s.idx : null;
}
