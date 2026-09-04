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
import { deriveBindingsFor } from './deriveBindings.js';

/** Author defaults — match atcWarmupStack's own num() fallbacks so the seeded template == the true default stack. */
export const ATC_WARMUP_DEFAULTS = { rpm1: 6000, time1: 30, rpm2: 12000, time2: 30 };

// t2605 (BACKLOG #71/#72 conversion tier) — CONVERTED from hand-counted `blockIndex` values (a
// `WRAP_PREFIX_COUNT`-style constant this file's own comment already names as the exact hazard class
// `deriveBindings.js`'s header warns against — it desynced once already, t2257, and needed a live-caught fix)
// to identity-based `match`. THE GENUINE WRINKLE: atcWarmupStack's own two stages (spindle-on + dwell, twice)
// are STRUCTURALLY IDENTICAL blocks with no per-stage identity field at all — `{type:'spindle', params:
// {dir:'cw'}}` alone still matches BOTH stage blocks (ambiguous), and `{type:'dwell'}` alone matches both
// dwells too (their own DEFAULT sec values even collide: time1=time2=30). `{type, params, nth}` — a small,
// genuinely-needed extension to deriveBindings.js's own match vocabulary (t2605) — resolves this: `nth` counts
// position WITHIN THE TYPE[+params]-FILTERED SUBSET, not an absolute flatten offset, so it stays immune to the
// uiChildren-restructuring hazard this whole conversion tier exists to close (see deriveBindings.js's own
// updated header for the full reasoning). The `dir:'cw'` filter on spindle excludes the two spindle-OFF
// blocks (no `dir` key at all) before `nth` picks stage 1 vs stage 2.
// t2383 — SECTION ABSENCE, fixed (unchanged from before this turn): none of these four carried `section:` at
// all (t2381's own registry survey flagged it, 0/4). The shell (index.html:917-940) declares exactly ONE
// section — "WARM-UP SEQUENCE" — covering all four fields, already in the shell's own order.
// KEPT ALIVE under its historic name: `tests/atc-warmup-as-data.spec.js` imports `ATC_WARMUP_BINDINGS` directly
// (a real external consumer, reading only `.param`/`.key` from each entry — never `.blockIndex` off this array
// itself, only off the REGISTERED def's own bindings — so renaming the fields from blockIndex to match loses
// nothing that test needs; only the export NAME must stay the same).
export const ATC_WARMUP_BINDINGS = [
    { param: 'rpm1', match: { type: 'spindle', params: { dir: 'cw' }, nth: 0 }, key: 'rpm', type: 'number', default: ATC_WARMUP_DEFAULTS.rpm1, section: 'WARM-UP SEQUENCE' },
    { param: 'time1', match: { type: 'dwell', nth: 0 }, key: 'sec', type: 'number', default: ATC_WARMUP_DEFAULTS.time1, section: 'WARM-UP SEQUENCE' },
    { param: 'rpm2', match: { type: 'spindle', params: { dir: 'cw' }, nth: 1 }, key: 'rpm', type: 'number', default: ATC_WARMUP_DEFAULTS.rpm2, section: 'WARM-UP SEQUENCE' },
    { param: 'time2', match: { type: 'dwell', nth: 1 }, key: 'sec', type: 'number', default: ATC_WARMUP_DEFAULTS.time2, section: 'WARM-UP SEQUENCE' },
];

export const ATC_WARMUP_DATA_OPTYPE = 'user_atc_warmup_data';

/** Build the spindle-warmup-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function atcWarmupDataDef() {
    // t2605 (Phase 1 step 1) — static shape (no superset/guards), but STILL re-derived fresh against the final
    // tree-shaped stack (t2595's own finding: match bakes a concrete blockIndex at DERIVE time and never
    // re-resolves — reusing ATC_WARMUP_BINDINGS's own raw specs directly against a DIFFERENT stack shape than
    // whatever it was last derived against would break identically to the blockIndex this conversion removed).
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2605 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes
            // this twin onto renderUiTree, the SAME mechanism drill/surfacing/bore/.../atc_length already use.
            // No classic shell to reproduce for THIS twin's own purposes (`#wiz_atc_warmup`, index.html:941, is
            // a real, still-live classic shell like atc_table/test/change — this twin stays unlinked from it,
            // opened separately) — usage_text written fresh.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Spindle Warmup' },
                    children: [
                        { type: 'usage_text', params: { text: 'Runs a two-stage spindle warmup: spin up and hold at each RPM for the set time, then stop. Useful after a cold start or a long idle before cutting.' } },
                        { type: 'group_box', params: { title: 'WARM-UP SEQUENCE' }, children: fieldRefsOf(ATC_WARMUP_BINDINGS) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2605 (Phase 1 step 2) — panel='form3d' (no 2D pane). preview3d declared ALONE — the shape
                // BACKLOG #77 fixed (t2603), already proven across 5 ATC ops; this op shares the identical
                // mechanism, not re-verified from scratch.
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: true, magazine: true } },
                ],
            },
        }],
        children: atcWarmupStack(ATC_WARMUP_DEFAULTS),
    }];
    const bindings = deriveBindingsFor(stack, ATC_WARMUP_BINDINGS);
    return userOpFromStack('atc_warmup_data', 'Spindle Warmup (data)', stack, bindings, 'form3d', { forceMachine: true, showMagazine: true }, 'atc_datawiz');
}
