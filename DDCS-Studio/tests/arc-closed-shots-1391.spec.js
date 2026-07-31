import { test, expect } from '@playwright/test';

/**
 * t1391 — THE ARC CLOSED, SEEN. Two surfaces changed and both are checked as pixels, not only as asserts.
 *
 * The retirement's user-visible half is the PALETTE: three literal hole atoms existed at the start of this arc
 * (`drill`, `bore`, and t1379's `holepeck`) and one parametric atom now stands in their place. The other is the
 * too-small POCKET emit, which is the arm act 1 re-pointed — the one program in the app whose G-code this act changed.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const SHOTS = 'test-results/t1391-shots';

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('SHOT — the Toolpaths palette carries ONE parametric hole atom and no literal ones', async ({ page }) => {
    await boot(page);
    const tab = page.locator('[data-tab="blocks"], button:has-text("Blocks")').first();
    if (await tab.count()) await tab.click();
    await page.waitForFunction(() => window.Blockly && Blockly.getMainWorkspace(), null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const { BLOCKS, PALETTE } = await import('/wizards/ops/index.js');
        const hole = PALETTE.filter((d) => /hole|drill|bore/i.test(d.type)).map((d) => `${d.type} (${d.label})`);
        return {
            hole,
            retired: ['drill', 'bore', 'holepeck'].filter((t) => !!BLOCKS[t]),
            holeCycleLabel: BLOCKS.holecycle && BLOCKS.holecycle.label,
        };
    });
    expect(r.retired, 'no literal hole atom is registered — all three retired over the arc').toEqual([]);
    expect(r.holeCycleLabel, 'and the one that remains is the parametric family').toBe('Holes (parametric)');
    // Nothing hole-shaped survives beyond the successor and the drill CYCLE atoms (the native G81-85 canned cycles, which
    // are a different thing entirely — the controller's own cycles, not a Studio-emitted body).
    expect(r.hole.filter((h) => !/^holecycle |^drillcycle /.test(h)), `only the successor + the native canned cycles: ${JSON.stringify(r.hole)}`).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/1-palette-no-literals.png`, fullPage: false });
});

test('SHOT — the too-small pocket emit: the arm act 1 re-pointed, drawn and declared', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        // t1444 — Ø == tool, not smaller. This shot exists to picture the RE-POINTED plunge arm tracing whole and
        // cutting; at Ø4 the pocket now refuses and the picture would have shown an empty canvas and a red
        // refusal — evidence for a different claim entirely. The arm did not move, its domain did, so the shot
        // follows it to the case it still covers: a pocket the tool exactly fills.
        const text = emitMapped(pocketStack({ shape: 'circle', dia: 6, toolDia: 6, depth: 12, stepdown: 1, feed: 600, plunge: 150, clearance: 5 })).text;
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;grid-template-columns:520px 1fr;background:#0e1116;color:#dfe6ee';
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:0;padding:14px;font:11px/1.45 ui-monospace,monospace;overflow:auto;border-right:1px solid #232a33';
        pre.textContent = text;
        const viz = document.createElement('div');
        host.appendChild(pre); host.appendChild(viz);
        document.body.appendChild(host);
        const panel = createPreviewPanel(viz, { getGcode: () => text });
        panel.setGcode(text);
        await new Promise((res) => setTimeout(res, 900));
        const st = viz.querySelector('.pp-status');
        return { status: st ? st.textContent : null, isError: st ? st.classList.contains('has-error') : null };
    });
    // The claims the picture is evidence FOR: it traces whole (not truncated) and it really cuts.
    expect(r.status, 'the fallback preview reports real move counts, not a truncation').not.toMatch(/truncated/i);
    expect(r.isError, 'and is not in the error state').toBe(false);
    expect(r.status, 'a 12mm-deep 1mm-peck plunge is a lot of cuts').toMatch(/\d+ cuts/);
    await page.screenshot({ path: `${SHOTS}/2-toosmall-pocket-emit.png`, fullPage: false });
});
