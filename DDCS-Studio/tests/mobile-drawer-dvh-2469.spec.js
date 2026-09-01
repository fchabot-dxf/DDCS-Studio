import { test, expect } from '@playwright/test';

/**
 * t2469 (BACKLOG #62, round 4) — A DECLARATION guard, not a rendered-truth one, and that distinction is the
 * point, not a shortcut.
 *
 * THE FINDING: on mobile, the Blocks-tab preview drawer (`#blocks-app .right`) is `position:fixed; bottom:0`
 * with `height:min(62vh,520px)`. Measured live at 390×844 (BACKLOG #62's own corner-op reproduction, drawer
 * genuinely opened): the pane sizer sits at `top:822.5 / bottom:828.5` — inside the LAST ~22px of the layout
 * viewport `vh` is computed against. `vh` resolves against the LARGE viewport (URL bar retracted); on a real
 * phone with the URL bar showing, that last ~22px sits under the browser chrome — invisible and untappable,
 * exactly how the owner reported it. The fix (this turn): `vh` → `dvh`, the SAME remedy already applied
 * elsewhere in this file (t782 §3234, t2081 §2024) for this identical class of bug.
 *
 * ⚠ WHY THIS TEST CANNOT BE A RENDERED-TRUTH GUARD, MEASURED NOT ASSUMED: `vh`, `dvh`, `svh`, and `lvh` were
 * empirically compared in headless Chromium at this exact viewport (390×844, no keyboard, no chrome) and ALL
 * FOUR resolve to the identical pixel value (520, capped). Headless Chromium has no dynamic toolbar to show or
 * hide, so there is no mechanism — `page.route()`, viewport resize, or otherwise — that makes `dvh` render
 * differently from `vh` in this harness. This is the EXACT SAME instrument limitation that hid the original
 * bug from three prior Playwright rounds, now blocking a rendered verification of its own fix. Forcing a
 * geometry-based RED-then-GREEN here would be decorative, not evidence (CLAUDE.md: "a test that cannot fail
 * is not evidence").
 *
 * WHAT IS ACHIEVABLE AND HONEST: the one thing this harness CAN verify is the DECLARATION itself — that the
 * drawer's height formula actually uses `dvh`, not bare `vh`. Weaker than L1 (`dragRenderTruth.js`)/L2
 * (`affordancePresence.js`), which both assert a REAL RENDERED effect; this asserts a SOURCE-LEVEL guarantee
 * instead, labeled as such rather than presented as the stronger claim. Proven non-vacuous by an in-flight
 * `page.route()` mutation (never disk, same hard constraint as `previewMutations.js`) that reverts the served
 * CSS back to the ORIGINAL bug's own text — the assertion must fail against it, or this test is decoration.
 */

const DRAWER_HEIGHT_RULE_FIND = `height:var(--blk-pv-h, min(62vh, 520px)); height:var(--blk-pv-h, min(62dvh, 520px));`;
const DRAWER_HEIGHT_RULE_BUGGY = `height:var(--blk-pv-h, min(62vh, 520px));`;

test('the mobile preview drawer sizes itself off dvh, not bare vh (BACKLOG #62 round 4 fix)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const cssText = await page.evaluate(async () => (await fetch('/styles.css')).text());
    const occurrences = cssText.split(DRAWER_HEIGHT_RULE_FIND).length - 1;
    expect(occurrences, 'the dvh-bearing declaration appears exactly once in the served CSS').toBe(1);
});

test('non-vacuous: the same check FAILS against the original vh-only bug, reverted in-flight (never disk)', async ({ page }) => {
    await page.route('**/styles.css', async (route) => {
        const res = await route.fetch();
        const body = await res.text();
        const occurrences = body.split(DRAWER_HEIGHT_RULE_FIND).length - 1;
        if (occurrences !== 1) throw new Error(`mutation target not found exactly once (found ${occurrences}) -- fix drifted, update this seed`);
        const mutated = body.split(DRAWER_HEIGHT_RULE_FIND).join(DRAWER_HEIGHT_RULE_BUGGY);
        await route.fulfill({ response: res, body: mutated, headers: { ...res.headers(), 'content-length': String(Buffer.byteLength(mutated)) } });
    });
    await page.goto('http://localhost:3211');
    const cssText = await page.evaluate(async () => (await fetch('/styles.css')).text());
    const occurrences = cssText.split(DRAWER_HEIGHT_RULE_FIND).length - 1;
    expect(occurrences, 'RED under the reverted (original-bug) CSS -- proves the GREEN check above is not vacuous').toBe(0);
    expect(cssText.includes(DRAWER_HEIGHT_RULE_BUGGY), 'the reverted, vh-only rule is what got served').toBe(true);
});
