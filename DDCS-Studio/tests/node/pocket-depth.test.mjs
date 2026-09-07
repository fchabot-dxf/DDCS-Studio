import { test, expect } from './support/harness.mjs';
import { waitReady } from '../_boot.js';

/**
 * t2695 — TIER MIGRATION: split from tests/pocket-depth.spec.js. Only "2D backdrop reflects a declared floor depth"
 * is pure (projectWorkpiece/workpieceBackdrop are plain data functions, no DOM, no canvas/Three.js read). The other
 * three tests in the original file — the 3D floor test (instantiates GcodeViz3D against a real `document.createElement`
 * host and reads `viz.stockMesh.geometry.attributes.position.array`, a Three.js buffer), the modal depth field test
 * (page.waitForSelector + a real dispatched `change` event + a page screenshot), and the SCRUTINY screenshot test
 * (another real GcodeViz3D host + screenshot) — all depend on real DOM/canvas/Three.js and stay in the browser tier,
 * moved verbatim to tests/pocket-depth-drive.spec.js.
 *
 * POCKET-DEPTH FIELD (declare-not-derive). Inside features get a real BOTTOM at a DECLARED depth — the user owns the number,
 * the previews render the floor. VERIFY (this file): the 2D backdrop reflects a declared floor; depth is PHYSICAL (from the
 * top), datum-free.
 */

test('2D backdrop reflects a declared floor depth (a sub-through cavity gets the depth tag)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await waitReady(page, () => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { projectWorkpiece, workpieceBackdrop } = await import('/engine/workpiece.js');
        const floored = workpieceBackdrop(projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket',
            features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 30, y: 20 }, size: { x: 20, y: 10 }, depth: 6 }] }));
        const thru = workpieceBackdrop(projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket',
            features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 30, y: 20 }, size: { x: 20, y: 10 }, depth: 20 }] }));
        return { flooredDepth: floored.items[0] && floored.items[0].depth, thruDepth: thru.items[0] && thru.items[0].depth };
    });
    expect(r.flooredDepth, 'a declared sub-through depth is tagged on the 2D cavity glyph').toBe(6);
    expect(r.thruDepth, 'a full-through depth is NOT tagged (through-cut, no floor)').toBeUndefined();
});
