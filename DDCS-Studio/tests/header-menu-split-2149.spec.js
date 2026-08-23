import { test, expect } from '@playwright/test';

/**
 * t2149 — BACKLOG #9: SPLIT THE ONE MENU IN TWO. The logo owns the APP (#hdrAppBtn/#hdrAppMenu — Settings,
 * FAQ, About (split into two rows/panels per a later amendment — "i meant seperate them in 2 panel"), the
 * desktop download, Rate, "open the website", the version); the filename chip owns the FILE
 * (#hdrPostBtn/#hdrPostMenu, unchanged ids — Save/Open/Load/Insert/Export/Library/Wizards/setup docs). Before
 * this turn both lived in one menu hanging off the filename, so "Settings…" under your filename read as this
 * FILE's settings.
 *
 * The test that drew the line: does going through this door bring something INTO your work, or come OUT of
 * it? Wizards inserts an op into THIS program (checked: runQuickAction's 'wizards' case opens the wizard
 * manager scoped to the current workspace) — so it stays FILE-scoped, unlike the older "### The shape" sketch
 * in BACKLOG.md which drew it app-side before that reasoning was written down; the later, checkmarked ✅
 * section is what this turn builds.
 *
 * ⛔ THE LOGO STOPS BEING A LINK — a real mis-click hazard (`<a href="https://ddcs-studio.pages.dev"
 * target="_blank">`) that was also the reason t2147's whole workspace-chip layout argument existed. It is now
 * a real <button> that opens the app menu; "open the website" is one row inside it.
 */
test.use({ viewport: { width: 1400, height: 900 } });

async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

test('the logo is a real BUTTON, not a link — no href, no target, opens the app menu', async ({ page }) => {
    await ready(page);
    const s = await page.evaluate(() => {
        const el = document.getElementById('hdrAppBtn');
        return {
            tag: el ? el.tagName : null,
            hasHref: el ? el.hasAttribute('href') : null,
            hasTarget: el ? el.hasAttribute('target') : null,
            ariaHaspopup: el ? el.getAttribute('aria-haspopup') : null,
        };
    });
    expect(s.tag, 'the logo is a <button> now, not an <a>').toBe('BUTTON');
    expect(s.hasHref, 'no href — nothing to navigate to').toBe(false);
    expect(s.hasTarget, 'no target — it never opened a new tab either').toBe(false);
    expect(s.ariaHaspopup, 'it announces itself as a menu trigger to assistive tech').toBe('menu');
});

test('⛔ INVERTED (was a navigation test): clicking the logo opens the app menu, it never navigates away', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#hdrAppMenu')).toBeHidden();
    const startUrl = page.url();
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    expect(page.url(), 'still on the app, no navigation happened').toBe(startUrl);
});

test('app menu: FAQ, About, desktop download, Rate, Open the website, version — and NOTHING file-scoped', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    const s = await page.evaluate(() => {
        const acts = [...document.querySelectorAll('#hdrAppMenu [data-act]')].map((b) => b.dataset.act);
        return {
            acts,
            hasVersion: document.querySelectorAll('#hdrAppMenu .hq-ver-footer').length,
            hasIdentity: document.querySelectorAll('#hdrAppMenu .hq-identity-line').length,
            hasThemeRow: document.querySelectorAll('#hdrAppMenu [data-theme]').length,
        };
    });
    // t2184 (amendment 2) — 'settings' moved OUT of this list: it's saved into the .ddcs (backup.js's own save
    // registry), so it's workspace content now, in the FILE menu's Workspace section instead.
    expect(s.acts).toEqual(['helpFaq', 'helpAbout', 'getDesktop', 'rate', 'openWebsite']);
    expect(s.hasVersion, 'the version footer lives here now').toBe(1);
    expect(s.hasIdentity, 'no workspace identity line — that is file-scoped').toBe(0);
    expect(s.hasThemeRow, 'no Theme row — Settings already reaches it in one step (BACKLOG #1)').toBe(0);
    // none of the file-scoped acts leaked into this menu ('settings' included — it is file-scoped as of t2184)
    for (const fileAct of ['wsSave', 'wsOpen', 'wizards', 'settings', 'library', 'fileLoad', 'fileInsert', 'fileExport', 'projSave', 'setupSheet', 'checklist']) {
        expect(s.acts.includes(fileAct), `${fileAct} is file-scoped, must not be in the app menu`).toBe(false);
    }
});

