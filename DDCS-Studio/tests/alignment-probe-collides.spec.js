import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT probe COLLISION (t572) — the human: the probe doesn't hit the stock. ROOT (a t570 spec error): the sim Z was
 * seated ABOVE the stock top, but alignment probes HORIZONTALLY into the FENCE at PROBING HEIGHT (below the top edge), so the
 * G31 passed OVER the stock. FIX: seat the sim Z a few mm DOWN the wall (opSimStarts) + when the tool is seated at an absolute
 * pos, the collision `O` must not double-count `_stockOffset` (else aStart is 2× the seat and the ray misses).
 *
 * VERIFY (the DEFAULT config — checkAxis X, probeDir +): the traced probe-leg endpoints STOP at the +Y fence face
 * (stock.y + tip radius), NOT the full max-probe distance, for BOTH A and B; the retract legs come back OFF the wall.
 *
 * GAP flagged to the advisor (a marker-geometry design decision, NOT done here): the OTHER configs (probeDir −, checkAxis Y)
 * do NOT collide — A's DEFAULT anchor (opSimStarts/alignDefaultAnchor: fy≈0.85, near the +Y edge) only reaches the +Y fence.
 * Making every config collide needs A repositioned OUTSIDE the PROBED fence per checkAxis × probeDir (an external standoff
 * within the max-probe distance) — which fence each config probes + the standoff basis (mm vs fraction, stock-robust) is a
 * design choice to confirm before changing the marker defaults.
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('DEFAULT config (checkAxis X, probeDir +): both probe legs STOP at the +Y fence face (stock.y + tipR), not full travel', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(400);

    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const stock = window.ddcsGetSettings().stock, tipR = (window.ddcsGetSettings().probes || {}).radius || 0;
        const segs = p.getSegments();
        const probes = segs.filter((s) => s.type === 'probe').map((s) => ({ y1: s.y1, y2: s.y2, x1: s.x1 }));
        const rapids = segs.filter((s) => s.type === 'rapid').map((s) => ({ y1: s.y1, y2: s.y2 }));
        return { wall: stock.y + tipR, tipR, probes, rapids, seatZ: (p.getStartPos() || {}).z };
    });
    expect(r.seatZ, 'the sim is seated BELOW the stock top (a few mm down the wall), not above it').toBeLessThan(0);
    expect(r.probes.length, 'there are probe legs (A fast+slow, B fast+slow)').toBeGreaterThanOrEqual(2);
    const fenceXs = new Set();
    for (const pr of r.probes) {
        const travel = Math.abs(pr.y2 - pr.y1);
        expect(travel, 'the probe leg COLLIDED — stopped before the full 20mm max-probe').toBeLessThan(20 - 0.5);
        expect(Math.abs(pr.y2 - r.wall), `the probe endpoint sits AT the fence face (${r.wall}), got ${pr.y2.toFixed(2)}`).toBeLessThan(0.6);
        fenceXs.add(Math.round(pr.x1));
    }
    // A and B probe the SAME fence line (their probe legs both end at wall Y) at DISTINCT X (A + the span)
    expect([...fenceXs].length, 'A and B probe at distinct X positions (A + the span)').toBeGreaterThanOrEqual(2);
    // a retract leg comes back OFF the wall (toward smaller Y)
    expect(r.rapids.some((s) => s.y2 < s.y1 - 0.5), 'a retract leg backs OFF the wall').toBe(true);
    console.log('ALIGNMENT probe collides: wall=' + r.wall + ' (stock.y+tipR' + r.tipR + '), ' + r.probes.length + ' legs stop at it; seatZ=' + r.seatZ);
});
