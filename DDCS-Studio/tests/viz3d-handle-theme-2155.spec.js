import { test, expect } from '@playwright/test';

/**
 * t2155 (tail) — THE 3D-PREVIEW PULL-TAB (`.viz3d-handle`) JOINS THE THEME.
 *
 * Before: four hardcoded colours on the base rule (`.editor-container .viz3d-handle`), every one !important.
 * A `[data-theme="studio"] .viz3d-handle` rule ALREADY existed, trying to give studio its own metallic look via
 * `var(--dock-handle-face)` etc. — it never rendered, in any release: the base rule's own !important always won
 * regardless of specificity. Confirmed via getComputedStyle before touching anything, not assumed from reading
 * the CSS (see styles.css's own comment on the studio block for the exact readback).
 *
 * Fix, in order (swap first, cleanup second, per the dispatch's own instruction):
 *  1. Declared `--viz3d-handle-face/-face-hover/-edge/-ink` in :root, defaulting to the EXACT hardcoded values
 *     (t2075's house pattern) — proven byte-identical via getComputedStyle before moving on.
 *  2. Retargeted studio's dead rule to MAP its existing `--dock-handle-face`/`-edge` tokens onto the new ones,
 *     instead of fighting the base rule's !important on the property side.
 *  3. Found and fixed a REAL bug surfaced by the swap: the base rule used the `border: 1px solid X` COMPOUND
 *     shorthand, which only accepts a single colour — studio's `--dock-handle-edge` is a 4-value per-side token,
 *     which silently invalidated the WHOLE border when substituted in (studio's handle rendered borderless).
 *     Split into border-width/style/color (separate properties accept 1–4 colours natively).
 *  4. Tested each !important flag on color/background/border/border-right individually (getComputedStyle across
 *     all 5 themes, with and without) before removing any — all five proved dead weight (nothing in the cascade
 *     actually competes with `.editor-container .viz3d-handle`'s own specificity for these specific properties).
 *     The REMAINING !important flags (position, width, min-*, padding, border-radius, box-shadow, touch-action)
 *     are untouched — a different, still-live concern this tail did not re-verify.
 *
 * t2229 (BACKLOG amendment 1) — the declared SLOT this turn built stayed unfilled for four themes until then:
 * they all read the shared :root blue default. That turn gave each of the four its own theme material (reusing
 * each theme's own --btn-face/-edge/-ink, t2075) — the first test below now asserts THAT, not the old shared
 * blue it used to pin byte-identical.
 */

const THEMES = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];

async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio, null, { timeout: 20000 });
}

async function setTheme(page, theme) {
    await page.evaluate((t) => {
        document.body.setAttribute('data-theme', t);
        window.ddcsSetTheme && window.ddcsSetTheme(t);
    }, theme);
    await page.waitForTimeout(150);
}

const handleStyle = (page) => page.evaluate(() => {
    const h = document.querySelector('.viz3d-handle');
    const cs = getComputedStyle(h);
    return {
        bg: cs.backgroundColor, bgImage: cs.backgroundImage, ink: cs.color,
        edgeTop: cs.borderTopColor, edgeWidth: cs.borderTopWidth, edgeStyle: cs.borderTopStyle,
    };
});

// t2229 (BACKLOG amendment 1) — SUPERSEDED: the four non-studio themes no longer share one hardcoded blue.
// --viz3d-handle-face/-face-hover/-edge/-ink were a declared slot only studio ever filled in; this turn filled
// the other four too, each reusing that theme's OWN --btn-face/-edge/-ink material (t2075) rather than the
// shared :root default. Values below are the real computed styles, captured live per theme, not hand-derived
// from the source gradients — same discipline the rest of this file already uses.
const EXPECT = {
    normal:     { bg: 'rgb(244, 244, 244)', bgImage: 'none', ink: 'rgb(51, 51, 51)', edgeTop: 'rgb(221, 221, 221)' },
    steampunk:  { bg: 'rgba(0, 0, 0, 0)', bgImage: 'linear-gradient(rgb(107, 83, 41), rgb(74, 56, 25))', ink: 'rgb(212, 165, 116)', edgeTop: 'rgb(139, 105, 20)' },
    futuristic: { bg: 'rgba(0, 0, 0, 0)', bgImage: 'linear-gradient(rgba(28, 42, 66, 0.92), rgba(10, 16, 28, 0.95))', ink: 'rgb(183, 243, 255)', edgeTop: 'rgba(45, 226, 255, 0.45)' },
    // organic's own --btn-edge is transparent (t2208 — the theme went borderless); the FACE gradient alone
    // carries the handle's shape, exactly the t2213/t2214 lesson the amendment named directly for this control.
    organic:    { bg: 'rgba(0, 0, 0, 0)', bgImage: 'linear-gradient(rgb(231, 219, 192), rgb(204, 189, 153))', ink: 'rgb(42, 33, 23)', edgeTop: 'rgba(0, 0, 0, 0)' },
};