// t2184 (amendment 4's convention, extended here after asking the human directly — screenshots of both menus,
// answer "yes, unify it too") — the app menu's four emoji rows (FAQ/About/getDesktop/Rate) now carry the SAME
// declared SVG icons as the file menu; three ("help"/"about"/"rate") are genuinely new (nothing existing fit),
// "standalone" is reused for getDesktop (it already means "the desktop EXE" on the Gateway page).
test('app menu: every row carries a declared SVG icon — no emoji glyph baked into a label string', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    const s = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#hdrAppMenu [data-act]')];
        const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
        return rows.map((b) => ({ act: b.dataset.act, hasSvg: !!b.querySelector('svg'), labelHasEmoji: emojiRe.test(b.textContent) }));
    });
    expect(s.length, 'rows are actually present to check').toBeGreaterThan(0);
    for (const row of s) {
        expect(row.hasSvg, `${row.act} carries an SVG icon`).toBe(true);
        expect(row.labelHasEmoji, `${row.act}'s label has no baked-in emoji`).toBe(false);
    }
});

test('file menu: Save/Open/Wizards/Settings/Load/Export/Library/Save-as-project/Setup — and NOTHING app-scoped', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => {
        const acts = [...document.querySelectorAll('#hdrPostMenu [data-act]')].map((b) => b.dataset.act);
        return { acts, hasVersion: document.querySelectorAll('#hdrPostMenu .hq-ver-footer').length };
    });
    expect(s.acts).toContain('wsSave');
    expect(s.acts).toContain('wsOpen');
    expect(s.acts).toContain('wizards');   // stays FILE-scoped per the ✅ split's own reasoning — see header comment
    // t2184 (amendment 2) — 'settings' joins the file menu's Workspace section (see the app-menu test above).
    expect(s.acts).toContain('settings');
    expect(s.acts).toContain('library');
    expect(s.acts).toContain('projSave');   // t2184 — Project section's NEW Save row
    expect(s.acts).toContain('fileLoad');
    expect(s.acts).toContain('fileExport');
    expect(s.acts, 'Insert stays removed (t2173)').not.toContain('fileInsert');
    expect(s.acts).toContain('setupSheet');
    expect(s.hasVersion, 'the version moved out to the app menu, not here any more').toBe(0);
    for (const appAct of ['helpFaq', 'helpAbout', 'getDesktop', 'rate', 'openWebsite']) {
        expect(s.acts.includes(appAct), `${appAct} is app-scoped, must not be in the file menu`).toBe(false);
    }
});

test('two menus, one dismissal contract: opening the app menu closes an open file menu, and vice versa', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    await expect(page.locator('#hdrPostMenu')).toBeHidden();   // opening the app menu closed the file menu

    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await expect(page.locator('#hdrAppMenu')).toBeHidden();    // and back the other way
});

test('Escape and outside-click close whichever popover is open', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#hdrAppMenu')).toBeHidden();

    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await page.mouse.click(700, 500);   // outside both menus
    await expect(page.locator('#hdrPostMenu')).toBeHidden();
});

test('the three doors to "open a saved thing" carry distinguishing titles (Open / Load / Library)', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => ({
        open: document.querySelector('[data-act="wsOpen"]')?.title || '',
        load: document.querySelector('[data-act="fileLoad"]')?.title || '',
        library: document.querySelector('[data-act="library"]')?.title || '',
    }));
    expect(s.open.toLowerCase()).toContain('workspace');
    expect(s.load.toLowerCase()).toContain('g-code');
    expect(s.library.toLowerCase()).toContain('project');
});

