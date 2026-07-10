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
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { num, r3 } from './ops/util.js';
import { declaredHomeEdgeSide } from '../engine/limitSwitches.js';   // the ONE source of the home end — the DECLARED home switch (settings.limits.<edge>Home), shared with the engine handler + the emit

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

// axis name → controller axis index (the N in M98 P50x X<N> and the #[base+N] param math)
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };
const AX_LABEL = { x: 'X', y: 'Y', z: 'Z', a: 'A', b: 'B' };

/**
 * Homing params → its block SNIPPET. params:
 *   axes: ['z','x','y']  — the axes to home THIS run, already in execution order (the view resolves order/philosophy)
 *   config: the per-axis homing config (settings.homing.axes) — method/dir/feeds/backoff/slaveFollows/rotary/offset
 *   softLimits: re-enable #655 at the end iff the machine uses soft limits (sourced from machine.softLimits)
 * A frameless snippet — inserted mid-program like the other setup macros.
 */
/**
 * The per-axis home block sequence (ONE source, shared by homingStack + the user_homing_data twin's E1 unroll/recompose).
 * A LINEAR axis emits the simple G31 seek (t536); a rotary A/B emits setzero. The seek is SETTINGS-dependent: distance =
 * |machine span| + margin toward the DECLARED home end (declaredHomeEdgeSide); an unset (0) span → the SKIP comment (t540,
 * structure-changing — this is why the twin RECOMPOSES from settings, not a static value-swap). config (feeds/backoff/slave)
 * rides the op; machine/limits ride the CURRENT settings. Returns a fresh block array (never mutates a shared buffer).
 */
export function homeAxisBlocks(ax, config, machine, limits) {
    const B = [];
    const c = config || {};
    const N = AX_IDX[ax], L = AX_LABEL[ax];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; B.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; B.push(b); };
    const RAW = (t) => { const b = newBlock('raw'); b.params = { text: t }; B.push(b); };
    // t536 — the WIZARD is G31-only for linear axes; a rotary A/B is setzero. (native is dead here — never selected — kept for parity.)
    const method = (ax === 'a' || ax === 'b') ? 'setzero' : 'seek';
    const flagVar = `#${1515 + N}`, coordVar = `#${880 + N}`;
    // A dual-axis SLAVE that follows this master: copy its machine coord to the slave + mark it homed (fndzero.nc tail).
    const syncSlave = () => {
        const s = parseInt(c.slaveFollows, 10);
        if (!Number.isInteger(s) || s < 0 || s > 4 || s === N) return;
        C(`Sync slave axis ${s} to ${L} (gantry slave)`);
        A(`#${880 + s}`, coordVar, `slave coord = ${L} coord`);
        A(`#${1515 + s}`, '1', 'slave homed flag');
    };
    if (method === 'native') {
        C(`Home ${L} — native (controller config)`);
        RAW(`M98P501X${N}     ( home ${L} - axis ${N} )`);
        syncSlave();
        return B;
    }
    if (method === 'setzero') {
        // Set the CURRENT position as machine home — no motion. (#[880+N]=0 then mark homed.)
        C(`Home ${L} — set current position as home (no motion)`);
        A(coordVar, '0', `${L} machine coord = 0 here`);
        A(flagVar, '1', `${L} homed flag`);
        syncSlave();
        return B;
    }
    // ── G31 HOME SEEK — simple + readable (t536). DIRECTION = the DECLARED home end (declaredHomeEdgeSide); max → +1 (UP),
    //    min → -1; no declared home → -tSign (toward machine-0), unknown envelope → +1. An unset span → the SKIP comment.
    const backoff = num(c.backoff, 5);
    const fastF = Math.round(num(c.seekFeed, 600)) || 600;
    const slowF = Math.round(num(c.slowFeed, 100)) || 100;
    const tSign = Math.sign(num((machine || {})[ax], 0));
    const homeSide = declaredHomeEdgeSide(ax, limits);
    const dir = homeSide === 'max' ? 1 : homeSide === 'min' ? -1 : (-tSign || 1);
    const span = Math.abs(num((machine || {})[ax], 0));
    if (!(span > 0)) { C(`Home ${L} — SET ${ax.toUpperCase()} TRAVEL (machine envelope) first; homing SKIPPED for this axis`); return B; }
    const seekDist = r3(dir * (span + 20));
    const P = `P#${1045 + N * 3}`, Lw = `L#${1047 + N * 3}`;
    const endLabel = homeSide === 'max' ? 'max (top)' : homeSide === 'min' ? 'min' : (dir > 0 ? 'max' : 'min');
    C(`Home ${L} — G31 seek to the ${endLabel} home switch`);
    RAW('G91     ( incremental moves )');
    RAW(`G31 ${L}${seekDist} F${fastF} ${P} ${Lw}     ( fast seek to the home switch )`);
    RAW(`G01 ${L}${r3(-dir * backoff)} F${slowF}     ( back off the switch )`);
    RAW(`G31 ${L}${r3(dir * (backoff + 2))} F${slowF} ${P} ${Lw}     ( slow re-touch for accuracy )`);
    A(coordVar, '0', `${L} machine coord = 0 (home datum)`);
    A(flagVar, '1', `${L} homed flag`);
    RAW(`G01 ${L}${r3(-dir * backoff)} F${slowF}     ( clearance back-off )`);
    RAW('G90     ( back to absolute )');
    syncSlave();
    return B;
}

