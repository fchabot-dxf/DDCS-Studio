/**
 * DDCS Studio - Homing Wizard — emits a SAFE machine-homing macro from the persisted homing profile
 * (Settings → Homing Setup). Machine-control code: only VERIFIED-safe sequences are emitted, and methods a
 * model can't run are gated upstream (the view greys them; the builder falls back to native-or-nothing).
 *
 * BLOCK STACK: `homingStack(params)` builds the macro from atoms (Comment / Set # / Raw / End Program). The
 * DDCS homing idiom is controller-specific (M98 P501/P503 subprograms + #[880+N]/#[1515+N] register writes),
 * so those lines are emitted as `raw`/`assign` atoms rather than invented semantic atoms — the same escape
 * hatch the communication/ATC wizards use for controller-specific G-code.
 *
 * GROUND TRUTH (DDCS Expert M350, verified vs fndzero.nc / fndY.nc / Double_Y_double_zero_switch.nc):
 *   native per-axis home   M98 P501 X<N>     (N = axis index 0=X 1=Y 2=Z 3=A 4=B) — uses the controller's config
 *   low-level switch-seek   M98 P503 X<N>     — composes custom/dual homing
 *   per-axis params         port #[1045+N*3] · level #[1047+N*3] · seek speed #[607+N] · seek dir #[612+N]
 *   machine coord #[880+N] · homed flag #[1515+N] (A=#1518) · soft-limit enable #655 (0=off/1=on)
 *   set-current-as-home     #[880+N]=0 then #[1515+N]=1   (NO motion)
 *   slave follows master    #883=#881 then #1518=1        (A slaved to Y example)
 *
 * Posts: Expert emits the full M98 + param writes. V4.1 / V3-DM500 sub/param maps are UNVERIFIED, so those
 * posts get a clear "unverified on <model>" note and emit NOTHING executable for homing (no guessed sequence).
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { num } from './ops/util.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

// axis name → controller axis index (the N in M98 P50x X<N> and the #[base+N] param math)
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };
const AX_LABEL = { x: 'X', y: 'Y', z: 'Z', a: 'A', b: 'B' };

/**
 * Homing params → its block SNIPPET. params:
 *   axes: ['z','x','y']  — the axes to home THIS run, already in execution order (the view resolves order/philosophy)
 *   config: the per-axis homing config (settings.homing.axes) — method/dir/feeds/backoff/dual/rotary/offset
 *   softLimits: re-enable #655 at the end (default true)
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
        const method = c.method || 'native';

        // Homed-flag + machine-coord are written at their RESOLVED literal address (e.g. Z=#1517, #882) to match
        // the verified fndzero.nc / fndY.nc style exactly — #1515+ is a persistent var, and a literal write is the
        // proven-safe form (the seek/dual paths that compute an index prime through #107 the way Double_Y does).
        const flagVar = `#${1515 + N}`, coordVar = `#${880 + N}`;

        // A gantry slave that FOLLOWS this master (e.g. A slaved to Y): copy the master's machine coord to the
        // slave and mark it homed — the verified fndzero.nc / fndY.nc tail (`#883 = #881`, `#1518 = 1`).
        const syncSlave = () => {
            const s = parseInt(c.slaveFollows, 10);
            if (!Number.isInteger(s) || s < 0 || s > 4 || s === N) return;
            C(`Sync slave axis ${s} to ${L} (gantry slave)`);
            A(`#${880 + s}`, coordVar, `slave coord = ${L} coord`);
            A(`#${1515 + s}`, '1', 'slave homed flag');
        };

        if (method === 'native' || (method === 'dual' && !c.dual)) {
            // Controller built-in home — uses ITS configured switch/dir/speed. The safest method (fndzero.nc).
            C(`Home ${L} — native (controller config)`);
            RAW(`M98P501X${N}     ( home ${L} - axis ${N} )`);
            A(flagVar, '1', `${L} homed flag`);
            syncSlave();
            return;
        }

        if (method === 'setzero') {
            // Set the CURRENT position as machine home — no motion. (#[880+N]=0 then mark homed.)
            C(`Home ${L} — set current position as home (no motion)`);
            A(coordVar, '0', `${L} machine coord = 0 here`);
            A(flagVar, '1', `${L} homed flag`);
            return;
        }

        if (method === 'seek') {
            // Low-level switch-seek + back-off + slow re-seek, composed from M98 P503. Uses the per-axis param
            // registers verbatim (port/level/speed/dir), then zeroes the coord and re-seeks slowly for repeatability.
            const backoff = num(c.backoff, 5);
            C(`Home ${L} — switch-seek + back-off + slow re-seek`);
            A('#100', N, 'axis index');
            A('#101', `#[1045+#100*3]`, 'input port');
            A('#102', `#[1047+#100*3]`, 'active level');
            A('#103', `#[607+#100]`, 'seek speed');
            A('#104', `#[612+#100]`, 'seek direction');
            A('#105', backoff, 'back-off distance');
            RAW(`M98P503X#100     ( seek ${L} switch )`);
            A(`#[880+#100]`, '0', `${L} machine coord = 0`);
            // back-off direction = opposite the seek direction (#612: 0=neg seek → back +, 1=pos seek → back -)
            A('#106', `[1*[1-#104]]-#104`, 'back-off direction');
            RAW(`G91 G01 ${L}[#106*#105] F#103     ( back off )`);
            RAW(`M98P503X#100     ( slow re-seek ${L} )`);
            A(`#[880+#100]`, '0', `${L} machine coord = 0 (precise)`);
            RAW(`G91 G01 ${L}[#106*#105] F#103     ( back off clear )`);
            A('#107', `#[1515+#100]`, 'prime homed flag');
            A('#107', '1', `${L} homed flag`);
            A(`#[1515+#100]`, '#107');
            RAW('G90');
            syncSlave();
            return;
        }

        if (method === 'dual') {
            // Dual-motor gantry squaring (Double_Y_double_zero_switch.nc pattern): seek S1 on the master port,
            // zero the coord, cancel soft-limit, back off, seek S2 on the SLAVE's port, square the master by the
            // residual (pos1-pos2), re-sync, set the homed flag, re-enable soft-limit. Faithful to the verified macro.
            const c2 = c.dual || {};
            const slaveIdx = num(c2.slaveIdx, 3);
            const backoff = num(c.backoff, 10);
            const skew = num(c2.skew, 0);
            C(`Home ${L} — dual-motor squaring (master idx ${N}, slave idx ${slaveIdx})`);
            A('#100', N, 'master axis index');
            A('#101', `#[1045+#100*3]`, 'master input port');
            A('#102', `#[1047+#100*3]`, 'master active level');
            A('#103', `#[607+#100]`, 'seek speed');
            A('#104', `#[612+#100]`, 'seek direction');
            A('#105', backoff, 'back-off distance');
            RAW(`M98P503X#100     ( seek S1 - master switch )`);
            A(`#[880+#100]`, '0', `${L} machine coord = 0 (pos1)`);
            A('#655', '0', 'cancel soft-limit (squaring move)');
            A('#106', `[1*[1-#104]]-#104`, 'back-off direction');
            RAW(`G91 G01 ${L}[#106*#105] F#103     ( back off )`);
            C('Seek S2 on the SLAVE switch port');
            A('#101', `#[1045+${slaveIdx}*3]`, 'slave input port');
            A('#102', `#[1047+${slaveIdx}*3]`, 'slave active level');
            RAW(`M98P503X#100     ( seek S2 - slave switch )`);
            // residual #[880+N] = how far the master moved seeking S2 = master/slave skew → square it out
            if (skew) A(`#[880+#100]`, `#[880+#100]-${skew}`, 'apply skew offset');
            RAW(`G91 G01 ${L}[0-#[880+#100]] F#103     ( square master: pos1-pos2 )`);
            A(`#[880+#100]`, '0', `${L} machine coord = 0`);
            RAW(`G91 G01 ${L}[#106*#105] F#103     ( back off clear )`);
            A('#107', `#[1515+#100]`, 'prime homed flag');
            A('#107', '1', `${L} homed flag`);
            A(`#[1515+#100]`, '#107');
            A('#655', '1', 're-enable soft-limit');
            RAW('G90');
            return;
        }
    };

    axes.forEach(homeAxis);

    // Re-enable soft limits at the end (seek/dual cancel #655 mid-routine; a plain native run leaves it). #655
    // is global; setting it 1 is idempotent. Skip if the user disabled the re-enable (e.g. soft limits not used).
    if (params.softLimits !== false) {
        const anyMotion = axes.some((a) => { const m = (cfg[a] || {}).method; return m === 'seek' || m === 'dual' || m === 'native'; });
        if (anyMotion) { C('Re-enable soft limits'); A('#655', '1', 'soft-limit enable'); }
    }

    C('HOMING COMPLETE');
    END();
    return S;
}

/**
 * SIMULATION PROXY — engine-runnable G-code that VISUALISES homing, NOT the real macro.
 *
 * The emitted macro homes via the controller-native subs (M98 P501/P503), which the Studio sim engine can't
 * execute. So for the ▶ Simulate path we model the motion: for each axis in the configured order, rapid it to
 * its home END (machine frame, per the configured seek direction), then a short back-off — plain G53/G1 moves
 * the existing engine runs. This shows the homing ORDER and the final homed state. It is kept SEPARATE from
 * generate() (never mixed into the inserted macro).
 *
 * Home END machine coord: the machine travel (settings.machine.x/y/z) is SIGNED (sign = home direction). We
 * home toward that signed end and land at the home `offset` (usually 0). A slave that follows its master moves
 * with it (same target). Rotary set-zero axes just snap to 0 (no travel to model).
 */
