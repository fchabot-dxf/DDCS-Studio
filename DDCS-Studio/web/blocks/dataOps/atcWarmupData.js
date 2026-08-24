/**
 * blocks/dataOps/atcWarmupData.js — the SPINDLE-WARMUP built-in expressed as a pure DATA definition (ROADMAP Stage 5,
 * the 2nd port — validates the wizards-as-data harness on a non-drill, non-placement op).
 *
 * WHY atc_warmup is a clean STATIC-SHAPE port (unlike WCS, which branches on auto/fixed + conditionally includes
 * axis/sync assigns → not data-expressible at all): `atcWarmupStack` always emits the SAME block sequence regardless
 * of params — a fixed 18-atom stack [comment×3, confirm, spindle-off, coolant-off, comment, message, spindle, dwell,
 * comment, message, spindle, dwell, spindle-off, message, label, endprogram]. The 4 params map to plain scalar
 * sockets: rpm1→stage-1 spindle.rpm, time1→stage-1 dwell.sec, rpm2→stage-2 spindle.rpm, time2→stage-2 dwell.sec.
 *
 * THE FRONTIER this port surfaced — COMPUTED ANNOTATION TEXT — is now CLOSED for this op (was: the builder interpolated
 * params into comment + operator-message TEXT — `( Stage 1: 6000 RPM for 30s )`, `#1505=…(Starting at 6000 RPM)` — that a
 * static template FROZE at author-time, so a forked 8000-RPM warmup would TELL THE OPERATOR "6000 RPM" — a stale message,
 * a lie at the machine, NOT a mere cosmetic nit). FIXED at the SOURCE (north-star directive 1): the wizard's annotation
 * text is now STATIC — the rpm/time are the single source of truth in the executable Spindle/Dwell atoms, never duplicated
 * into prose (principle #4). The def is now BYTE-IDENTICAL to atcWarmupStack (no stripAnnotations), matching drill's standard.
 * ⇒ Stage-5 taxonomy: frozen DERIVED values split into FUNCTIONAL (placement/method/conditional-shape — must solve) and
 *   ANNOTATION TEXT. The latter splits again: VALUE-FREE messages → make them static (this op); VALUE-BEARING messages an
 *   operator reads before acting (e.g. a probe "Probing 50mm — press Enter") → a future GENERAL annotation-text atom that
 *   renders text from a BOUND param (like Spindle renders M3 S<rpm>), built when an op FORCES it — NOT speculatively. As
 *   each op is ported, classify its messages droppable (static) vs value-bearing (needs the atom). See NEXT-SESSION.
 *
 * The template is SEEDED from atcWarmupStack(ATC_WARMUP_DEFAULTS) (== the canonical valid-by-construction default
 * stack); the hand-authored BINDINGS map is the independent artifact, proven by the structural binding-wiring check.
 */
import { atcWarmupStack } from '../../wizards/stacks/atcWarmupWizard.js';
import { userOpFromStack } from '../userOps.js';

/** Author defaults — match atcWarmupStack's own num() fallbacks so the seeded template == the true default stack. */
export const ATC_WARMUP_DEFAULTS = { rpm1: 6000, time1: 30, rpm2: 12000, time2: 30 };

// Hand-authored binding map → execution-stack indexes (atcWarmupStack pushes a flat stack, no nesting):
//   0 comment · 1 comment · 2 comment · 3 confirm · 4 spindle(off) · 5 coolant(off) · 6 comment · 7 message ·
//   8 spindle(stage1) · 9 dwell(stage1) · 10 comment · 11 message · 12 spindle(stage2) · 13 dwell(stage2) ·
//   14 spindle(off) · 15 message · 16 label · 17 endprogram
const ATC_WARMUP_EXEC_BINDINGS = [
    { param: 'rpm1', blockIndex: 8, key: 'rpm', type: 'number', default: ATC_WARMUP_DEFAULTS.rpm1 },
    { param: 'time1', blockIndex: 9, key: 'sec', type: 'number', default: ATC_WARMUP_DEFAULTS.time1 },
    { param: 'rpm2', blockIndex: 12, key: 'rpm', type: 'number', default: ATC_WARMUP_DEFAULTS.rpm2 },
    { param: 'time2', blockIndex: 13, key: 'sec', type: 'number', default: ATC_WARMUP_DEFAULTS.time2 },
];

// Wrapped-template indexes (user_root + param_group precede execution children).
// t2257 (BACKLOG 20) — was 4 (user_root + panel + sim + param_group); removing the redundant, id-colliding
// 'panel' node (see atcChangeData.js's own comment) drops this to 3. Caught live: registerUserOp threw
// "binding (block 16.rpm) does not resolve in the template" for every param after the panel removal alone —
// this constant is the ONE place that offset was hardcoded, and it was the ONLY thing left pointing at the
// old wrap shape. Full suite re-run confirmed clean after this fix.
const WRAP_PREFIX_COUNT = 3;   // user_root + sim + param_group
export const ATC_WARMUP_BINDINGS = ATC_WARMUP_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const ATC_WARMUP_DATA_OPTYPE = 'user_atc_warmup_data';

/** Build the spindle-warmup-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function atcWarmupDataDef() {
    const exec = atcWarmupStack(ATC_WARMUP_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t407 IN-PLACE — the built-in atcWarmupView is twoPane with a 3D machine preview (preview3D +
            // previewMachine), so the twin must show the SAME so the DECLARED machine+magazine sim renders.
            // Display-only (this whole node emits nothing) → emit byte-identical.
            // t2257 (BACKLOG 20) — the separate 'panel' node t407 added alongside 'sim' is REMOVED: it was
            // inert (params.panel isn't read by formWidgets.js's panel branch) and id-collided with sim's
            // own layout2d pane — see atcChangeData.js's own comment for the full reasoning. layout2d: false
            // is the CORRECT way to say "3D preview, no 2D pane" that t407 was reaching for with 'form3d'.
            { type: 'sim', params: { rotary: false, machine: true, magazine: true, layout2d: false } },
            {
                type: 'param_group',
                params: { group: 'Spindle Warmup' },
                children: [],
            },
        ],
        children: exec,
    }];
    return userOpFromStack('atc_warmup_data', 'Spindle Warmup (data)', stack, ATC_WARMUP_BINDINGS, 'form3d', { forceMachine: true, showMagazine: true }, 'atc_datawiz');
}
