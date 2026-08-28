import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t2357 — THE LAST SLAM. t2355 fixed the container coupling; the owner's own post-fix desktop probe confirmed
 * `expH == vis` held on every single frame (472/472 through 674/674) — but found ONE remaining defect: the
 * FIRST movement frame of a ratio-splitter drag slammed the applied ratio (0.6181 → 0.5016) on a ~1px pointer
 * delta, then tracked smoothly afterward. The direction of the slam was the diagnosis: the drag handler now
 * honestly captures its baseline from RENDERED rects (t2349's own delta-math fix), so the first write snaps
 * the STORED `--pane-ratio` to whatever was ACTUALLY rendered at rest — meaning the tree's panes never
 * reflected the stored ratio in the first place, at rest, before any drag touched them.
 *
 * ROOT CAUSE, confirmed live (devtools-style, not assumed): `.wiz-2pane > .wiz-visual > .viz-split { flex: 1 1
 * auto; min-height: 0; }` (the rule that lets `.viz-split` GROW to fill its own parent's available height) is a
 * DIRECT-CHILD chain (`.wiz-2pane > .wiz-visual`) — the tree's own simBox/pnlBox is never a direct child of
 * `.wiz-2pane` (it sits several levels deeper, through `.wiz-controls` → the split's own `.ui-split-horiz` →
 * `.ui-split-pane`), so this rule structurally can never reach it. `.viz-split` fell back to the browser
 * default (`flex: 0 1 auto`) and stayed content-sized — measured live: 364px, while its two panes sat pinned
 * at their shared 160px MINIMUM regardless of a correctly-computed 61.8/38.2 flex-grow split between them (the
 * `--pane-ratio`-consuming rules themselves DO reach the tree — descendant-only chains, unlike this one — they
 * just had zero free space to distribute, because `.viz-split` itself never grew). Forcing `flex: 1 1 auto;
 * min-height: 0` on `.viz-split` directly grew it to 522px and the panes to 294/184 — matching the stored ratio
 * almost exactly. Fixed with a parallel, tree-scoped rule (`.ui-split-pane > .wiz-visual > .viz-split`) rather
 * than widening the original — same "fix the family" shape as t2355's own two container findings, a third
 * instance of the same class: classic markup/CSS reused by the tree, but authored at a DOM depth only the
 * classic shell's own structure actually has.
 *
 * NARROW WIDTH — investigated per the dispatch's own explicit question ("why does mobile feel fine — report,
 * don't assume"), and the earlier t2355 hand-back claim that BACKLOG #38 was "no --viz-stack-h rule reaches the
 * tree's own pane-bodies" is CORRECTED here: it does. `.wiz-2pane .wiz-visual [data-viz-pane] > .wiz-pane-body`
 * is a pure descendant chain (no `>` until the very last step, which the tree's own markup also satisfies) —
 * confirmed live via `.matches()`, not re-derived from selector text alone (the mistake the t2355 hand-back
 * made). The stacked layout's OWN ratio mechanism (explicit `height: calc(var(--viz-stack-h) * var(--pane-
 * ratio))` on the pane BODIES) was never broken; only the desktop mechanism (flex-grow on the pane CONTAINERS,
 * which needs `.viz-split` itself to have grown into free space first) was. That is the honest answer: narrow
 * width consumes the ratio through a DIFFERENT, already-working mechanism, not a smaller version of the same
 * bug.
 *
 * SECOND SLAM, found via a mid-task amendment (the owner's own two follow-up probe captures): the SIZER
 * handle showed the SAME slam shape, larger (0.6935 → 0.2374 on a ~4px pointer delta), while the classic
 * sizer control stayed slam-free from its very first frame. A SEPARATE bug, not a consequence of the CSS fix
 * above: `addVisualSizer`'s own ratio branch (`frac = startTopHeight / clampedTotalHeight`) divided by the
 * WHOLE visual total instead of `startTopHeight + startBottomHeight` (the two panes only) — the exact same
 * wrong-denominator shape `addPaneSplitter`'s own ratio branch had at t2353, fixed there but never carried
 * over to this sibling handler in that same pass. Fixed identically: capture `startBottomHeight` alongside
 * `startTopHeight` at pointerdown, divide by their sum in both `applyMove` and `onUp`.
 */

const openTreeWithPrefs = async (page, storedHeight, storedRatio) => {
    if (storedRatio != null) await page.evaluate(async (r) => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(r); }, storedRatio);
    if (storedHeight != null) await page.evaluate((h) => localStorage.setItem('ddcs_visual_height', String(h)), storedHeight);
    await page.evaluate(() => window.openWiz('user_drill_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await waitReady(page, () => {
        const visuals = [...document.querySelectorAll('#wiz_user .wiz-visual')];
        const v = visuals.find((x) => getComputedStyle(x).display !== 'none');
        const s = v && v.querySelector('.viz-split');
        return s && s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)') && s.querySelector(':scope > .viz-pane-sizer');
    });
    return page.evaluate(() => {
        const visuals = [...document.querySelectorAll('#wiz_user .wiz-visual')];
        const v = visuals.find((x) => getComputedStyle(x).display !== 'none');
        v.setAttribute('data-t2357', '1');
        return '[data-t2357="1"]';
    });
};

const openClassicWithPrefs = async (page, storedHeight, storedRatio) => {
    if (storedRatio != null) await page.evaluate(async (r) => { const m = await import('/ui/panePrefs.js'); m.setPaneRatio(r); }, storedRatio);
    if (storedHeight != null) await page.evaluate((h) => localStorage.setItem('ddcs_visual_height', String(h)), storedHeight);
    await page.evaluate(() => window.openWiz('contour'));
    await page.waitForSelector('#wiz_contour', { state: 'visible', timeout: 8000 });
    await waitReady(page, () => {
        const s = document.querySelector('#wiz_contour .wiz-visual .viz-split');
        return s && s.querySelector(':scope > .viz-pane-splitter:not(.viz-pane-sizer)') && s.getAttribute('data-split-on') === '1';
    });
    return '#wiz_contour .wiz-visual';
};

const ratioFromPanes = (page, sel) => page.evaluate((s) => {
    const split = document.querySelector(s).querySelector('.viz-split');
    const a = split.querySelector('[data-viz-pane="preview3d"]'), b = split.querySelector('[data-viz-pane="layout2d"]');
    const ah = a.getBoundingClientRect().height, bh = b.getBoundingClientRect().height;
    return ah / (ah + bh);
}, sel);

const cssRatio = (page) => page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--pane-ratio').trim()));

for (const vp of [{ name: '412px stacked', width: 412, height: 900 }, { name: 'desktop', width: 1280, height: 900 }]) {
    test.describe(vp.name, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });
        const storedH = vp.width < 861 ? 350 : 550;

        test('AT-REST: the rendered pane split already reflects the stored ratio, before any drag', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const treeSel = await openTreeWithPrefs(page, storedH, 0.618);
            const rendered = await ratioFromPanes(page, treeSel);
            expect(rendered, `rendered split ${rendered} should already match the stored 0.618`).toBeGreaterThan(0.58);
            expect(rendered).toBeLessThan(0.66);
        });

        test('NO SLAM: the first movement frame changes the ratio by roughly what the pointer delta implies, not a jump', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const treeSel = await openTreeWithPrefs(page, storedH, 0.618);
            const r0 = await cssRatio(page);
            const box = await page.locator(`${treeSel} .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)`).boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 1, { steps: 1 });
            await page.waitForTimeout(60);
            const r1 = await cssRatio(page);
            await page.mouse.up();
            expect(Math.abs(r1 - r0), `ratio jumped from ${r0} to ${r1} on a ~1px move — a slam, not a track`).toBeLessThan(0.03);
        });

        // t2357 AMENDMENT (owner's own two follow-up captures): the SIZER handle showed the SAME slam, larger
        // (0.6935 → 0.2374 on a ~4px delta) — a SEPARATE instance of the wrong-denominator bug (`addVisualSizer`'s
        // own ratio branch divided by the whole visual total, same as `addPaneSplitter`'s own bug this turn's
        // first fix closed, but never fixed here in t2353's own pass). The classic sizer control was slam-free
        // from the very first frame — proving the handler itself was never broken, only this one denominator.
        test('NO SLAM (SIZER handle): the first movement frame changes the ratio by roughly what the pointer delta implies, not a jump', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const treeSel = await openTreeWithPrefs(page, storedH, 0.618);
            const r0 = await cssRatio(page);
            const box = await page.locator(`${treeSel} .viz-split > .viz-pane-sizer`).boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 4, { steps: 1 });
            await page.waitForTimeout(60);
            const r1 = await cssRatio(page);
            await page.mouse.up();
            expect(Math.abs(r1 - r0), `sizer: ratio jumped from ${r0} to ${r1} on a ~4px move — a slam, not a track`).toBeLessThan(0.05);
        });

        test('touch-release with NO motion is still inert (t2353\'s own acceptance criterion, re-verified after this fix)', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const treeSel = await openTreeWithPrefs(page, storedH, 0.618);
            const r0 = await cssRatio(page);
            const box = await page.locator(`${treeSel} .viz-split > .viz-pane-splitter:not(.viz-pane-sizer)`).boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(60);
            await page.mouse.up();
            const r1 = await cssRatio(page);
            expect(Math.abs(r1 - r0), `stationary touch moved the ratio from ${r0} to ${r1}`).toBeLessThan(0.01);
        });

        test('classic control: at-rest split still reflects the stored ratio (byte-identical to pre-fix, A/B in WORK-LOG)', async ({ page }) => {
            await page.goto('/');
            await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
            const classicSel = await openClassicWithPrefs(page, storedH, 0.618);
            const rendered = await ratioFromPanes(page, classicSel);
            expect(rendered).toBeGreaterThan(0.58);
            expect(rendered).toBeLessThan(0.66);
        });
    });
}
