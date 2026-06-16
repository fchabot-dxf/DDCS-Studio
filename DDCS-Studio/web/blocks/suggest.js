/**
 * blocks/suggest.js — next-block suggestions for the Blocks tab.
 *
 * Counts "block type A is followed by B" across the user's programs (persisted to localStorage, so it learns
 * their habits over sessions) blended with a curated cold-start seed. suggestNext(type) → the most-likely next
 * block types. Drives the "Suggested next" strip (A) and the canvas suggestion float (B). Built on the shared
 * generic bigram engine (bigram.js) — the same engine powers the Studio editor's next-word box.
 */
import { makeBigram } from './bigram.js';

// Curated cold-start transitions — "what commonly follows X" (block/op types). Learned counts override.
// The intra-op idioms below are grounded in the DDCS firmware macro library (canned cycles + probe / tool-change
// routines: slib O9081/O9083, O501/O502, O20000, snippets.nc); op-to-op job ordering stays editorial judgement.
const SEED = {
    // Program open: real jobs set safe-Z + work coords, load the tool, spin up, then rapid in.
    progstart: ['wcs', 'tool', 'spindle', 'move'],
    wcs: ['tool', 'move', 'spindle', 'proberead'],
    tool: ['spindle', 'move', 'probe'],            // a change ends in G53 retracts + an auto tool-set probe (M98P502)
    spindle: ['move', 'coolant', 'feed'],          // M3 S… → G0 rapid to start → G1 cut
    coolant: ['move', 'feed', 'spindle'],
    feed: ['move', 'drill', 'line'],
    move: ['move', 'feed', 'probe'],               // cycles alternate G0/G1; G53 rapids cluster
    arc: ['move', 'arc'],
    // Probe idiom (every DDCS probe macro): G91 → G31 → IF #1922 check → read #1927 → G53 retract → write offset.
    distmode: ['probe', 'move'],
    confirm: ['distmode', 'probe', 'move'],         // "hover over the setter" prompt → G91 → G31
    probe: ['probecheck', 'proberead', 'move'],
    probecheck: ['proberead', 'probe', 'move'],
    proberead: ['setworkoffset', 'tooloffset', 'move'],
    readmachine: ['setworkoffset', 'move'],
    setworkoffset: ['move', 'progend'],
    tooloffset: ['move', 'progend'],
    // Canned cycles (G81/G83/G73): rapid XY, rapid R, feed Z, retract; multiple holes / arrays repeat.
    drill: ['drill', 'move', 'progend'],
    bore: ['move', 'progend'],
    line: ['line', 'move'],
    slot: ['move', 'progend'],
    wall: ['move', 'progend'],
    region: ['fillzigzag', 'fillconcentric', 'wall'],
    array: ['drill', 'bore', 'line'],
    dwell: ['mcode', 'move', 'spindle'],           // G04 sits between drawbar M-codes + before retracts
    mcode: ['mcode', 'move', 'dwell'],             // M-codes cluster (M151/M153/M155, M300/M301/M302)
    stepdown: ['stepover'],
    progend: [],
};

const model = makeBigram({ seed: SEED, storageKey: 'ddcs_blk_bigrams', exclude: ['progstart'] });

/** Flatten a stack (incl. op-container children) into a forward type sequence (op-containers use their opType). */
function seq(stack, out = []) {
    for (const b of (stack || [])) {
        if (!b) continue;
        out.push(b.type === 'op' ? (b.opType || 'op') : b.type);
        if (b.children) seq(b.children, out);
    }
    return out;
}

/** Learn the A→B transitions from a program stack (the engine skips an unchanged sequence so param edits, which
 *  fire many change events for the same structure, don't over-count one program). */
export function recordProgram(stack) { model.record(seq(stack)); }

/** Most-likely next types after `type`. `valid` (optional) filters to insertable block types. */
export function suggestNext(type, n = 5, valid = null) { return model.suggestNext(type, n, valid); }

/** Test/debug reset. */
export function _resetLearned() { model._reset(); }
