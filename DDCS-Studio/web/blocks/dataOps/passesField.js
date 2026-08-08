/**
 * blocks/dataOps/passesField.js — the DERIVED `passes` field, declared ONCE for every depth+stepdown wizard.
 *
 * t1613 (user-ruled, INCREMENT semantics). `passes` is a FORM-side convenience field: it has NO emit socket
 * (no match/blockIndex — instantiate ignores it, the emit is byte-identical), and its value is DERIVED from
 * the two fields that do emit: `ceil(depth / stepdown)`. Stepping it writes DEPTH back through the declared
 * INCREMENT expression — `depth + (passes − ceil(depth/stepdown)) × stepdown` — which adds/removes WHOLE
 * stepdown bites, so an adapted final pass survives: at depth 1.6 / stepdown 0.5, passes reads 4
 * (0.5·0.5·0.5·0.1); stepping to 5 makes depth 2.1, and the 0.1 finishing pass is still there. The rejected
 * alternative (snap depth to passes × stepdown) would silently re-split the user's total.
 *
 * The `derived` / `writes` slots are DECLARATIONS consumed by ui/formWidgets.wireDerivedFields (both faces,
 * one engine): derives recompute on any OTHER field's edit; writes fire ONLY on a user gesture on THIS
 * field, and a write triggers derives, never other writes. Errors are NAMED inline — never a silent zero.
 */

export const PASSES_FIELD = {
    param: 'passes', type: 'int', widget: 'stepper', label: 'Passes',
    derived: 'ceil(depth / stepdown)',
    writes: { depth: 'depth + (passes - ceil(depth / stepdown)) * stepdown' },
    widgetConfig: { min: 1, step: 1 },
    help: 'How many Z passes the total depth ÷ depth-per-pass works out to. Step it to ADD or REMOVE whole passes — the total depth follows by whole stepdown bites, so an adapted final pass (e.g. a 0.1 finishing cut) is preserved, never re-split.',
};

/** Splice the passes field into a twin's assembled binding list, directly after its `stepdown` binding
 *  (inheriting that row's section so it lands in the same fold). ONE consumer shape for all five twins. */
export function withPassesField(bindings) {
    const i = bindings.findIndex((b) => b && b.param === 'stepdown');
    const f = { ...PASSES_FIELD };
    if (i >= 0 && bindings[i].section) f.section = bindings[i].section;
    const out = [...bindings];
    out.splice(i < 0 ? out.length : i + 1, 0, f);
    return out;
}
