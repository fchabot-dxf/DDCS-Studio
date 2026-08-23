import { test, expect } from '@playwright/test';

/**
 * t2184 — the FILE menu's flat list + separator-line convention becomes FOUR labelled, bordered sections, each
 * a two-column GRID of the SAME declared tile button: Workspace (identity + saved lines, then a 2x2 — Save,
 * Open…, Wizards…, Settings…), G-code (Save as…, Open…), Project (Save…, Open…), Reference (Setup sheet…,
 * Setup checklist). Spec: DDCS-Studio/scratchpad/t-filemenu-sections.md — the human's own pasted mockup is the
 * authority; amendments 14-20 (mid-task) refined it further. Amendments: 2 — Settings moves here from the APP
 * menu (saved into the .ddcs — workspace content); 3/4 — every row uses its declared SVG icon, no emoji, per
 * commandDeck.js's own documented convention (enforced, not just followed); 5/6 — the identity line + section
 * headers were measured (pixel-sampled, composited over a real loaded program) to fail WCAG AA in every theme,
 * fixed via color-mix toward --text-main; 13 — identity + saved lines moved INSIDE the Workspace section,
 * dropping the "Workspace: " prefix; 16 — SUPERSEDES the pairs-plus-odd-item rule from amendment 3 entirely:
 * one shared grid tile, every width, 44px floor on phone only; 17 — the save action always leads its section
 * (G-code's Save as/Open pair swapped to match); 18-20 — five label rules (see the comment above
 * workspaceGrid in headerPost.js): section carries the noun, save-first, ellipsis means "will ask you
 * something" except Save-vs-Save-as, and OPEN is the only word for picking a file (G-code's "Load…" → "Open…").
 */
test.use({ viewport: { width: 1400, height: 900 } });

async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

test('four labelled sections, in order, each carrying the right acts', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const sections = await page.evaluate(() =>
        [...document.querySelectorAll('#hdrPostMenu .hdr-menu-section')].map((sec) => ({
            title: sec.querySelector('.hdr-menu-section-title')?.textContent || '',
            acts: [...sec.querySelectorAll('[data-act]')].map((b) => b.dataset.act),
        }))
    );
    // t2184 amendment 16 — Workspace is now a 2x2 (Save/Open/Wizards/Settings), no odd-item-spans-full-width
    // case; amendment 17 — G-code's save action (fileExport, "Save as…") leads, Open (fileLoad) follows.
    expect(sections).toEqual([
        { title: 'Workspace', acts: ['wsSave', 'wsOpen', 'wizards', 'settings'] },
        { title: 'G-code', acts: ['fileExport', 'fileLoad'] },
        { title: 'Project', acts: ['projSave', 'library'] },
        { title: 'Reference', acts: ['setupSheet', 'checklist'] },
    ]);
});

test('labels drop the noun the section title now carries, no emoji baked into any label', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => ({
        wsOpen: document.querySelector('[data-act="wsOpen"]')?.textContent.trim() || '',
        gcodeOpen: document.querySelector('[data-act="fileLoad"]')?.textContent.trim() || '',
        saveAs: document.querySelector('[data-act="fileExport"]')?.textContent.trim() || '',
        libOpen: document.querySelector('[data-act="library"]')?.textContent.trim() || '',
        projSave: document.querySelector('[data-act="projSave"]')?.textContent.trim() || '',
        wsSave: document.querySelector('[data-act="wsSave"]')?.textContent.trim() || '',
    }));
    // t2184 amendment 20 — OPEN is the only word for picking a file: Workspace, G-code and Project all agree.
    expect(s.wsOpen, 'the section title says "Workspace" now; Open still gets an ellipsis (it asks something)').toBe('Open…');
    expect(s.gcodeOpen, '"Load…" retired — OPEN is the one word for picking a file').toBe('Open…');
    expect(s.libOpen, '"project" moved to the section title').toBe('Open…');
    // t2184 amendment 19 — Save vs Save as is the one legitimate exception to the ellipsis rule: Save writes
    // straight to the known target (no ellipsis), Save as always asks (keeps its ellipsis).
    expect(s.wsSave, 'plain Save, no ellipsis (writes to the known target)').toBe('Save');
    expect(s.saveAs).toBe('Save as…');
    expect(s.projSave, 'Project Save always opens the save modal, so it keeps its ellipsis').toBe('Save…');
});

