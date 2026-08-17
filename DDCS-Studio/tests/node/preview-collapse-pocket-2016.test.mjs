import { test, expect } from './support/harness.mjs';
import { pocketPreviewGeometry } from '../../web/blocks/dataOps/pocketData.js';
import { trueRegionFromFlat } from '../../web/wizards/ops/pocketfill.js';

/**
 * t2016 — THE TIER-1 COLLAPSE, pocket_data's shape→region-params boundary (PREVIEW-AS-DATA.md's own "strongest
 * triplication"). `pocketPreviewGeometry`'s drawn boundary used to hand-dispatch on `p.shape` with its OWN
 * inline geometry per shape kind (rect: a literal 4-corner polyline; circle: a locally-defined 48-segment
 * `_circlePath`; polygon/ellipse: an inline `regionDesc(...)` call) — a THIRD independent copy of the exact
 * shape→region mapping `pocketfill.js`'s `trueRegionFromFlat` already owns for the real emit (and
 * `pocketWizard.js`'s `trueRegionParams` owns for structural guards — left untouched here: a different
 * consumer, out of scope for a preview fix). This asserts the collapse: the PREVIEW's drawn boundary is now
 * the emit's OWN function, called directly — not a copy that happens to agree today.
 *
 * Not a new declaration (Fork 1, ruled void at t1726, stays void) — a straight import + call, the same shape
 * `drill_data`/`bore_data`'s `patternPoints` reuse and `lathe_polygon`'s `polygonPath` reuse already prove works.
 */

const closeRing = (ring) => (ring.length > 1 ? [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })) : []);

const CASES = [
    { label: 'rect @defaults', p: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60 } },
    { label: 'rect @offdefaults', p: { shape: 'rect', originX: 12.5, originY: -7.25, w: 133.4, h: 41.75 } },
    { label: 'circle @defaults', p: { shape: 'circle', originX: 0, originY: 0, dia: 50 } },
    { label: 'circle @offdefaults', p: { shape: 'circle', originX: 32, originY: 35.5, dia: 57 } },
    { label: 'polygon @offdefaults', p: { shape: 'polygon', originX: 18, originY: 22, dia: 40, sides: 7 } },
    { label: 'ellipse @offdefaults', p: { shape: 'ellipse', originX: -10, originY: 5, w: 90, h: 44 } },
];

test('pocket_data preview boundary — the drawn ring is trueRegionFromFlat\'s OWN contour, for every shape', () => {
    const wrong = [];
    for (const c of CASES) {
        const geo = pocketPreviewGeometry(c.p);
        const boundary = geo.paths[0];
        const expected = closeRing((trueRegionFromFlat(c.p).contour || [])[0] || []);
        const got = JSON.stringify(boundary.pts);
        const want = JSON.stringify(expected);
        if (got !== want) wrong.push(`${c.label}: preview boundary does not match trueRegionFromFlat's own contour — got ${got.length} chars, want ${want.length} chars`);
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
});

test('rect/polygon/ellipse are BYTE-IDENTICAL to the pre-collapse hand-typed geometry (only circle gained fidelity, deliberately)', () => {
    // The pre-collapse rect path was the literal 4-corner polyline; polygon/ellipse already called regionDesc
    // inline with the SAME field names — so those three must be pixel-for-pixel unchanged by this collapse.
    const rect = pocketPreviewGeometry({ shape: 'rect', originX: 5, originY: 5, w: 80, h: 60 });
    expect(rect.paths[0].pts).toEqual([
        { x: 5, y: 5 }, { x: 85, y: 5 }, { x: 85, y: 65 }, { x: 5, y: 65 }, { x: 5, y: 5 },
    ]);
});
