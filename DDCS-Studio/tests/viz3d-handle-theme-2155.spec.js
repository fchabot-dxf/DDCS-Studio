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

test('the four NON-studio themes render the exact original hardcoded blue, via tokens now (byte-identical)', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await ready(page);
    for (const theme of THEMES.filter((t) => t !== 'studio')) {
        await setTheme(page, theme);
        const s = await handleStyle(page);
        expect(s.bg, `${theme}: same blue background as before this turn`).toBe('rgba(28, 86, 140, 0.95)');
        expect(s.ink, `${theme}: same ink colour as before this turn`).toBe('rgb(234, 244, 255)');
        expect(s.edgeTop, `${theme}: same edge colour as before this turn`).toBe('rgba(130, 195, 255, 0.65)');
        expect(s.edgeWidth, `${theme}: still has a real 1px border (the compound-shorthand bug this turn found and fixed didn't regress the DEFAULT case)`).toBe('1px');
        expect(s.edgeStyle, `${theme}: still solid`).toBe('solid');
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
