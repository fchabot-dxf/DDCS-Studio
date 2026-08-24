import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * POCKET-DEPTH FIELD (declare-not-derive). Inside features get a real BOTTOM at a DECLARED depth — the user owns the number,
 * the previews render the floor. VERIFY: (1) the 3D floors the cavity at (top − depth) — ASSERT floor-Z == top − depth (an
 * independent geometric truth), a full/undeclared depth (≥ Z) stays a through-cut; (2) the modal depth FIELD persists to
 * feature.depth (round-trips); (3) the 2D backdrop reflects a declared floor; depth is PHYSICAL (from the top), datum-free.
 */

test('3D floor: an inside cavity with a declared depth gets a floor at top − depth; a full depth stays through', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await waitReady(page, () => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const host = document.createElement('div'); host.style.cssText = 'width:320px;height:320px;'; document.body.appendChild(host);
        let viz; try { viz = new GcodeViz3D(host); viz._animOn = false; } catch (e) { return { err: String(e) }; }
        const stock = (depth) => ({ x: 100, y: 80, z: 20, show: true, shape: 'pocket', datum: 'nnp',
            features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 50, y: 40 }, size: { x: 40, y: 30 }, depth }] });
        viz.setStock(stock(8));    // depth 8 < 20 → a floor + walls recessing only to −8; footprint 40×30 @ (50,40)
        const floored = { floors: (viz._pocketFloors || []).map((f) => ({ depth: f.depth, floorZ: f.floorZ })), top: viz._stockTopZ, wallDepth: viz._pocketWallDepthZ };
        // INSPECT the manifold geometry: the horizontal surface at the FLOOR (z ≈ −8) must be the POCKET FOOTPRINT ONLY,
        // not a stock-spanning plane. Collect horizontal tris at z=−8 and measure their XY extent (geometry is local [0,X]×[0,Y]×[−Z,0]).
        const g = viz.stockMesh.geometry.attributes.position.array;
        let e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }, floorTris = 0;
        for (let i = 0; i < g.length; i += 9) {
            const zs = [g[i + 2], g[i + 5], g[i + 8]];
            if (zs.every((z) => Math.abs(z + 8) < 0.02)) { floorTris++; for (const j of [0, 3, 6]) { e.minX = Math.min(e.minX, g[i + j]); e.maxX = Math.max(e.maxX, g[i + j]); e.minY = Math.min(e.minY, g[i + j + 1]); e.maxY = Math.max(e.maxY, g[i + j + 1]); } }
        }
        floored.floorExtent = e; floored.floorTris = floorTris;
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
    // BUG C (the REAL symptom) — the horizontal floor surface at −depth is the POCKET FOOTPRINT ONLY, NOT a stock-spanning plane.
    // footprint 40×30 @ (50,40) → x∈[30,70], y∈[25,55]. The stock is 100×80 → a stock-spanning plane would be [0,100]×[0,80].
    expect(r.floored.floorTris, 'the floor surface exists at −depth').toBeGreaterThan(0);
    expect(r.floored.floorExtent.minX, 'floor left == the pocket footprint (NOT the stock 0)').toBeCloseTo(30, 3);
    expect(r.floored.floorExtent.maxX, 'floor right == the pocket footprint (NOT the stock 100)').toBeCloseTo(70, 3);
    expect(r.floored.floorExtent.minY, 'floor front == the pocket footprint (NOT the stock 0)').toBeCloseTo(25, 3);
    expect(r.floored.floorExtent.maxY, 'floor back == the pocket footprint (NOT the stock 80)').toBeCloseTo(55, 3);
    expect(r.thru.floors, 'a full depth (≥ stock Z) stays a through-cut — NO floor').toBe(0);
    expect(r.thru.wallDepth, 'a full/undeclared depth keeps full-Z walls (through-hole)').toBe(r.Z);
});

test.use({ viewport: { width: 1200, height: 900 } });
test('modal depth field: editing it persists to feature.depth (round-trip) + floors the pocket; screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await waitReady(page, () => window.ddcsStudio && window.ddcsOpenStock && window.ddcsGetSettings);
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

test('SCRUTINY screenshot: a 3/4-angle render shows the pocket CONFINED (solid stock all around, walls to the floor, no full-width band)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await waitReady(page, () => window.ddcsGetBlockProgram);
    await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const host = document.createElement('div'); host.id = 'scrutiny3d'; host.style.cssText = 'position:fixed; left:0; top:0; width:560px; height:440px; background:#05070a; z-index:99999;'; document.body.appendChild(host);
        const viz = new GcodeViz3D(host); viz._animOn = false;
        viz.setStock({ x: 120, y: 90, z: 20, show: true, shape: 'pocket', datum: 'nnp',
            features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 45, y: 40 }, size: { x: 50, y: 34 }, depth: 8 }] });
        // screenshot-only: render the recess OPAQUE + depth-tested so it reads as a real solid 3D cut (the app runs 0.72 translucent
        // so you can see the toolpath inside — but that hides the recess shape; here we make the GEOMETRY unambiguous to scrutinize).
        if (viz.stockMesh && viz.stockMesh.material) { const m = viz.stockMesh.material; m.transparent = false; m.opacity = 1; m.depthWrite = true; }
        try { viz.fitAll(); } catch (_) {}
        viz.theta = -Math.PI / 2 + 0.6;   // swing to a front-right corner (set AFTER fitAll so it isn't reset)
        viz.phi = Math.PI / 3.4;          // a top-down look, into the pocket (see the floor below the rim)
        try { viz._applyCamera(); } catch (_) {}
        try { viz.render(); } catch (_) {}
        window.__scrutinyReady = true;
    });
    await waitReady(page, () => window.__scrutinyReady);
    await page.waitForTimeout(300);
    await page.locator('#scrutiny3d').screenshot({ path: 'scratchpad/pocket_recess_3q.png' });
    expect(true).toBe(true);
});

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
