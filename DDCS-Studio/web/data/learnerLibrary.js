/**
 * data/learnerLibrary.js — the LEARNER LIBRARY: curated, pre-composed stacks surfaced as a TREE in the Blocks
 * toolbox for people learning G-code on a DDCS controller. The rail reads:
 *
 *   ⚛ Atoms            — the instruction-set blocks (Shapes / Move / … — built by bridge.buildToolbox)
 *   📚 Snippets         — themed CATEGORIES of BARE atom compositions (2–5 atoms) that slot INTO a program
 *   📦 Complete Programs — themed CATEGORIES of FRAMED examples (progstart … progend) that run / sim as-is
 *
 * Each Snippets/Programs CATEGORY holds compositions; each composition IS just a {type,params,children} stack — the
 * SAME thing the app already builds — and drags in as ONE connected block (stackBridge.stackToFlyoutBlock). It pairs
 * with the Blocks-tab hover-highlight (drag in → hover a block → watch its G-code light up) for a self-teaching loop.
 * Everything is CURATED + valid-by-construction — every entry is asserted to emit clean G-code by
 * tests/learner-library.spec.js (same guarantee as a built-in).
 *
 * The real work is CURATION — minimal, well-commented examples ordered as a gentle curriculum. Add entries here; the
 * toolbox tree + drag-in are generic. NON-GOAL: never auto-explode a parametric op into atoms — these are AUTHORED
 * stacks (see ROADMAP MID #14).
 */
import { stackToFlyoutBlock } from '../blocks/blockly/stackBridge.js';   // a curated stack → one draggable flyout block

// Each move specifies all of x/y/z (and feed on a cut) explicitly — a flyout block renders every value socket, so an
// omitted axis would read as 0 anyway; being explicit keeps the example honest + readable.
const cmt = (text) => ({ type: 'comment', params: { text } });

/** Snippets — BARE atom compositions (2–5 atoms; no program frame), grouped into themed sub-categories. */
export const SNIPPETS = [
    {
        category: 'Spindle & Coolant',
        entries: [
            { id: 'spindle-warmup', label: 'Spindle warm-up', desc: 'Start the spindle, then dwell so it reaches speed before cutting.',
              stack: [cmt('Spindle warm-up — start, then dwell to reach speed'), { type: 'spindle', params: { rpm: 8000, dir: 'cw' } }, { type: 'dwell', params: { sec: 3 } }] },
            { id: 'flood-on', label: 'Flood coolant on', desc: 'Turn on flood coolant (M8).',
              stack: [cmt('Flood coolant on'), { type: 'coolant', params: { flow: 'flood' } }] },
            { id: 'stop-all', label: 'Stop spindle + coolant', desc: 'Spindle off (M5) and coolant off (M9) — a safe resting state.',
              stack: [cmt('Stop — spindle off, coolant off (safe state)'), { type: 'spindle', params: { rpm: 0, dir: 'cw' } }, { type: 'coolant', params: { flow: 'off' } }] },
            { id: 'spindle-ccw', label: 'Spindle CCW', desc: 'Start the spindle counter-clockwise (M4).',
              stack: [cmt('Spindle CCW (M4)'), { type: 'spindle', params: { rpm: 8000, dir: 'ccw' } }] },
            { id: 'mist-on', label: 'Mist coolant on', desc: 'Turn on mist coolant (M7).',
              stack: [cmt('Mist coolant on'), { type: 'coolant', params: { flow: 'mist' } }] },
            { id: 'coolant-off', label: 'Coolant off', desc: 'Turn off coolant (M9).',
              stack: [cmt('Coolant off'), { type: 'coolant', params: { flow: 'off' } }] },
        ],
    },
    {
        category: 'Motion',
        entries: [
            { id: 'park-lift', label: 'Park & lift', desc: 'Stop, then rapid back to the origin and raise Z clear of the work.',
              stack: [cmt('Park & lift — stop, return to origin, raise Z clear'), { type: 'spindle', params: { rpm: 0, dir: 'cw' } }, { type: 'coolant', params: { flow: 'off' } }, { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 50, feed: 200 } }] },
            { id: 'rapid-origin', label: 'Rapid to origin', desc: 'Rapid to X0 Y0, just above the work.',
              stack: [cmt('Rapid to origin, just above the work'), { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5, feed: 200 } }] },
            { id: 'dwell-2s', label: 'Dwell 2 s', desc: 'Pause for 2 seconds (e.g. let the spindle settle).',
              stack: [cmt('Dwell — pause 2 seconds'), { type: 'dwell', params: { sec: 2 } }] },
        ],
    },
    {
        category: 'Probing',
        entries: [
            { id: 'z-touch', label: 'Z touch-off', desc: 'Probe straight down (G31) until the probe triggers, then store the touch Z in #50.',
              stack: [cmt('Z touch-off — probe down, store the result in #50'), { type: 'probe', params: { axis: 'Z', to: -20, feed: 100, port: 3, level: 0 } }, { type: 'proberead', params: { axis: 'Z', var: '#50' } }] },
        ],
    },
];

