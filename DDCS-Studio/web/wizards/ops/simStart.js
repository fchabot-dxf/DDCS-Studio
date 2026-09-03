/**
 * wizards/ops/simStart.js — the SIM-START (per-pass preview-start) GUI block. The blocks-native twin of B1's
 * `def.sim.starts` ROWS: each block declares ONE pass-start of a multi-pass probe preview (a boss-both ①②, an
 * alignment A→B), right in the authoring stack — paired with the `param` / `panel` / `sim` blocks as the visible
 * authoring layer. Emits NOTHING: it's metadata read at SAVE time → def.sim.starts (userOps.simStartsFromStack),
 * which B1's makeProvider turns into the per-pass markers. A DECLARATION, never inferred from motion.
 *
 * The fields ARE the Option-A vocabulary (B1): anchor centre|edge|frac|radial|lathe · the per-anchor offset(s) ·
 * zplane top|probe|@flank|<num> · an optional when-gate. `dynamic: 'anchor'` shows only the fields the chosen
 * anchor needs (the ddcs_dynfields extension), so the block stays readable.
 *
 * `id` (t2585, BACKLOG #61 follow-up) — a STABLE, author-typed identifier for this row, matching `formfield`'s
 * own `param` field's shape exactly (free text, the DECLARATION site a picker elsewhere must-matches against —
 * never itself a picker). `simStartsFromStack`/`simStartsToBlocks` (userOps.js) already read/wrote `params.id`
 * before this turn (`resolveRelToIndex`'s own `relTo:{row}` semantic anchor has named it since ② B4 step 4a) —
 * the DATA MODEL already carried it end to end; only the BLOCK never exposed a field to type it into, so `relTo`
 * (both `formfield`'s own point-handle usage and `cross_aim_handle`'s new one, t2583) was reachable only through
 * a literal template, never by a person clicking through the app. This field is the missing "declaring GUI" —
 * the fourth instance this session of the project's own recurring pattern (a declared seam with no way in).
 * Optional (empty = no relTo can name this row, byte-identical to every pre-t2585 row) — most rows never need
 * one, only the ones a `relToRow` picker elsewhere will reference.
 */
export const simStartBlock = {
    type: 'simstart', label: 'sim start', category: 'Wizard Previews',
    dynamic: 'anchor',
    defaults: { id: '', anchor: 'centre', axis: 'X', wall: '@dir1', out: '@outset', fx: 0.5, fy: 0.5, sign: '+', rad: '@R', zplane: 'probe', whenparam: '', whenis: '' },
    allFields: ['id', 'anchor', 'axis', 'wall', 'out', 'fx', 'fy', 'sign', 'rad', 'zplane', 'whenparam', 'whenis'],
    fieldsFor(p) {
        const a = (p && p.anchor) || 'centre';
        const f = ['id', 'anchor'];
        if (a === 'edge') f.push('axis', 'wall', 'out');
        else if (a === 'frac') f.push('fx', 'fy');
        else if (a === 'radial') f.push('axis', 'sign', 'rad');
        else if (a === 'lathe') f.push('out');            // t1301 — outside the BAR by this much; zplane carries the Z along it
        f.push('zplane', 'whenparam', 'whenis');
        return f;
    },
    emit: () => [],   // metadata only — produces no G-code (read at save → def.sim.starts → makeProvider)
};
