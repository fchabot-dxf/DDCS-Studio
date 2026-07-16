import { test, expect } from '@playwright/test';

/**
 * t881 — TWO-SIDED JOBS, phases 2 + 3 (fast-follows on t879).
 * PHASE 2 PREFLIGHT-PER-SETUP: the envelope check is ONE whole-program trace (the emitted text already carries the baked
 * side-2 mirror), so per-setup is a REPORTING split — violations bucket onto their owning setup via the projection map
 * (proj.map[line-1][0] = the top-level setup id) and are named on that setup's sheet page.
 * PHASE 3 SIM STOCK-FLIP + CARVE-CARRY: at the setup-2 boundary the sim turns the stock over about the declared axis
 * (rotate the part group π) and carries the carve height-field through the flip (HeightmapCarve.mirrorField — reflect
 * indices + through-hole-preserving Z-carry, the same axis+thickness the emit uses). The honest t879 note comes down.
 */
test.use({ viewport: { width: 1300, height: 950 } });

// ── PHASE 2 ────────────────────────────────────────────────────────────────────────────────────────────────
test('preflight splits per setup: a PLANTED side-2 violation is bucketed to setup 2 and named on its page', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const SS = await import('/ui/setupSheet.js');
        // stub the projection map: emitted lines 1..5 (1-based) → ancestry top id; setup 1 owns lines 1-2, setup 2 owns 3-5
        const realProj = window.ddcsGetProjection;
        window.ddcsGetProjection = () => ({ map: [['s1'], ['s1'], ['s2'], ['s2'], ['s2']] });
        const groups = [{ id: 's1', index: 1 }, { id: 's2', index: 2 }];
        // a whole-program verdict with one violation on a SIDE-1 line (2) and a PLANTED one on a SIDE-2 line (4)
        const verdict = { status: 'red', violations: [{ line: 2, axis: 'X-', overshoot: 1.1 }, { line: 4, axis: 'Y+', overshoot: 3.2 }] };
        const bySetup = SS.violationsBySetup(verdict, groups);
        const out = {
            s1: (bySetup.get(1) || []).length, s2: (bySetup.get(2) || []).length,
            s2html: SS.setupPreflightHTML(bySetup.get(2)),
            s1noViolIfGreen: SS.setupPreflightHTML([]),   // a clean setup → green line
        };
        window.ddcsGetProjection = realProj;
        return out;
    });
    expect(r.s1, 'the side-1 violation buckets to setup 1').toBe(1);
    expect(r.s2, 'the planted side-2 violation buckets to setup 2').toBe(1);
    expect(/outside the envelope/.test(r.s2html), 'setup 2 names it as a breach').toBe(true);
    expect(/line 4/.test(r.s2html) && /Y\+/.test(r.s2html) && /3\.2/.test(r.s2html), 'the violation is named line+axis+overshoot on the side-2 page').toBe(true);
    expect(/fits the envelope/.test(r.s1noViolIfGreen), 'a clean setup shows a green line').toBe(true);
});

// ── PHASE 3: the carried field (through-hole) ──────────────────────────────────────────────────────────────
test('carve-carry: a side-1 THROUGH-hole carries to the reflected cell on the new top; a BLIND pocket does not (2.5D honest)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/engine/stockRemoval.js');
        const Z = 20;
        const hm = new M.HeightmapCarve({ x: 40, y: 40, z: Z }, []);
        // a THROUGH cut at (10,8): plunge clean through the thickness
        hm.carveSegment({ x: 10, y: 8, z: -Z }, { x: 10, y: 8, z: -Z }, 2, 'feed');
        // a BLIND pocket at (30,8): 4mm deep only
        hm.carveSegment({ x: 30, y: 8, z: -4 }, { x: 30, y: 8, z: -4 }, 2, 'feed');
        const ci = (x) => Math.round(x / hm.dx), cj = (y) => Math.round(y / hm.dy);
        const beforeThrough = hm.h[hm.idx(ci(10), cj(8))];
        const beforeBlind = hm.h[hm.idx(ci(30), cj(8))];
        // FLIP about X → reflect Y (rows): the (x, y) material carries to (x, Y-y)
        hm.mirrorField('X', Z);
        const yReflect = 40 - 8;   // the reflected Y for the through-hole
        const afterThroughReflected = hm.h[hm.idx(ci(10), cj(yReflect))];   // the carried through-hole from the new top
        const afterBlindReflected = hm.h[hm.idx(ci(30), cj(yReflect))];     // the blind pocket should NOT carry
        return { beforeThrough, beforeBlind, afterThroughReflected, afterBlindReflected, Z };
    });
    expect(Math.abs(r.beforeThrough + r.Z), 'the side-1 through cut reaches the bottom (h ≈ -Z)').toBeLessThan(0.5);
    expect(r.beforeBlind, 'the blind pocket is ~4mm deep (not through)').toBeGreaterThan(-r.Z + 1);
    expect(Math.abs(r.afterThroughReflected + r.Z), 'the through-hole CARRIES to the reflected cell from the new top (still -Z)').toBeLessThan(0.5);
    expect(Math.abs(r.afterBlindReflected), 'the blind pocket does NOT carry — the new top reads intact (0) [honest 2.5D limit]').toBeLessThan(0.5);
});

