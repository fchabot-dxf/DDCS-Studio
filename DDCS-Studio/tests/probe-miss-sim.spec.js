import { test, expect } from '@playwright/test';

/**
 * PROBE-MISS SAFETY — the SIM proof (t638). The whole point: on V4.1/DM500 a probe that never contacts must NOT write a
 * (wrong) WCS. (1) REAL EMIT: trace the V4.1 edge emit with NO stock in the probe path (guaranteed miss — the G31 travels its
 * full commanded distance) → the route takes the fail branch: the intermediate result #50 stays 0 (the `#50=[#1500+#6]` read
 * and the `G90 G92 X#50` WCS write are SKIPPED by the GOTO). (2) CONTROLLED: the exec engine correctly BRANCHES on both the
 * V4.1 no-space `...]GOTO1` and the DM500 word-op `...] GOTO1` compare forms — miss (DRO at full travel) branches, contact
 * (DRO short of travel) falls through to the write. (The engine's IF-GOTO parser gained no-space tolerance so V4.1 flow plays.)
 */
test('REAL EMIT — a simulated V4.1 probe MISS takes the fail branch; the WCS result #50 is NOT written', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { edgeStack } = await import('/wizards/edgeWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const code = emitMapped(edgeStack({ edge: 'left', probeDia: 6, safeZ: 5, overtravel: 3, feed: 100 }), { dialect: getDialect('ddcs-v41') }).text;
        const eng = new GcodeExecutionEngine({ autoAnswer: true });   // no stock → the probe runs its full commanded travel = MISS
        eng.trace(code);
        return { result: eng.vars.get(50), dro: eng.vars.get(1500), start: eng.vars.get(190), seek: eng.vars.get(8) };
    });
    expect(r.result, 'a V4.1 probe MISS leaves the result #50 unwritten (0) → the fail branch was taken, WCS NOT written').toBe(0);
    expect(r.dro, 'the DRO reached the full commanded travel (start + seek) — a genuine miss').toBeCloseTo(r.start + r.seek, 3);
});

test('CONTROLLED — the engine branches correctly on the V4.1 (no-space) AND DM500 (word-op) DRO-compare forms', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        // mimic the emitted compare: capture start (#190), a probe that leaves the DRO in #500, then the dir-'+' compare to the
        // full travel [start+seek-eps]; #50 is the "WCS write" reached only when the compare does NOT branch (a real contact).
        const prog = (dro, form) => [
            '#190=0', '#8=15', `#500=${dro}`, '#50=0',
            form === 'v41' ? 'IF #500>=[#190+#8-0.05]GOTO1' : 'IF #500GE[#190+#8-0.05] GOTO1',
            '#50=99', 'GOTO2', 'N1', 'N2', 'M30',
        ].join('\n');
        const run = (dro, form) => { const e = new GcodeExecutionEngine({ autoAnswer: true }); e.trace(prog(dro, form)); return e.vars.get(50); };
        return {
            v41_miss: run(15, 'v41'),    // DRO at full travel (15) → branch → #50 stays 0
            v41_contact: run(10, 'v41'), // DRO short (10) → no branch → #50 = 99
            dm_miss: run(15, 'dm'),      // DM500 word-op GE
            dm_contact: run(10, 'dm'),
        };
    });
    expect(r.v41_miss, 'V4.1 no-space compare: a MISS (DRO=full travel) branches → result not written').toBe(0);
    expect(r.v41_contact, 'V4.1 no-space compare: a CONTACT (DRO short) does NOT branch → result written').toBe(99);
    expect(r.dm_miss, 'DM500 word-op compare: a MISS branches → result not written').toBe(0);
    expect(r.dm_contact, 'DM500 word-op compare: a CONTACT does NOT branch → result written').toBe(99);
});
