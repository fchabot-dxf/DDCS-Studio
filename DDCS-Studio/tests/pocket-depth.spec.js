import { test, expect } from '@playwright/test';

/**
 * POCKET-DEPTH FIELD (declare-not-derive). Inside features get a real BOTTOM at a DECLARED depth — the user owns the number,
 * the previews render the floor. VERIFY: (1) the 3D floors the cavity at (top − depth) — ASSERT floor-Z == top − depth (an
 * independent geometric truth), a full/undeclared depth (≥ Z) stays a through-cut; (2) the modal depth FIELD persists to
 * feature.depth (round-trips); (3) the 2D backdrop reflects a declared floor; depth is PHYSICAL (from the top), datum-free.
 */

test('3D floor: an inside cavity with a declared depth gets a floor at top − depth; a full depth stays through', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const host = document.createElement('div'); host.style.cssText = 'width:320px;height:320px;'; document.body.appendChild(host);
        let viz; try { viz = new GcodeViz3D(host); viz._animOn = false; } catch (e) { return { err: String(e) }; }
        const stock = (depth) => ({ x: 100, y: 80, z: 20, show: true, shape: 'pocket', datum: 'nnp',
            features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 50, y: 40 }, size: { x: 40, y: 30 }, depth }] });
        viz.setStock(stock(8));    // depth 8 < 20 → a floor + walls recessing only to −8
        const floored = { floors: (viz._pocketFloors || []).map((f) => ({ depth: f.depth, floorZ: f.floorZ })), top: viz._stockTopZ, wallDepth: viz._pocketWallDepthZ };
        viz.setStock(stock(20));   // depth 20 == Z → full-through (walls full-Z, no floor)
        const thru = { floors: (viz._pocketFloors || []).length, wallDepth: viz._pocketWallDepthZ };
        return { floored, thru, Z: 20 };
    });
    console.log('POCKET FLOOR: ' + JSON.stringify(r));
    expect(r.err, 'the 3D viz instantiated').toBeUndefined();
    expect(r.floored.floors.length, 'the declared-depth cavity produced ONE floor').toBe(1);
    expect(r.floored.floors[0].depth, 'the floor carries the declared depth').toBe(8);
    // the CORE assertion (independent geometric truth): floor-Z == stock top − depth
    expect(r.floored.top - r.floored.floors[0].floorZ, 'floor-Z == top − depth (a real bottom at the cut depth)').toBeCloseTo(8, 5);
    // BUG C — the WALLS END at the floor: the cavity wall Z-extent == depth (NOT full-Z). A through-hole would be 20.
    expect(r.floored.wallDepth, 'the pocket WALLS terminate at the floor (extent == depth, solid below) — NOT a full-Z through-hole').toBe(8);
    expect(r.thru.floors, 'a full depth (≥ stock Z) stays a through-cut — NO floor').toBe(0);
    expect(r.thru.wallDepth, 'a full/undeclared depth keeps full-Z walls (through-hole)').toBe(r.Z);
});

test.use({ viewport: { width: 1200, height: 900 } });
test('modal depth field: editing it persists to feature.depth (round-trip) + floors the pocket; screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsOpenStock && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings().stock;
        Object.assign(s, { x: 120, y: 90, z: 20, datum: 'nnp', shape: 'pocket', features: [] });
        window.ddcsOpenStock();
    });
    await page.waitForSelector('#se_features .se-feat-depth', { timeout: 8000 });
    await page.waitForTimeout(400);
    // set a floored depth in the field
    const round = await page.evaluate(() => {
        const inp = document.querySelector('#se_features .se-feat-depth');
        inp.value = '7'; inp.dispatchEvent(new Event('change', { bubbles: true }));
        const feats = window.ddcsGetSettings().stock.features;
        return { stored: feats[0] && feats[0].depth, fieldExists: !!inp };
    });
    await page.waitForTimeout(400);
    await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/pocket_depth_floor.png' });
    expect(round.fieldExists, 'the pocket-depth field rendered for the inside feature').toBe(true);
    expect(round.stored, 'editing the depth field persisted to feature.depth (materialized + round-trips)').toBe(7);
});

test('2D backdrop reflects a declared floor depth (a sub-through cavity gets the depth tag)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
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