/** Complete Programs — FRAMED stacks (progstart … progend) that run / sim as-is, grouped into themed sub-categories. */
export const PROGRAMS = [
    {
        category: 'Milling',
        entries: [
            { id: 'trace-square', label: 'Trace a square', desc: 'A first program to read: spin up, plunge, cut a 50 mm square at Z-1, then retract & end.',
              stack: [
                  { type: 'progstart', params: { rpm: 10000, dir: 'cw', spinUp: 0, clearance: 5 } },
                  cmt('Trace a 50 mm square at Z-1 — a first cut to read'),
                  { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5, feed: 200 } },     // above the start corner
                  { type: 'move', params: { mode: 'cut', x: 0, y: 0, z: -1, feed: 300 } },       // plunge
                  { type: 'move', params: { mode: 'cut', x: 50, y: 0, z: -1, feed: 600 } },      // →
                  { type: 'move', params: { mode: 'cut', x: 50, y: 50, z: -1, feed: 600 } },     // ↑
                  { type: 'move', params: { mode: 'cut', x: 0, y: 50, z: -1, feed: 600 } },      // ←
                  { type: 'move', params: { mode: 'cut', x: 0, y: 0, z: -1, feed: 600 } },       // ↓ back to start
                  { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 10, park: false, parkX: 0, parkY: 0, end: 'M30' } },
              ] },
            { id: 'face-pass', label: 'Single facing pass', desc: 'Spin up, plunge to a shallow Z, then cut one straight pass across 100 mm.',
              stack: [
                  { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5 } },
                  cmt('A single facing pass across 100 mm at Z-0.5'),
                  { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5, feed: 200 } },       // above the start
                  { type: 'move', params: { mode: 'cut', x: 0, y: 0, z: -0.5, feed: 200 } },       // plunge to depth
                  { type: 'move', params: { mode: 'cut', x: 100, y: 0, z: -0.5, feed: 800 } },     // face across
                  { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 10, park: false, parkX: 0, parkY: 0, end: 'M30' } },
              ] },
        ],
    },
    {
        category: 'Drilling',
        entries: [
            { id: 'drill-hole', label: 'Drill one hole', desc: 'Spin up, rapid over the hole, plunge to depth, then retract clear.',
              stack: [
                  { type: 'progstart', params: { rpm: 6000, dir: 'cw', spinUp: 0, clearance: 5 } },
                  cmt('Drill one hole at (25,25) to depth -5'),
                  { type: 'move', params: { mode: 'rapid', x: 25, y: 25, z: 5, feed: 200 } },      // over the hole
                  { type: 'move', params: { mode: 'cut', x: 25, y: 25, z: -5, feed: 120 } },        // plunge to depth
                  { type: 'move', params: { mode: 'rapid', x: 25, y: 25, z: 10, feed: 200 } },      // retract clear
                  { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 10, park: false, parkX: 0, parkY: 0, end: 'M30' } },
              ] },
        ],
    },
    {
        category: 'Probing',
        entries: [
            { id: 'z-touch-prog', label: 'Z touch-off (program)', desc: 'Position above the surface, probe down (G31), store the touch Z, then retract. No spindle — the probe is in the spindle.',
              stack: [
                  cmt('Simple Z touch-off — position, probe down, store Z, retract'),
                  { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 10, feed: 200 } },        // position above the surface
                  { type: 'probe', params: { axis: 'Z', to: -30, feed: 100, port: 3, level: 0 } },   // probe straight down (G31)
                  { type: 'proberead', params: { axis: 'Z', var: '#50' } },                          // store the touch Z in #50
                  { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 20, feed: 200 } },         // retract clear
                  { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: false, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
              ] },
        ],
    },
];

/** Every curated entry, flat — for the validator-gate test. */
export const allLearnerEntries = () => [...SNIPPETS, ...PROGRAMS].flatMap((g) => g.entries);

/** Build the themed sub-categories of a group (each composition → one draggable flyout block). */
function subCategories(groups, style) {
    return groups.map((g) => ({
        kind: 'category', name: g.category, categorystyle: style,
        contents: g.entries.map((e) => stackToFlyoutBlock(e.stack)).filter(Boolean),
    })).filter((c) => c.contents.length);
}

/** The learner-library toolbox tree: two collapsible top-level groups (Snippets / Complete Programs), each containing
 *  the themed sub-categories above. Passed to bridge.buildToolbox(extraCategories) as siblings of "⚛ Atoms" so the
 *  rail reads Atoms · Snippets · Programs — and the caller (blocksApp) injects it, so the low-level toolbox builder
 *  needn't import the stack→flyout converter (which would form an eval-time cycle through bridge). */
export function learnerToolboxCategories() {
    return [
        { kind: 'category', name: '📚 Snippets', expanded: 'true', contents: subCategories(SNIPPETS, 'markup_cat') },
        { kind: 'category', name: '📦 Complete Programs', expanded: 'true', contents: subCategories(PROGRAMS, 'program_cat') },
    ].filter((c) => c.contents.length);
}
