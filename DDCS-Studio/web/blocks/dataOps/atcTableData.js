/**
 * blocks/dataOps/atcTableData.js — the ATC TOOL TABLE built-in as a pure DATA definition (E1, t568; on the E0 superset). THE
 * LAST WIZARD of the port campaign.
 *
 * atc_table is a pure LIVE VIEW over Settings → Tool table: the apply-macro (tool lengths #[toolTable+n-1], pocket XYZ
 * #1330/#1350/#1370, no motion) whose real inputs are the tools[] + magazine[] arrays + the two include-toggles. So the twin
 * is a DECLARED LIVE-VIEW like the atc_change inlineTnc arm — postInstantiate REGENERATES the whole body from the CURRENT
 * settings.atc.tools/magazine every instantiation (the rows UNROLL live; a tool-length edit in Settings → the next emit
 * tracks). DOCUMENTED GAP: edits inside the unrolled rows do NOT survive (it is a view of the current table).
 *
 *   • the E0 superset (atcTableStack{superset:true}) carries BOTH include sections GUARDED by the derived _lengths/_pockets/
 *     _pocketsNA keys — the re-authorable TEMPLATE (the Blocks structure + the E0 prune gate).
 *   • deriveGuards injects those keys so pruneGuards collapses the template to the chosen toggles.
 *   • postInstantiate regenerates wholesale from the live table (the ONE source — never a snapshot in the marker).
 *
 * NO second table editor — the edit UI STAYS Settings → Tool table (one source): the in-place form = the two toggles + the
 * 'Edit table…' button (an action widget) + the emit preview. NOT registered/in-place yet (E2 — done alongside).
 */
import { atcTableStack, atcTableGuardKeys } from '../../wizards/stacks/atcTableWizard.js';
import { userOpFromStack } from '../userOps.js';

export const ATC_TABLE_DATA_OPTYPE = 'user_atc_table_data';

/** Author defaults — MIRROR the run-form (the twin-default rule): both include toggles ON (the atc_table panel's checkboxes
 *  default checked). The tools[]/magazine[] are NOT form fields — they are live settings, read + unrolled at instantiation. */
export const ATC_TABLE_DEFAULTS = { includeLengths: true, includePockets: true };

/** The op params (the run-form): the two include toggles + the 'Edit table…' action button (opens Settings → ATC = the ONE
 *  table editor; contributes no param). The rows come from the live table, never the form. */
// t1890 — includeLengths writes #[toolTable+n-1] (the confirmed-mapped length-table register on every DDCS variant +
// rs274ngc/centroid; absent only on grbl) → gated on `_toolTableOk`, same as atcLengthData/atcCheckData.
// includePockets writes #1330/#1350/#1370 — the ATC pocket/model registers, governed by the SEPARATE `atc` cap, which
// t1890 found encodes an EVIDENCE GAP on V4.1/DM500 (not a confirmed absence — see WORK-LOG t1890) — left UNGATED
// this turn, pending the advisor's ruling on atc; its own help text already names the "mapped ATC model" caveat.
// t2383 — SECTION NAME, corrected: the shell (index.html:957) declares "TOOL TABLE → CONTROLLER", not the
// shorter 'TABLE' this array used — same single section either way (only 3 bindings, well below
// formWidgets.js's own SECTION_THRESHOLD=8, so chrome doesn't render regardless — the WCS/atc_warmup
// situation), but the DECLARATION should still name the shell's own string exactly.
export const ATC_TABLE_STRUCT_BINDINGS = [
    { param: 'includeLengths', type: 'bool', default: ATC_TABLE_DEFAULTS.includeLengths, label: 'Write tool lengths', help: 'Emit the library tool-length writes (#[table base + T−1]).', section: 'TOOL TABLE → CONTROLLER',
        gate: { param: '_toolTableOk', is: false, tip: 'This controller has no in-program tool-length table to write to.' } },
    { param: 'includePockets', type: 'bool', default: ATC_TABLE_DEFAULTS.includePockets, label: 'Write pocket positions', help: 'Emit the magazine pocket XYZ writes (needs a controller with a mapped ATC model).', section: 'TOOL TABLE → CONTROLLER' },
    { param: '_setup', type: 'bool', widget: 'action', action: 'atcTableEdit', default: false, label: 'Edit table…', help: 'Open Settings → ATC: the tool library (lengths) + the magazine (pocket XYZ) — the ONE source this macro writes.', section: 'TOOL TABLE → CONTROLLER' },
];