test('every menu row carries a declared SVG icon — no emoji glyph baked into a label string', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#hdrPostMenu [data-act]')];
        const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
        return rows.map((b) => ({
            act: b.dataset.act,
            hasSvg: !!b.querySelector('svg'),
            labelHasEmoji: emojiRe.test(b.textContent),
        }));
    });
    for (const row of s) {
        expect(row.hasSvg, `${row.act} carries an SVG icon`).toBe(true);
        expect(row.labelHasEmoji, `${row.act}'s label has no baked-in emoji`).toBe(false);
    }
});

test('Settings moved from the APP menu into the FILE menu\'s Workspace section', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    const inAppMenu = await page.locator('#hdrAppMenu [data-act="settings"]').count();
    expect(inAppMenu, 'settings is no longer in the app menu').toBe(0);
    await page.click('#hdrAppBtn');   // close
    await page.click('#hdrPostBtn');
    const inFileMenu = await page.locator('#hdrPostMenu .hdr-menu-section [data-act="settings"]').count();
    expect(inFileMenu, 'settings now lives in the file menu').toBe(1);
});

test('Project Save is a real, new door — calls the same openSaveModal the Library and the old header disk used to', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    await page.click('[data-act="projSave"]');
    // openSaveModal renders its own dialog; assert something from it actually opened rather than the button
    // just existing (a dead data-act with no case in runQuickAction would look identical up to this point).
    await expect(page.locator('.pm-save-modal, [data-testid="project-save-modal"], .modal:visible, [role="dialog"]:visible').first())
        .toBeVisible({ timeout: 3000 });
});

test('the header disk buttons (#projSaveBtn/#projOpenBtn) and the macro-bar are gone entirely', async ({ page }) => {
    await ready(page);
    const s = await page.evaluate(() => ({
        macroBar: document.getElementById('macroBar'),
        saveBtn: document.getElementById('projSaveBtn'),
        openBtn: document.getElementById('projOpenBtn'),
    }));
    expect(s.macroBar, 'no #macroBar element at all').toBeNull();
    expect(s.saveBtn, 'no #projSaveBtn element at all').toBeNull();
    expect(s.openBtn, 'no #projOpenBtn element at all').toBeNull();
});

test('390px: the four-section menu still fits under the popover\'s own height cap, no scroll-forcing overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.click('#hdrPostBtn');
    const menu = page.locator('#hdrPostMenu');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    // t2184/t2186 measured at 390px: 307px (pre-sections) -> 421px (stacked sections, pre amendment 3) -> 390px
    // (two-column pairs) -> 388px (amendment 13 — identity+saved lines moved inside the Workspace box, costs
    // ~nothing since it's relocated not duplicated) -> 450px (amendment 14/16 — the 44px touch floor spends
    // some of the height the grid bought back, as amendment 14 itself predicted it would) -> 441px (t2186
    // amendment 1 — the bordered box retired; the label + gap alone were already doing the separating, the
    // border just repeated it). Desktop: 365px (unaffected by the phone-only floor). The popover's own cap
    // (styles.css .hdr-quick-menu) is min(72vh, 560px); 844*0.72 = 607px, so 560px is the real ceiling at 390px.
    expect(box.height, `menu is ${box.height}px — must stay under the popover's own 560px cap`).toBeLessThan(560);
});

test('390px: every actionable tile clears the 44px touch floor (t2153\'s rule reaching this menu, amendment 14) — asserted, not eyeballed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.click('#hdrPostBtn');
    const sizes = await page.evaluate(() =>
        [...document.querySelectorAll('#hdrPostMenu .hq-ws-btn')].map((b) => {
            const r = b.getBoundingClientRect();
            return { act: b.dataset.act, h: r.height };
        })
    );
    expect(sizes.length, 'the grid tiles are actually present to measure').toBeGreaterThan(0);
    for (const s of sizes) {
        expect(s.h, `${s.act} tile height ${s.h}px must be >= 44px at phone width`).toBeGreaterThanOrEqual(44);
    }
});

