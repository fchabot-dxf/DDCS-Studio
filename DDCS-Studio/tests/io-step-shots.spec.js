import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1500, height: 950 } });
test('E3 screenshots: the SETUP menu I/O section + an io_step block in the Blocks tab', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.openWiz);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks

    // (1) the SETUP dropdown open — the I/O quick-actions that open the grouped wizard
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.toolbar-dropdown'));
        const setup = btns.find((d) => /Setup/.test(d.querySelector('button')?.getAttribute('title') || '') || /Setup/.test(d.textContent));
        if (setup) { const c = setup.querySelector('.toolbar-dropdown-content'); if (c) { c.style.display = 'block'; c.style.visibility = 'visible'; c.style.opacity = '1'; } }
    });
    await page.waitForTimeout(300);
    const menuShot = await page.evaluate(() => !!document.querySelector('.toolbar-dropdown-content button[onclick*="user_io_step"]'));
    await page.screenshot({ path: 'scratchpad/io_step_setup_menu.png', clip: { x: 0, y: 0, width: 700, height: 700 } });

    // (2) an io_step op → the Blocks tab → the block renders
    let blocks = { switched: false, hasBlock: false };
    try {
        await page.evaluate(async () => {
            const { recordOp } = await import('/blocks/opRecord.js');
            recordOp('user_io_step', { mode: 'input', inputRef: 'raw', waitPin: 3, mode2: 'rise', timeout: 0, var: '#5399' });
        });
        // click the BLOCKS tab (the real user gesture)
        await page.evaluate(() => { const t = Array.from(document.querySelectorAll('button, a, [role="tab"], .tab, [onclick]')).find((e) => /^\s*BLOCKS\s*$/i.test(e.textContent || '')); if (t) t.click(); });
        await page.waitForTimeout(1600);
        blocks = await page.evaluate(() => {
            const g = document.querySelector('.blocklyBlockCanvas, .blocklyWorkspace');
            const texts = Array.from(document.querySelectorAll('.blocklyText')).map((t) => t.textContent).join(' ');
            return { switched: !!(g && g.getBoundingClientRect().width > 0), blocklyText: texts.slice(0, 300), hasBlock: /I\/O Step|Wait Input|wait input|input/i.test(texts) };
        });
        await page.screenshot({ path: 'scratchpad/io_step_blockly.png' });
    } catch (e) { blocks.err = String((e && e.message) || e); }

    console.log('SETUP menu io_step buttons present: ' + menuShot + ' | Blockly: ' + JSON.stringify(blocks));
    expect(menuShot, 'the SETUP dropdown shows the I/O buttons that open user_io_step').toBe(true);
});
