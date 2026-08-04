/**
 * blocks/opToolbox.js — THE REGISTERED WIZARDS REACH THE BLOCKS PALETTE (t1315).
 *
 * ── THE ROOT CAUSE, which was not a filter and not a stale map ───────────────────────────────────────────────────
 * `buildToolbox` was built from two sources: the ATOM palette (wizards/ops/index.js) and whatever categories the
 * caller passed in — the curated learner library. The federated op registry was never one of them. So a workspace
 * could hold seven registered lathe twins and the palette would show none of them: not hidden, not filtered out,
 * simply never wired. (The `OP_BLOCKS` list in the Blockly bridge is a separate, hand-kept thing that predates the
 * user layer; adding to it would have been the hand edit this file exists to avoid.)
 *
 * ── SO IT IS DERIVED, NOT LISTED ────────────────────────────────────────────────────────────────────────────────
 * Every registered op is offered, grouped by the `group` it already declares, labelled from the group registry that
 * already names them. Nothing here knows what a lathe is. Register the eighth lathe op — or a family nobody has
 * thought of yet — and it appears in the palette with no edit to this file, which is the property that was missing.
 *
 * ── AND WHAT IT OFFERS IS THE OP'S OWN STACK ────────────────────────────────────────────────────────────────────
 * Each entry is `builderOf(opType)(defaultParams(def))` — the SAME builder the wizard's Insert runs. So a block
 * dragged out of the palette emits what the wizard emits, by construction rather than by a copy kept in step; and
 * because the stack is real atoms, editing a field in it moves the program exactly as editing the wizard would.
 */
import { listUserOps, defaultParams, materializeParamGroup } from './userOps.js';
import { builderOf } from './opBuilders.js';
import { stackToFlyoutBlock } from './blockly/stackBridge.js';
import { getLibrary } from './wizardLibrary.js';

/** The colour a family's category wears. The lathe has its own; everything else takes the neutral ops slate. */
const CAT_STYLE = { lathe: 'lathe_cat' };
const DEFAULT_STYLE = 'ops_cat';

/** The label a group id reads as, from the group registry that already declares it (never a second list here). */
function groupLabels() {
    const out = {};
    try { for (const g of (getLibrary().groups || [])) out[g.id] = g.label || g.id; } catch (_) { /* registry unavailable → ids */ }
    return out;
}

/** …and a readable fallback for a group the registry does not name, so a raw id never reaches a person's eyes. */
const prettify = (id) => String(id || '').split(/[_-]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * The registered wizard families, as toolbox categories.
 * @param {object} opts  `only` — restrict to these group ids (unused today; the palette shows every family)
 * @returns {Array} categories in the shape buildToolbox's `extraCategories` takes
 */
export function opToolboxCategories(opts = {}) {
    let defs = [];
    try { defs = listUserOps() || []; } catch (_) { return []; }
    const labels = groupLabels();
    const byGroup = new Map();
    for (const def of defs) {
        if (!def || def.hidden) continue;
        const g = def.group || 'custom';
        if (opts.only && !opts.only.includes(g)) continue;
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(def);
    }
    const cats = [];
    for (const [g, list] of byGroup) {
        const contents = list.map((def) => {
            try {
                const build = builderOf(def.opType);
                let stack = build ? build(defaultParams(def)) : null;
                // t1111 (S5.3) — dynamically materialize the param_group for the palette so built-in wizards
                // don't present an empty form when dragged onto the canvas.
                if (stack && stack.length && stack[0] && stack[0].type === 'user_root') {
                    const tempDef = { opType: def.opType, template: stack, bindings: def.bindings, bindingSpecs: def.bindingSpecs };
                    materializeParamGroup(tempDef);
                    stack = tempDef.template;
                }
                const blk = stack && stack.length ? stackToFlyoutBlock(stack) : null;
                // …a family entry is the op's own stack, so what lands on the canvas IS what the wizard inserts
                return blk;
            } catch (_) { return null; }   // an op whose builder throws is skipped, never a broken palette entry
        }).filter(Boolean);
        if (contents.length) {
            cats.push({ kind: 'category', name: labels[g] || prettify(g), categorystyle: CAT_STYLE[g] || DEFAULT_STYLE, contents });
        }
    }
    if (!cats.length) return [];
    // One collapsible parent, so the rail reads: Atoms · Wizards · Snippets · Programs.
    return [{ kind: 'category', name: '🧩 Wizards', expanded: 'true', contents: cats }];
}
