import { test, expect } from '@playwright/test';

/**
 * THE TEXT ARC stage 1 (t708) — the text twin reaches BUILT-IN PARITY + rotation. Verifies the REAL symptom:
 *   • the twin's 2D draws REAL letters (filltext.previewGeometry → FeatureCanvas paths) + pos & rotation handles;
 *   • rotation (in layoutText, the one source) rotates the 3D engraving trace AND the 2D letters together;
 *   • a literal {SN} renders as glyph braces (stage 2 owns substitution) — the braces are real glyphs, not spaces;
 *   • the width-honesty note shows when the tool is wider than the intended stroke.
 * (Emit byte-identity at rotation=0 + the rotation marker round-trip are covered by text-as-data + protocol-validator.)
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openText(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_text_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
}
const setParam = (page, name, val) => page.evaluate(({ name, val }) => {
    const f = document.querySelector(`#wiz_user_form [data-param="${name}"]`);
    if (!f) throw new Error('no field ' + name);
    f.value = String(val); f.dispatchEvent(new Event('input', { bubbles: true }));
}, { name, val });

function readState(page) {
    return page.evaluate(() => {
        const fcPaths = document.querySelectorAll('#wiz_user .fc-path').length;
        const handles = document.querySelectorAll('#wiz_user .fc-handle').length;
        const moveHandles = document.querySelectorAll('#wiz_user .fc-handle-move').length;
        const p = window.ddcsStudio.wizardManager._activePanel;
        let bbox = { w: 0, h: 0, n: 0 };
        if (p && typeof p.getSegments === 'function') {
            const segs = p.getSegments() || [];
            let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
            for (const s of segs) for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
                if (Number.isFinite(x)) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); }
                if (Number.isFinite(y)) { mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
            }
            bbox = { w: Number.isFinite(mxx - mnx) ? mxx - mnx : 0, h: Number.isFinite(mxy - mny) ? mxy - mny : 0, n: segs.length };
        }
        const status = (document.getElementById('userVizStatus') || {}).textContent || '';
        return { fcPaths, handles, moveHandles, bbox, status };
    });
}

test('text twin: real letters in the 2D + pos & rotation handles', async ({ page }) => {
    await openText(page);
    const st = await readState(page);
    expect(st.fcPaths, 'the "TEXT" default draws real letter paths (previewGeometry), not just a stock rect').toBeGreaterThan(3);
    expect(st.moveHandles, 'a draggable pos (move) handle').toBeGreaterThan(0);
    expect(st.handles, 'pos + rotation handles present').toBeGreaterThanOrEqual(2);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/text-atom-2d.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('rotation end-to-end: the 3D engraving trace rotates with the label angle', async ({ page }) => {
    await openText(page);
    await setParam(page, 'text', 'TEST');
    await page.waitForTimeout(250);
    const a = (await readState(page)).bbox;
    expect(a.n, 'the engraving traced some cut segments').toBeGreaterThan(0);
    expect(a.w, 'rotation 0: horizontal text is wider than tall').toBeGreaterThan(a.h);
    await setParam(page, 'rotation', 90);
    await page.waitForTimeout(300);
    const b = (await readState(page)).bbox;
    expect(b.h, 'rotation 90: the traced toolpath is now taller than wide (it rotated)').toBeGreaterThan(b.w);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/text-atom-rot90.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('a {SN} token renders as its reserved serial PLACEHOLDER digits (t764 stage-2 substitution — no longer literal braces)', async ({ page }) => {
    await openText(page);
    await setParam(page, 'text', 'SN');
    await page.waitForTimeout(200);
    const bare = (await readState(page)).fcPaths;
    await setParam(page, 'text', 'SN{SN}');
    await page.waitForTimeout(200);
    const withSN = (await readState(page)).fcPaths;
    // t764 — {SN} is no longer engraved as literal { } glyphs; it reserves a dynamic-serial region shown in the 2D
    // layout as N placeholder digit glyphs (the runtime number is engraved on the controller).
    expect(withSN, 'the {SN} token adds its placeholder serial digits over bare "SN"').toBeGreaterThan(bare);
});

test('width-honesty: the note shows when the tool is wider than the stroke', async ({ page }) => {
    await openText(page);
    await setParam(page, 'strokeWidth', 1);
    await setParam(page, 'toolDia', 3);
    await page.waitForTimeout(250);
    const st = await readState(page);
    expect(st.status.toLowerCase(), 'the status flags the tool-limited engraved width').toMatch(/engraved width|wider than/);
});
