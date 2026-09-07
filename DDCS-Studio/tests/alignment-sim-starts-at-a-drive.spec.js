import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT sim-start fix (t570) — the human's symptom: the played trace + the point-A probe rendered AT {0,0} (the circled
 * origin probe) while the A/B handles sat elsewhere, so the drawn path was disconnected from the handles. Since the revised
 * AUTO probes A IN PLACE, the sim's "in place" = the engine's initial seat = origin. FIX (reuse the homing t540 initialPos
 * seam via a declared seatStart intent): seat the trace/engine INITIAL POSITION at marker A, so the drawn path BEGINS at A
 * (probe A at A → the span jog lands at B → the path connects the handles). Emit unchanged (sim-only).
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from alignment-sim-starts-at-a.spec.js. This test opens a real wizard
 * (window.openWiz), waits on a real DOM selector + a rendered canvas, and reads a live wizardManager panel's
 * getSegments/getPassStarts — a genuine app+DOM+render dependency, not a pure import()+evaluate. Its sibling ("the
 * alignment intent carries seatAtStart" — pure opSimContext, no DOM) moved to tests/node/alignment-sim-starts-at-a.test.mjs.
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('the played trace STARTS at handle A (not origin) — the drawn path begins at A, nothing at {0,0}', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'nnp' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(400);

    const r = await page.evaluate(async () => {
        const { passAnchorFor } = await import('/engine/passAnchor.js');
        const p = window.ddcsStudio.wizardManager._activePanel;
        const A = p && p.getStartPos ? p.getStartPos() : null;
        const segs = (p && p.getSegments) ? p.getSegments() : [];
        const starts = p.getPassStarts ? p.getPassStarts() : [], ends = p.getPassEnds ? p.getPassEnds() : [];
        const first = segs[0] ? { x: segs[0].x1, y: segs[0].y1 } : null;
        // The closest any segment endpoint comes to the machine origin {0,0} (the human's stray origin probe).
        // t1235 — measured in WORLD, not in a segment's PASS-LOCAL frame. Local {0,0} is not the machine origin: it is
        // wherever that pass is anchored, and the inter-pass connector legitimately starts at local zero (the previous
        // pass's runtime end IS pass p's anchor). Reading raw coords made a local zero look like the stray probe this
        // test exists to catch — the same over-broad-proxy trap, one frame lower.
        const world = (s, k) => { const o = passAnchorFor(starts, ends, s.pass) || { x: 0, y: 0 }; return [(s['x' + k] || 0) + o.x, (s['y' + k] || 0) + o.y]; };
        let minOrigin = Infinity;
        for (const s of segs) { for (const pt of [world(s, 1), world(s, 2)]) { const d = Math.hypot(pt[0], pt[1]); if (d < minOrigin) minOrigin = d; } }
        return { A, first, segCount: segs.length, minOrigin, aFromOrigin: A ? Math.hypot(A.x || 0, A.y || 0) : 0 };
    });
    expect(r.segCount, 'the alignment trace has segments').toBeGreaterThan(0);
    expect(r.aFromOrigin, 'marker A is DISTINCT from the origin (so the test is meaningful)').toBeGreaterThan(10);
    expect(r.first, 'the trace has a first point').not.toBeNull();
    // the trace's FIRST point sits at A (within a small tolerance), NOT at the origin
    expect(Math.hypot(r.first.x - r.A.x, r.first.y - r.A.y), `the played trace STARTS at handle A (A=${JSON.stringify(r.A)}, first=${JSON.stringify(r.first)})`).toBeLessThan(5);
    // and NO segment endpoint sits at the origin (the stray {0,0} probe is gone)
    expect(r.minOrigin, 'no segment endpoint sits at the machine origin {0,0} anymore').toBeGreaterThan(10);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_starts_at_a.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('ALIGNMENT trace starts at A=' + JSON.stringify(r.A) + ' first=' + JSON.stringify(r.first) + ' minOrigin=' + r.minOrigin.toFixed(1));
});
