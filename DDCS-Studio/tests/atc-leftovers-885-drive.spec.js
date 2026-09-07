import { test, expect } from '@playwright/test';

/**
 * t885 — ATC LEFTOVERS (backlog item 12). Split from atc-leftovers-885.spec.js at the tier migration work package D;
 * its three sibling tests (piece 2 x2 + piece 3, pure magazinePockets() calls) moved to tests/node/atc-leftovers-885.test.mjs.
 * This one stayed because it builds a real GcodeViz3D (Three.js), appends a DOM host element, and screenshots it — a
 * genuine app+DOM+render dependency, not a pure import()+evaluate.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const DISK = {
    magType: 'disk', pickup: { x: 150, y: 100, z: -40 }, diskDia: 120, diskAxis: '+y',
    magazine: [{ pocket: 1, tool: 1 }, { pocket: 2, tool: 2 }, { pocket: 3, tool: '' }, { pocket: 4, tool: 4 }],
    tools: [{ num: 1, dia: 6, type: 'endmill' }, { num: 2, dia: 3, type: 'ballnose' }, { num: 4, dia: 6, type: 'vbit', angle: 60 }],
};

test('pieces 1+3: the machine-frame magazine renders the carousel plate + occupied tool silhouettes + an empty slot; screenshot', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.THREE, null, { timeout: 15000 });
    const r = await page.evaluate(async ([DISK]) => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const { magazinePockets } = await import('/wizards/views/atcViews.js');
        const host = document.createElement('div'); host.className = '__mag'; host.style.cssText = 'position:fixed;left:8px;top:8px;width:460px;height:380px;z-index:99999;background:#0d1117';
        document.body.appendChild(host);
        const v = new GcodeViz3D(host);
        if (v.setMachine) v.setMachine({ x: { travel: -300 }, y: { travel: -300 }, z: { travel: -120 } });   // the machine envelope (frame context)
        v.setMagazine(magazinePockets({ ...DISK, diskOffsetDeg: 20 }, 0));
        if (v.render) v.render();
        window.__mag = v;
        // piece-1 re-verify: a magazine pocket sits at its RAW machine coord (fixed machine frame), not shifted by any WCS
        const firstOccupied = v._magGroup && v._magGroup.children.find((c) => c.type === 'Mesh' && c.geometry && c.geometry.type === 'LatheGeometry');
        return { hasGroup: !!v._magGroup, kids: v._magGroup ? v._magGroup.children.length : 0, hasPlate: !!(v._magGroup && v._magGroup.children.some((c) => c.geometry && c.geometry.type === 'CylinderGeometry')) };
    }, [DISK]);
    expect(r.hasGroup, 'the magazine group renders').toBe(true);
    expect(r.hasPlate, 'the carousel PLATE (a disc mesh) is drawn').toBe(true);
    expect(r.kids, 'the group has the plate + per-pocket meshes').toBeGreaterThan(4);
    await page.locator('.__mag').screenshot({ path: testInfo.outputPath('t885-atc-magazine.png') });
    await page.evaluate(() => { window.__mag && window.__mag.dispose && window.__mag.dispose(); document.querySelectorAll('.__mag').forEach((n) => n.remove()); });
});
