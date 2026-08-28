import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t2353 — THE 3D PANE ONLY SHRINKS. TWO separate, confirmed defects in `paneAccordion.js`'s drag handlers
 * (`addVisualSizer`, `addPaneSplitter`), both stemming from the same root habit — per-frame/per-call reads that
 * should have been captured once at pointerdown:
 *
 * (1) THE RATCHET (the advisor's own spec, verified narrower than diagnosed — see below). `visualMaxHeight(v)`
 *     asks `v.parentElement` how much room is available. In the STACKED (≤860px) tree layout specifically, that
 *     parent is the split-pane wrapper whose OWN height is CONTENT-DRIVEN BY THE VISUAL — the "ceiling" echoes
 *     back whatever height the visual already has, so a shrink lowers the very ceiling the NEXT frame reads.
 *     Live-measured at 412px: a continuous shrink-then-grow drag on the flipped drill's sizer recovered ~1px per
 *     frame instead of tracking the pointer. Desktop's `.ui-split-pane2` gets a real, independent row height —
 *     NOT reproducible there (confirmed live both before AND after the owner separately reported a desktop
 *     repro — see (2), a different bug entirely). Fixed via `dragMaxHeight` in both handlers' own per-frame math
 *     AND in `applyVisualHeight`'s own internal `cap = visualMaxHeight(v)` (a SECOND per-frame read one level
 *     down the first fix alone didn't reach — an explicit `dragCap` override lets the ONE visual being dragged
 *     borrow the caller's own number; every other mounted `.wiz-visual` — cross-wizard sync — keeps deriving its
 *     own cap live, unchanged). ⚠ A pure ONE-TIME SNAPSHOT at pointerdown was tried first and reverted: it broke
 *     pane-sizer-mobile-1468.spec.js (an EARLIER, already-shipped fix) — verified live that right after a
 *     SEPARATE prior drag on a stacked twin, a fresh pointerdown's very first ceiling reading can be a
 *     TRANSIENT UNDER-count (measured 305 while the true settled ceiling was north of 500 — the stacked form
 *     below hadn't finished reflowing from the prior drag's own write yet), and a frozen snapshot has no way
 *     back once it locks that in. `dragMaxHeight` is instead seeded at pointerdown and then MONOTONIC for the
 *     rest of that one drag — re-read every frame (`visualMaxHeight(visual)`) but only ever RAISED, never
 *     lowered — which keeps both properties at once: a shrinking, content-driven host can't ratchet the ceiling
 *     down (the stored max never drops), while a genuinely settling layout can still raise it mid-drag (t1468's
 *     case). Both are covered below AND in pane-sizer-mobile-1468.spec.js itself, which this turn re-ran clean.
 *
 * (2) THE RATIO CLIFF (the owner's own desktop repro + second observation, "on touch it slightly increases size
 *     then just reduces" — found live via the advisor's own dragProbe instrumentation, WORK-LOG has the exact
 *     numbers). `addPaneSplitter`'s ratio branch computed `frac = actualTopHeight / clampedTotalHeight` — the
 *     top pane's share of the WHOLE VISUAL, chrome (the "VISUALIZATION" label, the ratio bar, the sizer bar —
 *     none of which participate in the ratio) included in the denominator. Measured live on the flipped drill,
 *     desktop, an untouched drag (pointerdown then pointerup with ZERO pointer movement): top=160, bottom=160,
 *     chrome=72, visual=392 — `160/392=0.408` against a starting ratio of 0.5, moving the split on a gesture
 *     that never moved at all. `160/(160+160)=0.5` — exact. Same class of bug, much smaller magnitude, existed
 *     on the CLASSIC shell too (a few px on a stationary touch, matching the owner's OWN second observation,
 *     which named the discontinuity as its own separate thing from the ratchet) — the denominator was wrong
 *     everywhere; drill's tree layout just carries enough of its own chrome (a section-label AND both grab bars
 *     living inside one `.viz-split`) to make the error large enough to see as "it moves and then shrinks."
 *     `dragStartTopHeight` (the numerator's own baseline) also moved off the OLD pointer-offset approximation
 *     (pointer distance from the visual's top — only exact when the pointer sits precisely at the pane
 *     boundary, which it structurally never does — grab handles have real width/height) onto the pane's own
 *     EXACT rendered height, captured once at pointerdown (`dragStartChrome` carries the remainder — everything
 *     that ISN'T the two panes — as one measured leftover, not enumerated piece by piece).
 *
 * ⛔ CLASSIC-PATH SATURATION, the one place both fixes above are DELIBERATELY inert: if a drag pushes the
 * requested total PAST `dragMaxHeight` (the drag saturates the ceiling), `actualTopHeight` falls back to the
 * OLD chrome-blind subtraction (`clampedTotalHeight − startBottomHeight`) instead of the exact one — verified
 * live (A/B against the pre-t2353 file, exact number `0.44342291371994347` both before and after every change
 * in this turn) that subtracting chrome there too lands the ratio on a DIFFERENTLY-WRONG value once already at
 * max height — a real behavior change the turn's own "classic path byte-identical" requirement rules out
 * shipping without a dedicated look at how a ratio-splitter SHOULD rebalance once there's no more room to give
 * (a design question this turn didn't open). The new `frac` DENOMINATOR fix is a no-op in that same saturated
 * branch by construction (`actualTopHeight + startBottomHeight` algebraically reduces to `clampedTotalHeight`
 * there — the exact quantity the OLD denominator already was) — proven, not assumed, by the same A/B.
 *
 * Layer 2 of the RATCHET spec (re-deriving what the ceiling should MEAN in a content-driven tree host, rather
 * than just hoisting the read) is still not shipped — the right ancestor to measure against is genuinely
 * ambiguous for an arbitrary future split_horizontal/split_vertical tree, and hoisting alone already closes the
 * within-drag ratchet a real user would feel. A separate LATER drag still starts its own cap from whatever
 * height exists at that pointerdown (the smaller residual symptom the spec named as acceptable to defer).
 */

const openTree = async (page) => {
    await page.evaluate(() => window.openWiz('user_drill_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await waitReady(page, () => {
        const visuals = [...document.querySelectorAll('#wiz_user .wiz-visual')];
        const v = visuals.find((x) => getComputedStyle(x).display !== 'none');
        const s = v && v.querySelector('.viz-split');
        return s && s.querySelector(':scope > .viz-pane-sizer') && s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)') && s.getAttribute('data-split-on') === '1';
    });
    // NOTE (site-level trap, same class as t2347's wrong-host mistake): `#wiz_user` also still carries the
    // CLASSIC shell's own native `.wiz-visual` (hidden, display:none — render()'s isTree branch leaves it in
    // the DOM). A bare `.wiz-visual` selector finds THAT one first in document order. Tag the VISIBLE one.
    return page.evaluate(() => {
        const visuals = [...document.querySelectorAll('#wiz_user .wiz-visual')];
        const v = visuals.find((x) => getComputedStyle(x).display !== 'none');
        v.setAttribute('data-t2353', '1');
        return '[data-t2353="1"]';
    });
};

const openClassic = async (page) => {
    await page.evaluate(() => window.openWiz('contour'));
    await page.waitForSelector('#wiz_contour', { state: 'visible', timeout: 8000 });
    await waitReady(page, () => {
        const s = document.querySelector('#wiz_contour .wiz-visual .viz-split');
        return s && s.querySelector(':scope > .viz-pane-sizer') && s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)') && s.getAttribute('data-split-on') === '1';
    });
    return '#wiz_contour .wiz-visual';
};

// The open/collapse drawer animation (motionTokens, ≤350ms) can still be mid-flight right after data-split-on
// flips — settle on two consecutive equal reads (100ms apart) before treating a height as a real baseline.
const settledHeight = async (page, sel) => {
    let prev = null;
    for (let i = 0; i < 20; i++) {
        const h = await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().height), sel);
        if (h === prev) return h;
        prev = h;
        await page.waitForTimeout(100);
    }
    return prev;
};