// ── PHASE 3: the visual flip + honest note gone (screenshot VIEWED) ─────────────────────────────────────────
test('the part group turns over at the flip (π about the axis) and the carried stock renders; screenshot', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.THREE, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const host = document.createElement('div'); host.className = '__flip'; host.style.cssText = 'position:fixed;left:8px;top:8px;width:420px;height:340px;z-index:99999;background:#0d1117';
        document.body.appendChild(host);
        const v = new GcodeViz3D(host);
        v.setStock({ x: 40, y: 40, z: 20, show: true });
        v.setCarve(true);
        // side-1: a through-hole + a shallow pocket, then FLIP about X + carry the field
        v.carveEndState([{ x1: 10, y1: 8, z1: -20, x2: 10, y2: 8, z2: -20, type: 'feed' }, { x1: 30, y1: 30, z1: -3, x2: 30, y2: 30, z2: -3, type: 'feed' }], 3, 'flat', 0);
        const before = v._partGroup ? v._partGroup.rotation.x : -1;
        v.setPartFlip('X');
        v.carveMirrorField('X', 20);
        if (v.render) v.render();
        window.__flip = v;
        return { before, afterX: v._partGroup ? v._partGroup.rotation.x : -1, flipState: v._partFlip };
    });
    expect(Math.abs(r.before), 'the part group starts un-flipped').toBeLessThan(1e-6);
    expect(Math.abs(r.afterX - Math.PI), 'setPartFlip(X) rotates the part group π about X (the part turns over)').toBeLessThan(1e-6);
    expect(r.flipState, 'the flip state persists (survives per-frame re-apply + rebuilds)').toBe('X');
    await page.locator('.__flip').screenshot({ path: testInfo.outputPath('t881-stock-flip.png') });
    await page.evaluate(() => { window.__flip && window.__flip.dispose && window.__flip.dispose(); document.querySelectorAll('.__flip').forEach((n) => n.remove()); });
});

test('the honest t879 two-sided note is RETIRED: the sheet flip instruction no longer carries the "coming next" caveat', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.openSetupSheet, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const SS = await import('/ui/setupSheet.js');
        const mkOp = (id, label, mx) => ({ type: 'op', id, opType: 'pocket', label, params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x: mx, y: 10, z: -5, feed: 200 } }] });
        window.ddcsLoadBlockStack([
            { type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mkOp('o1', 'Front', 10)] },
            { type: 'setup', id: 's2', params: { title: 'Back', index: 2 }, children: [mkOp('o2', 'Back', 10)] },
            { type: 'flip', id: 'f1', params: { axis: 'X', setup: 2 } },
        ]);
        SS.openSetupSheet();
        const html = document.getElementById('setupSheetPage').innerHTML;
        return { hasFlipInstr: /Flip the part about the X axis/.test(html), hasStaleNote: /not yet re-shown flipped|coming next/.test(html) };
    });
    expect(r.hasFlipInstr, 'the flip instruction still stands').toBe(true);
    expect(r.hasStaleNote, 'the t879 "coming next / not yet re-shown flipped" caveat is gone (phase 3 shipped)').toBe(false);
});
