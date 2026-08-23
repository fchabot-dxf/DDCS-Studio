import { test, expect } from '@playwright/test';

/**
 * BACKLOG #12 — the editor's focus ring, across three rounds of correction (t2151, then t2153 amendments 1-3).
 *
 * ROUND 1 (t2151) — the ring was missing its LEFT edge only. CAUSE: a real, deliberate `textarea:focus-visible`
 * rule (this file's own house style) drew correctly on `#editor` itself, but `#editor-gutter` is a plain
 * SIBLING inside `.editor-container` (editorManager.js's `insertBefore`), absolutely positioned at `left:0;
 * width:44px; z-index:3` — directly ON TOP of `#editor`'s own left edge (`z-index:2`). FIX: moved the ring to
 * `.editor-container` — an ANCESTOR of both — via `:has(#editor:focus-visible)`.
 *
 * ROUND 2 (t2153, human ruling after two mockups compared side by side) — ringing the WHOLE `.editor-container`
 * was REJECTED: it enclosed `.editor-toolbar` (Make/rotate/undo/redo/clear/copy), which the human reads as a
 * separate control row, not part of "the code". RULING: the ring frames the CODE AREA ONLY. MEASURED first,
 * per the ruling's own condition — does the toolbar (position:absolute, top:8px) actually float OVER line 1 of
 * code? Seeded 5 real lines: toolbar bottom sits at y=142, the first `.g-line`'s own top at y=168 — a clean
 * 26px gap, no overlap. So `#editor`/`#editor-highlight`/`#editor-gutter` already start BELOW the toolbar's own
 * band, at `top: var(--editor-chip-inset)` (46px — t1323's own reserved strip for the runtime-estimate chip,
 * which floats in the SAME band as the toolbar) — the boundary the ruling asked for already existed in the
 * layout. FIX: a generated `.editor-container::before`, inset from the top by that SAME variable (not a new
 * value), carries the ring instead of the container's own box — a real descendant of the container (so its
 * outline still paints after the gutter, same mechanism as round 1), but sized to the code area only.
 *
 * ROUND 3 (t2153 amendment 6, human direct observation on the real app: "circles fine on mobile but not in
 * wide mode" — the OPPOSITE of what an earlier, WITHDRAWN prediction expected for phone) — the ring's own
 * RIGHT edge broke at wide viewports only. CAUSE, reproduced before touching anything: `.viz3d-handle` (the
 * 3D-preview pull-tab) sits `position:absolute; right:0; z-index:6`, vertically centred, squarely overlapping
 * the ring's right edge line — z-index 4 lost to it, so the handle painted a 72px gap into the ring. Absent on
 * phone because a SEPARATE `@media (orientation: portrait)` rule relocates the handle to `bottom:0; left:50%`
 * there — off the right edge entirely, which is why the human saw it fine on mobile. FIX: raised the ring's
 * `::before` to `z-index: 7`, above the handle (an outline only paints a thin edge line, so this cannot cover
 * the handle's own content or the preflight badge's z-index:12 interior — nothing else sits AT an edge this
 * ring draws on).
 *
 * ⚠ WHY THIS SUITE VERIFIES PIXELS, NOT `getComputedStyle` ON THE PSEUDO-ELEMENT: tried first, and
 * `getComputedStyle(container, '::before')` reported wrong values for EVERY property in this harness — even
 * `content`, which is unconditionally `''` in the rule — a real limitation of that two-argument form here, not
 * a property of the CSS. Verified instead by DIFF: the same pixel, focused vs unfocused — a ring appearing is
 * a real, themed-colour-agnostic change a broken computed-style API cannot lie about.
 *
 * ⚠ NOTE FOR THE HUMAN, NOT ACTED ON (amendment 6's own instruction: report, do not fix, "they may simply not
 * mind"): on PHONE, the toolbar (bottom-anchored at `bottom:8px` since BACKLOG #13, this same turn) sits
 * GEOMETRICALLY inside the ring's own box (ring bottom ≈ y=799 at 390px, toolbar spans y=749–793) — the same
 * "ruling says outside, geometry says inside" shape amendment 5 predicted, just for the bottom edge instead of
 * the right one. Measured AND screenshotted: unlike the right-edge break above, this produces NO visible
 * artifact — the toolbar sits well clear of the ring's actual 2px line, just inside the enclosed area near the
 * bottom. Left alone, per the explicit instruction and the human's own "fine on mobile" verdict.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

/** Seed real multi-line content so "line 1" and the toolbar band are both meaningful, not the placeholder. */
async function seedLines(page) {
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.value = '( line 1 )\n( line 2 )\n( line 3 )\n( line 4 )\n( line 5 )';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

/** The real, deterministic hosts: neither carries its own outline any more — the ring lives on the pseudo. */
const hostOutlines = (page) => page.evaluate(() => {
    const c = document.querySelector('.editor-container');
    const e = document.getElementById('editor');
    return { containerOutline: getComputedStyle(c).outlineStyle, editorOutline: getComputedStyle(e).outlineStyle };
});

/** Screenshot → canvas → real pixel colours at each (x, y) in page coordinates, in one round trip. */
async function pixelsAt(page, points) {
    const buf = await page.screenshot();
    const b64 = buf.toString('base64');
    return page.evaluate(async ({ b64, points }) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
    }, { b64, points });
}
const isBlack = ([r, g, b]) => r < 10 && g < 10 && b < 10;
const colorDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('unfocused: no ring anywhere, at the boundary line or inside the toolbar band', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const s = await hostOutlines(page);
    expect(s.containerOutline, 'no ring on .editor-container').toBe('none');
    expect(s.editorOutline, 'no ring on #editor').toBe('none');
});

