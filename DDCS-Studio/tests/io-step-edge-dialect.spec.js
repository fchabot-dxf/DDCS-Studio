import { test, expect } from '@playwright/test';

/**
 * SETUP/IO increment 2 — the Wait-Input EDGE field is DIALECT-AWARE (the human confirmed). A DDCS post reads a LEVEL, so it
 * shows High/Low only; RS274/grblHAL (M66 L1-L4) show all four (Rise/Fall/High/Low). The emit is unchanged (only the FORM
 * options narrow — a hidden rise/fall still emits high/low per the atom mapping).
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('the Edge field shows High/Low on a DDCS post and all 4 on RS274; emit unchanged', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);

    const edgeButtons = async (profile, shotName) => {
        await page.evaluate(async (p) => { const { setActivePostId } = await import('/wizards/dialects/index.js'); setActivePostId(p); }, profile);
        await page.evaluate(() => window.openWiz('user_io_step', 'input'));
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(300);
        const res = await page.evaluate(() => {
            const seg = document.querySelector('#wiz_user_form [data-param="mode2"]');
            const btns = seg ? Array.from(seg.querySelectorAll('.seg-btn')).map((b) => b.textContent.trim()) : [];
            const onBtn = seg ? (seg.querySelector('.seg-btn.seg-on') || {}).textContent : null;
            return { btns, onBtn: onBtn ? onBtn.trim() : null };
        });
        if (shotName) await page.locator('#wiz_user').screenshot({ path: shotName });
        return res;
    };

    const expert = await edgeButtons('ddcs-expert-m350', 'scratchpad/io_step_edge_expert.png');
    const rs274 = await edgeButtons('rs274ngc', 'scratchpad/io_step_edge_rs274.png');

    // the fix touches ONLY the form options (ioEdgeOptions + the segmented widget) — NOT ioStepStack/the atoms/the emit, and
    // the segmented read() still returns the raw value (a hidden 'rise' stays 'rise'). So the emit is byte-identical; that is
    // pinned by io-step-emit.spec + io-step-twin.spec (re-run this turn), not re-asserted here through emitMapped's dialect.
    await page.evaluate(async () => { const { setActivePostId } = await import('/wizards/dialects/index.js'); setActivePostId('auto'); });
    console.log('Edge Expert: ' + JSON.stringify(expert) + ' | RS274: ' + JSON.stringify(rs274));

    expect(expert.btns, 'DDCS Expert shows High/Low only (level, not edge)').toEqual(['High', 'Low']);
    expect(expert.onBtn, 'a stored "rise" highlights High on Expert (alias — value unchanged)').toBe('High');
    expect(rs274.btns, 'RS274 shows all four edges').toEqual(['Rise', 'Fall', 'High', 'Low']);
    expect(rs274.onBtn, 'RS274 highlights the stored "rise"').toBe('Rise');
});
