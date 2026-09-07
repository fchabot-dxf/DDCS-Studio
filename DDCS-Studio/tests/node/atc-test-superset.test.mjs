import { test, expect } from './support/harness.mjs';

/**
 * ATC-TEST E0 (t556) — the data-op twin seam (the homing-port toolkit applied to atc_test). atcTestStack(params,{superset:true})
 * carries BOTH mode arms GUARDED by `mode` (drawbar | pockets). pruneGuards collapses to the chosen mode → BYTE-IDENTICAL to
 * the concrete build. The pockets arm UNROLLS the current magazine; the drawbar arm is the counted GOTO loop — the twin (E1)
 * re-unrolls the pockets from the CURRENT settings.atc.magazine + sources the drawbar/sensor M-codes from Settings→ATC I/O.
 * E0 gates the MODE selection: prune==concrete across modes × magazine sizes (0/1/3/8) × drawbar counts.
 *
 * t2691 — TIER MIGRATION WORK PACKAGE C: moved browser→node. No registerUserOp/builderOf here — both tests call
 * atcTestStack directly.
 */
test('E0 GATE: prune(atcTestStack superset) == concrete, byte-identical across modes × magazine sizes × drawbar counts', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestStack, atcTestEffectiveMode } = await import('/wizards/atcTestWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const mkMag = (n) => Array.from({ length: n }, (_, i) => ({ tool: i + 1, x: 100 + i * 10, y: 50, z: -20 }));
        const combos = [];
        for (const mode of ['drawbar', 'pockets', undefined]) for (const mag of [0, 1, 3, 8]) for (const cycles of [1, 10, 25]) {
            combos.push({ mode, magazine: mkMag(mag), cycles, dwellMs: 500, first: 1, count: mag || 1, zClear: 0, descend: mag === 3 });
        }
        let diffs = 0, first = null, guardMax = 0, leftover = 0;
        for (const c of combos) {
            const sup = atcTestStack(c, { superset: true });
            guardMax = Math.max(guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            pruneGuards(sup, { ...c, mode: atcTestEffectiveMode(c) });
            if (JSON.stringify(sup).includes('"type":"guard"')) leftover++;
            const a = emitMapped(sup).text, b = emitMapped(atcTestStack(c)).text;
            if (a !== b) { diffs++; if (!first) { const al = a.split('\n'), bl = b.split('\n'); let i = 0; while (i < al.length && al[i] === bl[i]) i++; first = { mode: c.mode, mag: c.magazine.length, cycles: c.cycles, line: i, sup: al.slice(i, i + 3), con: bl.slice(i, i + 3) }; } }
        }
        return { diffs, first, guardMax, leftover, combos: combos.length };
    });
    if (r.first) console.log('ATC-TEST E0 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 3 modes × 4 magazine sizes × 3 drawbar counts').toBe(36);
    expect(r.guardMax, 'the superset carries the 2 mode guards (drawbar/pockets)').toBe(2);
    expect(r.leftover, 'prune leaves ZERO guard blocks (fully collapsed)').toBe(0);
    expect(r.diffs, 'prune(superset) is BYTE-IDENTICAL to concrete atcTestStack for ALL combos (byte-diff = ZERO)').toBe(0);
});

/** The concrete/default path is UNCHANGED by the E0 seam — atcTestStack() (no opts) emits exactly as before. */
test('E0 golden: the concrete build (no superset) is unchanged — a plain drawbar / pockets stack, no guard blocks', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestStack } = await import('/wizards/atcTestWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const drawbar = atcTestStack({ mode: 'drawbar', cycles: 10 });
        const pockets = atcTestStack({ mode: 'pockets', magazine: [{ tool: 1, x: 100, y: 50, z: -20 }] });
        return {
            drawbarEmit: emitMapped(drawbar).text, pocketsEmit: emitMapped(pockets).text,
            drawbarGuard: JSON.stringify(drawbar).includes('"type":"guard"'), pocketsGuard: JSON.stringify(pockets).includes('"type":"guard"'),
        };
    });
    expect(r.drawbarGuard, 'the concrete drawbar build has NO guard blocks (superset-only)').toBe(false);
    expect(r.pocketsGuard, 'the concrete pockets build has NO guard blocks').toBe(false);
    expect(r.drawbarEmit, 'drawbar still cycles the drawbar (M154/M155)').toMatch(/M154|Drawbar/);
    expect(r.pocketsEmit, 'pockets still visits the magazine pocket').toMatch(/Pocket 1/);
});