test('focused: neither #editor nor .editor-container itself carries the ring (it lives on the container\'s ::before)', async ({ page }) => {
    await ready(page);
    await page.click('#editor');
    const s = await hostOutlines(page);
    expect(s.containerOutline, '.editor-container has no DIRECT outline of its own').toBe('none');
    expect(s.editorOutline, '#editor carries none either — a ring there would repeat the original left-edge bug').toBe('none');
});

test('THE RING EXCLUDES THE TOOLBAR ROW (t2153 ruling): the boundary pixel changes on focus, the toolbar-band pixel does not', async ({ page }) => {
    await ready(page);
    await seedLines(page);
    const POINTS = [
        [1, 130],   // inside the toolbar's own band (y:108-153) — must stay unchanged; the ring must never reach here
        [1, 154],   // the code boundary (container.top(108) + --editor-chip-inset(46)) — the ring's real top edge
        [400, 400], // well inside the code area — plain black either way, never swallowed by an oversized ring
    ];
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const before = await pixelsAt(page, POINTS);
    await page.click('#editor');
    await page.waitForTimeout(120);
    const after = await pixelsAt(page, POINTS);

    expect(colorDist(before[0], after[0]), `toolbar-band pixel unchanged by focus: ${before[0]} -> ${after[0]}`).toBeLessThan(20);
    expect(colorDist(before[1], after[1]), `boundary pixel changes on focus — the ring's own top edge: ${before[1]} -> ${after[1]}`).toBeGreaterThan(40);
    expect(isBlack(after[2]), `the code area itself stays plain black, not ring-filled: ${after[2]}`).toBe(true);
});

test('THE LEFT EDGE (round 1\'s own fix, still true): the gutter sits INSIDE the ring at the code boundary, not under it', async ({ page }) => {
    await ready(page);
    await seedLines(page);
    const POINT = [[1, 156]];   // 2px below the boundary — a -2px-offset ring's top-left corner resolves here, the SAME edge the gutter itself occupies
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const [before] = await pixelsAt(page, POINT);
    await page.click('#editor');
    await page.waitForTimeout(120);
    const [after] = await pixelsAt(page, POINT);
    expect(colorDist(before, after), `the ring's left edge reaches x≈1 at the code boundary: ${before} -> ${after}`).toBeGreaterThan(40);
});

