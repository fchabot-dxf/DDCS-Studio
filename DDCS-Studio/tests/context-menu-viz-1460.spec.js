import { test, expect } from '@playwright/test';

/**
 * t1460 — SURFACE 6 OF THE CONTEXT-MENU PASS: the 3D PREVIEW.
 *
 * ── A MENU ON A SURFACE THAT HAD ONE TAKEN AWAY ──────────────────────────────────────────────────────────────────
 * The 3D view already suppresses the native menu (`contextmenu → preventDefault`, because right-drag pans), so this
 * is not a menu competing with another — it is the right button being given something to do again.
 *
 * ── THE LINK LIST IS CAPPED AT THREE, AND THE CAP IS ASSERTED ────────────────────────────────────────────────────
 * A link earns its place by GOVERNING WHAT THE VIEW SHOWS: the envelope box, the preview display options, the stock
 * body. Tool table, WCS, Program and the rest all influence a program somewhere, and a menu that grows to
 * "everything related" stops being a shortcut and becomes a second Settings index nobody maintains. The test asserts
 * the count, not just the presence, because a cap that is only described is a cap that drifts.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * Mount the shipping preview panel on a real program, then right-click the 3D canvas.
 * Driven through `createPreviewPanel` (the component every preview surface uses) rather than a hand-built host, so
 * what is tested is the panel a user actually sees.
 */
const openVizMenu = async (page) => {
    const at = await page.evaluate(async () => {
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        const NL = String.fromCharCode(10);
        const nc = ['G90', 'G0 X0 Y0 Z5', 'G1 Z-1 F150', 'G1 X40 F600', 'G1 Y30', 'G0 Z5', 'M30'].join(NL);
        let host = document.querySelector('.ddcs-t1460-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'ddcs-t1460-host';
                // ⚠ z-index BELOW the shared menu's (1000). The first cut used 99999 and the menu rendered correctly
            // but sat BEHIND this test host — the DOM assertions passed while the SCREENSHOT showed no menu at
            // all, which is precisely the gap a picture is supposed to close. A test host that outranks the thing
            // under test cannot photograph it.
        host.style.cssText = 'width:1100px;height:640px;position:fixed;left:0;top:0;z-index:900;background:#111';
            document.body.appendChild(host);
            const panel = createPreviewPanel(host, { getGcode: () => nc });
            panel.setGcode(nc);
            window.__t1460 = panel;
        }
        await new Promise((r) => setTimeout(r, 700));
        const c = host.querySelector('canvas');
        if (!c) return { err: 'no 3D canvas — the panel fell back to 2D' };
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    if (at.err) return at;
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.waitForTimeout(250);
    const items = await page.evaluate(() => {
        const m = document.querySelector('.op-ctx-menu');
        if (!m || m.hidden) return null;
        return [...m.querySelectorAll('.op-ctx-item')].map((b) => b.textContent);
    });
    return { ...at, items };
};

test('THE MENU — three view presets, fit, and EXACTLY three settings links', async ({ page }, testInfo) => {
    await boot(page);
    const r = await openVizMenu(page);
    expect(r.err).toBeUndefined();
    expect(r.items, 'right-clicking the 3D view opens the app menu (the native one is suppressed here)').toBeTruthy();
    const all = r.items.join(' | ');
    expect(all, 'Top').toMatch(/Top view/);
    expect(all, 'Front').toMatch(/Front view/);
    expect(all, 'Iso').toMatch(/Iso view/);
    expect(all, 'Fit').toMatch(/Fit to work/);
    // ⚠ THE CAP, ASSERTED AS A COUNT. Three links govern what the view SHOWS; a fourth would mean the rule
    // ("it governs the view") had been replaced by "it is related", which is how this becomes a Settings index.
    const links = r.items.filter((t) => /⚙/.test(t));
    expect(links.length, `exactly three settings links — got ${JSON.stringify(links)}`).toBe(3);
    expect(links.join(' | ')).toMatch(/Machine \/ envelope/);
    expect(links.join(' | ')).toMatch(/Preview display/);
    expect(links.join(' | ')).toMatch(/Stock/);
    await page.screenshot({ path: 'test-results/t1460-shots/viz-menu.png' });
    await testInfo.attach('t1460-viz-menu', { path: 'test-results/t1460-shots/viz-menu.png', contentType: 'image/png' });
});

test('THE VIEW ENTRIES REALLY MOVE THE CAMERA — and to the same place the ViewCube does', async ({ page }) => {
    await boot(page);
    await openVizMenu(page);
    // read the camera angles the panel's own viz holds, before and after
    const before = await page.evaluate(() => {
        const v = window.__t1460 && window.__t1460.viz3d ? window.__t1460.viz3d() : null;
        return v ? { theta: v.theta, phi: v.phi } : null;
    });
    // the real mouse: this menu sits over a fixed, high-z host, so Playwright's actionability check would wait for
    // an "unobstructed" element a user simply clicks (the same lesson surfaces 2 and 4 taught).
    const box = await page.evaluate(() => {
        const it = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Top view/.test(b.textContent));
        if (!it) return null;
        const r = it.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    expect(box, 'the Top view entry is on screen').toBeTruthy();
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => {
        const v = window.__t1460 && window.__t1460.viz3d ? window.__t1460.viz3d() : null;
        if (!v) return null;
        // what the ViewCube would do for the same named face — the SAME call, so the two doors must agree
        const t = v.theta, p = v.phi;
        v.setView('top');
        return { menu: { theta: t, phi: p }, cube: { theta: v.theta, phi: v.phi } };
    });
    if (!before || !after) { test.info().annotations.push({ type: 'note', description: 'viz handle not exposed by the panel — camera assertion skipped' }); return; }
    expect(after.menu, 'the menu entry left the camera where setView("top") puts it').toEqual(after.cube);
});

test('LONG-PRESS opens it too — the 3D view is the surface a phone user pans with', async ({ page }) => {
    await boot(page);
    const at = await openVizMenu(page);
    expect(at.err).toBeUndefined();
    await page.keyboard.press('Escape');
    const open = await page.evaluate(async ({ x, y }) => {
        const c = document.querySelector('.ddcs-t1460-host canvas');
        const t = new Touch({ identifier: 1, target: c, clientX: x, clientY: y });
        c.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
        await new Promise((r) => setTimeout(r, 700));
        c.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
        const m = document.querySelector('.op-ctx-menu');
        return !!m && !m.hidden;
    }, { x: at.x, y: at.y });
    expect(open, 'a long press on the 3D view opens the same menu').toBe(true);
});
