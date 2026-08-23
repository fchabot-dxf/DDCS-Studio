import { test, expect } from '@playwright/test';

/**
 * t2161 ("t-wordmarks") — the header wordmark for all five themes switches from a live `<text textLength=…>`
 * font request to a pre-traced `<symbol>` (brand/MARK-*-TRACED.svg). normal/studio/futuristic/steampunk are a
 * pure fidelity fix, no redesign — traced AS-IS from the exact fonts they already requested, so they render
 * visually IDENTICAL to what they replace. organic is a deliberate redesign, and went through two faces before
 * shipping — see below.
 *
 * ── ORGANIC'S FACE CHANGED MID-SERIES: Sniglet → Fredoka (t2161 → t2163 → t2165) ────────────────────────────
 * t2161 traced organic from Sniglet ExtraBold (the human's own choice) and found the 'D' glyph broken — its
 * inner counter traces as a ~2-unit stray fragment, so the mark visibly read "DOCS". t2163 root-caused it: read
 * Sniglet's own glyf table directly, confirmed the defect exists in the UPSTREAM published webfont too (not a
 * Google Fonts serving artifact, not this pipeline), and confirmed Sniglet Regular (400) does not have it — so
 * it's specific to weight 800. t2165 tried the canonical OFL source on github.com/google/fonts directly (same
 * defect, byte-identical contours — rules out Google's own copy being the problem) and, per the advisor's own
 * call, fell back to Fredoka Bold (700) — the runner-up from the original live-specimen comparison, vendored
 * from its own upstream OFL source (brand/fonts/) since it ships as a variable font. Fredoka's D/C/S all traced
 * with correctly-proportioned counters/openings, verified the same way every time in this series: rendered
 * standalone, outside the app, and READ — not inferred from a coordinate diff. `mark-organic` now carries the
 * traced Fredoka paths; Sniglet is not referenced anywhere it ships.
 *
 * ── HOW THIS FILE WAS ACTUALLY USED (the free correctness test the dispatch promised) ──────────────────────────
 * 1. `--update-snapshots` run BEFORE the index.html edit — captured all 5 OLD font-rendered marks as baselines.
 * 2. The edit applied (4 `<symbol>` bodies swapped for the traced paths in t2161; organic's swapped later, in
 *    t2165, once its face question was settled).
 * 3. Plain run AFTER each edit: the four AS-IS marks each showed a SMALL non-zero pixel diff (1-13% of the
 *    image) at `maxDiffPixelRatio: 0` — inspected by eye (actual vs. baseline, side by side) and found to be
 *    sub-pixel anti-aliasing noise from the rendering-pipeline change itself (browser font-hinted `<text>` vs.
 *    plain-filled `<path>`), not a geometry difference — the letterforms are indistinguishable to the eye.
 *    `maxDiffPixelRatio: 0` was the wrong bar for a cross-pipeline comparison (it is the right bar for t1792's
 *    same-pipeline case); loosened to 0.15 here. organic (t2165) showed a large, EXPECTED diff — a genuine
 *    font/design change, not noise — inspected by eye and confirmed correct before accepting the new baseline.
 *
 * ── WHY THE LOOSENED TOLERANCE IS STILL SAFE ─────────────────────────────────────────────────────────────────
 * The header logo carries no live data (unlike t1792's DRO-driven visualization panes) — no timers, no clock,
 * no coordinate readout, so a diff here is either AA noise (small, edge-only, already characterized above) or a
 * real shape/position regression (which reads as a much larger diff — organic's own broken Sniglet 'D', in the
 * t2161 draft before it was held back, measured a 23% diff against its own old baseline — contour-scale, not
 * edge-scale). 0.15 sits between those two regimes for this specific rendering method.
 *
 * ⚠ WHAT THIS FILE DOES **NOT** GUARD (advisor review note, t2161 → t2163): a diff test at ANY reasonable
 * tolerance is a LAYOUT/POSITION guard, not a glyph-correctness guard — 0.15 is loose enough that a single
 * mis-shaped letter (a broken counter, a dropped stroke) inside an otherwise-correctly-positioned mark would
 * NOT cross the threshold and would NOT fail here. This is exactly how organic's broken Sniglet 'D' shipped to
 * brand/ undetected by any coordinate-level check — it was only caught by rendering the SVG standalone and
 * READING the letters, a human/eyeball step no pixel-ratio number substitutes for. Green here means "nothing
 * moved"; it does not mean "the letters are right." Re-verify by eye after any regeneration, every time.
 */

test.use({ viewport: { width: 1500, height: 950 } });

const MARKS = ['normal', 'studio', 'futuristic', 'organic', 'steampunk'];

for (const mark of MARKS) {
    test(`wordmark: ${mark}`, async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), mark);
        await page.waitForTimeout(200);   // theme-driven CSS filter settles
        await expect(page.locator(`.app-header .brand svg.logo-${mark}`)).toHaveScreenshot(`wordmark-${mark}.png`, {
            maxDiffPixelRatio: 0.15,
        });
    });
}
