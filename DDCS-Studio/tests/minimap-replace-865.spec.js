import { test, expect } from '@playwright/test';

/**
 * t865 — MINIMAP REMOVED, REPLACED BY THE TWO CHEAP HONEST ANSWERS (ratified t862). The g-code minimap (not as good as
 * VS Code's, not worth the polish debt) is gone; its only real value — the execution position — is served better by:
 *   (1) a thin PROGRESS BAR on the preview, ONE SOURCE with the existing "Running line N/total" counter;
 *   (2) a FOLLOW-EXECUTION toggle on the editor (⤓, OFF by default) that auto-scrolls the running line into view.
 * The editorManager.onActiveLine seam (that once fed the minimap marker) STAYS — both replacements consume it.
 */
const READY = () => window.ddcsStudio && window.editorManager && window.ddcsGetSettings;

test.describe('t865 minimap → progress bar + follow toggle', () => {
    test('the minimap is fully removed: no strip/toggle/gm- DOM, the editor is full-width, the ⤓ follow toggle replaces it', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(READY, null, { timeout: 15000 });
        // zero minimap DOM anywhere
        await expect(page.locator('.gcode-minimap')).toHaveCount(0);
        await expect(page.locator('.gm-toggle')).toHaveCount(0);
        await expect(page.locator('.editor-container.has-minimap')).toHaveCount(0);
        // the editor is FULL-WIDTH: no minimap padding inset on the text layer (base is 20px; the minimap added ~70px)
        const padRight = await page.evaluate(() => {
            const el = document.getElementById('editor');
            return el ? parseFloat(getComputedStyle(el).paddingRight) : 999;
        });
        expect(padRight, 'the editor text layer carries no minimap right-inset (full-width)').toBeLessThan(40);
        // the replacement mounted: the ⤓ follow toggle exists in the editor chrome
        await expect(page.locator('.follow-toggle')).toHaveCount(1);
        await expect(page.locator('.follow-toggle')).toHaveText('⤓');
    });

    test('the preview PROGRESS BAR renders + fills during play, ONE SOURCE with the "Running line N/total" counter', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(READY, null, { timeout: 15000 });
        // a preview panel over a multi-line program, looping so it stays mid-run for a deterministic sample
        await page.evaluate(async () => {
            const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
            document.querySelectorAll('.__mp865').forEach((n) => n.remove());
            const host = document.createElement('div'); host.className = '__mp865';
            host.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:380px;z-index:99999';
            document.body.appendChild(host);
            const prog = 'G21 G90\n' + Array.from({ length: 60 }, (_, i) => `G1 X${i % 30} Y${(i * 2) % 40} F400`).join('\n') + '\nM30';
            const panel = createPreviewPanel(host, { getGcode: () => prog });
            window.__mp = panel;
            host.querySelector('.pp-loop').click();   // loop → always mid-run (no finish-race)
            host.querySelector('.pp-run').click();
        });
        // wait for a mid-run moment: the bar is visible + the chip shows the raw executing line ("N · <src>", t867 rider)
        await page.waitForFunction(() => {
            const bar = document.querySelector('.__mp865 .pp-progress');
            const st = document.querySelector('.__mp865 .pp-status');
            return bar && bar.classList.contains('on') && /^\d+ · /.test(st ? st.textContent : '') && window.__mp && window.__mp.engine && window.__mp.engine.totalLines > 0;
        }, null, { timeout: 15000 });
        // ONE SOURCE: the fill % and the chip's executing-line number (N) both derive from the SAME engine line index;
        // read them (+ engine.totalLines) in one snapshot and require fill == N/total.
        const snap = await page.evaluate(() => {
            const fill = document.querySelector('.__mp865 .pp-progress-fill');
            const st = document.querySelector('.__mp865 .pp-status').textContent;
            const n = +((st.match(/^(\d+) · /) || [])[1]);
            return { fillPct: parseFloat(fill.style.width) || 0, n, total: window.__mp.engine.totalLines };
        });
        expect(snap.fillPct, 'the fill has a real width during play').toBeGreaterThan(0);
        const expectedPct = (snap.n / snap.total) * 100;
        expect(Math.abs(snap.fillPct - expectedPct), `fill ${snap.fillPct}% == executing line ${snap.n}/${snap.total} (${expectedPct.toFixed(1)}%) — one source`).toBeLessThan(1.2);
        // stops → the bar hides (visible only while playing)
        const hidden = await page.evaluate(async () => {
            window.__mp.stop && window.__mp.stop();
            await new Promise((r) => setTimeout(r, 150));
            return document.querySelector('.__mp865 .pp-progress').classList.contains('on');
        });
        expect(hidden, 'stopped → the bar is hidden (only visible while playing)').toBe(false);
    });

    test('the FOLLOW toggle: OFF keeps the editor put (no-jump rule holds); ON scrolls the running line into view and tracks it', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 800 });
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsStudio && window.editorManager && document.querySelector('.follow-toggle'), null, { timeout: 15000 });
        // a long program so scrolling is meaningful; confirm the editor is actually scrollable
        const scrollable = await page.evaluate(() => {
            const prog = Array.from({ length: 220 }, (_, i) => `G1 X${i} Y${i} F600`).join('\n');
            window.editorManager.setValue(prog);
            const ed = document.getElementById('editor');
            ed.scrollTop = 0;
            return ed.scrollHeight > ed.clientHeight + 50;
        });
        expect(scrollable, 'the editor overflows (scrollable) with 220 lines').toBe(true);

        // OFF (default): a running line far down must NOT scroll the editor (the no-jump-while-playing rule)
        const offTop = await page.evaluate(() => {
            document.getElementById('editor').scrollTop = 0;
            window.editorManager.setActiveLine(180);
            return document.getElementById('editor').scrollTop;
        });
        expect(offTop, 'follow OFF → the editor stays put on a far running line (no jump)').toBeLessThan(30);

        // turn follow ON via the real button → it jumps to the CURRENT active line immediately
        await page.locator('.follow-toggle').click();
        await expect(page.locator('.follow-toggle')).toHaveClass(/on/);
        const onTop = await page.evaluate(() => document.getElementById('editor').scrollTop);
        expect(onTop, 'follow ON → the editor scrolled the running line (180) into view').toBeGreaterThan(offTop + 200);

        // still ON: a new running line near the TOP scrolls back up (it TRACKS execution)
        const upTop = await page.evaluate(() => {
            window.editorManager.setActiveLine(12);
            return document.getElementById('editor').scrollTop;
        });
        expect(upTop, 'follow ON → a new running line near the top scrolls the editor back up (tracks)').toBeLessThan(onTop - 200);

        // turn it OFF again → a far running line no longer moves the editor
        await page.locator('.follow-toggle').click();
        await expect(page.locator('.follow-toggle')).not.toHaveClass(/on/);
        const offAgain = await page.evaluate(() => {
            const before = document.getElementById('editor').scrollTop;
            window.editorManager.setActiveLine(200);
            return { before, after: document.getElementById('editor').scrollTop };
        });
        expect(offAgain.after, 'follow OFF again → a far running line does not move the editor').toBe(offAgain.before);
    });

    test('screenshots: 850px + desktop, idle + playing (progress bar + follow toggle)', async ({ page }, testInfo) => {
        for (const [label, w, h] of [['desktop', 1400, 900], ['850', 850, 760]]) {
            await page.setViewportSize({ width: w, height: h });
            await page.goto('http://localhost:3211');
            await page.waitForFunction(READY, null, { timeout: 15000 });
            await page.evaluate(() => window.editorManager.setValue(Array.from({ length: 60 }, (_, i) => `G1 X${i} Y${i} F600`).join('\n')));
            // IDLE
            await page.screenshot({ path: testInfo.outputPath(`t865-${label}-idle.png`) });
            // PLAYING — a preview panel over the program, mid-run (loop), so the progress bar shows
            await page.evaluate(async () => {
                const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
                document.querySelectorAll('.__mp865s').forEach((n) => n.remove());
                const host = document.createElement('div'); host.className = '__mp865s';
                host.style.cssText = 'position:fixed;left:12px;top:12px;width:520px;height:360px;z-index:99999;border:1px solid #333';
                document.body.appendChild(host);
                const prog = 'G21 G90\n' + Array.from({ length: 80 }, (_, i) => `G1 X${i % 30} Y${(i * 2) % 40} F400`).join('\n') + '\nM30';
                const panel = createPreviewPanel(host, { getGcode: () => prog });
                window.__mps = panel;
                host.querySelector('.pp-loop').click();
                host.querySelector('.pp-run').click();
            });
            await page.waitForFunction(() => {
                const bar = document.querySelector('.__mp865s .pp-progress');
                return bar && bar.classList.contains('on') && parseFloat(document.querySelector('.__mp865s .pp-progress-fill').style.width) > 5;
            }, null, { timeout: 15000 });
            await page.screenshot({ path: testInfo.outputPath(`t865-${label}-playing.png`) });
            await page.evaluate(() => { window.__mps && window.__mps.stop && window.__mps.stop(); document.querySelectorAll('.__mp865s').forEach((n) => n.remove()); });
        }
    });
});
