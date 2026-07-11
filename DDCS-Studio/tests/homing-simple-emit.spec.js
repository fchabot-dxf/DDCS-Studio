import { test, expect } from '@playwright/test';

/**
 * t536 HOMING part 2 — the human's exact case: a SAVED method:'native' config. The wizard now IGNORES the saved method
 * and emits a SHORT, READABLE G31 block (no M98, no 7-read "debounce" vote, no GOTO/label soup, no ±10000). Both Z signs
 * seek TOWARD the declared top (backfilled zMaxHome). Verified as the ordered emit lines + a real-app code-preview screenshot.
 */
test('a SAVED method:native + declared zMaxHome → the wizard emits the SHORT G31 block, both signs seek the top', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // the human's config: a SAVED per-axis method:'native' (survives the merge) + the backfilled zMaxHome + a +Z machine
        const cfg = (z) => ({ axes: ['z'], config: { z: { enable: true, method: 'native', seekFeed: 800, slowFeed: 100, backoff: 5 } }, machine: { z }, limits: { zMaxHome: true } });
        const e500 = emitMapped(homingStack(cfg(500))).text;
        const eNeg = emitMapped(homingStack(cfg(-120))).text;
        const lines500 = e500.split('\n').filter((l) => l.trim());
        return { e500, eNeg, nLines: lines500.length, lines: lines500 };
    });
    console.log('SIMPLE HOMING (z=+500, saved method:native):\n' + r.lines.join('\n'));

    // (1) the wizard IGNORES the saved native — G31, not M98
    expect(r.e500, 'the saved method:native is ignored → G31').toContain('G31');
    expect(r.e500, 'NOT the native M98 P501 (no toggle needed)').not.toContain('M98P501');
    // (2) the opaque O501 machinery is GONE — a human can read every line
    expect(r.e500, 'no 7-read debounce vote').not.toMatch(/debounce/i);
    expect(r.e500, 'no GOTO/label soup').not.toMatch(/GOTO\d|N4[0-9]/);
    expect(r.e500, 'no ±10000 magic seek distance').not.toContain('10000');
    expect(r.e500, 'no #102 seek-dist scratch var').not.toContain('#102');
    // (3) the SHORT readable shape (per-axis): fast G31 → back off → slow re-touch → datum + flag → clearance → G90
    expect(r.e500, 'incremental').toContain('G91');
    expect(r.e500, 'fast G31 seek toward the switch').toMatch(/G31 Z\d+(\.\d+)? F800 P#1051 L#1053/);   // +Z seeks UP toward zMaxHome
    expect(r.e500, 'back off the switch (G01)').toMatch(/G01 Z-5 F100/);
    expect(r.e500, 'ONE slow G31 re-touch for accuracy (F100 is modal — set once by the back-off G01)').toMatch(/G31 Z7 P#1051 L#1053/);
    expect(r.e500, 'set the Z machine-coord datum').toContain('#882=0');
    expect(r.e500, 'set the Z homed flag').toContain('#1517=1');
    expect(r.e500, 'back to absolute').toContain('G90');
    // it IS short — a readable block, not a macro (well under the old ~30-line O501 re-derivation)
    expect(r.nLines, 'the per-axis homing is a SHORT readable block').toBeLessThan(15);
    // (4) BOTH signs seek UP toward the declared top (positive Z seek)
    expect(r.eNeg, 'z=-120 also seeks UP toward the declared top (positive G31 Z)').toMatch(/G31 Z\d+(\.\d+)? F800/);
});

test.use({ viewport: { width: 1300, height: 950 } });
test('REAL APP: a saved-native config code preview shows the SHORT G31 block per axis (screenshot)', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_studio_settings', JSON.stringify({
            machine: { x: 600, y: 600, z: 500, workOrigin: { x: 0, y: 0, z: 0 } },
            inputs: [{ id: 'probe', type: 'probe', label: '3D Probe', pin: 5, level: 0 }, { id: 'setter', type: 'setter', label: 'Tool Setter', pin: 6, level: 0 }],
            limits: {},
            homing: { philosophy: 'sequential', axes: { z: { enable: true, order: 1, method: 'native', seekFeed: 800, slowFeed: 100, backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } },
        }));
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const code = await page.evaluate(() => document.getElementById('wiz_homing_code').textContent || '');
    { const _b = await page.locator('#wiz_homing').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_simple_g31.png', clip: _b }); }   // t710 clip capture (rAF-starvation dodge)
    console.log('CODE PREVIEW:\n' + code);
    expect(code, 'the code preview shows G31 (the saved native is ignored — no toggle)').toContain('G31');
    expect(code, 'NOT M98 P501 in the preview').not.toContain('M98P501');
    expect(code, 'no GOTO soup in the preview').not.toMatch(/GOTO\d/);
});
