import { test, expect } from '@playwright/test';

/**
 * t746 — THE POSITION CHIP (the declared 12th visibility element 'poschip'). During play a small readout RIDES THE TOOL
 * HEAD in BOTH renderers (3D: a sprite near _animTool; 2D: a label near the drawPath head) showing the live WORK coords
 * from the SAME source as the DRO (onPositionChange → DRO-equal). Motion-gated (fades ~1s after stop); a toggle+alpha row
 * in the visibility modal; prefs persist. View-only → emit byte-identical.
 */
test.use({ viewport: { width: 1300, height: 950 } });

// a longer program → a longer play window for robust sampling
const PROG = 'G90\nG0 X10 Y10 Z5\nG1 Z-2 F200\nX70\nY10\nX70 Y60\nX10 Y60\nX10 Y10\nX40 Y35\nG0 Z5\nM30\n';
const seed = async (page, view) => {
    await page.evaluate((v) => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.default3D = (v === '3d'); s.preview.autoLoop = false; s.preview.defaultSpeed = 1; }, view);
    await page.evaluate((g) => { const e = document.getElementById('editor'); e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, PROG);
    await page.waitForFunction(() => window.__gpPanel, null, { timeout: 8000 });
    await page.evaluate((v) => { const p = window.__gpPanel; p.setGcode(document.getElementById('editor').value); if (p.setView) p.setView(v); }, view);
    await page.waitForTimeout(300);
};
// start a fresh play (click the panel's ▶) and confirm the engine runs — controls the play window explicitly (no autoLoop gaps)
const play = async (page) => {
    await page.evaluate(() => { const p = window.__gpPanel; const b = p.el.querySelector('.pp-run'); if (b) b.click(); });
    await page.waitForFunction(() => { const p = window.__gpPanel; return p && p.engine && p.engine.running; }, null, { timeout: 5000 }).catch(() => {});
};
// poll during the play window until `read()` returns non-null (or the window closes)
const sampleDuringPlay = async (page, read) => {
    let s = null;
    for (let i = 0; i < 40 && !s; i++) { s = await page.evaluate(read); if (!s) await page.waitForTimeout(60); }
    return s;
};

test('3D: the chip rides the head during play with DRO-equal WORK coords; the modal toggles it; it fades on stop', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    await seed(page, '3d');
    await play(page);

    // sample during play: catch a frame where the chip is visible + read it + the DRO together
    const s = await sampleDuringPlay(page, () => {
        const v = window.__gpPanel.viz; if (!(v._posChip && v._posChip.visible && v._posChipVal)) return null;
        const V3 = v.THREE.Vector3; const cw = v._posChip.getWorldPosition(new V3()); const t = v._animTool; t.updateWorldMatrix(true, false); const tw = t.getWorldPosition(new V3());
        const dro = [...document.querySelectorAll('.pp-dro-w')].map((e) => parseFloat(e.textContent));
        const wcsLabel = (document.querySelector('.pp-dro-wcs') || {}).textContent || '';
        return { val: v._posChipVal, chipXY: { x: cw.x, y: cw.y }, toolXY: { x: tw.x, y: tw.y }, dro, wcsLabel, onTop: v._posChip.renderOrder >= 100 && v._posChip.center.x < 0 };
    });
    expect(s, 'the 3D chip was visible during play').not.toBeNull();
    expect(Number.isFinite(s.val.x) && Number.isFinite(s.val.y), 'the chip carries finite WORK coords').toBe(true);
    // DRO-EQUAL: the chip's WORK coords == the DRO Work cells (the same onPositionChange source)
    expect(Math.abs(s.val.x - s.dro[0]), 'chip X == DRO Work X').toBeLessThan(0.01);
    expect(Math.abs(s.val.y - s.dro[1]), 'chip Y == DRO Work Y').toBeLessThan(0.01);
    expect(Math.abs((s.val.z || 0) - s.dro[2]), 'chip Z == DRO Work Z (t780 - the Z line)').toBeLessThan(0.01);
    expect(s.onTop, 'the chip draws ALWAYS-ON-TOP with a side offset (t780 - renderOrder 100 + center.x < 0, never hidden by the spindle)').toBe(true);
    expect(s.val.wcs, 'the chip STATES its frame - the active WCS label (t780)').toBe(s.wcsLabel);
    // RIDES the head: the sprite sits at the tool's world XY (offset only in Z)
    expect(Math.hypot(s.chipXY.x - s.toolXY.x, s.chipXY.y - s.toolXY.y), 'the chip rides the tool head (XY)').toBeLessThan(2);

    // the MODAL row toggles it: hide poschip → the 3D chip goes invisible
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement('poschip', { visible: false }); });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => { const c = window.__gpPanel.viz._posChip; return !c || !c.visible; }), 'the modal toggle hides the chip').toBe(true);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement('poschip', { visible: true }); });

    // FADES on stop: stop play, wait > the ~1s fade → the chip is hidden
    await page.evaluate(() => { const p = window.__gpPanel; if (p.stop) p.stop(); const s = window.ddcsGetSettings(); s.preview.autoLoop = false; });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => { const c = window.__gpPanel.viz._posChip; return !c || !c.visible; }), 'the chip fades out ~1s after stop').toBe(true);
});

test('2D: the chip rides the head with DRO-equal coords', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    await seed(page, '2d');
    await play(page);
    const s = await sampleDuringPlay(page, () => {
        const c = window.__gpPanel.el.querySelector('.pp-2d'); const chip = c && c.__t2chip; if (!chip) return null;
        const dro = [...document.querySelectorAll('.pp-dro-w')].map((e) => parseFloat(e.textContent));
        return { chip, dro };
    });
    expect(s, 'the 2D chip drew during play').not.toBeNull();
    expect(s.chip.text, 'the 2D chip shows X/Y coords').toContain('X ');
    expect(Math.abs(s.chip.x - s.dro[0]), '2D chip X == DRO Work X').toBeLessThan(0.01);
    expect(Math.abs(s.chip.y - s.dro[1]), '2D chip Y == DRO Work Y').toBeLessThan(0.01);
    expect(s.chip.text, 'the 2D chip shows the Z line (t780)').toContain('Z ');
    expect(s.chip.text, 'the 2D chip states its frame (t780)').toMatch(/^G5\d/);
});

test('the poschip pref persists across a reload', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement('poschip', { visible: false, alpha: 0.4 }); });
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio);
    const p = await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); return m.displayOf('poschip'); });
    expect(p.visible, 'poschip visible pref survived reload').toBe(false);
    expect(p.alpha, 'poschip alpha pref survived reload').toBeCloseTo(0.4, 2);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
});
