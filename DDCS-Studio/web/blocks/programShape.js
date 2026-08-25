/**
 * blocks/programShape.js — the DECLARED shape of a program: which top-level entries are loose atoms (as
 * opposed to an op container or program framing), and which top-level Blockly chains are STRAY — present on
 * the canvas, but disconnected from the program the app considers primary, and never meant to run.
 *
 * `isLooseAtomType` was `_isLooseTop`, duplicated identically in programModel.js and opSession.js (t2281 —
 * consolidated here, renamed to name what it actually checks: a block's TYPE, not its topology). Used for the
 * "Group" gesture's contiguous-run boundary detection, and as one ingredient below — but type alone can never
 * tell a stray apart from a legitimate snippet's own atoms (a snippet IS a stack of loose atoms, by design —
 * wizards/ops/program.js's own words: "a SNIPPET (probe/WCS/comms) is simply a stack without [progstart/
 * progend], no special bare mode"). The stray question needs a second, independent signal: CONNECTIVITY.
 */
import { BLOCKS } from '../wizards/ops/index.js';

/** Is this record/block a plain atom, as opposed to an op CONTAINER or PROGRAM FRAMING (progstart/progend)? */
export const isLooseAtomType = (b) => b && b.type !== 'op' && b.type !== 'progstart' && b.type !== 'progend';

/**
 * t2281 — which of a LIVE Blockly workspace's top-level blocks are STRAY.
 *
 * ESTABLISHED, not assumed (scratchpad/t2281-*.mjs): a well-formed loaded program — op-based OR a snippet —
 * is ALWAYS represented as ONE connected top-level chain (stackToWorkspace links consecutive stack entries
 * via next/previous on load; groupConsecutiveOps wraps 2+ top-level ops into one multi_step on import). A
 * block dragged from the toolbox and left unconnected is, by construction, its OWN separate top-level chain —
 * confirmed live, both against a real op-based program and against a real 3-atom snippet: `getTopBlocks(true)`
 * goes from 1 entry to 2 the instant a loose block is created, and the new entry's own next/previous chain
 * never touches the original.
 *
 * So the distinguishing signal is CONNECTIVITY (which top-level chain), not TYPE (a stray's own atoms are
 * `isLooseAtomType` too, exactly like a snippet's) and not raw canvas position (never consulted here — two
 * separate chains are two separate chains regardless of where either one happens to sit on screen).
 *
 * THE PRIMARY CHAIN, in order: (1) whichever top-level chain contains `progstart`/`progend` — an op-based or
 * framed-snippet program declares itself unambiguously; (2) failing that (a bare snippet, or several bare
 * candidates), the LARGEST chain by `getDescendants(false).length` — total block count including every
 * op-container's own body, not just top-level chain length (a real op and a lone stray atom both have a
 * top-level chain length of 1; measuring descendants breaks that tie honestly — a real drill op carries
 * dozens of descendant atoms, a freshly-dragged stray carries only itself). A single top-level chain (the
 * overwhelmingly common case) is trivially primary — nothing to compare against, no stray possible.
 *
 * Every block in every OTHER top-level chain is stray. Returns a Set of block ids (empty when nothing is
 * stray, including whenever there is only one top-level chain at all).
 *
 * REPORTER blocks (value-type — e.g. a `variable` reporter, `#18`) are excluded from the primary/stray
 * comparison entirely, mirroring workspaceToStack's own existing reporter filter — same rationale, applied
 * one step earlier: a reporter has no independent meaning off a socket, so it must never be picked as
 * "primary" (which would wrongly stray-mark a genuine tiny program it happens to out-count) nor marked stray
 * itself (workspaceToStack already drops it regardless; marking it here would just grey a block nobody
 * needs greyed). A lone orphaned reporter — the same accidental-drag shape as everything else this guards —
 * is left alone: inert either way, and not this function's problem to flag.
 */
export function findStrayTopBlockIds(ws) {
    const isReporter = (b) => { const d = BLOCKS[b.type]; return d && d.kind === 'reporter'; };
    const tops = ws.getTopBlocks(true).filter((t) => !isReporter(t));
    if (tops.length <= 1) return new Set();
    const descendantsOf = (t) => (t.getDescendants ? t.getDescendants(false) : [t]);
    const hasFraming = (t) => descendantsOf(t).some((b) => b.type === 'progstart' || b.type === 'progend');
    const framed = tops.find(hasFraming);
    const primary = framed || tops.reduce((a, b) => (descendantsOf(b).length > descendantsOf(a).length ? b : a));
    const strayIds = new Set();
    for (const t of tops) {
        if (t === primary) continue;
        for (const b of descendantsOf(t)) strayIds.add(b.id);
    }
    return strayIds;
}
