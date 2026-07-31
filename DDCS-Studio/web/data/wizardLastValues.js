/**
 * data/wizardLastValues.js — WIZARD VALUE PERSISTENCE (t1437, user-ruled): a wizard form remembers what you last
 * used with it, across app restarts.
 *
 * ── WHAT IS REMEMBERED, AND WHY IT IS THE OP'S PARAMS RATHER THAN THE FORM'S DOM ──────────────────────────────────
 *
 * The record is `recordOp`'s params snapshot — the exact object every wizard already hands the block builder when it
 * generates. Two other candidates existed and both are worse:
 *
 *   the DOM snapshot   `_captureForm()` walks `view.inputIds` and reads `.value`/`.checked`. It is what the Cancel
 *                      snapshot uses, and it is EMPTY for every custom op — `userOpView.inputIds` is `[]` because
 *                      that form is rendered from the def's bindings, not from a fixed id list. A feature that
 *                      silently did nothing for user ops would be a feature with a hole in it.
 *   a new codec        writing a third serialisation of "what the form holds" is the split this project keeps
 *                      closing. `recordOp` params ARE that value, they are what the op was built from, and
 *                      `_seedForm` already knows how to put them back (it is what EDIT-IN-PLACE uses).
 *
 * So capture and restore both ride seams that already exist and are already proven by the edit path. No new codec,
 * and custom ops work for free.
 *
 * ── ON INSERT, NOT ON TYPING (user-confirmed) ─────────────────────────────────────────────────────────────────────
 * The record is written when an op is actually COMMITTED, so a half-typed form that was cancelled never becomes
 * tomorrow's default. That is the user's own wording ("sound good on insert") and it is also what makes the record
 * meaningful: these are values that produced real G-code.
 *
 * ── STORAGE IS A BUFFER; THE REGISTRY LINE IS WHAT MAKES IT DURABLE ───────────────────────────────────────────────
 * One localStorage key per op type (`ddcs_lastvals_<type>`), mirroring the per-op-type preset keys (`ddcs_tpl_*`),
 * and ONE declared row in `backup.js`'s `BACKUP_STORES` reading the whole prefix. localStorage stays a temporary
 * buffer by principle ([[persistence-user-owned-file-principle]]); the master `.ddcs` is where it becomes the user's.
 */

/** The key prefix — read by the backup registry's `lsPrefix` row, so the two cannot drift. */
export const LASTVALS_PREFIX = 'ddcs_lastvals_';

const keyFor = (type) => LASTVALS_PREFIX + String(type || '');

/**
 * ── THE PROBE-DEFAULT FIELDS ARE DELIBERATELY NOT REMEMBERED HERE, AND THAT IS THE RECONCILIATION ─────────────────
 *
 * The dispatch asked which wins between this record and `applyProbeDefaults`: the answer is that they never compete,
 * because the probe fields already HAVE a last-used mechanism and it is a better one.
 *
 * `wizardManager`'s `ddcs_probe_field_overrides` records a probe field only on a `change` event — a user COMMIT —
 * so it knows exactly which fields the operator actually set, and it already beats the global `settings.probes`
 * default on open. This record cannot know that: it is a snapshot of every param at insert time, so it holds the
 * global's value for fields nobody touched. Remembering those would FREEZE a stale global into the form — change the
 * probe's fast feed in Settings and a wizard would keep offering the old one, silently, which is the exact contract
 * the sticky-override comment says it preserves ("a field the user never touched still follows the global on open").
 *
 * So: LAST-USED WINS for every field the user actually set, and the mechanism that knows which those are is the one
 * that answers. Two sources for one question is what this excludes.
 *
 * The names here are PARAM names as `recordOp` writes them, resolved per op through the schema's own param→field map
 * by `omitProbeDefaultParams` — never a second copy of the id list in `wizardManager`.
 */
export function omitProbeDefaultParams(params, fieldOf, probeDefaultFields) {
    if (!params) return params;
    const out = {};
    for (const k in params) {
        const field = fieldOf ? fieldOf[k] : null;
        if (field && probeDefaultFields && (field in probeDefaultFields)) continue;   // the sticky-override mechanism owns it
        out[k] = params[k];
    }
    return out;
}

/** The remembered params for an op type, or null. Never throws — a disabled/full localStorage is not a wizard error. */
export function loadLastValues(type) {
    if (!type) return null;
    try {
        const raw = localStorage.getItem(keyFor(type));
        if (raw == null) return null;
        const v = JSON.parse(raw);
        return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
    } catch (_) { return null; }
}

/** Remember these params for this op type. A non-object (or an empty record) writes nothing. */
export function saveLastValues(type, params) {
    if (!type || !params || typeof params !== 'object' || Array.isArray(params)) return false;
    if (!Object.keys(params).length) return false;
    try { localStorage.setItem(keyFor(type), JSON.stringify(params)); return true; } catch (_) { return false; }
}

/** Forget this op type's remembered values → its form opens on the shipped defaults again. */
export function clearLastValues(type) {
    if (!type) return;
    try { localStorage.removeItem(keyFor(type)); } catch (_) { /* storage disabled — nothing to clear */ }
}

/** Does this op type have a remembered record? (Drives the per-wizard reset's visibility — no button with nothing to do.) */
export function hasLastValues(type) { return loadLastValues(type) != null; }

/** Every op type with a remembered record. Used by the backup row's count and by tests. */
export function listLastValueTypes() {
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LASTVALS_PREFIX)) out.push(k.slice(LASTVALS_PREFIX.length));
        }
    } catch (_) { /* storage disabled */ }
    return out.sort();
}