const ratioNow = (page) => page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--pane-ratio').trim()));

for (const vp of [{ name: '412px stacked', width: 412, height: 900 }, { name: 'desktop', width: 1280, height: 900 }]) {
    test.describe(vp.name, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        for (const [handleLabel, handleSel] of [['sizer', '.viz-pane-sizer'], ['ratio splitter', '.viz-pane-splitter:not(.viz-pane-sizer)']]) {
            test(`ACCEPTANCE — touching the ${handleLabel} WITHOUT moving changes no pane height, tree AND classic`, async ({ page }) => {
                await page.goto('/');
                await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');

                const treeSel = await openTree(page);
                const h0Tree = await settledHeight(page, treeSel);
                const box = await page.locator(`${treeSel} .viz-split > ${handleSel}`).boundingBox();
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.waitForTimeout(60);   // let one rAF flush land at the SAME point (pendingY === startY)
                await page.mouse.up();
                const h1Tree = await settledHeight(page, treeSel);
                expect(h1Tree, `${handleLabel} touch-without-move must not change the tree visual's height (1px tolerance for layout rounding)`).toBeGreaterThanOrEqual(h0Tree - 1);
                expect(h1Tree).toBeLessThanOrEqual(h0Tree + 1);

                const classicSel = await openClassic(page);
                const h0Classic = await settledHeight(page, classicSel);
                const box2 = await page.locator(`${classicSel} .viz-split > ${handleSel}`).boundingBox();
                await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
                await page.mouse.down();
                await page.waitForTimeout(60);
                await page.mouse.up();
                const h1Classic = await settledHeight(page, classicSel);
                expect(h1Classic, `${handleLabel} touch-without-move must not change the classic visual's height`).toBeGreaterThanOrEqual(h0Classic - 1);
                expect(h1Classic).toBeLessThanOrEqual(h0Classic + 1);
            });
        }

        test('THE RATIO CLIFF — the owner\'s real desktop repro: touching the ratio splitter WITHOUT moving changes the RATIO by no more than 1%, tree AND classic', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(0.5); });

            const treeSel = await openTree(page);
            const r0Tree = await ratioNow(page);
            const box = await page.locator(`${treeSel} .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)`).boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(60);
            await page.mouse.up();
            const r1Tree = await ratioNow(page);
            // Pre-fix (measured live, WORK-LOG): top=160/bottom=160/chrome=72/visual=392 on the flipped drill
            // desktop turned a 0.5 stationary touch into 0.408 — an 18% relative swing on a gesture that never
            // moved. Post-fix the denominator excludes chrome, so a stationary touch reconstructs the SAME ratio.
            expect(Math.abs(r1Tree - r0Tree), `ratio moved from ${r0Tree} to ${r1Tree} on a touch that never moved the pointer`).toBeLessThan(0.01);

            await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(0.5); });
            const classicSel = await openClassic(page);
            const r0Classic = await ratioNow(page);
            const box2 = await page.locator(`${classicSel} .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)`).boundingBox();
            await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(60);
            await page.mouse.up();
            const r1Classic = await ratioNow(page);
            expect(Math.abs(r1Classic - r0Classic), `classic ratio moved from ${r0Classic} to ${r1Classic} on a stationary touch`).toBeLessThan(0.01);
        });

        test('the SIZER handle: a continuous shrink-then-grow drag on the flipped drill (tree) recovers close to where it started', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const treeSel = await openTree(page);
            const h0 = await settledHeight(page, treeSel);
            const box = await page.locator(`${treeSel} .viz-split > .viz-pane-sizer`).boundingBox();

            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            const travel = Math.min(120, Math.max(20, h0 - 165));   // shrink toward VIZH_MIN(160) without overshooting past it
            for (let i = 0; i < 8; i++) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - Math.round((i + 1) * travel / 8), { steps: 2 }); await page.waitForTimeout(25); }
            const hShrunk = Math.round((await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().height, treeSel)));
            expect(hShrunk, 'the drag actually shrank the visual').toBeLessThan(h0 - 5);
            for (let i = 0; i < 8; i++) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - Math.round(travel - (i + 1) * travel / 8), { steps: 2 }); await page.waitForTimeout(25); }
            await page.mouse.up();
            const hGrown = await settledHeight(page, treeSel);

            const shrankBy = h0 - hShrunk;
            const recoveredBy = hGrown - hShrunk;
            // Pre-fix (measured live, see WORK-LOG): recovery was ~1px/frame — a handful of px out of a 100+px
            // shrink. Post-fix: within ONE continuous drag the cap is pinned at pointerdown, so growth is bounded
            // only by that pinned number, not by the previous frame's own write — recovery should track the
            // shrink almost 1:1 (the same delta math drives both directions).
            expect(recoveredBy, `grew back by ${recoveredBy}px of the ${shrankBy}px shrink — the ratchet would cap this near 0`).toBeGreaterThan(shrankBy * 0.6);
        });
    });
}
