import { test, expect } from './support/harness.mjs';
import { contourPreviewGeometry } from '../../web/blocks/dataOps/contourData.js';
import { regionFromFlat } from '../../web/wizards/ops/contourfill.js';
import { regionDesc } from '../../web/wizards/ops/region.js';
import { contourRegion } from '../../web/wizards/ops/contour.js';

/**
 * t2028 — THE TIER-1 COLLAPSE, contour_data's shape→region-dims boundary (PREVIEW-AS-DATA.md's Tier-1 #6,
 * the same triplication class as pocket_data's #5, collapsed at t2016). `contourPreviewGeometry` used to
 * hand-dispatch its OWN `_regionParams(p)` per shape kind — a 3rd independent copy of the exact mapping
 * `contourfill.js`'s `regionFromFlat` already owns for the real emit (contourfill's own `emit` calls it).
 * `contourWizard.js`'s `regionParams`/`contourBBox` are left untouched — a DIFFERENT consumer (the wizard's
 * own stack build, `makePlace(params, contourBBox(params), ...)`, not a preview concern), the same
 * "different purpose, stays separate" call t2016 made for `pocketWizard.js`'s own `trueRegionParams`.
 *
 * The one real rename between the twin's own field names (`originX`/`originY`) and the atom's flat ones
 * (`x`/`y`) is bridged with the SAME adapter `contourStack` already uses to build the atom's own params from
 * these same twin fields — not a new vocabulary. Not a new declaration either (Fork 1 stays void): a straight
 * import + call, matching pocket's own collapse shape exactly.
 *
 * Contour draws TWO rings per shape (unlike pocket's one): the TRUE boundary you type (`fc-guide`, straight
 * off `regionDesc`) and the OFFSET toolpath (`fc-path`, `contourRegion` applied to that same region) — both
 * asserted here against the SAME functions the real emit calls, not a copy.
 */

const closeRing = (ring) => (ring.length > 1 ? [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })) : []);
const flatOf = (p) => ({ ...p, x: p.originX, y: p.originY });

const CASES = [
    { label: 'rect @defaults', p: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, side: 'outside', toolDia: 6 } },
    { label: 'rect @offdefaults', p: { shape: 'rect', originX: 12.5, originY: -7.25, w: 133.4, h: 41.75, side: 'inside', toolDia: 8 } },
    { label: 'circle @defaults', p: { shape: 'circle', originX: 0, originY: 0, dia: 50, side: 'outside', toolDia: 6 } },
    { label: 'circle @offdefaults', p: { shape: 'circle', originX: 32, originY: 35.5, dia: 57, side: 'on', toolDia: 6 } },
    { label: 'polygon @offdefaults', p: { shape: 'polygon', originX: 18, originY: 22, dia: 40, sides: 7, side: 'outside', toolDia: 6 } },
    { label: 'ellipse @offdefaults', p: { shape: 'ellipse', originX: -10, originY: 5, w: 90, h: 44, side: 'inside', toolDia: 6 } },
];

test('contour_data preview\'s TRUE boundary ring (fc-guide) is regionDesc(regionFromFlat(...))\'s OWN contour, for every shape', () => {
    const wrong = [];
    for (const c of CASES) {
        const geo = contourPreviewGeometry(c.p);
        const guide = geo.paths.find((q) => q.cls === 'fc-guide');
        const expected = closeRing((regionDesc(regionFromFlat(flatOf(c.p))).contour || [])[0] || []);
        const got = JSON.stringify(guide ? guide.pts : null);
        const want = JSON.stringify(expected);
        if (got !== want) wrong.push(`${c.label}: guide ring does not match regionDesc(regionFromFlat(...))'s own contour — got ${got}, want ${want}`);
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
});

test('contour_data preview\'s OFFSET toolpath ring (fc-path) is contourRegion(...)\'s OWN contour, for every shape', () => {
    const wrong = [];
    for (const c of CASES) {
        const geo = contourPreviewGeometry(c.p);
        const path = geo.paths.find((q) => q.cls === 'fc-path');
        const rg = contourRegion({ region: regionDesc(regionFromFlat(flatOf(c.p))), side: c.p.side, tool: c.p.toolDia });
        const expected = closeRing((rg.contour || [])[0] || []);
        const got = JSON.stringify(path ? path.pts : null);
        const want = JSON.stringify(expected);
        if (got !== want) wrong.push(`${c.label}: offset ring does not match contourRegion's own contour — got ${got}, want ${want}`);
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
});

test('rect is BYTE-IDENTICAL to the pre-collapse hand-typed geometry — the collapse changed the SOURCE, not the shape', () => {
    const geo = contourPreviewGeometry({ shape: 'rect', originX: 5, originY: 5, w: 80, h: 60, side: 'outside', toolDia: 6 });
    const guide = geo.paths.find((q) => q.cls === 'fc-guide');
    expect(guide.pts).toEqual([
        { x: 5, y: 5 }, { x: 85, y: 5 }, { x: 85, y: 65 }, { x: 5, y: 65 }, { x: 5, y: 5 },
    ]);
});
