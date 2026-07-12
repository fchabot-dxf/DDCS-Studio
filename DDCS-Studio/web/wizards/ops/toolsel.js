/**
 * wizards/ops/toolsel.js — TOOL SELECTION: a declared marker atom that records WHICH tool an op runs (the T-word /
 * tool-library number), so the sim renders the real cutter and (Phase 2) the emitter injects a tool-change prefix
 * before an op whose tool differs from the currently-loaded one.
 *
 * Like the entry-point marker, this is a childless MARKER — it EMITS NOTHING itself (Phase 1a). It is appended AFTER the
 * program body (a sibling, so it never shifts the body's flat indices → the as-data goldens' positional bindings stay
 * untouched). The DECLARED value is the tool NUMBER only (identity): the tool's diameter + tip SHAPE derive from the tool
 * library (settings.atc.tools[toolNum]) at sim/carve, so there is no {dia,tip} COPY on the op to drift from the table
 * (the one source). A free-typed toolDia stays the honest no-table fallback. UNSET (toolNum='') ⇒ no declared tool ⇒
 * BYTE-IDENTICAL (the op's own toolDia owns the cut). Phase 2 scans for this marker to drive the change-on-difference prefix.
 */
export const toolSelBlock = {
    type: 'toolsel', label: 'Tool', kind: 'toolsel', category: 'Transforms',
    defaults: { toolNum: '' },   // UNSET → no declared tool (the op's free-typed toolDia owns the cut)
    fields: ['toolNum'],
};

/** APPEND the tool-selection marker as a sibling AFTER the body — it emits nothing, so the body's flat indices are
 *  UNCHANGED (the goldens' positional bindings hold). A twin binds toolNum by IDENTITY (toolBindingsFor / a bindingSpec
 *  matching { type:'toolsel' }), so the marker's index is found by type, not a fixed offset. `exec` = the program body array. */
export function appendToolSel(exec) {
    return [...(exec || []), { type: 'toolsel', params: { toolNum: '' } }];
}
