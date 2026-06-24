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
 *   G31 granular seek       transparent raw G31  — UNVERIFIED faithful re-derivation of O501 (slib-g.nc); no
 *                                                  firmware flag write, so we set #[1515+N] ourselves. Advanced
 *                                                  path only; native M98 P501 is the robust default.
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
        const method = c.method || 'native';

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
            // ── G31 GRANULAR SEEK — a FAITHFUL re-derivation of the controller's O501 single-axis home seek
            //    (slib-g.nc lines ~157-304), emitted as TRANSPARENT raw G31 instead of the M98 P503 sub the native
            //    path uses. This is for advanced / unconventional uses (custom debounce, interleaved MSG/comm in the
            //    Blocks view, non-standard switch wiring). It is UNVERIFIED on hardware — `native` (M98 P501) is the
            //    robust, controller-flagged path. The tunables (dir / feeds / back-off / debounce passes) ride on
            //    these emitted atoms only; the wizard form stays a lean method-picker (no settings fields added).
            //
            //    SEQUENCE (mirrors O501): fast G31 toward the switch (signed by dir) → NOT-FOUND guard (#1920+N>2
            //    means a hard limit was struck instead of the home switch → reverse + re-seek) → 7-read debounce on
            //    the input register vs the expected level → back-off until release (inverted-level G31, Q1) → halve
            //    feed → multi-pass loop → set machine coord + homed flag. The trailing G53 "return to reference
            //    point" (O501 lines 251-298, machine-specific #622-626 + rotary remap) is NOT mirrored — it depends
            //    on per-machine reference offsets we don't carry, and the home itself is complete without it.
            //
            //    DIRECTION (granular per-axis): c.dir '+'/'-' wins; else the SIGNED machine-travel sign; else fall
            //    back to the controller's own #612 register (20000*#612-10000 → ±10000). Signs the seek distance.
            const backoff = num(c.backoff, 5);                       // back-off / release-clear distance (mm)
            const seekDist = 10000;                                  // O501: ±10000 signed seek distance
            const tSign = Math.sign(num((params.machine || {})[ax], 0)); // signed-travel sign (0 if unknown)
            const dir = c.dir === '+' ? 1 : c.dir === '-' ? -1 : (tSign || 0); // 0 ⇒ defer to controller #612
            const passes = Math.max(1, Math.round(num(c.seekPasses, 2)));     // O501 multi-pass (#606); default 2

            C(`Home ${L} — G31 GRANULAR SEEK (transparent re-derivation of O501)`);
            C(`G31 seek — transparent/UNVERIFIED: verify on hardware; native M98 P501 is the robust path`);
            A('#100', N, 'axis index N');
            // Seek distance, signed by the granular direction. dir==0 → use the controller's own #612 register
            // exactly as O501 does (20000*#[612+N]-10000), so config-driven machines still work.
            if (dir === 0) A('#102', `20000*#[612+#100]-10000`, 'seek dist (signed by controller #612)');
            else A('#102', `${dir * seekDist}`, `seek dist (signed by dir ${dir > 0 ? '+' : '-'})`);
            A('#103', `#[607+#100]`, 'fast seek feed');
            A('#104', `#[1910+#100]`, 'expected switch level (debounce target)');

            // ── Pass loop. #21 = pass counter (O501 #21); feed halves each pass (#22). ──
            A('#21', '0', 'pass counter');
            A('#22', `#103`, 'this-pass feed (halves each pass)');
            C('N41  ( ---- seek pass ---- )');

            // Fast G31 toward the switch. P=port #[1045+N*3], L=active level #[1047+N*3], K0, Q0 (per O501 line 190).
            C(`Fast G31 ${L} toward home switch`);
            RAW(`G91 G31 ${L}[#102] F#22 P#[1045+#100*3] L#[1047+#100*3] K0 Q0     ( seek switch )`);

            // NOT-FOUND guard: #[1920+N] > 2 means a HARD LIMIT was struck, not the home switch (O501 line 192:
            // IF #[1920+N]<=2 GOTO found). If so, reverse the seek and try once from the other side, exactly like
            // O501 lines 193-197. (#1920+N semantics UNVERIFIED — see report.)
            RAW(`IF #[1920+#100]<=2 GOTO42     ( home switch hit -> debounce )`);
            C('Limit struck instead of home switch — reverse and re-seek');
            A('#102', `-#102`, 'reverse seek');
            RAW(`G91 G31 ${L}[#102] F#103 P#[1045+#100*3] L#[1047+#100*3] K0 Q0     ( re-seek from far side )`);

            // ── Debounce: O501 lines 199-214 sum 7 reads of the input register #[1520+#[1900+N]-1] into #24;
            //    <4 → 0, else → 1 (majority vote). Then compare to the expected level #[1910+N]. ──
            C('N42  ( debounce — 7-read majority vote on the home input )');
            A('#24', '0', 'debounce accumulator');
            for (let r = 0; r < 7; r++) A('#24', `#24+#[1520+#[1900+#100]-1]`, r === 0 ? 'read home input x7' : '');
            RAW('IF #24<4 GOTO43     ( majority LOW )');
            A('#24', '1', 'majority HIGH');
            RAW('GOTO44');
            C('N43'); A('#24', '0', 'settled LOW');
            C('N44');
            RAW('IF #24==#104 GOTO45     ( settled in switch zone -> back off )');
            // Overshot the switch zone (O501 line 217): reverse-seek back into it, Q1.
            C('Overshot switch zone — reverse-seek back into it');
            RAW(`G91 G31 ${L}[-#102] F#22 P#[1045+#100*3] L#[1047+#100*3] K0 Q1     ( back into zone )`);

            // ── Back-off until release: reverse-seek with the INVERTED active level L[1-#[1047+N*3]] and Q1
            //    (O501 line 220 — seek the switch's RELEASE edge for a repeatable datum). ──
            C('N45  ( back off until switch releases — inverted level, Q1 )');
            RAW(`G91 G31 ${L}[-#102] F#22 P#[1045+#100*3] L[1-#[1047+#100*3]] K0 Q1     ( seek release edge )`);

            // Halve feed for the next, finer pass (O501 lines 222-223).
            A('#22', `#22/2`, 'halve feed for next pass');
            A('#21', `#21+1`, 'pass++');
            RAW(`IF #21<${passes} GOTO41     ( more passes )`);

            // ── Datum: set machine coord + homed flag. O501 sets #[880+N]=#[735+N] (reference offset); we don't
            //    carry #735, so we zero the coord here (#[880+N]=0) — the same datum the setzero/native paths use.
            //    The seek path writes the homed flag itself (O501 line 245) since no firmware sub did it. ──
            C(`${L} homed — set machine coord + homed flag`);
            A(`#[880+#100]`, '0', `${L} machine coord = 0 at datum`);
            A(`#[1515+#100]`, '1', `${L} homed flag`);

            // Final clearance back-off so the homed state isn't sitting on the switch (granular back-off distance),
            // away from the switch i.e. opposite the seek direction. dir 0 (deferred to #612) → back off positive.
            RAW(`G91 G01 ${L}${(-dir || 1) * backoff} F#22     ( clearance back-off )`);
            RAW('G90');
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
    const travel = { x: num(machine.x, 300), y: num(machine.y, 300), z: num(machine.z, -120), a: 0, b: 0 };

    const L = [];
    L.push('( SIMULATION PROXY — homing motion model, not the emitted macro )');
    L.push('G90');
    const homeEnd = (ax) => {
        const c = cfg[ax] || {};
        const t = travel[ax] || 0;
        // Home end follows the SIGNED travel (its sign = home direction). An explicit c.dir — set by a Homing block,
        // never the settings form — overrides; otherwise derive from the travel sign. offset shifts the landing point.
        const end = c.dir === '+' ? Math.abs(t) : c.dir === '-' ? -Math.abs(t) : t;
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
