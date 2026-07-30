import { test, expect } from '@playwright/test';

/**
 * t848 — RIDERS: (1) drill default = single; (2) pull-seed settings.machine.rapidRate from the dump G0-rate register;
 * (3) the gateway instrument estimate reads the ONE engine-trace time model (== the editor); (4) label humanization.
 */
test.beforeEach(async ({ page }) => { await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsStudio); });

test('(1) DRILL DEFAULT = single (one hole); explicit grid still six — saved projects carry their pattern', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
        const { BORE_DEFAULTS } = await import('/blocks/dataOps/boreData.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const base = { toolDia: 6, holeDia: 6, depth: 10, peck: 3 };
        // t1385 — COUNT THE HOLES DRILLED, not the `G0 X` LINES. The old proxy worked while the pattern was stamped at
        // build time (six holes → six rapid lines); `holecycle` walks the pattern in a macro LOOP, so a 6-hole grid and a
        // 1-hole single both emit exactly ONE `G0 X` line and the text count says 1 for everything. The claim being made
        // here is about how many holes the machine drills, so it is now measured where that is actually visible: the
        // DISTINCT XY positions at which the traced path cuts downward.
        const holesIn = (text) => {
            const segs = traceToolpath(text).segments || [];
            const at = new Set();
            for (const s of segs) if (!s.rapid && s.z2 < s.z1) at.add(`${(+s.x2.toFixed(3)) + 0},${(+s.y2.toFixed(3)) + 0}`);
            return at.size;
        };
        return {
            def: DRILL_DEFAULTS.pattern, bore: BORE_DEFAULTS.pattern,
            defHoles: holesIn(emitMapped(drillStack({ ...base })).text),
            gridHoles: holesIn(emitMapped(drillStack({ ...base, pattern: 'grid' })).text),
        };
    });
    expect(r.def, 'drill DEFAULTS default = single').toBe('single');
    expect(r.bore, 'bore DEFAULTS default = single (coupled)').toBe('single');
    expect(r.defHoles, 'default drill = 1 hole').toBe(1);
    expect(r.gridHoles, 'explicit grid still drills 6 holes (saved projects unaffected)').toBe(6);
});

test('(2) PULL-SEED: the dump G0-rate → geometry.rapidRate (Expert #63 index; V4.1/DM500 by-name resolver)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { mapExpertGeometry, byNameIndices } = await import('/data/dumpImport.js');
        const params = []; params[63] = 4500;                      // Expert #63 = G00 speed
        const expert = mapExpertGeometry(params).rapidRate;
        const idx = byNameIndices({ 103: { name: 'G0 Speed' }, 108: { name: 'X axis home search speed' } }).rapid;   // V4.1 by-name
        return { expert, idx };
    });
    expect(r.expert, 'Expert #63 seeds rapidRate').toBe(4500);
    expect(r.idx, 'the by-name resolver finds the G0-speed register (V4.1/DM500)').toBe(103);
});

test('(2b) the seeded rapidRate stays a user-editable settings.machine field (honest default when absent)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { mapExpertGeometry } = await import('/data/dumpImport.js');
        const absent = mapExpertGeometry([]).rapidRate;             // no register → null → keep the default
        return { absent, setting: (window.ddcsGetSettings().machine || {}).rapidRate };
    });
    expect(r.absent, 'absent register → null (keep the honest default)').toBeNull();
    expect(r.setting, 'settings.machine.rapidRate is the editable field, default 6000').toBe(6000);
});

test('(3) the GATEWAY estimate == the EDITOR estimate (one engine-trace time model)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { instrument } = await import('/shared/js/instrument/instrument.js');
        const { estimateProgram } = await import('/engine/timeEstimate.js');
        const prog = 'G21 G90\nG0 X50\nG1 X150 Y100 F800\nG1 X150 Y0\nG0 Z5\nM30';
        const gateway = instrument(prog, { rapid: 6000 }).map.total_est_time_s;
        const editor = estimateProgram(prog, { rapidRate: 6000 }).seconds;
        return { gateway, editor };
    });
    expect(r.gateway, 'the gateway total_est_time_s reads the same engine estimate as the editor').toBeCloseTo(r.editor, 1);
});

test('(4) LABELS: drill/bore x0/y0/offZ + the entry pair are humanized (no bare camelCase)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { DRILL_BINDINGS } = await import('/blocks/dataOps/drillData.js');
        const pick = (p) => (DRILL_BINDINGS.find((b) => b.param === p) || {});
        return { x0: pick('x0').label, y0: pick('y0').label, offZ: pick('offZ').label };
    });
    expect(r.x0, 'x0 → human label').toBe('Pattern origin X');
    expect(r.y0).toBe('Pattern origin Y');
    expect(r.offZ).toBe('Z offset');
});
