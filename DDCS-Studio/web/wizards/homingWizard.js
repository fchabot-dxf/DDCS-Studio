/**
 * DDCS Studio - Homing Wizard — emits a SAFE machine-homing macro from the persisted homing profile
 * (Settings → Hardware → Machine → Homing). Machine-control code: only VERIFIED-safe sequences are emitted,
 * and methods a model can't run are gated upstream (the config greys them; the builder emits native-or-nothing).
 *
 * BLOCK STACK: `homingStack(params)` builds the macro from atoms (Comment / Set # / Raw / End Program). The
 * DDCS homing idiom is controller-specific (M98 P501/P503 subprograms + #[880+N]/#[1515+N] register writes),
 * so those lines are emitted as `raw`/`assign` atoms rather than invented semantic atoms — the same escape
 * hatch the communication/ATC wizards use for controller-specific G-code.
 *
 * GROUND TRUTH (DDCS Expert M350, verified vs fndzero.nc / fndY.nc):
 *   native per-axis home   M98 P501 X<N>     (N = axis index 0=X 1=Y 2=Z 3=A 4=B) — uses the controller's config
 *                                            AND sets the homed flag itself (we do NOT write #[1515+N] for it)
 *   G31 granular seek       transparent raw G31  — the WIZARD'S DEFAULT OUTPUT (t499): the seek params (feed / dir /
 *                                                  port P#[1045+N*3] / level L#[1047+N*3]) are VISIBLE in the emitted
 *                                                  G-code, not hidden inside the controller's O501 macro. A faithful
 *                                                  re-derivation of O501 (slib-g.nc); no firmware flag write, so we set
 *                                                  #[1515+N] ourselves. `native` (M98 P501) stays a SEPARATE option
 *                                                  (the controller built-in Homing Setup), reachable per-axis.
 *   per-axis params         port #[1045+N*3] · level #[1047+N*3] · seek speed #[607+N] · seek dir #[612+N]
 *   machine coord #[880+N] · homed flag #[1515+N] (A=#1518) · soft-limit enable #655 (0=off/1=on)
 *   set-current-as-home     #[880+N]=0 then #[1515+N]=1   (NO motion)
 *   slave follows master    #883=#881 then #1518=1        (A slaved to Y example)
 *
 * Dual-axis SLAVE SYNC is supported (homing the master syncs the slave coord + marks it homed); gantry SQUARING
 * is done MANUALLY by the operator — Studio does not emit an auto-squaring sequence.
 *
 * Posts: Expert emits the M98 + param writes. V4.1 / V3-DM500 sub/param maps are UNVERIFIED, so those posts get
 * a clear "unverified on <model>" note and emit NOTHING executable for homing (no guessed sequence).
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { slaveAxes } from '../engine/gantry.js';   // t648 — the ONE source of the gantry topology (motors[ax]={role:'slave',follows}); homing derives the slave sync from it
// t1728 (gameplan step 1) — homeAxisBlocks/homingStack/homingUnsetAxes MOVED to stacks/homingWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure
// move, no signature change). homingRunParams stays HERE, unmoved — dataOps/homingData.js never imports it
// (only views/homingView.js and ui/macrosApp.js's sysstart generator do), so severing the twin's dependency
// doesn't need it to move.
import { homeAxisBlocks, homingStack, homingUnsetAxes } from './stacks/homingWizard.js';
export { homeAxisBlocks, homingStack, homingUnsetAxes };

/** homingRunParams(settings, opts) — the ONE contract shape for homingStack, mirroring what homingView built inline
 *  (homingView.js:84). BOTH the Homing wizard AND the Macros sysstart Generate call this, so the two paths can't drift
 *  again (t626 — the sysstart path used to pass settings.homing raw, an OBJECT where axes must be an ordered ARRAY, so it
 *  emitted the empty "(none)" stub — it never homed). `opts.selected` = an explicit axis list (the wizard's per-run ticks);
 *  default = the ENABLED configured axes (the boot macro homes what the config enables). Axes ordered by the per-axis `order`.
 *  config / machine / limits / softLimits mirror homingView.js:84 exactly, so the two emits stay byte-identical. */
export function homingRunParams(settings = {}, opts = {}) {
    const homing = settings.homing || { axes: {} };
    const cfg = homing.axes || {};
    const m = settings.motors || {};
    // t648 — a SLAVE-role axis is NEVER independently homed (the master's homing syncs it); exclude it like 'unused'.
    const configured = ['x', 'y', 'z'];
    if (m.a && m.a.role && m.a.role !== 'unused' && m.a.role !== 'slave') configured.push('a');
    if (m.b && m.b.role && m.b.role !== 'unused' && m.b.role !== 'slave') configured.push('b');
    const selected = Array.isArray(opts.selected) ? opts.selected : configured.filter((ax) => (cfg[ax] || {}).enable !== false);
    const axes = [...selected].sort((p, q) => ((cfg[p] || {}).order || 9) - ((cfg[q] || {}).order || 9));
    // t648 — DERIVE the slave sync from the axes declaration (the ONE SOURCE): inject the slave's index into the MASTER's
    // config as slaveFollows so homeAxisBlocks.syncSlave emits `#[880+idx]=masterCoord`+`#[1515+idx]=1`. Only when a slave is
    // DECLARED — else cfg is untouched, so every non-gantry config (incl. a legacy stored slaveFollows) is byte-identical.
    let config = cfg;
    const slaves = slaveAxes(m);
    if (slaves.length) {
        config = { ...cfg };
        for (const { idx, follows } of slaves) config[follows] = { ...(cfg[follows] || {}), slaveFollows: String(idx) };
    }
    return { axes, config, softLimits: (settings.machine || {}).softLimits !== false, machine: settings.machine || {}, limits: settings.limits || {} };
}

// t542 — homingSimProxy (a hand-made G53 motion model) is DELETED. It existed only because the pre-b0a9791 M98 emit
// wasn't engine-runnable; the wizard is G31-only now and the emit plays to M30 (t540). The 3D preview plays the REAL
// emitted G-code (homingView → HomingWizard.generate), the SAME execution the editor does — one simulator, one truth.

export class HomingWizard {
    generate(params) {
        recordOp('homing', params);
        return emitMapped(homingStack(params), activeDialectOpts()).text;
    }
    // t542 — the 3D preview plays generate()'s REAL emitted code (not a proxy), so simProxy()/inferStart() are gone.
}
