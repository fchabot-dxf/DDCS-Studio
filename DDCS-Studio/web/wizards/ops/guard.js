/**
 * wizards/ops/guard.js — a `guard`: a transparent container holding ONE arm of a structural fork, gated by a
 * `when:{param,is}`. At BUILD time pruneGuards (blocks/whenGuard.js) DROPS the guard when its `when` is false and
 * UNWRAPS it (splices its children in place) when true — so a DATA template carries every fork arm, each guarded, and
 * collapses to the chosen shape for the op's params. This is what makes a structural toggle re-authorable pure data
 * (② B4 M2) instead of JS-locked structure.
 *
 * A guard normally NEVER reaches emit (prune removes it first); the transparent emit below is a safety net (a stray
 * surviving guard emits its children, never an `( unknown block )`).
 *
 * ── t1595 — THE PREDICATE IS NOW A DECLARED FIELD, BECAUSE THE CANVAS HAD TO BE ABLE TO CARRY IT ─────────────────
 *
 * The guard was invisible to Blockly in both ways at once: it had NO fields, so its predicate could not round-trip,
 * and it had no C-mouth, so `recToJson` wrote it CHILDLESS and every arm inside it was discarded on render. Measured
 * on Corner: 1157 blocks handed to the canvas, 98 back, 371 guards down to 30 — and the reproject wrote that loss
 * into the live program. That is what made a fork of any guarded wizard unsaveable (t1593).
 *
 * `when` is an OBJECT, and the bridge's `data` path excludes objects BY DESIGN — a nested value-socket reporter is an
 * object too, and it belongs in `inputs`, not smuggled through `data` as a second copy. So the predicate is DECLARED
 * as ordinary fields instead, and the exclusion is left exactly as it was.
 *
 * ⚠ THREE FIELDS, NOT TWO, AND THE THIRD IS THE POINT. The sibling seams (`simstart`, `formfield`) serialize a
 * `when` with two text fields and recover the type by INFERENCE — `'true'`/`'false'` become booleans, everything else
 * stays a string. Measured over all 645 guards in the registry: 505 string values, 138 boolean, and 2 NUMBERS
 * (`user_comm_data` gates `_popupMode` on 1 and on 3). Inference turns those into the strings `'1'`/`'3'`, and
 * `whenOk` compares with `===`, so both arms would silently vanish. No string value in the registry today looks
 * numeric or boolean — so a smarter inference would work today and would break the first time someone guards a text
 * param on the value "2". `whentype` states the type outright, so nothing is ever guessed.
 *
 * The RECORD shape is unchanged: `params.when` stays the one thing pruneGuards reads, and the 14 GUARD builders
 * still write it. These fields are its SERIALIZATION, converted at the bridge boundary by the pair below and nowhere
 * else — so each side holds exactly one representation and the two cannot drift.
 */

/** The three declared fields, in header order. Exported so the bridge conversions and their spec share one list. */
export const GUARD_FIELDS = ['whenparam', 'whenis', 'whentype'];
export const GUARD_TYPES = ['text', 'number', 'bool'];

/** A guard record's `params.when` → its declared FIELD values (record → canvas). A guard with no predicate (never
 *  seeded, or one the author has not filled in yet) serializes as empty, which `guardWhenFromFields` reads back as
 *  "no condition" — the same always-true state `whenOk` gives a missing `when`. */
export function guardFieldsFromWhen(when) {
    const w = (when && typeof when === 'object') ? when : null;
    if (!w || !w.param) return { whenparam: '', whenis: '', whentype: 'text' };
    const t = typeof w.is === 'boolean' ? 'bool' : typeof w.is === 'number' ? 'number' : 'text';
    return { whenparam: String(w.param), whenis: String(w.is), whentype: t };
}

/** The declared FIELD values → a `when` predicate (canvas → record). The inverse of guardFieldsFromWhen; returns null
 *  for an unnamed param, which whenOk treats as no condition. A `number` field that is not a number falls back to the
 *  TEXT reading rather than to NaN: NaN never equals anything, so it would drop an arm silently — the one outcome
 *  this whole change exists to remove. */
export function guardWhenFromFields(params) {
    const p = params || {};
    const param = String(p.whenparam || '').trim();
    if (!param) return null;
    const raw = String(p.whenis ?? '');
    if (p.whentype === 'bool') return { param, is: raw === 'true' };
    if (p.whentype === 'number') { const n = Number(raw); return { param, is: Number.isFinite(n) ? n : raw }; }
    return { param, is: raw };
}

export const guardBlock = {
    type: 'guard',
    label: 'Guard (when)',
    category: 'Control',
    kind: 'guard', mouth: 'DO',
    defaults: { whenparam: '', whenis: '', whentype: 'text' },
    selects: { whentype: GUARD_TYPES },   // the atom's OWN vocabulary (t1520) — not a global SELECTS key
    fields: GUARD_FIELDS,
    emit: (params, children) => children || [],
};