test('desktop: tiles stay compact — the 44px floor is phone-only, not inflating every width for nothing', async ({ page }) => {
    await ready(page);   // default viewport (1400px, set at file top)
    await page.click('#hdrPostBtn');
    const sizes = await page.evaluate(() =>
        [...document.querySelectorAll('#hdrPostMenu .hq-ws-btn')].map((b) => b.getBoundingClientRect().height)
    );
    expect(sizes.length).toBeGreaterThan(0);
    // not asserting an exact number (the design may tune padding later) — just that it did NOT inherit the
    // phone floor, which would silently cost desktop popover height for a touch target nobody uses with a mouse
    for (const h of sizes) expect(h, `desktop tile is ${h}px — should read visibly more compact than the 44px phone floor`).toBeLessThan(40);
});

test('the identity + saved lines live inside the Workspace section, above Save/Open, with no "Workspace: " prefix', async ({ page }) => {
    await ready(page);
    // seed a saved timestamp so the saved-line actually renders (empty when the workspace was never saved) —
    // otherwise this test can't tell "moved correctly" from "never rendered in the first place".
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved && window.ddcsMarkWorkspaceSaved('Rig B.ddcs'));
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => {
        const ws = document.querySelector('#hdrPostMenu .hdr-menu-section');   // Workspace is the first section
        const kids = ws ? [...ws.children] : [];
        return {
            sectionTitle: ws && ws.querySelector('.hdr-menu-section-title')?.textContent,
            order: kids.map((k) => k.className.split(' ')[0]),
            identityText: ws && ws.querySelector('.hq-identity-txt')?.textContent.trim(),
        };
    });
    expect(s.sectionTitle).toBe('Workspace');
    // section-title, identity-line, saved-line, then the Save/Open pair — in that order, inside the ONE box
    expect(s.order.slice(0, 4)).toEqual(['hdr-menu-section-title', 'hq-identity-line', 'hq-saved-line', 'hq-ws-row']);
    expect(s.identityText, 'no "Workspace: " prefix — the box title states the subject (amendment 13)').not.toMatch(/^Workspace:/);
});

test('identity line + section headers clear WCAG AA (4.5:1), composited over a real loaded program, all 5 themes', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'rapid' } }], simChildren: [] }]));
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved && window.ddcsMarkWorkspaceSaved('Rig B.ddcs'));

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
        await page.click('#hdrPostBtn');
        const menu = page.locator('#hdrPostMenu');
        await menu.waitFor({ state: 'visible' });

        const idBox = await page.locator('#hdrPostMenu .hq-identity-txt').boundingBox();
        const titleBox = await page.locator('#hdrPostMenu .hdr-menu-section-title').first().boundingBox();
        const menuBox = await menu.boundingBox();
        const buf = await menu.screenshot();
        const b64 = buf.toString('base64');

        // sample the ACTUAL rendered pixels (not a CSS-token guess): a translucent, backdrop-filtered popover
        // has no single "background" to compute contrast against analytically.
        const result = await page.evaluate(async ({ b64, idBox, titleBox, menuBox }) => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
            const cnv = document.createElement('canvas');
            cnv.width = img.naturalWidth; cnv.height = img.naturalHeight;
            const ctx = cnv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const scaleX = img.naturalWidth / menuBox.width, scaleY = img.naturalHeight / menuBox.height;
            const sampleRegion = (box) => {
                if (!box) return null;
                const x0 = Math.max(0, Math.round((box.x - menuBox.x) * scaleX));
                const y0 = Math.max(0, Math.round((box.y - menuBox.y) * scaleY));
                const w = Math.max(1, Math.round(box.width * scaleX));
                const h = Math.max(1, Math.round(box.height * scaleY));
                const data = ctx.getImageData(x0, y0, w, h).data;
                const bgx = Math.min(cnv.width - 1, x0 + w + 4), bgy = y0 + Math.floor(h / 2);
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
            };
            return { identity: sampleRegion(idBox), title: sampleRegion(titleBox) };
        }, { b64, idBox, titleBox, menuBox });

        const idC = result.identity ? contrast(result.identity.text, result.identity.bg) : 0;
        const titleC = result.title ? contrast(result.title.text, result.title.bg) : 0;
        expect(idC, `${theme}: identity line contrast ${idC.toFixed(2)}:1 (need >= 4.5:1)`).toBeGreaterThanOrEqual(4.5);
        expect(titleC, `${theme}: section-header contrast ${titleC.toFixed(2)}:1 (need >= 4.5:1)`).toBeGreaterThanOrEqual(4.5);

        await page.click('#hdrPostBtn');
    }
});