export function homingSimProxy(params = {}) {
    const axes = Array.isArray(params.axes) ? params.axes.filter((a) => AX_IDX[a] != null) : [];
    const cfg = params.config || {};
    const machine = params.machine || {};
    const travel = { x: num(machine.x, 300), y: num(machine.y, 300), z: num(machine.z, 120), a: 0, b: 0 };

    const L = [];
    L.push('( SIMULATION PROXY — homing motion model, not the emitted macro )');
    L.push('G90');
    const homeEnd = (ax) => {
        const c = cfg[ax] || {};
        const t = travel[ax] || 0;
        // signed home end: + dir → +|travel|, − dir → −|travel|. offset shifts the landing point.
        const end = ((c.dir || '-') === '+' ? Math.abs(t) : -Math.abs(t));
        return Math.round((end + num(c.offset, 0)) * 1000) / 1000;
    };
    axes.forEach((ax) => {
        const c = cfg[ax] || {};
        const A = ax.toUpperCase();
        if ((ax === 'a' || ax === 'b') && (c.rotary || 'setzero') === 'setzero') { L.push(`G53 ${A}0     ( ${A} set zero )`); return; }
        const end = homeEnd(ax);
        L.push(`G53 G0 ${A}${end}     ( seek ${A} home )`);
        // back-off a touch toward centre so the homed state isn't sitting on the switch
        const back = Math.round((end - Math.sign(end || 1) * num(c.backoff, 5)) * 1000) / 1000;
        L.push(`G53 G1 ${A}${back} F${Math.round(num(c.slowFeed, 100))}     ( back off )`);
        const s = parseInt(c.slaveFollows, 10);
        if (Number.isInteger(s)) L.push(`( slave idx ${s} follows ${A} )`);
    });
    return L.join('\n');
}

export class HomingWizard {
    generate(params) {
        recordOp('homing', params);
        return emitMapped(homingStack(params)).text;
    }

    /** Engine-runnable motion model for the shared 3D preview (see homingSimProxy). */
    simProxy(params) { return homingSimProxy(params); }

    /** Preview start hint: the spindle's current spot is fine; homing pulls toward the machine ends. */
    inferStart() { return null; }
}
