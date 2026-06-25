/**
 * data/slotPack.js — CAM Pack Builder core: the DDCS on-controller slot-pack mechanism (pure logic, no DOM).
 * (Was `camPack.js` — these are DDCS controller "CAM" slots, not an industry-CAM toolpath system.) Phase 1.
 *
 * A DDCS Expert "CAM" slot is a parameterized macro launcher (see docs/archive/CAM-MENU-RESEARCH.md):
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
    if (slot.wcs && slot.wcs !== 'active') head.push(`${esc(slot.wcs)}   ( work offset )`);
    const body = String(slot.body || '').replace(/\r/g, '').replace(/\s+$/, '');
    // Macro-first: if the body already declares the mirror reads, don't prepend them again (it IS the macro).
    const hasReads = /#\d+\s*=\s*#2[6-9]\d\d/.test(body);
    const reads = hasReads ? [] : fields.map((f, i) => `${f.var || '#' + (i + 1)}=#${mirrorVar(f.idx)}   ;${esc(f.label)}`);
    const hasEnd = /\b(M99|M30|M0?2)\b/.test(body);
    return head.concat(reads, body ? [body] : [], hasEnd ? [] : ['M99']).join('\n') + '\n';
}

/**
 * Merge a pack's `additions` (eng param lines) into the controller's CURRENT `eng` text — the safe install
 * that community packs get wrong (they ship a full-replacement eng and clobber the operator's customisations;
 * CAM-MENU-RESEARCH §2.4). APPENDS the new param lines, never replaces. Surfaces the cross-pack/factory
 * collisions the in-pack allocator can't see (a #11xx the eng already defines, or a -m group already in use).
 * @returns {{ merged:string, paramCollisions:number[], groupCollisions:number[], added:number[] }}
 */
export function mergeEng(existingEng, additions) {
    const paramOf = (l) => { const m = String(l).match(/^\s*#(\d+)\b/); return m ? Number(m[1]) : null; };
    const groupOf = (l) => { const m = String(l).match(/-m(\d+)\b/); return m ? Number(m[1]) : null; };
    const have = new Set(), haveGroups = new Set();
    String(existingEng || '').split(/\r?\n/).forEach((l) => { const p = paramOf(l); if (p != null) have.add(p); const g = groupOf(l); if (g != null) haveGroups.add(g); });
    const addLines = String(additions || '').split(/\r?\n/).filter((l) => paramOf(l) != null);
    const paramCollisions = [], added = [];
    addLines.forEach((l) => { const p = paramOf(l); (have.has(p) ? paramCollisions : added).push(p); });
    const addGroups = [...new Set(addLines.map(groupOf).filter((g) => g != null))];
    const groupCollisions = addGroups.filter((g) => haveGroups.has(g));
    const base = String(existingEng || '').replace(/\s+$/, '');
    const merged = base + '\n\n( ===== merged CAM pack params (DDCS Studio) ===== )\n' + addLines.join('\n') + '\n';
    return { merged, paramCollisions: [...new Set(paramCollisions)], groupCollisions: [...new Set(groupCollisions)], added };
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

/** Parse a mirror-read comment "Label [units] =default [min~max]" (all parts optional) into field metadata.
 *  Defaults to a permissive editable range so a freshly-imported field is usable in the controller GUI. */
function parseFieldComment(c) {
    const f = { label: '', units: '', def: 0, min: -9999, max: 9999, type: 1 };
    let s = String(c || '').trim(); if (!s) return f;
    const range = s.match(/\[\s*(-?\d*\.?\d+)\s*~\s*(-?\d*\.?\d+)\s*\]/);
    if (range) { f.min = Number(range[1]); f.max = Number(range[2]); s = s.replace(range[0], ' '); }
    const def = s.match(/=\s*(-?\d*\.?\d+)/);
    if (def) { f.def = Number(def[1]); f.type = /\./.test(def[1]) ? 1 : 0; s = s.replace(def[0], ' '); }
    const units = s.match(/\[([^\]~]*)\]/);   // a [mm]-style unit tag, not the range
    if (units) { f.units = units[1].trim(); s = s.replace(units[0], ' '); }
    f.label = s.replace(/\s+/g, ' ').trim();
    return f;
}

/** Scan a macro for its form FIELDS: every `#var=#26xx ;comment` mirror-read becomes a field (genuine operator
 *  params only — #2600–#2999, never working/local vars). Returns the field list; does NOT touch the body, so it
 *  can re-derive ("Refresh") the fields from a macro that is the single source. Metadata comes from the comment
 *  (Label [units] =default [min~max]); the caller merges in any ranges the author already edited. */
export function fieldsFromMacro(text) {
    const fields = [], seen = new Set();
    const re = /#(\d+)\s*=\s*#(2[6-9]\d\d)\b\s*;?\s*(.*?)\s*$/;
    for (const ln of String(text || '').split(/\r?\n/)) {
        const m = ln.match(re), mir = m ? Number(m[2]) : 0;
        if (m && mir >= 2600 && mir <= 2999 && !seen.has(mir)) {
            seen.add(mir);
            const f = parseFieldComment(m[3]); f.idx = mir - 1500; f.var = '#' + m[1];
            fields.push(f);
        }
    }
    fields.sort((a, b) => a.idx - b.idx);
    return fields;
}
