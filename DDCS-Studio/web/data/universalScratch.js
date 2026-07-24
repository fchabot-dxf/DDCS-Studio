/**
 * data/universalScratch.js — the scratch the UNIVERSAL (custom-op) emit path injects UNDERNEATH a slot's own field vars.
 *
 * WHY A SECOND MODULE, not more of camScratch (t1085 slice C): camScratch is deliberately a LEAF — it imports NOTHING, so
 * it cannot cycle, and six `data/` consumers plus macrosApp lean on that (probeToSlot.js even imports distmode LIGHT to dodge
 * the safeZframe→blockEmitter→saferetract cycle). Aggregating the wizard-op + dialect declarations needs `wizards/ops/index.js`
 * and `wizards/dialects/index.js`, so that edge lives HERE and only `stackToSlot` — which already has both in its closure —
 * pays for it. camScratch stays the one place that aggregates GENERATOR bands; this is the one place that aggregates the
 * INJECTED bands. Neither copies the other's facts.
 *
 * WHY IT EXISTS AT ALL: the generator arms (mill / probe / opToSlot) emit hand-written macro text, so their scratch is
 * declared in camScratch and slice B mints field vars around it. The UNIVERSAL arm does not — `stackToSlot` emits through
 * `emitMapped`, i.e. through the real wizard-op atoms and the real active dialect, and BOTH inject low macro vars of their
 * own (#5 #6 #9 #10 #17 #22 #30 #31 #50 #57 #70-#72 #95 #99 #100 #102 #150-#152, plus #42/#43 on Expert and #190/#191 on
 * V4.1/DM500). A universal op's field vars start at #1, so they were landing ON TOP of that — broken at ONE part, before
 * any composition. Same defect class as the S0 spindle bug, different arm.
 *
 * THE DECLARATIONS DO NOT LIVE HERE. Each atom / dialect declares the band IT injects, next to the code that injects it
 * (`def.scratch` on a palette block, `dialect.scratch` on a post, `PROBE_SURFACE_SCRATCH` on the composer that has no def).
 * This module only READS them, so it cannot drift from the thing it describes and adding a post or an atom needs no edit here.
 *
 * READ LAZILY, NEVER AT MODULE TOP LEVEL. `wizards/ops/index.js` sits in a live import cycle
 * (ops/index → saferetract → safeZframe → blockEmitter → ops/index) that is benign ONLY because no module reads BLOCKS while
 * the graph is still evaluating — every existing consumer reads it inside a function body. A top-level read from here would
 * be a TDZ crash. Hence the functions below.
 */
import { BLOCKS } from '../wizards/ops/index.js';
import { PROBE_SURFACE_SCRATCH } from '../wizards/ops/probeSurface.js';
import { activeDialectOpts } from '../wizards/previewEmit.js';

const isBand = (b) => Array.isArray(b) && b.length === 2 && Number.isFinite(+b[0]) && Number.isFinite(+b[1]);
const bandsOn = (o) => ((o && Array.isArray(o.scratch)) ? o.scratch.filter(isBand) : []);

/**
 * The union of every band declared by a PALETTE ATOM. This is deliberately the union across ALL atoms rather than only the
 * atoms present in one stack: a custom op is composed freely (and can be edited after the slot is built), the union is ~14
 * numbers wide, and being wrong-by-omission here re-introduces exactly the bug this fixes. Cheap to over-avoid, expensive
 * to under-avoid.
 */
export function opBands() {
    const out = [];
    for (const d of Object.values(BLOCKS || {})) out.push(...bandsOn(d));
    out.push(...PROBE_SURFACE_SCRATCH);
    return out;
}

/** The band the given post injects, resolved from the SAME dialect object emitMapped will emit with. Absent key → []. */
export const dialectBands = (dialect) => bandsOn(dialect);

/**
 * The full avoid set for a universal slot's local-var mint: atom-declared ∪ active-post-declared.
 *
 * The dialect is resolved through activeDialectOpts() — the very call `stackToSlot` already makes to emit the body — so the
 * band is per-post correct by construction and never hard-coded to Expert. A post that injects nothing (grbl, rs274ngc,
 * grblHAL, centroid) contributes nothing and its slots keep the tighter numbering.
 */
export function universalBands(dialect) {
    let d = dialect;
    if (d === undefined) { try { d = activeDialectOpts().dialect; } catch (_) { d = null; } }
    return [...opBands(), ...dialectBands(d)];
}