/** CURRENT table the emit unrolls — the LIVE tools[]/magazine[] (never a frozen snapshot). */
function liveTable() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings() || {}) : {};
    const a = s.atc || {};
    return { tools: Array.isArray(a.tools) ? a.tools : [], magazine: Array.isArray(a.magazine) ? a.magazine : [] };
}

// t2601/t2603 (BACKLOG #71/#72/#77) — `atcTableDataStack()` (the old flat-render `user_root` wrapper) is
// REMOVED here — `atcTableDataDef()` below now builds its own tree-shaped stack inline, and grepping the whole
// repo found no other caller (product code or test) invoking this function by name.

/** The DERIVED guard keys — the include sections (+ the post-dependent pockets/no-ATC fork), so pruneGuards collapses the
 *  superset to the chosen toggles. ONE source with the concrete build (atcTableGuardKeys). */
export function atcTableDeriveGuards(p) { return atcTableGuardKeys(p); }

/** The M2 recompose — a DECLARED LIVE-VIEW: regenerate the WHOLE body from the live table via atcTableStack (the ONE source).
 *  Edits inside the rows do not survive (the documented live-view gap, like the atc_change inlineTnc arm). */
function applyAtcTableRecompose(stack, resolved) {
    const root = (Array.isArray(stack) ? stack : []).find((b) => b && b.type === 'user_root');
    if (!root || !Array.isArray(root.children)) return stack;
    const t = liveTable();
    root.children = atcTableStack({ ...resolved, tools: t.tools, magazine: t.magazine }, {});
    return stack;
}

/** Build the tool-table-as-data def — the E0 superset template + deriveGuards + the live-view recompose. Byte-identical to
 *  atcTableStack across the toggle × table-size sweep. NO opensAs yet (E2). */
export function atcTableDataDef() {
    // t2601 (BACKLOG #71/#72, Phase 1 step 1) — no value bindings (every param is a plain bool toggle or the
    // `_setup` action button), so no two-phase derive is needed — same shape as homing. ONE group_box (the
    // shell's own single section, "TOOL TABLE → CONTROLLER").
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2601 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes
            // this twin onto renderUiTree, the SAME mechanism drill/surfacing/bore/.../homing already use.
            // Unlike every op migrated so far, atc_table's own CLASSIC shell (`#wiz_atc_table`, index.html:967)
            // is NOT retired — it is a real, separate, currently-live UI (atcViews.js's own panel class); this
            // twin is simply "NOT registered/opened in-place yet (E2)" per this file's own header, so the two
            // surfaces coexist unlinked rather than one having replaced the other. No usage_text precedent to
            // reproduce from that shell (it renders its own bespoke markup, an unrelated code path) — written
            // fresh, matching every other twin's own quality bar.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Tool Table' },
                    children: [
                        { type: 'usage_text', params: { text: 'A live view over Settings → ATC: writes the tool-length table and/or the magazine pocket positions from whatever the tool library and magazine currently hold — edit the table in Settings, not here. This op stores only which sections to write.' } },
                        { type: 'group_box', params: { title: 'TOOL TABLE → CONTROLLER' }, children: fieldRefsOf(ATC_TABLE_STRUCT_BINDINGS) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2601 (Phase 1 step 2) — panel='form3d' (no 2D pane — layout2d:false on the old sim node,
                // since ATC has no param_field/block that ever declares 2D geometry). preview3d declared ALONE,
                // with NO adjacent feature_canvas sibling. t2603 (BACKLOG #77) — this is the case that was
                // FOUND BROKEN and FIXED this turn: formWidgets.js's own preview3d-alone template now builds
                // the SAME logical box name (`userVizBox`/`userVizContainer`) userOpView.js's own single-panel
                // `'3d'`-mode branch already mounts into, instead of the `userViz3dBox`/`userViz3dContainer`
                // name that branch never looked up. Verified live before shipping (a scratch probe, 2 real
                // canvases mounted, zero console errors) — not re-attempted blind.
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, magazine: true, toolMachine: true } },
                ],
            },
        }],
        children: atcTableStack({ ...ATC_TABLE_DEFAULTS, tools: liveTable().tools, magazine: liveTable().magazine }, { superset: true }),
    }];
    const def = userOpFromStack('atc_table_data', 'Tool Table (data)', stack, [...ATC_TABLE_STRUCT_BINDINGS], 'form3d', { forceMachine: true, showMagazine: true, toolMachineFrame: true }, 'atc_datawiz');
    def.deriveGuards = atcTableDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyAtcTableRecompose(stack, resolved);
    return def;
}
