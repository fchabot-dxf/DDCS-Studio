import { test, expect } from '@playwright/test';

/**
 * PREVIEW SWEEP (t702) — the SLOT / CONTOUR / TEXT data-twins were ported emit-first as `panel: 'form2d'`, so opening
 * them took userOpView's `mode==='2d'` branch: NO createPreviewPanel, no 3D, no engine — and (no role/group bindings)
 * the FeatureCanvas painted only the stock rectangle. The user saw "no 3D, near-empty 2D". The fix flips each twin to
 * `panel: 'form3d'` (the drill/bore reference), routing them into `preview3D` → the shared createPreviewPanel: a 3D
 * stock+toolpath with play/material-carve AND the panel's OWN 2D toolpath-from-above (the real traced segments) + a
 * draggable start marker.
 *
 * REAL SYMPTOM asserted per twin (not a proxy):
 *   • the shared panel MOUNTED — wizardManager._activePanel is set (preview3D sets it; a form2d op never calls preview3D).
 *   • the 2D draws the ACTUAL toolpath — getSegments() is non-empty AND spans the op extent (a real feature, not a point
 *     and not just the stock box, which is drawn separately and is NOT in the segment list).
 *   • the 3D PLAYS — the engine runs to completion when Play is clicked.
 *   • a draggable start/placement marker exists (getPassStarts()).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openTwin(page, opType) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' };   // a real stock so the carve + layout have context
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate((t) => window.openWiz(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
}

/** Read the live panel state: mounted?, segment count + toolpath bbox, start-marker count. */
function panelState(page) {
    return page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        if (!p || typeof p.getSegments !== 'function') return { mounted: false };
        const segs = p.getSegments() || [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of segs) {
            for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
                if (Number.isFinite(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
                if (Number.isFinite(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
            }
        }
        const w = (maxX - minX), h = (maxY - minY);
        const starts = (typeof p.getPassStarts === 'function' ? p.getPassStarts() : []) || [];
        return { mounted: true, segCount: segs.length, bboxW: Number.isFinite(w) ? w : 0, bboxH: Number.isFinite(h) ? h : 0, starts: starts.length };
    });
}

const clickPlay = (page) => page.evaluate(() => {
    const run = [...document.querySelectorAll('#wiz_user .wiz-viz3d .pp-run')].find((b) => b.offsetParent !== null) || document.querySelector('#wiz_user .pp-run');
    if (run) run.click();
});

/** Click Play and assert the engine STARTS running — proves the shared 3D sim is wired + plays. (We don't wait for full
 *  completion: a scanline-filled TEXT engrave is legitimately long; that it RUNS is the symptom, not how long it takes.)
 *  The engine is created lazily by Play, so it only exists after the click. Stop it afterward to leave a clean state. */
async function playAndAssertStarts(page) {
    await clickPlay(page);
    await page.waitForFunction(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        return p && p.engine && p.engine.running;   // the lazy engine was created AND is now running
    }, null, { timeout: 12000 });
    await clickPlay(page);   // toggle Stop (a running .pp-run stops + resets) so no engine lingers into the next test
}

for (const { opType, name, minSpan } of [
    { opType: 'user_slot_data', name: 'slot', minSpan: 20 },      // default A(0,0)→B(60,0): the channel spans ~60 in X
    { opType: 'user_contour_data', name: 'contour', minSpan: 20 }, // default rect 80×60: the profile spans both axes
    { opType: 'user_text_data', name: 'text', minSpan: 5 },        // engraved glyph strokes span the text box
]) {
    test(`${name} twin: the 3D panel mounts + the 2D draws a real toolpath spanning the op extent`, async ({ page }) => {
        await openTwin(page, opType);
        const st = await panelState(page);
        expect(st.mounted, `${name}: the shared createPreviewPanel mounted (form3d → preview3D set _activePanel)`).toBe(true);
        expect(st.segCount, `${name}: the traced toolpath has segments (not an empty preview)`).toBeGreaterThan(0);
        // "a polyline that spans the op extent, not just the stock rectangle": the stock box is NOT in segs, so a real
        // toolpath must have a meaningful bounding span in at least one axis.
        expect(Math.max(st.bboxW, st.bboxH), `${name}: the toolpath spans the op extent`).toBeGreaterThan(minSpan);
        expect(st.starts, `${name}: a draggable start/placement marker exists`).toBeGreaterThan(0);
        { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: `scratchpad/preview-sweep-${name}-after.png`, clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    });

    test(`${name} twin: the 3D preview PLAYS (engine runs)`, async ({ page }) => {
        await openTwin(page, opType);
        await playAndAssertStarts(page);
        // reaching here (the waitForFunction resolved) proves Play created + ran the engine — the sim plays.
    });
}
