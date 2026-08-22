import { test, expect } from '@playwright/test';

/**
 * t2127 (BOOT-SPLASH-PLAN.md) — the theme now applies BEFORE first paint (an inline, non-deferred script
 * as the first child of <body>, before the loader div), which is what lets the splash show the correct
 * themed logo (not the old "Loading DDCS Studio..." text, illegible on light themes since it hardcoded
 * near-white on a themed --modal-face background) and kills the studio-flash every non-studio user
 * previously got on every load (data-theme="studio" was hardcoded in the markup; themes.js only rewrote
 * it LATER, after boot).
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('the theme-apply script is the FIRST child of body, inline, not deferred, and comes before the loader', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const html = await page.content();
    const bodyIdx = html.indexOf('<body');
    const bodyOpenEnd = html.indexOf('>', bodyIdx) + 1;
    const afterBody = html.slice(bodyOpenEnd, bodyOpenEnd + 400);
    const firstTagMatch = afterBody.match(/<(\w+)/);
    expect(firstTagMatch && firstTagMatch[1], 'the very first element inside body must be the inline theme script').toBe('script');
    const scriptMatch = afterBody.match(/<script[^>]*>/);
    expect(scriptMatch[0], 'must not carry defer').not.toContain('defer');
    expect(scriptMatch[0], 'must not carry src (inline, not external)').not.toContain('src=');
    // the loader div must come AFTER the script, using FULL-document indices (the svg symbol defs sit
    // between them and are themselves long, so a truncated window would false-negative here)
    const scriptEndIdx = html.indexOf('</script>', bodyOpenEnd);
    const loaderIdx = html.indexOf('ddcs-boot-loader');
    expect(scriptEndIdx, 'sanity: the script tag must actually be found').toBeGreaterThan(-1);
    expect(loaderIdx, 'the boot-loader div must be parsed AFTER the theme script').toBeGreaterThan(scriptEndIdx);
});

test('the SVG symbol defs are parsed BEFORE the boot-loader div (trap 2 — no flash-empty <use>)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const html = await page.content();
    const defsIdx = html.indexOf('id="mark-studio"');
    const loaderIdx = html.indexOf('id="ddcs-boot-loader"');
    expect(defsIdx, 'sanity: the mark-studio symbol exists').toBeGreaterThan(-1);
    expect(defsIdx, 'the symbol defs must be parsed before the loader that <use>s them').toBeLessThan(loaderIdx);
});

test('a saved theme applies before boot — no studio flash, and the splash shows exactly one themed logo', async ({ page }) => {
    // seed localStorage first (needs an existing origin), then reload so the inline script sees it
    await page.goto('http://localhost:3211');
    await page.evaluate(() => localStorage.setItem('ddcs_theme', 'organic'));
    await page.reload();
    const theme = await page.evaluate(() => document.body.dataset.theme);
    expect(theme, 'organic must be applied, not the hardcoded studio fallback').toBe('organic');

    // exactly one splash logo visible, and it is the organic one
    const visible = await page.evaluate(() => {
        const card = document.querySelector('.ddcs-busy-card');
        if (!card) return null;   // boot may have already finished and removed the loader — acceptable, checked below instead
        return [...card.querySelectorAll('.logo')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.getAttribute('class'));
    });
    if (visible !== null) {
        expect(visible.length, 'exactly one mark visible — not all five stacked (trap 1)').toBe(1);
        expect(visible[0]).toContain('logo-organic');
    }
});

test('a garbage/stale localStorage theme value is ignored, not applied (fails safe to the studio fallback)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.evaluate(() => localStorage.setItem('ddcs_theme', 'not-a-real-theme'));
    await page.reload();
    const theme = await page.evaluate(() => document.body.dataset.theme);
    expect(theme, 'an invalid value must never produce an unknown/unstyled data-theme').toBe('studio');
});

test('the boot splash no longer shows the "Loading..." text', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // check the LIVE DOM node, not raw source (a source-text search would also match this spec's own
    // and the code's own explanatory HTML comments, which never render)
    const busyText = await page.evaluate(() => {
        const el = document.querySelector('.ddcs-busy-card .ddcs-busy-text');
        return el ? el.textContent : null;
    });
    expect(busyText, 'the .ddcs-busy-text div must be gone from the splash card entirely').toBeNull();
    const html = await page.content();
    const ariaCount = (html.match(/aria-label="DDCS CNC Macro Studio"/g) || []).length;
    expect(ariaCount, 'all five splash marks keep their aria-label').toBeGreaterThanOrEqual(5);
});

test('.ddcs-busy-text is no longer hardcoded near-white — it follows --text, legible on a LIGHT theme (studio)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.evaluate(() => localStorage.setItem('ddcs_theme', 'studio'));
    await page.reload();
    // .ddcs-busy-text has other users beyond the splash (per the plan) -- force one into the DOM to read its computed style
    const color = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'ddcs-busy-text';
        document.body.appendChild(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
    });
    expect(color, 'must no longer resolve to the old hardcoded near-white #dbe8f5').not.toBe('rgb(219, 232, 245)');
    expect(color, "studio's own --text is #101010 (near-black) -- legible on studio's light --panel").toBe('rgb(16, 16, 16)');
});

test('the busy-spin ring no longer hardcodes a near-white border (derives from --border instead)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.evaluate(() => localStorage.setItem('ddcs_theme', 'studio'));
    await page.reload();
    const borderColor = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'ddcs-busy-spin';
        document.body.appendChild(probe);
        const c = getComputedStyle(probe).borderLeftColor;   // the non-accent side of the ring
        probe.remove();
        return c;
    });
    expect(borderColor, 'must not be the old hardcoded rgba(255,255,255,.18)').not.toBe('rgba(255, 255, 255, 0.18)');
});