test('390px: both entry points (logo, filename chip) survive alongside the tabs, no header overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.waitForTimeout(300);   // let commandDeck's overflow-yield measurement settle
    const s = await page.evaluate(() => {
        const h = document.querySelector('.app-header');
        const app = document.getElementById('hdrAppBtn').getBoundingClientRect();
        const tabs = document.querySelector('.hdr-tabs').getBoundingClientRect();
        const chip = document.getElementById('hdrPostBtn').getBoundingClientRect();
        return {
            overflow: h.scrollWidth - h.clientWidth,
            appVisible: app.width > 0 && app.height > 0,
            chipVisible: chip.width > 0 && chip.height > 0,
            appLeftOfTabs: app.right <= tabs.left + 1,
            chipRightOfTabs: chip.left >= tabs.right - 1,
        };
    });
    expect(s.overflow, 'no header overflow at 390px').toBeLessThanOrEqual(0);
    expect(s.appVisible, 'the logo/app-menu trigger stays visible').toBe(true);
    expect(s.chipVisible, 'the filename chip stays visible').toBe(true);
    expect(s.appLeftOfTabs, 'the logo stays at the left, before the tabs').toBe(true);
    expect(s.chipRightOfTabs, 'the chip stays at the right, after the tabs').toBe(true);
});

test('verify: screenshot both menus open, desktop and 390px (human judges the split visually)', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    await page.screenshot({ path: 'verification/t2149-app-menu-desktop.png' });
    await page.click('#hdrAppBtn');   // close
    await page.click('#hdrPostBtn');
    await page.screenshot({ path: 'verification/t2149-file-menu-desktop.png' });
    await page.click('#hdrPostBtn');   // close

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.click('#hdrAppBtn');
    await page.screenshot({ path: 'verification/t2149-app-menu-390.png' });
    await page.click('#hdrAppBtn');
    await page.click('#hdrPostBtn');
    await page.screenshot({ path: 'verification/t2149-file-menu-390.png' });
});

// t2186 (advisor, closing the t2184 contrast sweep's own last gap) — the version footer measured 1.70:1
// (studio) to 2.57:1 (organic), the same dim-small-text recipe as the identity line/section headers t2184
// already fixed. Fixed via the same color-mix approach (a slightly richer 40/60 blend — the footer's own
// background differs enough from the file menu's that 45/55 left studio at 4.44:1, just under the floor).
// The human's earlier "no as is for now" ruling on this footer was about the proposed release-page LINK, not
// its legibility — untouched here, still the quietest thing in either menu.
test('app menu: the version footer clears WCAG AA (4.5:1), composited over the app menu, all 5 themes', async ({ page }) => {
    await ready(page);
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
        await page.click('#hdrAppBtn');
        const menu = page.locator('#hdrAppMenu');
        await menu.waitFor({ state: 'visible' });
        const box = await page.locator('#hdrAppMenu .hq-ver-footer').boundingBox();
        const menuBox = await menu.boundingBox();
        const buf = await menu.screenshot();
        const b64 = buf.toString('base64');
        const result = await page.evaluate(async ({ b64, box, menuBox }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
            const cnv = document.createElement('canvas');
            cnv.width = img.naturalWidth; cnv.height = img.naturalHeight;
            const ctx = cnv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const scaleX = img.naturalWidth / menuBox.width, scaleY = img.naturalHeight / menuBox.height;
            const x0 = Math.max(0, Math.round((box.x - menuBox.x) * scaleX));
            const y0 = Math.max(0, Math.round((box.y - menuBox.y) * scaleY));
            const w = Math.max(1, Math.round(box.width * scaleX)), h = Math.max(1, Math.round(box.height * scaleY));
            const data = ctx.getImageData(x0, y0, w, h).data;
            const bgx = Math.min(cnv.width - 1, x0 + 2), bgy = Math.max(0, y0 - 3);
            const bg = [...ctx.getImageData(bgx, bgy, 1, 1).data].slice(0, 3);
            const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
            let best = null, bestDiff = -1;
            for (let py = 0; py < h; py++) {
                for (let px = 0; px < w; px++) {
                    const r = data[(py * w + px) * 4], g = data[(py * w + px) * 4 + 1], bl = data[(py * w + px) * 4 + 2];
                    const diff = Math.abs((0.2126 * r + 0.7152 * g + 0.0722 * bl) - bgLum);
                    if (diff > bestDiff) { bestDiff = diff; best = [r, g, bl]; }
                }
            }
            return { text: best, bg };
        }, { b64, box, menuBox });
        const c = contrast(result.text, result.bg);
        expect(c, `${theme}: version-footer contrast ${c.toFixed(2)}:1 (need >= 4.5:1)`).toBeGreaterThanOrEqual(4.5);
        await page.click('#hdrAppBtn');
    }
});
