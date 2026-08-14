import { test, expect } from '@playwright/test';
import { openWizardViaBar, fillField } from './support/barGesture.js';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1792 — ADDITION 8: SCREENSHOT BASELINES for the modal and the pane.
 *
 * The suite had ZERO `toHaveScreenshot`/`toMatchSnapshot` baselines. Two of this week's bugs (the empty visual
 * host, t1782; the unstyled surface, t1764) would have been caught by a baseline with NO assertion logic to
 * write or maintain — a human glance at a diff image. This adds baselines for the two surfaces that share a
 * renderer: the wizard MODAL (`.wiz-box`) and the Blocks WIZARD-VIEW PANE (`#blk_wiz_user`), both reached
 * through the real bar gesture (`support/barGesture.js`).
 *
 * ── VIEWPORT — pinned, stated once ──────────────────────────────────────────────────────────────────────────────
 * 1500×950 (matches every other real-gesture spec in this series, so a shared dev machine sees one number, not
 * several) — set via `test.use` below, never left to the runner's own default.
 *
 * ── WHAT'S MASKED, AND WHY (checked live, not guessed) ──────────────────────────────────────────────────────────
 * Confirmed by direct measurement before writing any assertion: corner's 3D/2D visualization panel AUTO-PLAYS
 * AND LOOPS by default (`.pp-run.on` + `.pp-loop.on` on open). Three successive raw screenshots of a freshly
 * opened wizard were never byte-identical — the live DRO readout (echoed into both the TOP visualization pane's
 * overlay AND the BOTTOM Layout-2D pane's own "Mach X/Y/Z" line) visibly advances between shots.
 * `support/simControls.js`'s `stopLiveSim` clicks the panel's own Run/Stop toggle (its own title: "click to
 * stop and reset to the start") before every screenshot in this file — this alone makes the BOTTOM Layout-2D
 * pane's content perfectly byte-stable (verified: 3 consecutive raw screenshots, identical byte length and
 * content, in EVERY run tried). The TOP visualization box (`#userViz3dBox` / `#blk_userViz3dBox`) stayed
 * pixel-UNSTABLE even after stopping (checked, not assumed) — its own status line and DRO still read slightly
 * different coordinates run to run, most likely a camera/render-queue settle that doesn't reach a byte-fixed
 * point in the time available to wait for it. Per this act's own instruction ("if you cannot get a stable
 * baseline for the 3D specifically, baseline the form and surface only and say so"): **the top visualization
 * box is MASKED (Playwright's own `mask` option, a solid overlay drawn before comparison) in every baseline
 * below.** Everything else — the form, its live-typed value, the modal/pane chrome, the bottom Layout-2D pane —
 * is compared for real, not masked.
 *
 * ── t1794 — A SECOND TIMER FOUND BY REVIEWING THE BASELINE IMAGES, NOT THE 3-RUN GATE ────────────────────────────
 * The pane baseline (only the pane test clicks INSERT) captured `showRoundTripToastOnce()`'s toast
 * (wizardManager.js:72) — a 3.2s-lifetime `.toast` element (`ui/gateway/util.js:20-24`) that fires on every
 * fresh test page because the one-time `ddcs_seen_blocks_roundtrip` localStorage flag is never set. Three
 * consecutive runs in one window on one machine cannot expose a timer like this (it lands at the same offset
 * into the SAME 3.2s window every time) — `dismissToasts` (`support/simControls.js`) now removes any `.toast`
 * outright, right before each screenshot, so no toast can be in frame regardless of how long the preceding
 * action took — never a wait past 3200ms, which would only trade a fast flake for a slower one.
 *
 * SWEPT for anything else timer/animation-driven inside either baselined region (not just the one that already
 * bit us) — checked, not assumed, each with the evidence that cleared it:
 *   - `formWidgets.js:67`'s `token-refused-flash` (1.4s) — only fires on a refused TOKEN drag-drop; this file
 *     only ever calls `.fill()` on a plain numeric field, never attempts a token assignment.
 *   - `ratePrompt.js`'s post-insert prompt (`ddcs:op-inserted`, fired by every real INSERT, exactly what the
 *     pane test does) — its own declared gate, `RATE_TRIGGER = { minSessions: 2, minInserts: 5, ... }`
 *     (`ui/ratePrompt.js:15`): this file does ONE insert in ONE fresh session, below both thresholds, so the
 *     prompt structurally cannot fire here.
 *   - `editorManager.js`'s flash effects (750ms) — scoped to the MAIN CODE EDITOR, not inside `.wiz-box` or
 *     `#blk_wiz_user` at all; out of scope by DOM location, not by luck.
 *   - `headerPost.js`'s "copied" flash (600ms) — only follows clicking the header's "copy program" button,
 *     which this file never clicks.
 *   - CSS `@keyframes`/`transition` animations — Playwright's own `toHaveScreenshot` already disables these by
 *     default (confirmed in its own verbose log: "disabled all CSS animations"); not this file's concern.
 *
 * ── TOLERANCE — justified, not the default ──────────────────────────────────────────────────────────────────────
 * `maxDiffPixelRatio: 0` — the unmasked region is PROVEN byte-stable (see above), so any non-zero pixel diff on
 * it is a real regression, not noise to tolerate. A looser default would have hidden exactly the kind of bug
 * this act exists to catch (e.g. a subtly-shifted surface). If a future legitimate design change makes 0 too
 * strict (e.g. a font-rendering change that legitimately shifts a few AA pixels), that is a signal to look at
 * the diff, not to loosen the number blindly — see UPDATING below.
 *
 * ── UPDATING THESE BASELINES INTENTIONALLY ──────────────────────────────────────────────────────────────────────
 * `npx playwright test tests/screenshot-baselines-1792.spec.js --update-snapshots` after confirming the new
 * rendering is the INTENDED one (open the modal/pane yourself and look) — never run `--update-snapshots` to
 * make a red run green without looking at the diff first; that is exactly how a baseline becomes noise everyone
 * learns to overwrite blindly, which is the failure mode this whole act exists to avoid.
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('baseline: the MODAL (corner, form3d+2d)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await stopLiveSim(page, '#userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);

    await expect(page.locator('.wiz-box')).toHaveScreenshot('modal-corner.png', {
        mask: [page.locator('#userViz3dBox')],
        maxDiffPixelRatio: 0,
    });
});

test('baseline: the BLOCKS WIZARD-VIEW PANE (corner, form3d+2d)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await stopLiveSim(page, '#blk_userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);

    await expect(page.locator('#blk_wiz_user')).toHaveScreenshot('pane-corner.png', {
        mask: [page.locator('#blk_userViz3dBox')],
        maxDiffPixelRatio: 0,
    });
});
