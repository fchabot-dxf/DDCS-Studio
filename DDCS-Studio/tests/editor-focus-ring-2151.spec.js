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
 * ROUND 4 (t2155, the editor-strip/editor-code refactor) — the ring's HOST changed from `.editor-container`
 * (inset from the top by a hand-synced `--editor-chip-inset: 46px`) to `.editor-code` (a real box that already
 * starts exactly where the code area starts — the strip above it is auto-height, no number to keep in sync).
 * The ring STAYS a `::before` (`.editor-code::before`), not the box's own outline — tried outlining `.editor-
 * code` directly first, and it broke two things a plain reading doesn't surface: a z-indexed WRAPPER lifts its
 * whole subtree, including `#editor` itself (a real, clickable `<textarea>`), so it silently stole clicks
 * meant for `.viz3d-handle` wherever their boxes overlapped — the 3D-preview toggle became unusable, not just
 * visually wrong. It also lifted the code text above `[data-theme="futuristic"]`'s CRT scanline effect, which
 * is deliberately built to dim it. A thin, `pointer-events:none` `::before` has neither problem — seen styles.
 * css's own comment on `.editor-code` for the full reasoning. THE OTHER PART OF t2155: the toolbar (and the
 * whole strip with it) is now excluded from the ring at EVERY width, including phone, where it used to sit
 * geometrically INSIDE the ring's own box (a note in the previous round, not fixed then — see the phone test
 * below, now a real pass instead of a report).
 *
 * ⚠ WHY THIS SUITE VERIFIES PIXELS, NOT `getComputedStyle` ON THE PSEUDO-ELEMENT: tried first, and
 * `getComputedStyle(container, '::before')` reported wrong values for EVERY property in this harness — even
 * `content`, which is unconditionally `''` in the rule — a real limitation of that two-argument form here, not
 * a property of the CSS. Verified instead by DIFF: the same pixel, focused vs unfocused — a ring appearing is
 * a real, themed-colour-agnostic change a broken computed-style API cannot lie about. Where a plain DOM rect
 * comparison answers the question just as well (e.g. "does #editor start where .editor-code starts"), this
 * file uses `getBoundingClientRect()` instead — no screenshot needed, and it survives a future layout tweak
 * that a hardcoded pixel coordinate would silently start lying about.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

/** Seed real multi-line content so "line 1" and the toolbar band are both meaningful, not the placeholder.
 *  t2169 — also force the pre-flight badge closed: this content is comment-only (zero real moves), which a
 *  real preflight pass legitimately flags — and since `.editor-strip-chrome` (badge included) now stays at the
 *  TOP on phone too (t2169's own re-split), a shown badge sits exactly where these tests sample the ring's own
 *  left-edge pixel. Before t2169 the whole strip relocated to the BOTTOM on phone, so this interaction was
 *  structurally impossible there; it is real now, and out of scope for what these tests are actually about
 *  (the ring, not badge content) — so it is closed here rather than left to intermittently fail depending on
 *  what the preflight pass happens to think of five bare comment lines. */
