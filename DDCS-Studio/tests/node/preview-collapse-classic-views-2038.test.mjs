import { test, expect } from './support/harness.mjs';
import { buildPocketSpec } from '../../web/wizards/views/pocketView.js';
import { pocketPreviewGeometry } from '../../web/blocks/dataOps/pocketData.js';
import { buildContourSpec } from '../../web/wizards/views/contourView.js';
import { contourPreviewGeometry } from '../../web/blocks/dataOps/contourData.js';

/**
 * t2038 — RE-CHECKING TIER-1 "CLOSED" ITEMS AGAINST THEIR STILL-LIVE CLASSIC VIEWS.
 *
 * t2036's own slot_data finding generalises: mill-cutting-op classic views were never touched by the Fork-4
 * legacy-view deletion (probe-family only) — they still exist, are still registered in `wizards/views/index.js`,
 * and are still REACHABLE (via an old file/raw block carrying the built-in's raw opType — `wizardManager.js`'s
 * `open()` resolves `viewByType.get(type)` FIRST, and today's menu only bypasses it because `commandDeck.js`
 * routes every `opensAs`-bearing entry straight to the twin's opType instead). So a Tier-1 item "closed" against
 * the twin's own preview can still be duplicated a further time in the classic view nobody re-checked.
 *
 * Re-verified all 5 closed Tier-1 items this turn: `pocket_data` and `contour_data` WERE still duplicated
 * (`pocketView.js`/`contourView.js` each hand-typed their own shape-dispatch, independent of `trueRegionFromFlat`/
 * `regionFromFlat`) — collapsed here. `comm_data` (`commView.js` delegates entirely to the already-fixed
 * `CommunicationWizard` methods), `lathe_parting` (no classic lathe-parting view exists — lathe never used this
 * registry), and the ATC `def.sim` item (all 6 ATC views read through the already-shared `opSimContext`/
 * `applyPreviewIntent` pipeline, never `def.sim` directly) all came back CLEAN — not touched.
 */

test('pocketView\'s polygon/ellipse boundary now equals pocketData\'s own (already-collapsed, t2016) preview, for the same params', () => {
    const CASES = [
        { shape: 'polygon', originX: 10, originY: 20, dia: 40, sides: 6 },
        { shape: 'ellipse', originX: -5, originY: 8, w: 90, h: 44 },
    ];
    for (const p of CASES) {
        const classic = buildPocketSpec(p, { w: 200, h: 150 }).paths[0].pts;
        const twin = pocketPreviewGeometry(p).paths[0].pts;
        expect(classic).toEqual(twin);
    }
});

test('contourView\'s polygon/ellipse boundary now equals contourData\'s own (already-collapsed, t2028) TRUE boundary ring, for the same params', () => {
    const CASES = [
        { shape: 'polygon', originX: 10, originY: 20, dia: 40, sides: 6, side: 'outside', toolDia: 6 },
        { shape: 'ellipse', originX: -5, originY: 8, w: 90, h: 44, side: 'inside', toolDia: 6 },
    ];
    for (const p of CASES) {
        const classicGuide = buildContourSpec(p, { w: 200, h: 150 }).paths.find((q) => q.cls === 'fc-guide');
        const twinGuide = contourPreviewGeometry(p).paths.find((q) => q.cls === 'fc-guide');
        expect(classicGuide.pts).toEqual(twinGuide.pts);
    }
});

test('rect/circle in the classic views are UNTOUCHED — they never routed through the region kernel and still don\'t', () => {
    const pocketRect = buildPocketSpec({ shape: 'rect', originX: 5, originY: 5, w: 80, h: 60 }, { w: 200, h: 150 });
    expect(pocketRect.items.some((i) => i.kind === 'rect' && i.x === 5 && i.y === 5 && i.w === 80 && i.h === 60)).toBe(true);
    const contourCircle = buildContourSpec({ shape: 'circle', originX: 10, originY: 10, dia: 50 }, { w: 200, h: 150 });
    expect(contourCircle.items.some((i) => i.kind === 'circle' && i.cx === 10 && i.cy === 10 && i.r === 25)).toBe(true);
});
