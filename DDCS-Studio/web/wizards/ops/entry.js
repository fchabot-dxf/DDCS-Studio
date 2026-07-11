/**
 * wizards/ops/entry.js — ENTRY POINT: a declared marker atom that routes the program's OPENING rapid through a chosen XY
 * at clearance, BEFORE the cut's own entry.
 *
 * The mill twins used to carry a sim-only jog circle (never emitted) that churned the user across several behaviour
 * rounds. This DECLARES the operator's intent instead. The block is a childless MARKER (it emits nothing itself — kept a
 * sibling APPENDED after the program body so it never shifts the body's flat indices → the as-data goldens' positional
 * bindings stay untouched). The WAYPOINT is applied ONCE, at emitMapped, by scanning for this block and — only when its
 * entryX/entryY differ from the DERIVED cut entry beyond ε (firstRapidXY, the one shared cut-entry source) — inserting a
 * single `G0 X Y` at clearance before the first cut move. Default (unset) / within-ε ⇒ BYTE-IDENTICAL. The declaration
 * round-trips as block intent (entryX/entryY editable in Blocks); the emitting-square marker drags to write them.
 */
export const entryBlock = {
    type: 'entry', label: 'Entry Point', kind: 'entry', category: 'Transforms',
    defaults: { entryX: '', entryY: '' },   // UNSET → no waypoint (the cut owns its entry)
    fields: ['entryX', 'entryY'],
};

/** THE ONE cut-entry source (the graft): the first placed rapid with BOTH X and Y = the program's cut entry. Consumed by
 *  BOTH the emitMapped waypoint pass (ε-compare + insert index) AND the marker rendering (where the square sits when
 *  unset) so they can never disagree. Returns { x, y, index } (index = the line the waypoint inserts before) or null. */
export function firstRapidXY(text) {
    const lines = String(text || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (!/\bG0\b/.test(ln)) continue;   // a RAPID (G0) — not G1/G01 (the \b after G0 excludes G00/G01)
        const mx = ln.match(/X(-?\d+(?:\.\d+)?)/), my = ln.match(/Y(-?\d+(?:\.\d+)?)/);
        if (mx && my) return { x: +mx[1], y: +my[1], index: i };
    }
    return null;
}

/** APPEND the entry marker as the LAST child (a sibling AFTER progend) — it emits nothing, so the body's flat indices are
 *  UNCHANGED (WRAP_PREFIX stays 4; the goldens' positional bindings are untouched). A twin binds entryX/entryY by IDENTITY
 *  (entryBindingsFor), so the marker's index is found by type, not a fixed offset. `exec` = the program body array. */
export function appendEntry(exec) {
    return [...(exec || []), { type: 'entry', params: { entryX: '', entryY: '' } }];
}

/** The declared marker→param binding (def.entryPoint): the emitting-square entry marker writes these ABSOLUTE placed coords. */
export const ENTRY_POINT = { x: 'entryX', y: 'entryY' };
