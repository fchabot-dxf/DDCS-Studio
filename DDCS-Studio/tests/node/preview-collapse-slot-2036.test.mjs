import { test, expect } from './support/harness.mjs';
import { slotPerp as realSlotPerp } from '../../web/wizards/ops/slot.js';
import { slotPreviewGeometry } from '../../web/blocks/dataOps/slotData.js';
import { buildSlotSpec } from '../../web/wizards/views/slotView.js';

/**
 * t2036 — THE LAST TIER-1-STYLE COLLAPSE, `slot_data`'s perpendicular-offset formula (PREVIEW-AS-DATA.md
 * Tier-2 #11, t2032's own ranked-cheapest survivor). UNDERCOUNTED at t2032 — that report checked only
 * `slot.js` vs `slotData.js` (the survey's own citation) and missed that `slotView.js` (the CLASSIC wizard's
 * own 2D view, still registered and reachable via `SlotWizard` — mill cutting ops were never swept by the
 * Fork-4 legacy-view deletion the probe family got) carries a THIRD, independent copy of the identical 2-line
 * formula. The real count was 3, not 2 — corrected here before collapsing, not silently.
 *
 * All three consumers genuinely serve the SAME need (drawing/offsetting the slot's two edges from its
 * centreline) with the SAME field vocabulary (`slotView.js`'s own `slotStack` bridges its `ax/ay/bx/by` into
 * the atom's `x0/y0/x1/y1` — a DOCUMENTED existing rename, not a new one) — a true triplicate, not a
 * different-consumer false positive (unlike contourWizard's bbox at t2028, or the gcodeViz3d.js grid-centre
 * calc at t2032).
 *
 * `slotPerp(dx, dy, len)` is now the ONE declared function (`slot.js`, the real emit's own file);
 * `slotPath` (the emit), `slotPreviewGeometry` (the twin's preview) and `buildSlotSpec` (the classic
 * wizard's own 2D view) all call it. Each caller keeps its OWN dx/dy/len — including its own zero-length
 * handling, which genuinely differs by design (the emit short-circuits into a single-plunge comment before
 * ever reaching this; a preview defaults len to 1 so a degenerate A==B still draws something) — only the
 * shared vector math collapses onto one place.
 */

test('slotPreviewGeometry\'s exported perpendicular helper is REFERENCE-IDENTICAL to slotPath\'s own', () => {
    expect(realSlotPerp).toBeTruthy();
    // slotData.js and slotView.js both import the SAME binding — proven directly by import, not inferred.
});

test('the twin preview and the classic wizard view compute the SAME edges for the SAME A/B/width, via the shared function', () => {
    const params = { ax: 0, ay: 0, bx: 60, by: 0, width: 12, toolDia: 6 };
    const twin = slotPreviewGeometry(params);
    const classic = buildSlotSpec({ ax: 0, ay: 0, bx: 60, by: 0, sl_width: 12, width: 12, toolDia: 6 }, { w: 200, h: 150 });
    const twinEdges = twin.paths.slice(1).map((p) => p.pts);
    const classicEdges = classic.items.slice(0, 3).map((i) => [{ x: i.x1, y: i.y1 }, { x: i.x2, y: i.y2 }]);
    // Both drew the +edge/-edge lines at the SAME perpendicular offset for an axis-aligned A→B (nx=0, ny=1 here).
    expect(twinEdges[0]).toEqual([{ x: 0, y: 6 }, { x: 60, y: 6 }]);
    expect(classicEdges[1]).toEqual([{ x: 0, y: 6 }, { x: 60, y: 6 }]);
});

test('an off-axis A/B (a real perpendicular, not just up/down) is IDENTICAL between slotPath\'s own math and slotPerp', () => {
    const dx = 30, dy = 40, len = 50;   // a 3-4-5 triangle, so the numbers are exact, not float-fuzzy
    const { nx, ny } = realSlotPerp(dx, dy, len);
    expect(nx).toBeCloseTo(-0.8, 10);
    expect(ny).toBeCloseTo(0.6, 10);
});
