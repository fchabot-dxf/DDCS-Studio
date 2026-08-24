import { test, expect } from '@playwright/test';

/**
 * t2188 (amendment 1, human: "ok dot") — SUPERSEDES the "no replacement indicator" plan: the standalone disk
 * chip (#fileSaveChip) is retired, its STATE job replaced by a small dot on the workspace chip itself
 * (#hdrWsDirtyDot, inside #hdrPostBtn), its ACTION job by the file menu's own Workspace-section Save button
 * (t2184). This is the THIRD ruling on a dot for this exact fact (an earlier one was removed once the disk
 * chip's own colour already said it; now that chip is gone, the fact needs a home again).
 *
 * Design constraints, all direct instruction: a DOT not an asterisk (the name already truncates); NOT red
 * (unsaved is not an error); an ACCESSIBLE NAME on the dot itself, not relying on shape/colour alone; contrast
 * measured composited across all 5 themes, the same way the identity line/footer were; a FIXED slot so the
 * name never reflows when the dot shows/hides.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(2500);
}

test('#fileSaveChip is gone entirely — not hidden, deleted', async ({ page }) => {
    await ready(page);
    const exists = await page.evaluate(() => document.getElementById('fileSaveChip') !== null);
    expect(exists, 'no #fileSaveChip element at all').toBe(false);
});

test('the dot is hidden (visually and from assistive tech) when clean, shown with an accessible name when dirty', async ({ page }) => {
    await ready(page);
    const clean = await page.evaluate(() => {
        const dot = document.getElementById('hdrWsDirtyDot');
        return { isOn: dot.classList.contains('is-on'), ariaHidden: dot.getAttribute('aria-hidden'), ariaLabel: dot.getAttribute('aria-label') };
    });
    expect(clean.isOn, 'no visible fill when clean').toBe(false);
    expect(clean.ariaHidden, 'removed from the accessibility tree when clean').toBe('true');
    expect(clean.ariaLabel, 'no accessible name when there is nothing to announce').toBeNull();

    const dirty = await page.evaluate(async () => {
        const m = await import('/ui/settingsPanel.js');
        const s = m.getSettings();
        s.units = s.units === 'mm' ? 'in' : 'mm';
        m.saveSettings();
        window.ddcsFileSaveState.refresh();
        const dot = document.getElementById('hdrWsDirtyDot');
        return { isOn: dot.classList.contains('is-on'), ariaHidden: dot.getAttribute('aria-hidden'), ariaLabel: dot.getAttribute('aria-label') };
    });
    expect(dirty.isOn, 'visible fill when dirty').toBe(true);
    expect(dirty.ariaHidden, 'exposed to assistive tech when dirty').toBeNull();
    expect(dirty.ariaLabel, 'an accessible name that SAYS unsaved, not relying on shape/colour alone').toBe('Unsaved changes');
});

test('the dot occupies a FIXED slot — the chip does not reflow between clean and dirty', async ({ page }) => {
    await ready(page);
    // t2233 — the FIXED-SLOT property (styles.css .hdr-ws-dirty-dot: "the element always occupies its own
    // box... only its VISUAL fill toggles via opacity/scale") is a LAYOUT guarantee: offsetWidth/offsetHeight
    // (the pre-transform border box) is what actually stays constant, and it is what makes the neighbour not
    // reflow. getBoundingClientRect()/boundingBox() report the POST-transform visual rect instead — since the
    // fill toggle is implemented via `transform: scale()`, that rect genuinely differs (0.4x → 1x scale is
    // 3.2px → 8px, not a race) and was never a valid way to assert "the box doesn't change size". Originally
    // asserted via boundingBox and raced the .15s transition (see git history); fixed by reading the correct,
    // transform-immune property instead of chasing the transition's end state.
    const dotSize = (p) => p.evaluate(() => {
        const d = document.getElementById('hdrWsDirtyDot');
        return { width: d.offsetWidth, height: d.offsetHeight };
    });
    const cleanBox = await dotSize(page);
    const cleanNameX = (await page.locator('.hdr-ws-name-txt').boundingBox()).x;

    await page.evaluate(async () => {
        const m = await import('/ui/settingsPanel.js');
        const s = m.getSettings();
        s.units = s.units === 'mm' ? 'in' : 'mm';
        m.saveSettings();
        window.ddcsFileSaveState.refresh();
    });
    const dirtyBox = await dotSize(page);
    const dirtyNameX = (await page.locator('.hdr-ws-name-txt').boundingBox()).x;

    expect(dirtyBox.width, 'the dot\'s own LAYOUT box is the same size clean vs dirty (the fill toggle must not resize it)').toBe(cleanBox.width);
    expect(dirtyNameX, 'the name text does not shift sideways when the dot shows').toBe(cleanNameX);
});

test('the dot clears WCAG AA (4.5:1) composited over the real header, all 5 themes', async ({ page }) => {
    await ready(page);
    await page.evaluate(async () => {
        const m = await import('/ui/settingsPanel.js');
        const s = m.getSettings();
        s.units = s.units === 'mm' ? 'in' : 'mm';
        m.saveSettings();
        window.ddcsFileSaveState.refresh();
    });
    await page.waitForTimeout(150);

    const luminance = ([r, g, b]) => {
        const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contrast = (a, b) => {
        const [L1, L2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (L1 + 0.05) / (L2 + 0.05);
    };

    for (const theme of ['normal', 'studio', 'futuristic', 'organic', 'steampunk']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(150);

        const dotBox = await page.locator('#hdrWsDirtyDot').boundingBox();
        const chipBox = await page.locator('#hdrQuick').boundingBox();
        const buf = await page.locator('#hdrQuick').screenshot();
        const b64 = buf.toString('base64');

        const result = await page.evaluate(async ({ b64, dotBox, chipBox }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
            const cnv = document.createElement('canvas');
            cnv.width = img.naturalWidth; cnv.height = img.naturalHeight;
            const ctx = cnv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const scaleX = img.naturalWidth / chipBox.width, scaleY = img.naturalHeight / chipBox.height;
            const x0 = Math.max(0, Math.round((dotBox.x - chipBox.x) * scaleX));
            const y0 = Math.max(0, Math.round((dotBox.y - chipBox.y) * scaleY));
            const w = Math.max(1, Math.round(dotBox.width * scaleX)), h = Math.max(1, Math.round(dotBox.height * scaleY));
            const data = ctx.getImageData(x0, y0, w, h).data;
            const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
            const ci = (cy * w + cx) * 4;
            const dotColor = [data[ci], data[ci + 1], data[ci + 2]];
            const bgx = Math.min(cnv.width - 1, x0 + w + 4), bgy = y0 + Math.floor(h / 2);
            const bg = [...ctx.getImageData(bgx, bgy, 1, 1).data].slice(0, 3);
            return { dotColor, bg };
        }, { b64, dotBox, chipBox });

        const c = contrast(result.dotColor, result.bg);
        expect(c, `${theme}: dot contrast ${c.toFixed(2)}:1 (need >= 4.5:1)`).toBeGreaterThanOrEqual(4.5);
    }
});
