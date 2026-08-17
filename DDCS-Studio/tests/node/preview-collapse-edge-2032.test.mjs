import { test, expect } from './support/harness.mjs';
import { edgeSideIsNear } from '../../web/viz/opSimStarts.js';
import { edgeDataDef, EDGE_DEFAULTS } from '../../web/blocks/dataOps/edgeData.js';
import { layoutSpecFromOp } from '../../web/wizards/ops/panelTypes.js';

/**
 * t2032 — SETTLING edge_data honestly, per the dispatch's own instruction ("if it is still 2 copies, collapse
 * it — that is the honest end"). t2014 measured the "pos direction ⇒ near/0 face" rule at 4 → 2 copies, but
 * flagged that drop as INCIDENTAL (a side effect of Fork 4's legacy-view deletion, not a deliberate dedup).
 * Read directly against HEAD, not the survey's cached citations: `edgeData.js`'s own sim-start POSITION is
 * genuinely single-sourced already (a declared `EDGE_SIM_STARTS` row read by `opSimStarts.js`'s shared
 * row-interpreter) — but `panelTypes.js`'s 2D WALL-GLYPH drawing (a separate, differently-shaped output — WHICH
 * stock edge is the "wall", not the marker's offset) independently re-typed the identical "pos ⇒ near face"
 * boolean a second time. Genuinely still 2 copies of the SAME decision — collapsed here, not merely renamed:
 * `edgeSideIsNear` is now the ONE declared answer, exported from where the sim-start already computed it,
 * called by both.
 */

test('edgeSideIsNear matches the built-in outside() convention: pos/min are near, neg/max/anything else are far', () => {
    expect(edgeSideIsNear('pos')).toBe(true);
    expect(edgeSideIsNear('min')).toBe(true);
    expect(edgeSideIsNear('neg')).toBe(false);
    expect(edgeSideIsNear('max')).toBe(false);
    expect(edgeSideIsNear('anything-else')).toBe(false);
});

test('the REAL wall glyph, from layoutSpecFromOp itself, flips with dir exactly as edgeSideIsNear says it should', () => {
    // Not a re-implementation of panelTypes.js's own code — this calls the actual live function edge_data's
    // 2D pane renders through, on the actual registered def, and reads the actual drawn line back.
    for (const dir of ['pos', 'neg']) {
        const def = edgeDataDef();
        const params = { ...EDGE_DEFAULTS, dir, axis: 'X' };
        const spec = layoutSpecFromOp(def, params);
        const wall = (spec.items || []).find((i) => i.cls === 'fc-edge-wall');
        expect(wall, `dir=${dir} draws a wall line`).toBeTruthy();
        const wantNear = edgeSideIsNear(dir);
        const drawnAtOrigin = wall.x1 === 0 && wall.x2 === 0;
        expect(drawnAtOrigin, `dir=${dir}: drawn at X=0 iff edgeSideIsNear says near`).toBe(wantNear);
    }
});
