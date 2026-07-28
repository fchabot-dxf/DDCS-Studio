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
 */
export const simStartBlock = {
    type: 'simstart', label: 'sim start', category: 'Wizard UI',
    dynamic: 'anchor',
    defaults: { anchor: 'centre', axis: 'X', wall: '@dir1', out: '@outset', fx: 0.5, fy: 0.5, sign: '+', rad: '@R', zplane: 'probe', whenparam: '', whenis: '' },
    allFields: ['anchor', 'axis', 'wall', 'out', 'fx', 'fy', 'sign', 'rad', 'zplane', 'whenparam', 'whenis'],
    fieldsFor(p) {
        const a = (p && p.anchor) || 'centre';
        const f = ['anchor'];
        if (a === 'edge') f.push('axis', 'wall', 'out');
        else if (a === 'frac') f.push('fx', 'fy');
        else if (a === 'radial') f.push('axis', 'sign', 'rad');
        else if (a === 'lathe') f.push('out');            // t1301 — outside the BAR by this much; zplane carries the Z along it
        f.push('zplane', 'whenparam', 'whenis');
        return f;
    },
    emit: () => [],   // metadata only — produces no G-code (read at save → def.sim.starts → makeProvider)
};