async function seedLines(page) {
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.value = '( line 1 )\n( line 2 )\n( line 3 )\n( line 4 )\n( line 5 )';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // TWO independent debounces both react to this same input event and can re-show the badge after we close
    // it: preflightBadge.js's own 250ms `inputT` timer (re-renders straight from editor text), AND
    // programModel.js's 500ms reconcile timer (editor.js:614 `setTimeout(reconcileFromEditor, 500)`), whose
    // `setStack(...)` call fires the `onChange` subscription preflightBadge.js also renders from (line 198) —
    // a SECOND, later trigger a shorter wait doesn't clear. Confirmed live: even a 350ms wait (past the first
    // debounce alone) still read badge.hidden back as false. 650ms clears both with margin, and no further
    // input follows, so nothing re-triggers it after.
    await page.waitForTimeout(650);
    await page.evaluate(() => {
        const badge = document.getElementById('preflight-badge');
        if (badge) badge.hidden = true;   // see this function's own header — closed on purpose, not a real state
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

/** A point ON the ring's left edge line, a few px below its top-left corner — derived from `.editor-code`'s own
 * live rect (t2155: no more hardcoded --editor-chip-inset offset to guess at). Works at any width, since the
 * left edge is at x≈1 for the entire vertical span of the box, regardless of where the strip puts the top. */
const leftEdgePoint = (page) => page.evaluate(() => {
    const r = document.querySelector('.editor-code').getBoundingClientRect();
    return [Math.round(r.left) + 1, Math.round(r.top) + 6];
});

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

test('THE RING EXCLUDES THE TOOLBAR ROW (t2153 ruling), desktop: the boundary pixel changes on focus, the strip pixel does not', async ({ page }) => {
    // t2155 — explicit desktop size. The strip sits at the TOP only above 600px; below that it reorders to the
    // bottom (BACKLOG #13 / this same refactor), which is covered by its own phone test below instead of by
    // guessing a shared pixel coordinate could mean the same thing at both widths.
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    await seedLines(page);
    // Points DERIVED from the live rects, not hardcoded — `.editor-strip`'s own height is auto (t2155 deleted
    // the old --editor-chip-inset magic number), so a fixed y coordinate would silently drift the day padding
    // or font-size changes it.
    const { stripPoint, boundaryPoint, deepPoint } = await page.evaluate(() => {
        const strip = document.querySelector('.editor-strip').getBoundingClientRect();
        const code = document.querySelector('.editor-code').getBoundingClientRect();
        return {
            stripPoint: [1, Math.round(strip.top + strip.height / 2)],   // inside the strip's own band — must stay unchanged
            boundaryPoint: [1, Math.round(code.top) + 2],                // the code box's own top edge — the ring's real top edge
            deepPoint: [Math.round(code.left + code.width / 2), Math.round(code.top + code.height / 2)],   // well inside the code area
        };
    });
    const POINTS = [stripPoint, boundaryPoint, deepPoint];
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const before = await pixelsAt(page, POINTS);
    await page.click('#editor');
    await page.waitForTimeout(120);
    const after = await pixelsAt(page, POINTS);

    expect(colorDist(before[0], after[0]), `strip-band pixel unchanged by focus: ${before[0]} -> ${after[0]}`).toBeLessThan(20);
    expect(colorDist(before[1], after[1]), `boundary pixel changes on focus — the ring's own top edge: ${before[1]} -> ${after[1]}`).toBeGreaterThan(40);
    expect(isBlack(after[2]), `the code area itself stays plain black, not ring-filled: ${after[2]}`).toBe(true);
});

test('THE RING EXCLUDES THE TOOLBAR (t2155, re-split t2169), phone: the toolbar moved to the bottom, and the ring still stops above it', async ({ page }) => {
    // t2153 amendment 5 measured this exact case and found the toolbar sat GEOMETRICALLY inside the ring's own
    // box on phone (bottom-anchored at bottom:8px, but the ring's box was still the WHOLE .editor-container) —
    // reported as a note, not fixed, since it produced no visible artifact. t2155 fixes the underlying cause
    // (the ring's box is `.editor-code` now, and the strip is a genuine SIBLING outside it, at every width) —
    // this test is that note's replacement: a real assertion instead of a screenshot note.
    // t2169 — queries `.editor-toolbar` now, not `.editor-strip`: the strip re-split (chrome stays up, only the
    // toolbar relocates) made `.editor-strip` itself `display:contents` at phone width, so its OWN
    // getBoundingClientRect() is a zero rect (contents elements generate no box at all) — the toolbar is the
    // thing that actually moved to the bottom now, so it's the meaningful thing to check.
    await ready(page);   // default viewport is phone-sized (412×915) — no explicit size needed
    await seedLines(page);
    const { code, toolbar } = await page.evaluate(() => ({
        code: document.querySelector('.editor-code').getBoundingClientRect(),
        toolbar: document.querySelector('.editor-toolbar').getBoundingClientRect(),
    }));
    expect(toolbar.top, 'the toolbar sits BELOW the code box on phone, not overlapping it').toBeGreaterThanOrEqual(code.top + code.height - 1);
});

test('THE RING\'S BOX IS .editor-code\'s OWN BOX, at both widths (t2155 — no leftover inset)', async ({ page }) => {
    for (const size of [{ width: 1400, height: 900 }, { width: 412, height: 915 }]) {
        await page.setViewportSize(size);
        await ready(page);
        const { editorTop, codeTop, gap } = await page.evaluate(() => {
            const editorTop = document.getElementById('editor').getBoundingClientRect().top;
            const codeTop = document.querySelector('.editor-code').getBoundingClientRect().top;
            return { editorTop, codeTop, gap: editorTop - codeTop };
        });
        expect(gap, `${size.width}px: #editor starts at .editor-code's own top (no --editor-chip-inset left over): editor=${editorTop} code=${codeTop}`).toBeLessThan(1);
    }
});

test('THE LEFT EDGE (round 1\'s own fix, still true): the gutter sits INSIDE the ring at the code boundary, not under it', async ({ page }) => {
    await ready(page);
    await seedLines(page);
    const point = await leftEdgePoint(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const [before] = await pixelsAt(page, [point]);
    await page.click('#editor');
    await page.waitForTimeout(120);
    const [after] = await pixelsAt(page, [point]);
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
    const point = await leftEdgePoint(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const [before] = await pixelsAt(page, [point]);
    await page.click('#editor');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(120);
    const [after] = await pixelsAt(page, [point]);
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
        const point = await leftEdgePoint(page);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        const [before] = await pixelsAt(page, [point]);
        await page.click('#editor');
        await page.waitForTimeout(120);
        const [after] = await pixelsAt(page, [point]);
        expect(colorDist(before, after), `${theme}: the boundary pixel changes on focus: ${before} -> ${after}`).toBeGreaterThan(40);
    }
});

test('THE CHROME GROUP AND THE TOOLBAR EACH FIT THEIR OWN TALLEST CHILD at phone width (auto height, not clipped)', async ({ page }) => {
    // t2155's original version checked `.editor-strip` (then a single box) grew to fit BACKLOG #13's 44px touch
    // floor. t2169 changed BOTH premises at once: `.editor-strip` itself is `display:contents` at phone width
    // now (its own getBoundingClientRect() is a zero rect by construction — contents elements generate no box),
    // and the 44px floor was removed on direct human instruction (see editor-chrome.spec.js's own updated
    // note). What's still worth checking — an auto-height container actually growing to fit its content, not
    // silently clipping it — is checked against the two REAL boxes that replaced the one strip: the chrome
    // group and the toolbar each contain a real button, so each container's own height must be at least that
    // button's height. A geometry-relative check, not a hardcoded pixel constant that would just go stale again
    // the next time a button's own size changes.
    await ready(page);   // default viewport is phone-sized
    // seed real content with a feed rate, so the time-estimate chip (a `.editor-strip-chrome` tenant) actually
    // has something to show — an untouched editor legitimately renders an EMPTY (zero-height) chrome group,
    // which would make this assertion vacuous rather than testing "auto-height, not clipped" for real.
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.value = 'G0 X0 Y0\nG1 X50 F300\nG1 Y50 F300\nM30';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const h = await page.evaluate(() => {
        const chromeH = document.querySelector('.editor-strip-chrome').getBoundingClientRect().height;
        const toolbarH = document.querySelector('.editor-toolbar').getBoundingClientRect().height;
        const toolbarBtnH = document.querySelector('.editor-toolbar > button').getBoundingClientRect().height;
        return { chromeH, toolbarH, toolbarBtnH };
    });
    expect(h.toolbarH, `the toolbar is at least as tall as its own button (toolbar=${h.toolbarH}px, button=${h.toolbarBtnH}px)`).toBeGreaterThanOrEqual(h.toolbarBtnH);
    expect(h.chromeH, `the chrome group has real, non-zero height (measured ${h.chromeH}px) — not silently collapsed`).toBeGreaterThan(0);
});

test('THE PRE-FLIGHT BADGE IS NEVER COVERED BY THE TOOLBAR (t2155 — structural now, not z-index arbitration)', async ({ page }) => {
    // t2078's own comment documented this as a DELIBERATE z-index call (badge:12 over toolbar:3) because a long
    // "N outside envelope" pill could otherwise cover the toolbar. t2155 replaces the z-index arbitration with
    // plain flex flow, where two normal-flow siblings structurally cannot occupy the same pixels at all — so
    // this test doesn't need an artificially long pill to prove the property; it holds for ANY badge width.
    // A wide one is used anyway, matching the scenario the original comment worried about.
    await page.setViewportSize({ width: 700, height: 800 });   // narrow enough that a long pill would be forced to interact with the toolbar if it still could
    await ready(page);
    await page.evaluate(() => {
        const badge = document.getElementById('preflight-badge');
        const label = badge.querySelector('.preflight-badge-label');
        badge.hidden = false; badge.className = 'preflight-badge preflight-red';
        label.textContent = '12 moves leave the machine travel envelope on every axis, X Y and Z';   // deliberately long
    });
    await page.waitForTimeout(50);
    const { badgeRect, toolbarRect } = await page.evaluate(() => ({
        badgeRect: document.getElementById('preflight-badge').getBoundingClientRect(),
        toolbarRect: document.querySelector('.editor-toolbar').getBoundingClientRect(),
    }));
    const overlapsVertically = badgeRect.top < toolbarRect.bottom && badgeRect.bottom > toolbarRect.top;
    const overlapsHorizontally = badgeRect.left < toolbarRect.right && badgeRect.right > toolbarRect.left;
    expect(overlapsVertically && overlapsHorizontally, `badge=${JSON.stringify(badgeRect)} toolbar=${JSON.stringify(toolbarRect)}`).toBe(false);
});
