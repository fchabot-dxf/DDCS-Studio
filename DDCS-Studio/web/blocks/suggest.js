/**
 * blocks/suggest.js — next-block suggestions for the Blocks tab.
 *
 * A bigram model: counts "block type A is followed by B" across the user's programs (persisted to localStorage,
 * so it learns their habits over sessions) blended with a small curated cold-start seed. suggestNext(type) →
 * the most-likely next block types. Drives the "Suggested next" strip (A) and the ghost next-block (B).
 */
const LKEY = 'ddcs_blk_bigrams';
let learned = load();
function load() { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (_) { return {}; } }
function save() { try { localStorage.setItem(LKEY, JSON.stringify(learned)); } catch (_) { /* quota */ } }

// Curated cold-start transitions — semantic "what commonly follows X" (block/op types). Learned counts override.
const SEED = {
    progstart: ['wcs', 'spindle', 'tool', 'move'],
    wcs: ['move', 'spindle', 'drill', 'proberead'],
    spindle: ['feed', 'move', 'coolant'],
    feed: ['move', 'drill', 'line'],
    move: ['move', 'feed', 'probe', 'spindle'],
    arc: ['move', 'arc'],
    probe: ['proberead', 'probecheck', 'move'],
    proberead: ['setworkoffset', 'readmachine', 'move'],
    readmachine: ['setworkoffset', 'move'],
    drill: ['drill', 'move', 'progend'],
    bore: ['move', 'progend'],
    line: ['line', 'move'],
    slot: ['move', 'progend'],
    wall: ['move', 'progend'],
    region: ['fillzigzag', 'fillconcentric', 'wall'],
    array: ['drill', 'bore', 'line'],
    tool: ['spindle', 'move'],
    coolant: ['spindle', 'move', 'feed'],
    setworkoffset: ['move', 'progend'],
    dwell: ['move', 'spindle'],
    distmode: ['move'],
    mcode: ['move', 'spindle'],
    stepdown: ['stepover'],
    confirm: ['probe', 'move'],
    progend: [],
};

/** Flatten a stack (incl. op-container children) into a forward type sequence (op-containers use their opType). */
function seq(stack, out = []) {
    for (const b of (stack || [])) {
        if (!b) continue;
        out.push(b.type === 'op' ? (b.opType || 'op') : b.type);
        if (b.children) seq(b.children, out);
    }
    return out;
}

/** Learn the A→B transitions from a program stack. Skips when the block SEQUENCE is unchanged (param edits fire
 *  many change events for the same structure — we don't want to over-count one program). */
let lastSeqSig = '';
export function recordProgram(stack) {
    const s = seq(stack);
    const sig = s.join('>');
    if (sig === lastSeqSig) return;
    lastSeqSig = sig;
    let changed = false;
    for (let i = 0; i < s.length - 1; i++) {
        const a = s[i], b = s[i + 1];
        if (!a || !b) continue;
        (learned[a] || (learned[a] = {}))[b] = (learned[a][b] || 0) + 1;
        changed = true;
    }
    if (changed) save();
}

/** Most-likely next types after `type`. `valid` (optional) filters to insertable block types. */
export function suggestNext(type, n = 5, valid = null) {
    if (!type) return [];
    const score = {};
    const seed = SEED[type] || [];
    seed.forEach((t, i) => { score[t] = (score[t] || 0) + (seed.length - i); });   // rank → weight
    const lr = learned[type] || {};
    for (const t in lr) score[t] = (score[t] || 0) + lr[t] * 3;                      // learned weighted higher
    return Object.entries(score)
        .filter(([t]) => t !== type && t !== 'progstart' && (!valid || valid.has(t)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([t]) => t);
}

/** Test/debug reset. */
export function _resetLearned() { learned = {}; lastSeqSig = ''; save(); }