test('THE RIGHT EDGE (t2153 amendment 6): the ring paints ON TOP of the 3D-preview handle, not broken by it', async ({ page }) => {
    // ⚠ DESKTOP-ONLY BUG, DESKTOP-ONLY TEST: this project's default viewport is 412×915 (phone) — at that
    // width `.viz3d-handle` isn't even on the right edge (a portrait media query relocates it to
    // bottom:0;left:50%), so this scenario cannot reproduce there at all. The FIRST version of this test ran
    // at the default phone viewport by omission and passed for the wrong reason (the handle was never in the
    // ring's path), which is exactly why the non-vacuity check below matters — caught by that check, not by
    // reading the test. Explicit desktop size, matching the human's own "wide mode" report and every
    // measurement pass above.
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    // ⚠ FIRST DRAFT OF THIS TEST WAS VACUOUS, caught only by proving it against the pre-fix z-index and
    // seeing it pass anyway: a before/after-FOCUS diff at the handle's ring-line pixel alone crossed the
    // threshold even with the bug present (the handle itself shifts a few RGB values on focus for unrelated
    // reasons — a `:focus-within`-adjacent style, not the ring). The ring being HIDDEN under the handle and
    // the ring being ABSENT look too similar at a single point compared only to its own unfocused self.
    // FIXED DESIGN: compare, WITHIN the same focused screenshot, the exact ring-line pixel against a
    // REFERENCE pixel elsewhere on the handle's own fill (away from any edge) — spatial contrast, not a
    // temporal diff. If the ring shows through, the ring-line pixel reads as a distinctly different, brighter
    // colour than the handle's own plain fill right next to it; if the handle still covers it, both pixels
    // read as the same flat handle colour (confirmed empirically against the pre-fix screenshot: ring-line
    // read [28,87,146] — indistinguishable from the handle's own [27,82,133] — while the reference pixel read
    // the same [27,82,133] either way; post-fix the ring-line reads the theme's actual accent colour instead).
    const { ringLine, reference } = await page.evaluate(() => {
        const h = document.querySelector('.viz3d-handle');
        const r = h.getBoundingClientRect();
        return {
            ringLine: [Math.round(r.right) - 2, Math.round(r.top + r.height / 2)],   // the ring's own 2px line, inside the handle's box
            reference: [Math.round(r.left) + 4, Math.round(r.top + r.height / 2)],   // well inside the handle, away from any edge the ring could reach
        };
    });
    await page.click('#editor');
    await page.waitForTimeout(150);
    const [atRingLine, atReference] = await pixelsAt(page, [ringLine, reference]);
    expect(colorDist(atRingLine, atReference), `the ring-line pixel reads distinctly from the handle's own plain fill beside it: ring=${atRingLine} handle=${atReference}`).toBeGreaterThan(40);
});

test('focused via keyboard (Tab): the same ring — one mechanism for both input modalities', async ({ page }) => {
    await ready(page);
    await seedLines(page);
    const POINT = [[1, 154]];
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const [before] = await pixelsAt(page, POINT);
    await page.click('#editor');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(120);
    const [after] = await pixelsAt(page, POINT);
    expect(colorDist(before, after), `Tab-focus rings the code boundary too: ${before} -> ${after}`).toBeGreaterThan(40);
});

test('theme-independent: the boundary pixel changes on focus in normal, futuristic AND studio (the one theme that used to suppress the ring entirely)', async ({ page }) => {
    await ready(page);
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings, null, { timeout: 15000 });
    for (const theme of ['normal', 'futuristic', 'studio']) {
        await page.evaluate(() => window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
        await page.waitForSelector('#set_theme', { timeout: 6000 });
        await page.selectOption('#set_theme', theme);
        await expect.poll(() => page.getAttribute('body', 'data-theme')).toBe(theme);
        await page.evaluate(() => window.closeSettings && window.closeSettings());
        const POINT = [[1, 154]];
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        const [before] = await pixelsAt(page, POINT);
        await page.click('#editor');
        await page.waitForTimeout(120);
        const [after] = await pixelsAt(page, POINT);
        expect(colorDist(before, after), `${theme}: the boundary pixel changes on focus: ${before} -> ${after}`).toBeGreaterThan(40);
    }
});
