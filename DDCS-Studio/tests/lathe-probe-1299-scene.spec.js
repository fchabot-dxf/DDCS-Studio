import { test, expect } from '@playwright/test';

/**
 * t1299 — split from lathe-probe-1299.spec.js at the t2689 tier migration (batch 2). Every other test in that file
 * moved to tests/node/lathe-probe-1299.test.mjs; this one stayed because it opens a real wizard (window.openWiz),
 * waits for the Three.js scene to settle, and reads window.__ddcsLastViz — a real render, not a pure import()+
 * evaluate.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind = 'lathe') => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: k, chuck: 'axis' }, false);
    }, kind);
};

test('THE SCENE, BOTH WAYS — a stylus against the bar on a lathe, and the mill probes untouched', async ({ page }) => {
    await boot(page, 'lathe');
    await page.evaluate(() => window.openWiz('user_lathe_odprobe'));
    await page.waitForTimeout(1800);
    const lathe = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        return {
            tool: v && v._simTool && v._simTool.type,
            ruby: !!(v && v._animParts && v._animParts.ruby),      // the touching ball, red, as on a mill probe
            stock: v && v._stock && { shape: v._stock.shape, axis: v._stock.axis },
            probeMoves: v && v._parsed && v._parsed.stats && v._parsed.stats.probe,
        };
    });
    expect(lathe.tool, 'a probe program shows a PROBE, not a turning insert').toBe('probe');
    expect(lathe.ruby, 'with the ruby ball that does the touching').toBe(true);
    expect(lathe.stock, 'against the bar, lying along the bed').toEqual({ shape: 'cylinder', axis: 'z' });
    // THE MILL PROBES ARE NOT TOUCHED: never frame-gated, and their own op still emits its own sequence.
    await boot(page, 'mill');
    const mill = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_edge_data');
        const nc = def ? String(emitProgram(builderOf('user_edge_data')({ ...uo.defaultParams(def) }))) : '';
        return {
            found: !!def, gatedOnMill: G.frameWhy('user_edge_data'), gatedOnLathe: G.frameWhy('edge'),
            hasProbe: /G31/.test(nc), hasWrite: /#\[#70/.test(nc), stopsSpindle: /\bM5\b/.test(nc),
        };
    });
    expect(mill.found, 'the mill edge twin is registered as it always was').toBe(true);
    expect(mill.gatedOnMill, 'a mill probe is never frame-gated').toBe('');
    expect(mill.gatedOnLathe).toBe('');
    expect(mill.hasProbe, 'and still probes').toBe(true);
    expect(mill.hasWrite, 'and still writes its datum through the same seam').toBe(true);
    // …and the lathe family's spindle rule is the LATHE FAMILY'S. A mill edge probe was not given one, because a
    // mill's spindle is not what makes this dangerous — a chuck spinning the WORK against the stylus is.
    expect(mill.stopsSpindle, 'the mill probe is exactly as it was').toBe(false);
});