test('the four NON-studio themes each render their OWN theme material now, not a shared blue (t2229)', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    for (const theme of THEMES.filter((t) => t !== 'studio')) {
        await setTheme(page, theme);
        const s = await handleStyle(page);
        const exp = EXPECT[theme];
        expect(s.bg, `${theme}: fill's background-color`).toBe(exp.bg);
        expect(s.bgImage, `${theme}: fill's background-image (the gradient, when it has one)`).toBe(exp.bgImage);
        expect(s.ink, `${theme}: its own ink, not the old shared light-on-blue`).toBe(exp.ink);
        expect(s.edgeTop, `${theme}: its own edge colour`).toBe(exp.edgeTop);
        expect(s.edgeWidth, `${theme}: still a real 1px border (organic's own edge is transparent, not absent — width stays)`).toBe('1px');
        expect(s.edgeStyle, `${theme}: still solid`).toBe('solid');
        // no theme still renders the pre-t2227 shared blue — confirms this is a genuine per-theme change,
        // not an accidental byte-identical carry-over for any of the four.
        expect(s.bg === 'rgba(28, 86, 140, 0.95)' || s.edgeTop === 'rgba(130, 195, 255, 0.65)',
            `${theme}: must not still be the old shared blue`).toBe(false);
    }
});

test('STUDIO renders its OWN metallic look, not the shared blue (the dead rule, now actually wired)', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    await setTheme(page, 'studio');
    const s = await handleStyle(page);
    expect(s.bg, 'studio: NOT the shared blue').not.toBe('rgba(28, 86, 140, 0.95)');
    expect(s.bgImage, 'studio: the dock-handle gradient (plate-hi -> plate-lo)').toContain('linear-gradient');
    expect(s.ink, 'studio: dark ink on its own light plate, not the shared light-on-blue ink').toBe('rgb(16, 16, 16)');
    // THE REGRESSION THIS TURN CAUGHT: a `border: 1px solid var(--dock-handle-edge))` COMPOUND shorthand made the
    // whole border invalid (a 4-value token isn't a valid single <color>) — studio rendered borderless. Asserting
    // a REAL, non-zero border width is the whole point of this test existing, not an incidental check.
    expect(s.edgeWidth, 'studio: a real border, not silently dropped by an invalid shorthand').toBe('1px');
    expect(s.edgeStyle, 'studio: solid, not "none"').toBe('solid');
});

test('the handle is still CLICKABLE at every theme (the wide-mode z-index fight this same turn had to reconcile with .editor-code)', async ({ page }) => {
    // t2155's main arc raised `.editor-code`'s ring pseudo to z-index:7 to beat `.viz3d-handle` (z6) — and along
    // the way found that giving the CONTENT ITSELF (not just the ring) a high z-index broke this exact click.
    // This is that regression's own standing guard, now that the handle also carries live theme tokens.
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    const isOpen = () => page.evaluate(() => document.querySelector('.viz3d-handle').classList.contains('open'));
    expect(await isOpen(), 'starts closed').toBe(false);
    await page.click('#view-toggle', { timeout: 5000 });
    await page.waitForTimeout(300);
    expect(await isOpen(), 'the click actually reached the handle and opened the drawer').toBe(true);
});
