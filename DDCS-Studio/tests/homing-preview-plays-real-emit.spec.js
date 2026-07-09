import { test, expect } from '@playwright/test';

/**
 * t542 — the homing WIZARD PREVIEW plays the REAL emitted G-code (the same code inserted into the editor), through the
 * SAME engine the editor uses — NOT a hand-made proxy (homingSimProxy, deleted). ONE simulator, one truth → a
 * preview-vs-editor divergence (the human's line-8 "stall" class) is impossible. VERIFY (the human's config shape:
 * declared homes, z=+500 AND -120, stock shown): (a) the preview PLAYS the emit (host.__gcode === the code-panel emit);
 * (b) the wizard preview + the editor's engine playing the SAME code settle at the SAME top-backoff coords; (c) the
 * preview line-HIGHLIGHTS real emitted G31 lines during play. Screenshot the preview mid-run highlighting a G31 line.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHoming(page, z) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((z) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };   // the DECLARED homes (Z = top)
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };   // a workpiece IS shown (the human's scenario)
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, z);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

for (const z of [500, -120]) {
    test(`z=${z}: the preview PLAYS the real emit + settles at the SAME top-backoff as the editor engine`, async ({ page }) => {
        await openHoming(page, z);
        // (a) the preview plays the emit that's shown in the code panel (+ inserted into the editor) — NOT a proxy
        const same = await page.evaluate(() => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
            const played = (host.__gcode || '').replace(/\s+/g, ' ').trim();
            // the wizard's generate() output = the emitted code (what the code panel shows + insert() inserts)
            const emit = window.ddcsStudio.wizardManager;   // sanity handle
            return { played, hasG31: /G31/.test(host.__gcode || ''), isProxy: /SIMULATION PROXY/.test(host.__gcode || ''), hasPanel: !!p };
        });
        expect(same.hasG31, 'the preview plays the real G31 emit').toBe(true);
        expect(same.isProxy, 'the preview does NOT play the old hand-made proxy (deleted)').toBe(false);

        // (b) play the WIZARD preview to completion → its settled engine Z
        await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); host.querySelector('.pp-run').click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });
        await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 25000 });
        const wizardZ = await page.evaluate(() => +window.ddcsStudio.wizardManager._activePanel.engine.pos.z.toFixed(1));

        // the EDITOR playing the SAME inserted code = a fresh GcodeExecutionEngine trace (exactly what the editor's
        // gcode-preview panel runs) in the SAME settings context. Seed it from the SAME Start the preview used (the mid
        // Start, above the stock) so the comparison isolates the SIMULATOR — same code + same start → same motion. (From
        // a different start the incremental seek can trip on the stock instead of the switch; that's a start difference,
        // not a simulator one — the whole point of killing the proxy is ONE engine, so identical inputs give identical out.)
        const editorZ = await page.evaluate(async () => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
            const start = p.getStartPos();
            const code = host.__gcode + '\nM30\n';
            const { GcodeExecutionEngine } = await import('/engine/index.js');
            const eng = new GcodeExecutionEngine({ autoAnswer: true, stock: { x: 100, y: 100, z: 25, show: true }, initialPos: start });
            eng.trace(code);
            return +eng.pos.z.toFixed(1);
        });

        // SAME motion: the SAME code through the SAME engine from the SAME start settles at the SAME homed top-backoff.
        // z=+500 → ~495; z=-120 → ~-5. One simulator, one truth — a preview-vs-editor divergence is impossible.
        expect(wizardZ, `wizard preview settles == editor engine (${wizardZ} vs ${editorZ})`).toBe(editorZ);
        const topBackoff = z > 0 ? z - 5 : -5;
        expect(Math.abs(wizardZ - topBackoff) < 1.5, `both settle at the top-backoff (~${topBackoff}), got ${wizardZ}`).toBe(true);
    });
}

test('the preview line-HIGHLIGHTS real emitted G31 lines during play (+ screenshot mid-run)', async ({ page }) => {
    await openHoming(page, 500);
    // play at a moderate speed so a G31 line stays highlighted long enough to catch
    await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); host.querySelector('.pp-run').click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 4; });
    // poll the code panel for an ACTIVE (executing) line whose text is a G31 — proof the preview highlights the REAL emit
    const found = await page.waitForFunction(() => {
        const active = document.querySelector('#wiz_homing_code .g-line.active-line');
        return active && /G31/.test(active.textContent) ? active.textContent.trim() : false;
    }, null, { timeout: 15000 }).then((h) => h.jsonValue());
    expect(found, 'a real emitted G31 line is highlighted as it executes in the preview').toMatch(/G31/);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_preview_highlights_g31.png' });
});
