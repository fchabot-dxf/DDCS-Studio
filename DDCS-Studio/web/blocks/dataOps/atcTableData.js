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
import { atcTableStack, atcTableGuardKeys } from '../../wizards/atcTableWizard.js';
import { userOpFromStack } from '../userOps.js';

export const ATC_TABLE_DATA_OPTYPE = 'user_atc_table_data';

/** Author defaults — MIRROR the run-form (the twin-default rule): both include toggles ON (the atc_table panel's checkboxes
 *  default checked). The tools[]/magazine[] are NOT form fields — they are live settings, read + unrolled at instantiation. */
export const ATC_TABLE_DEFAULTS = { includeLengths: true, includePockets: true };

/** The op params (the run-form): the two include toggles + the 'Edit table…' action button (opens Settings → ATC = the ONE
 *  table editor; contributes no param). The rows come from the live table, never the form. */
export const ATC_TABLE_STRUCT_BINDINGS = [
    { param: 'includeLengths', type: 'bool', default: ATC_TABLE_DEFAULTS.includeLengths, label: 'Write tool lengths', help: 'Emit the library tool-length writes (#[table base + T−1]).', section: 'TABLE' },
    { param: 'includePockets', type: 'bool', default: ATC_TABLE_DEFAULTS.includePockets, label: 'Write pocket positions', help: 'Emit the magazine pocket XYZ writes (needs a controller with a mapped ATC model).', section: 'TABLE' },
    { param: '_setup', type: 'bool', widget: 'action', action: 'atcTableEdit', default: false, label: 'Edit table…', help: 'Open Settings → ATC: the tool library (lengths) + the magazine (pocket XYZ) — the ONE source this macro writes.', section: 'TABLE' },
];

/** CURRENT table the emit unrolls — the LIVE tools[]/magazine[] (never a frozen snapshot). */
function liveTable() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings() || {}) : {};
    const a = s.atc || {};
    return { tools: Array.isArray(a.tools) ? a.tools : [], magazine: Array.isArray(a.magazine) ? a.magazine : [] };
}

/** The wrapped `user_root` template — the E0 superset (both include sections guarded), machine-frame sim (envelope + the
 *  magazine tiles; a no-motion op → the preview is the bare envelope + rack). Seeded with the live table so the Blocks view
 *  shows real rows; instantiation regenerates from the live table. */
export function atcTableDataStack(params = ATC_TABLE_DEFAULTS) {
    const t = liveTable();
    const exec = atcTableStack({ ...params, tools: params.tools || t.tools, magazine: params.magazine || t.magazine }, { superset: true });
    return [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d' } },
            { type: 'sim', params: { rotary: false, machine: true, magazine: true, toolMachine: true } },
            { type: 'param_group', params: { group: 'Tool Table' }, children: [] },
        ],
        children: exec,
    }];
}

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
    const def = userOpFromStack('atc_table_data', 'Tool Table (data)', atcTableDataStack(ATC_TABLE_DEFAULTS), [...ATC_TABLE_STRUCT_BINDINGS], 'form3d', { forceMachine: true, showMagazine: true, toolMachineFrame: true }, 'atc_datawiz');
    def.deriveGuards = atcTableDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyAtcTableRecompose(stack, resolved);
    return def;
}
