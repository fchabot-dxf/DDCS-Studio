/**
 * data/camPack.js — CAM Pack Builder core (pure logic, no DOM). Phase 1.
 *
 * A DDCS Expert "CAM" slot is a parameterized macro launcher (see docs/CAM-MENU-RESEARCH.md):
 *   - macro_cam<slot>.nc reads form values at RUNTIME from the #2600+ mirrors (never bakes literals),
 *   - the form is defined by `eng` language-file lines (#11xx … -m<slot+20> …),
 *   - the form value persists in `camsetting` (firmware-owned — NEVER written by us).
 *
 * The mirror: a form field at #11xx is read by the macro at #[idx+1500] (so #1100→#2600, #1116→#2616 —
 * confirmed vs Vasily's cam13). Fields are allocated from the shared pool #1100–#1499 (400 total), so
 * collision detection across a pack's slots is the genuinely-hard part this module owns.
 */

const POOL_MIN = 1100, POOL_MAX = 1499, MIRROR = 1500;

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Runtime mirror variable the macro reads for a form field at #idx. #1100→#2600. */
export function mirrorVar(idx) { return num(idx, POOL_MIN) + MIRROR; }

/** The eng-file `-m` group for a slot (slot + 20: cam10→m30). */
export function slotGroup(slot) { return num(slot, 0) + 20; }

/** Every #11xx already used by a pack's fields → Set<number>. */
export function usedParams(pack) {
    const s = new Set();
    ((pack && pack.slots) || []).forEach((slot) => (slot.fields || []).forEach((f) => { const n = num(f.idx, null); if (n != null) s.add(n); }));
    return s;
}

/** Next free #11xx in the 1100–1499 pool, avoiding `used` (a Set). null when the pool is exhausted. */
export function nextParam(used) {
    for (let n = POOL_MIN; n <= POOL_MAX; n++) if (!used.has(n)) return n;
    return null;
}

/** Param numbers used by 2+ fields in the pack (the collisions to flag) → number[]. */
export function collisions(pack) {
    const seen = new Set(), dup = new Set();
    ((pack && pack.slots) || []).forEach((slot) => (slot.fields || []).forEach((f) => {
        const n = num(f.idx, null); if (n == null) return;
        if (seen.has(n)) dup.add(n); else seen.add(n);
    }));
    return [...dup];
}

/** Out-of-pool param numbers (must be 1100–1499) → number[]. */
export function outOfPool(pack) {
    const bad = [];
    ((pack && pack.slots) || []).forEach((slot) => (slot.fields || []).forEach((f) => {
        const n = num(f.idx, null); if (n != null && (n < POOL_MIN || n > POOL_MAX)) bad.push(n);
    }));
    return bad;
}

const esc = (s) => String(s == null ? '' : s);

/** One `eng` form line for a field. type 1 = decimal, 0 = integer-ish (observed). units '' → a single space. */
export function engLine(field, slot) {
    const units = field.units != null && field.units !== '' ? field.units : ' ';
    return `#${num(field.idx, POOL_MIN)} -p0 -a3 =${num(field.def, 0)} -t${field.type === 1 || field.type === '1' ? 1 : 0}`
        + ` -s1"${esc(field.label)}" -s2"${esc(units)}" -m${slotGroup(slot)} -min=${num(field.min, 0)} -max=${num(field.max, 0)}`;
}

/** All eng lines for a slot's fields (joined). */
export function slotEng(slot) {
    return (slot.fields || []).map((f) => engLine(f, slot.slot)).join('\n');
}

/** The macro_cam<slot>.nc text: a labelled mirror-read block (#var = #[idx+1500]) per field, then the
 *  author's body, then M99. The author references each field's `var` (default #1,#2,… in field order). */
export function slotMacro(slot) {
    const fields = slot.fields || [];
    const head = [`( macro_cam${num(slot.slot, 0)}.nc — ${esc(slot.name) || 'CAM slot ' + num(slot.slot, 0)} )`,
        '( form values are read live from the #2600+ mirrors — never edit camsetting )'];
    const reads = fields.map((f, i) => `${f.var || '#' + (i + 1)}=#${mirrorVar(f.idx)}   ;${esc(f.label)}`);
    const body = String(slot.body || '').replace(/\r/g, '').replace(/\s+$/, '');
    const hasEnd = /\b(M99|M30|M0?2)\b/.test(body);
    return head.concat(reads, body ? [body] : [], hasEnd ? [] : ['M99']).join('\n') + '\n';
}

/** Validate a pack → { ok, errors:[], warnings:[] } for the "simulate before publish" gate. */
export function validatePack(pack) {
    const errors = [], warnings = [];
    const dups = collisions(pack); if (dups.length) errors.push('Parameter # used by more than one field: ' + dups.map((n) => '#' + n).join(', '));
    const oop = outOfPool(pack); if (oop.length) errors.push('Parameter # outside the 1100–1499 pool: ' + oop.map((n) => '#' + n).join(', '));
    const used = usedParams(pack).size;
    if (used > 350) warnings.push(`${used}/400 form fields used — the #1100–1499 pool is filling up.`);
    ((pack && pack.slots) || []).forEach((slot) => {
        if ((slot.fields || []).length > 8) warnings.push(`Slot cam${slot.slot}: ${slot.fields.length} fields — >8 rows may not fit the form.`);
    });
    return { ok: errors.length === 0, errors, warnings };
}
