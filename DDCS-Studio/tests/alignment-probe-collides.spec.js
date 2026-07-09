import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT SIM MODEL (t574 — the advisor's RULED redesign; sim-only, emit unchanged). Alignment probes a FENCE FACE
 * determined by (checkAxis × probeDir) = the stock wall whose outward normal OPPOSES the probe direction, approached from
 * OUTSIDE: X+ → −Y face, X− → +Y face, Y+ → −X face, Y− → +X face. MARKERS = APPROACH POINTS: default ALONG the fence (0.3
 * fraction; B rides to A+span), PERPENDICULAR just OUTSIDE the face (a standoff ~ retract+2mm) → for ALL 4 combos the default
 * markers sit OUTSIDE the stock and collide by construction. A is freely draggable; B RIDES A's approach line (B.perp == A.perp)
 * offset by the span → marker B == the route's B (the +15 offset gone). Probe legs stop at the face ∓ tipR.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openAlign(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}
const setSeg = (page, param, val) => page.evaluate(({ param, val }) => { const seg = document.querySelector(`#wiz_user_form .seg-control[data-param="${param}"]`); const btn = seg && seg.querySelector(`button[data-value="${val}"]`); if (btn) btn.click(); }, { param, val });

// checkAxis × probeDir → { perp axis, the face contact value } (fence dim 150×100, tipR 2)
const FACE = {
    Xpos: { perp: 'y', face: -2 }, Xneg: { perp: 'y', face: 102 },   // −Y face (0−r) / +Y face (100+r)
    Ypos: { perp: 'x', face: -2 }, Yneg: { perp: 'x', face: 152 },   // −X face (0−r) / +X face (150+r)
};

for (const checkAxis of ['X', 'Y']) for (const probeDir of ['pos', 'neg']) {
    test(`combo ${checkAxis}/${probeDir}: default markers OUTSIDE the stock + BOTH legs stop at the fence face + marker B == route B`, async ({ page }) => {
        await openAlign(page);
        await setSeg(page, 'checkAxis', checkAxis);
        await setSeg(page, 'probeDir', probeDir);
        await page.evaluate(() => window.updateWiz && window.updateWiz());
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            const stock = window.ddcsGetSettings().stock;
            const m = p.getPassStarts().map((s) => ({ x: s.x, y: s.y }));
            const probes = p.getSegments().filter((s) => s.type === 'probe');
            const perp = probes.length && Math.abs(probes[0].x2 - probes[0].x1) > Math.abs(probes[0].y2 - probes[0].y1) ? 'x' : 'y';
            const along = perp === 'x' ? 'y' : 'x';
            const legs = probes.map((s) => ({ start: s[perp + '1'], contact: s[perp + '2'], along: s[along + '1'] }));
            const bLeg = probes.find((s) => Math.round(s[along + '1']) !== Math.round(probes[0][along + '1']));
            return { markers: m, perp, stock: { x: stock.x, y: stock.y }, legs, markerB: m[1], routeB: bLeg ? { x: bLeg.x1, y: bLeg.y1 } : null };
        });
        const F = FACE[checkAxis + probeDir];
        // 1) default markers OUTSIDE the stock on the probe axis
        for (const m of r.markers) {
            const v = F.perp === 'x' ? m.x : m.y, dim = F.perp === 'x' ? r.stock.x : r.stock.y;
            expect(v < 0 || v > dim, `marker sits OUTSIDE the stock on the ${F.perp} axis (v=${v.toFixed(1)})`).toBe(true);
        }
        // 2) every probe leg (A fast+slow, B fast+slow) COLLIDES at the fence face ∓ tipR (not the full 20mm max-probe)
        expect(r.legs.length, 'there are 4 probe legs (A + B, fast + slow)').toBeGreaterThanOrEqual(4);
        for (const leg of r.legs) {
            expect(Math.abs(leg.contact - F.face), `probe leg stops AT the fence face (${F.face}), got ${leg.contact.toFixed(1)}`).toBeLessThan(0.6);
            expect(Math.abs(leg.contact - leg.start), 'the leg COLLIDED (< the full 20mm max-probe)').toBeLessThan(20 - 0.5);
        }
        // 3) marker B == the route's B (the +15 offset is GONE — B rides A's approach line)
        expect(Math.hypot(r.routeB.x - r.markerB.x, r.routeB.y - r.markerB.y), `marker B (${JSON.stringify(r.markerB)}) == route B (${JSON.stringify(r.routeB)})`).toBeLessThan(0.6);
        await page.locator('#wiz_user').screenshot({ path: `scratchpad/alignment_combo_${checkAxis}${probeDir}.png` });
        console.log(`${checkAxis}/${probeDir}: markers outside ✓, ${r.legs.length} legs at face ${F.face} ✓, markerB==routeB ✓`);
    });
}
