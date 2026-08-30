/**
 * wizards/ops/radiuscomp.js — RADIUS COMP : read a probe trigger and offset it by the stylus radius toward the
 * wall, in ONE line (kind:'leaf', category:'Probing'). The single declared home for stylus-radius compensation —
 * the probe-surface block bundles it, replacing the per-wizard hand-rolled `#50=[#1925±#6]` copies.
 *
 * It is a DECLARED, TOGGLEABLE property: `enable` ON (default) → `#result=[#raw <dir> #radius]` (the TRUE surface);
 * `enable` OFF → `#result=#raw` (raw passthrough, the un-compensated tool-centre). Correct-by-default, reversible by a
 * config flip — never a big deal to change later. Emits exactly the legacy `assign` line, so a migration is byte-identical.
 *   raw     — the probe trigger var literal (#1925/#1926/#1927) — the Expert fallback when rawAxis is unset/unsupported
 *   rawAxis — OPT-IN: 'X'|'Y'|'Z' → ask the active DIALECT for the trigger register per axis (per-post, see below)
 *   result  — where to store the compensated surface (#50/#101/…)
 *   radius  — the stylus radius var or literal (#6)
 *   dir     — '+' (surface is +axis of the trigger) or '-'
 */
export const radiuscompBlock = {
    type: 'radiuscomp', label: 'Radius comp', kind: 'leaf', category: 'Probing',
    // t2433 (BACKLOG #49) — same `dir` collision the dispatch's own sweep asked for (measure.js's probecheck had
    // the identical one): this def's `dir` is the compensation SIGN, not a spindle direction, but shared the
    // spindle's own "dir" tooltip until `fieldHelp` (bridge.js) could override it per-def.
    labels: { dir: 'compensation sign' },
    fieldHelp: { dir: "Which side of the probe trigger the true surface sits on: + if it's on the trigger's positive-axis side, - if on the negative side. Getting it backwards puts the surface on the wrong side by twice the stylus radius." },
    defaults: { raw: '#1925', result: '#50', radius: '#6', dir: '+', enable: true, note: '', rawAxis: '' },
    // t1520 — `dir` here is the COMPENSATION SIGN, not a spindle direction: declare the vocabulary so the canvas can hold
    // a '-' (it used to coerce it to the shared cw/ccw list's first option, flipping the surface by 2× the stylus radius).
    // t2393 (BACKLOG #48 item 4) — `rawAxis` was declared in `fields` with NO default, rendering as an unguarded
    // free-text field (any string, not just X/Y/Z) despite `emit()` (below) only ever comparing it against a
    // 3-letter axis vocabulary via `dialect.probeTrigVar(p.rawAxis)`. Empty stays the documented opt-out
    // ("UNSET rawAxis (every existing caller) → the literal `raw` exactly as before").
    selects: { dir: ['+', '-'], rawAxis: [['(unset — use raw literal)', ''], 'X', 'Y', 'Z'] },
    scratch: [[6, 6], [50, 50]],   // t1085 — WRITES the comped result (#50) and READS the tool-radius var (#6); #1925 is a firmware probe-trigger reg
    fields: ['raw', 'rawAxis', 'result', 'radius', 'dir', 'enable', 'note'],
    emit: (p, dx, dy, dialect) => {
        const result = p.result || '#50';
        // rawAxis (OPT-IN) — ASK THE DIALECT for the trigger register per axis (the probe-trigger seam) instead of an inlined
        // Expert literal: Expert resolves to the IDENTICAL #1925/#1926/#1927 (the comp line stays byte-for-byte unchanged),
        // V4.1 → #1500+ax, DM500 → #864+ax. A post with NO readable trigger (grbl/centroid: probeTrigVar()=null) → honest
        // degrade: a comment, no executable guess. UNSET rawAxis (every existing caller) → the literal `raw` exactly as before.
        let raw = p.raw || '#1925', noTrig = false;
        if (p.rawAxis && dialect && typeof dialect.probeTrigVar === 'function') {
            const r = dialect.probeTrigVar(p.rawAxis);
            if (r) raw = r; else noTrig = true;
        }
        const n = String(p.note ?? '').replace(/[()]/g, '').trim();
        if (noTrig) return [`( ${result} not set — no probe-trigger readback on this controller${n ? ' (' + n + ')' : ''} )`];
        const on = p.enable !== false && p.enable !== 'false' && p.enable !== 0;   // default ON (correct-by-default)
        // ONE bracket convention, no inner spaces — `[#1925+#6]` — matching the DDCS M350 dump style (`Z[#113-2]`). The
        // spacing is functionally a no-op (DDCS parses both); this is consistency, not correctness. (Was the `spaced` param.)
        const expr = on ? `[${raw}${p.dir === '-' ? '-' : '+'}${p.radius || '#6'}]` : raw;
        return [n ? `${result}=${expr} ( ${n} )` : `${result}=${expr}`];
    },
};
