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
export function homingStack(params = {}) {
    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const RAW = (t) => { const b = newBlock('raw'); b.params = { text: t }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

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

    if (!axes.length) { C('No axes selected to home.'); END(); return S; }

    // Per-method emit for one axis. All math is on the axis INDEX N (0=X..4=B), matching the verified macros.
    const homeAxis = (ax) => {
        const c = cfg[ax] || {};
        const N = AX_IDX[ax], L = AX_LABEL[ax];
        // t536 (change 1) — the WIZARD IGNORES the saved per-axis method (the human 4×: "wizard is g31 only"). A LINEAR
        // axis ALWAYS emits the G31 seek; a rotary A/B emits setzero (the sensible method — no linear travel to seek).
        // Native M98 stays reachable ONLY via the separate Homing Setup (its machinery below is kept, just not wizard-routed).
        const method = (ax === 'a' || ax === 'b') ? 'setzero' : 'seek';

        // Homed-flag + machine-coord are written at their RESOLVED literal address (e.g. Z=#1517, #882) to match
        // Homed-flag / machine-coord at their RESOLVED literal address (e.g. Z=#1517, #882). The native path does
        // NOT write the homed flag — M98 P501 sets it itself (fndzero.nc never writes it for switch-homed axes), and
        // a manual write would falsely mark the axis homed if the home failed/alarmed. The flag is written ONLY where
        // the controller doesn't: slave-sync, set-current-as-home, and the G31 granular-seek path.
        const flagVar = `#${1515 + N}`, coordVar = `#${880 + N}`;

        // A dual-axis SLAVE that follows this master (e.g. A slaved to Y): after the master homes, copy its machine
        // coord to the slave and mark the slave homed — the verified fndzero.nc / fndY.nc tail (`#883=#881; #1518=1`).
        // (Gantry SQUARING is done manually by the operator — Studio only syncs the slave coordinate.)
        const syncSlave = () => {
            const s = parseInt(c.slaveFollows, 10);
            if (!Number.isInteger(s) || s < 0 || s > 4 || s === N) return;
            C(`Sync slave axis ${s} to ${L} (gantry slave)`);
            A(`#${880 + s}`, coordVar, `slave coord = ${L} coord`);
            A(`#${1515 + s}`, '1', 'slave homed flag');
        };

        if (method === 'native') {
            // Controller built-in home — uses ITS configured switch/dir/speed AND sets the homed flag itself. The
            // safest method (fndzero.nc). No manual #[1515+N] write here (see above).
            C(`Home ${L} — native (controller config)`);
            RAW(`M98P501X${N}     ( home ${L} - axis ${N} )`);
            syncSlave();
            return;
        }

        if (method === 'setzero') {
            // Set the CURRENT position as machine home — no motion. (#[880+N]=0 then mark homed.)
            C(`Home ${L} — set current position as home (no motion)`);
            A(coordVar, '0', `${L} machine coord = 0 here`);
            A(flagVar, '1', `${L} homed flag`);
            syncSlave();
            return;
        }

        if (method === 'seek') {
            // ── G31 HOME SEEK — SIMPLE + READABLE (t536, replacing the opaque O501 re-derivation). The old path emitted a
            //    7-read "debounce" that summed the SAME input 7× (it debounced nothing), a limit-vs-home GOTO guard, and a
            //    feed-halving multi-pass loop — a human couldn't read it ("wtf is this code"). This is the whole seek:
            //      fast G31 to the home switch → back off a few mm → ONE slow G31 re-touch (accuracy) → set the datum +
            //      homed flag → clearance back-off. Every line is plain. UNVERIFIED on hardware; the Setup/native M98 path
            //      stays the controller-flagged option (this wizard is G31-only for linear axes — the human's 4× request).
            //
            //    DIRECTION (change 3): the DECLARED HOME END is the ONLY source (declaredHomeEdgeSide) — max → +1 (UP, to
            //    the top), min → -1. NO c.dir override (a stale saved dir can no longer steer the seek away — the t491 bug
            //    class). Fallback when NO home is declared: -tSign (toward machine-0); unknown envelope (tSign 0) → +1.
            const backoff = num(c.backoff, 5);                          // back-off + clearance distance (mm)
            const fastF = Math.round(num(c.seekFeed, 600)) || 600;      // fast seek feed (mm/min)
            const slowF = Math.round(num(c.slowFeed, 100)) || 100;      // slow re-touch feed (accuracy)
            const tSign = Math.sign(num((params.machine || {})[ax], 0)); // signed-travel sign (fallback only)
            const homeSide = declaredHomeEdgeSide(ax, params.limits);   // 'min'|'max'|null — the DECLARED home switch end
            const dir = homeSide === 'max' ? 1 : homeSide === 'min' ? -1 : (-tSign || 1);
            const span = Math.abs(num((params.machine || {})[ax], 0));
            // t540 — NO SILENT FALLBACK: an unset/0 travel has no meaningful seek distance. SKIP the axis + surface it
            // (a comment), instead of fabricating a 300mm span. Configured machines (span > 0) are unaffected.
            if (!(span > 0)) { C(`Home ${L} — SET ${ax.toUpperCase()} TRAVEL (machine envelope) first; homing SKIPPED for this axis`); return; }
            const seekDist = r3(dir * (span + 20));                     // toward the home end, ~the travel span + margin (NOT ±10000)
            const P = `P#${1045 + N * 3}`, Lw = `L#${1047 + N * 3}`;     // home-input PORT / active-LEVEL registers (as today)
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
            return;
        }
    };

    axes.forEach(homeAxis);

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
        return emitMapped(homingStack(params)).text;
    }
    // t542 — the 3D preview plays generate()'s REAL emitted code (not a proxy), so simProxy()/inferStart() are gone.
}
