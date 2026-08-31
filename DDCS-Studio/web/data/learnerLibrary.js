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
        // t2449 (BACKLOG #45 part 2) — the owner's own ask: "does surfacing have a block snippet" — it
        // didn't, and the near-misses (the old face-pass) were fakes. This is the REAL atom, bare, no
        // program frame — the point is to show surfaceraster doing its own job without the wizard's own
        // 30-field apparatus around it. ESTABLISHED live, not assumed, per the dispatch's own instruction:
        // a bare surfaceraster atom (no progstart/progend) emits clean G-code AND traces a real, non-empty
        // toolpath on its own (confirmed directly — 50 lines, 5 segments, a real bounding box) — so this
        // correctly belongs in Snippets (bare compositions), not Complete Programs; the atom needs no
        // framing declared to preview meaningfully.
        category: 'Milling',
        entries: [
            { id: 'raster-area', label: 'Raster an area', desc: 'The real surfacing atom, bare — one small area, rastered at a shallow depth. No spindle/program framing: just the atom doing its own job.',
              stack: [
                  cmt('This block rasters an area — the atom the surfacing wizard actually emits'),
                  { type: 'surfaceraster', params: { w: 30, h: 20, depth: 0.3 } },   // everything else (tool Ø, stepover%, feed, entry, …) falls back to the atom's own sensible defaults
              ] },
        ],
    },
    {
        category: 'Probing',
        entries: [
            { id: 'z-touch', label: 'Z touch-off', desc: 'Probe straight down (G31) until the probe triggers, then store the touch Z in #50.',
              stack: [cmt('Z touch-off — probe down, store the result in #50'), { type: 'probe', params: { axis: 'Z', to: -20, feed: 100, port: 3, level: 0 } }, { type: 'proberead', params: { axis: 'Z', var: '#50' } }] },
            // The canonical probe primitive, decomposed into its atoms: probe IN → verify contact → retract → store.
            // (The wizards build their measure cycles from this exact shape; the later consolidation composes from it.)
            { id: 'probe-surface', label: 'Probe surface', desc: 'Probe in (G31) until the probe triggers, verify it contacted, retract clear, then store the touch position in #50.',
              stack: [
                  cmt('Probe surface — probe in (G31), verify contact, retract, store the touch position'),
                  { type: 'probe', params: { axis: 'Z', to: -20, feed: 100, port: 3, level: 0 } },   // probe straight in (G31)
                  { type: 'probecheck', params: { axis: 'Z', goto: 1 } },                              // verify it triggered (else jump to the fail handler)
                  { type: 'move', params: { mode: 'rapid', z: 5, feed: 200 } },                        // retract clear of the surface
                  { type: 'proberead', params: { axis: 'Z', var: '#50' } },                            // store the latched touch position
              ] },
            // Two-pass (fast find + slow re-probe) — the accurate version the WIZARDS actually use, so the later
            // consolidation has the right shape to compose from: fast probe → check → retract → slow probe → check → retract → save.
            { id: 'probe-surface-2pass', label: 'Probe surface — fast + slow', desc: 'Two-pass probe (the accurate version the wizards use): a fast approach to find the surface, retract, then a slow re-probe — and store the touch position in #50.',
              stack: [
                  cmt('Probe surface (fast + slow) — fast find, retract, slow re-probe for accuracy, store the result'),
                  { type: 'probe', params: { axis: 'Z', to: -20, feed: 200, port: 3, level: 0 } },   // FAST approach
                  { type: 'probecheck', params: { axis: 'Z', goto: 1 } },
                  { type: 'move', params: { mode: 'rapid', z: 5, feed: 200 } },                        // retract
                  { type: 'probe', params: { axis: 'Z', to: -20, feed: 50, port: 3, level: 0 } },     // SLOW re-probe (accurate)
                  { type: 'probecheck', params: { axis: 'Z', goto: 1 } },
                  { type: 'move', params: { mode: 'rapid', z: 5, feed: 200 } },                        // retract
                  { type: 'proberead', params: { axis: 'Z', var: '#50' } },                            // store the latched touch position
              ] },
        ],
    },
];

/** Complete Programs — FRAMED stacks (progstart … progend) that run / sim as-is, grouped into themed sub-categories. */
export const PROGRAMS = [
    {
        category: 'Milling',
        entries: [
            // t2449 (BACKLOG #45) — KEPT hand-listed moves DELIBERATELY, decided with the file in hand: this
            // entry's own POINT is reading raw G0/G1 syntax as a first program ("a first cut to read," its own
            // desc says so) — it never claims to BE a named operation the way face-pass used to. There is no
            // real atom for "trace this exact square outline" to hold it to (pocket/contour BUILD a boundary
            // from a shape+size, they don't retrace four literal corners) — so nothing here can drift from an
            // atom's own behavior the way the old face-pass could from surfaceraster's. If a future turn ever
            // adds a real "outline a rectangle" atom, RE-DECIDE against that atom specifically — don't assume
            // this reasoning still holds just because it held here.
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
            // t2449 (BACKLOG #45) — REBUILT on the real atom (owner's own ruling: "milling atom, needs to be
            // true"). The old version hand-listed one straight G1 across 100mm and called it "facing" — no
            // stepover, no raster, no boundary, free to drift from what the app's own surfacing wizard
            // actually emits. `surfaceraster` (wizards/ops/surfaceraster.js) IS what the wizard emits — a
            // small area (100×10mm, one stepover-ish wide) reads as simply as the old fake did, but it is the
            // thing itself: change the area or tool and the raster genuinely re-derives, because it's the real
            // math, not a description of it. Params kept MINIMAL (w/h/depth/feed only) — everything else
            // (toolDia, stepoverPct, entry, wcs, …) falls back to surfaceraster's own sensible defaults, same
            // as a freshly-dropped wizard op would. Read as a learner: the atom's OWN emitted G-code carries
            // named #vars with inline comments explaining the raster math (confirmed live) — MORE
            // self-documenting than the old hand-listed moves were, not less; no legibility tension found.
            { id: 'face-pass', label: 'Single facing pass', desc: 'Spin up, then face a shallow strip with the REAL facing atom (surfaceraster) — a small area, built from the same math the wizard uses, so it can never drift from what facing actually does.',
              stack: [
                  { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5 } },
                  cmt('A facing pass on the real surfaceraster atom — small area, same math the wizard uses'),
                  { type: 'surfaceraster', params: { w: 100, h: 10, depth: 0.5, feed: 800 } },
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