export function homingStack(params = {}, opts = {}) {
    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const RAW = (t) => { const b = newBlock('raw'); b.params = { text: t }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));
    // t546 E0 — the data-op twin seam. superset:true carries EVERY axis's home block GUARDED by its run-tick (_run<AX>), so
    // pruneGuards collapses to the selected set → byte-identical to the concrete build. capture() grabs the blocks homeAxis
    // pushes so the SUPERSET can wrap each per-axis sub-sequence in a guard; the CONCRETE calls homeAxis directly (unchanged).
    const superset = !!opts.superset;
    const ALL_AXES = ['x', 'y', 'z', 'a', 'b'];   // the fixed superset order (canonical); the run-ORDER reorder is the twin's unroll (E1)
    const capture = (fn) => { const save = S.length; fn(); return S.splice(save); };
    const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };

    const dialect = getDialect();
    if (!dialect) { C('Error: No dialect loaded'); return S; }
    const expert = dialect.id === 'ddcs-expert-m350';

    const axes = Array.isArray(params.axes) ? params.axes.filter((a) => AX_IDX[a] != null) : [];
    const cfg = params.config || {};

    C(`HOMING — ${axes.map((a) => AX_LABEL[a]).join(' ') || '(none)'}  |  ${dialect.name}`);

    // ── Gate non-Expert posts: the M98 P501/P503 subprograms and the #[1045+]/#[607+]/#[880+] param map are
    //    only verified on Expert M350. We do NOT emit a guessed homing sequence for V4.1 / DM500. ──
    if (!expert) {
        C(`Homing macros are UNVERIFIED on ${dialect.name} — Studio will not emit a homing sequence for it.`);
        C('Use the controller\'s own Home All / per-axis home button, or switch the active post to DDCS Expert M350.');
        END();
        return S;
    }

    if (!superset && !axes.length) { C('No axes selected to home.'); END(); return S; }   // superset carries all axes guarded (the twin prunes to the selection)

    // Per-axis emit — via the SHARED module builder (homeAxisBlocks) so the twin's E1 unroll/recompose reads the SAME source.
    const homeAxis = (ax) => { for (const b of homeAxisBlocks(ax, cfg[ax], params.machine, params.limits)) S.push(b); };

    // t546 E0 — SUPERSET: every axis's home block guarded by its run-tick (_run<AX>), canonical order; prune collapses to the
    // selected set. CONCRETE: emit the selected axes in the resolved run-order (unchanged, byte-identical).
    if (superset) {
        ALL_AXES.forEach((ax) => S.push(GUARD({ param: '_run' + ax.toUpperCase(), is: true }, capture(() => homeAxis(ax)))));
    } else {
        axes.forEach(homeAxis);
    }

    // Re-enable soft limits at the end (a belt-and-braces guarantee that homing leaves limits ON). #655 is
    // global; setting it 1 is idempotent. Skip if the user disabled the re-enable (e.g. soft limits not used).
    if (params.softLimits !== false) {
        const anyMotion = axes.some((a) => { const m = (cfg[a] || {}).method; return m === 'seek' || m === 'native'; });
        if (anyMotion) { C('Re-enable soft limits'); A('#655', '1', 'soft-limit enable'); }
    }

    C('HOMING COMPLETE');
    END();
    // Wrap the atoms in a collapsible op container so the Blocks view folds the whole homing sequence to one line
    // ("⬡ Home Z X Y") and expands to the steps (where the user can interleave MSG/comm). The op-container emit
    // walks its children, so the emitted G-code is unchanged. Collapsed by default — clean at a glance.
    return [{ type: 'op', opType: 'homing', label: `Home ${axes.map((a) => AX_LABEL[a]).join(' ')}`, children: S, collapsed: true }];
}

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
    const configured = ['x', 'y', 'z'];
    if (m.a && m.a.role && m.a.role !== 'unused') configured.push('a');
    if (m.b && m.b.role && m.b.role !== 'unused') configured.push('b');
    const selected = Array.isArray(opts.selected) ? opts.selected : configured.filter((ax) => (cfg[ax] || {}).enable !== false);
    const axes = [...selected].sort((p, q) => ((cfg[p] || {}).order || 9) - ((cfg[q] || {}).order || 9));
    return { axes, config: cfg, softLimits: (settings.machine || {}).softLimits !== false, machine: settings.machine || {}, limits: settings.limits || {} };
}

// t542 — homingSimProxy (a hand-made G53 motion model) is DELETED. It existed only because the pre-b0a9791 M98 emit
// wasn't engine-runnable; the wizard is G31-only now and the emit plays to M30 (t540). The 3D preview plays the REAL
// emitted G-code (homingView → HomingWizard.generate), the SAME execution the editor does — one simulator, one truth.

/** t540 — the LINEAR run-axes whose machine envelope travel is UNSET/0 (uppercased, e.g. ['Z']). The homing view shows a
 *  visible 'set … travel' hint for these + the sim skips them (no fictional span). Rotary set-zero axes never need a span. */
export function homingUnsetAxes(params = {}) {
    const axes = Array.isArray(params.axes) ? params.axes.filter((a) => AX_IDX[a] != null) : [];
    const machine = params.machine || {}, cfg = params.config || {};
    return axes.filter((ax) => {
        if ((ax === 'a' || ax === 'b') && ((cfg[ax] || {}).rotary || 'setzero') === 'setzero') return false;
        return !(Math.abs(num(machine[ax], 0)) > 0);
    }).map((a) => a.toUpperCase());
}

export class HomingWizard {
    generate(params) {
        recordOp('homing', params);
        return emitMapped(homingStack(params), activeDialectOpts()).text;
    }
    // t542 — the 3D preview plays generate()'s REAL emitted code (not a proxy), so simProxy()/inferStart() are gone.
}
