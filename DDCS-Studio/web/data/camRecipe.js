/**
 * data/camRecipe.js — THE `.cam` FILE: a CAM slot as SOURCE (t1247).
 *
 * A CAM slot has two faces. `slot.ops` is what the user AUTHORED — the structured list of ops with their variant and
 * their exposed/baked values, the input `buildSlotFromOps` reads. `slot.body` / `slot.fields` / `slot.name` are what
 * that build PRODUCED: macro text for the controller, regenerated from the ops every time.
 *
 * A `.cam` file carries the FIRST of those, and never the second. Handing someone the baked macro would hand them
 * something they cannot edit — they could run it, but not change a depth, retarget a variant, or see what it was
 * meant to be. The whole point of a shared recipe is that it arrives editable, so importing it rebuilds through the
 * ordinary build path and lands as a slot exactly like one they authored.
 *
 * That is also why the format is small: everything else about a slot is DERIVED. Storing the body alongside the ops
 * would be a second copy of the same fact, free to drift the moment either side is edited.
 */
export const CAM_FILE_KIND = 'ddcs.cam';
export const CAM_FILE_VERSION = 1;

/**
 * Serialize a slot's authored source → `.cam` text.
 * @param {{name?:string, ops?:Array}} slot  a CAM slot (only `name` + `ops` are read)
 * @returns {string|null} the file text, or null when the slot has no declared ops — a legacy hand-built macro has no
 *   SOURCE to share, and writing its baked body under a source extension would be a lie about what the file is.
 */
export function camToFile(slot) {
    const ops = (slot && slot.ops) || [];
    if (!ops.length) return null;
    return JSON.stringify({
        kind: CAM_FILE_KIND,
        v: CAM_FILE_VERSION,
        name: String((slot && slot.name) || 'CAM recipe'),
        ops,
    }, null, 2);
}

/**
 * Parse `.cam` text → `{name, ops}`, or null if it is not a valid CAM recipe.
 * Returns `ops` verbatim: an op row is the build's own input shape ({type, variant, values, opType}), so anything a
 * newer authoring surface adds to it rides through to buildSlotFromOps untouched rather than being filtered by a
 * whitelist here that would have to be maintained in step.
 */
export function camFromFile(text) {
    let o; try { o = JSON.parse(String(text || '').replace(/^﻿/, '')); } catch (_) { return null; }
    if (!o || o.kind !== CAM_FILE_KIND || !Array.isArray(o.ops) || !o.ops.length) return null;
    return { name: String(o.name || 'CAM recipe'), ops: o.ops };
}

/** A one-line description of what a recipe contains, for a library card: "2 ops — drill, bore". */
export function camSummary(obj) {
    const ops = (obj && obj.ops) || [];
    const kinds = [...new Set(ops.map((o) => String((o && (o.type || o.opType)) || '?')))];
    return `${ops.length} operation${ops.length === 1 ? '' : 's'} — ${kinds.join(', ')}`;
}
