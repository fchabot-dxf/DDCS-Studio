/**
 * ui/findBarCore.js — t2435 (BACKLOG #44): the tiny SHAPE every find bar in this app shares (editorFind.js,
 * t2383, and the Blocks-canvas one this turn builds) — cycling a match index with wraparound, and the "n/m"
 * count text a machinist reads to know where they are. Extracted here rather than left duplicated in both,
 * even though the actual MATCHING logic (text offsets in a textarea vs. blocks on a Blockly canvas) differs
 * too much between the two surfaces to share directly — this is the one piece that genuinely is identical.
 */

/** Next/previous index into a list of `length` matches, wrapping both directions. -1 (no current match) if
 *  the list is empty. */
export function cycleIndex(current, delta, length) {
    if (!length) return -1;
    return ((current + delta) % length + length) % length;
}

/** "n/m" (1-based) for the count readout, or "0/0" when there are no matches. */
export function formatCount(current, length) {
    return length ? `${current + 1}/${length}` : '0/0';
}
