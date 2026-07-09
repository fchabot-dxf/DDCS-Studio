import { test, expect } from '@playwright/test';

/**
 * ATC-CHANGE E0 (t562) — the data-op twin seam (the homing/atc_test toolkit applied to atc_change, the hardest of the ATC
 * set). atcChangeStack(params,{superset:true}) carries EVERY method arm GUARDED by the DERIVED `_arm` key — the EFFECTIVE
 * routing (method × callMacro → the 5 distinct builders: m6 / manual / macroCall / firmware / inlineTnc). pruneGuards collapses
 * to the chosen arm → BYTE-IDENTICAL to the concrete build. The inlineTnc arm reads Settings → ATC I/O LIVE (by design, the
 * codes stay out of the marker); the twin (E1) re-derives `_arm` + regenerates the live arm. E0 gates the ROUTING: prune ==
 * concrete across all 5 methods × callMacro × magazine/I-O configs.
 */
const CFG_EMPTY = { atc: {}, outputs: [], inputs: [] };
const CFG_ATC = {
    atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }, { tool: 2, x: 150, y: 50, z: -20, pocket: 2 }], grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10 },
    outputs: [{ type: 'drawbar', onCode: 'M154', offCode: 'M155' }],
    inputs: [{ group: 'atc', id: 'drawbar_released_atc', waitCode: 'M301' }, { group: 'atc', id: 'drawbar_clamped_atc', waitCode: 'M302' }, { group: 'atc', id: 'spindle_stopped_atc', waitCode: 'M300' }],
};

test('E0 GATE: prune(atcChangeStack superset) == concrete, byte-identical across method × callMacro × config', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ CFG_EMPTY, CFG_ATC }) => {
        const { atcChangeStack, atcChangeEffectiveArm } = await import('/wizards/atcChangeWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const methods = ['m6', 'firmware', 'manual', 'generic', 'disk'];
        const callMacros = [true, false, undefined];
        const base = { x: 120, y: 80, z: -5, zClear: 3, fixedT: 4, orient: true };
        let diffs = 0, first = null, guardMax = 0, leftover = 0, combos = 0;
        for (const cfg of [CFG_EMPTY, CFG_ATC]) {
            window.__atcS = cfg; window.ddcsGetSettings = () => window.__atcS;
            for (const method of methods) for (const callMacro of callMacros) {
                combos++;
                const p = { ...base, method, ...(callMacro === undefined ? {} : { callMacro }) };
                const sup = atcChangeStack(p, { superset: true });
                guardMax = Math.max(guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
                pruneGuards(sup, { ...p, _arm: atcChangeEffectiveArm(p) });
                if (JSON.stringify(sup).includes('"type":"guard"')) leftover++;
                const a = emitMapped(sup).text, b = emitMapped(atcChangeStack(p)).text;
                if (a !== b) { diffs++; if (!first) { const al = a.split('\n'), bl = b.split('\n'); let i = 0; while (i < al.length && al[i] === bl[i]) i++; first = { cfg: cfg === CFG_ATC ? 'atc' : 'empty', method, callMacro, arm: atcChangeEffectiveArm(p), line: i, sup: al.slice(i, i + 3), con: bl.slice(i, i + 3) }; } }
            }
        }
        return { diffs, first, guardMax, leftover, combos };
    }, { CFG_EMPTY, CFG_ATC });
    if (r.first) console.log('ATC-CHANGE E0 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 5 methods × 3 callMacro × 2 configs').toBe(30);
    expect(r.guardMax, 'the superset carries the 5 method arms (m6/manual/macroCall/firmware/inlineTnc)').toBe(5);
    expect(r.leftover, 'prune leaves ZERO guard blocks (fully collapsed)').toBe(0);
    expect(r.diffs, 'prune(superset) is BYTE-IDENTICAL to concrete atcChangeStack for ALL combos (byte-diff = ZERO)').toBe(0);
});

test('E0 golden: the concrete build (no superset) is unchanged — a plain method stack, no guard blocks; the routing is one-source', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ CFG_ATC }) => {
        const { atcChangeStack, atcChangeEffectiveArm } = await import('/wizards/atcChangeWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        window.__atcS = CFG_ATC; window.ddcsGetSettings = () => window.__atcS;
        const cases = [
            { p: { method: 'm6', fixedT: 2 }, arm: 'm6', want: /M6/ },
            { p: { method: 'manual' }, arm: 'manual', want: /Manual Tool Change/ },
            { p: { method: 'firmware', callMacro: true }, arm: 'macroCall', want: /installed T\.nc/ },
            { p: { method: 'firmware', callMacro: false }, arm: 'firmware', want: /O10102/ },
            { p: { method: 'generic', callMacro: false }, arm: 'inlineTnc', want: /INLINED/ },
        ];
        return cases.map((c) => {
            const stack = atcChangeStack(c.p);
            const emit = emitMapped(stack).text;
            return { arm: atcChangeEffectiveArm(c.p), expectArm: c.arm, guard: JSON.stringify(stack).includes('"type":"guard"'), match: c.want.test(emit) };
        });
    }, { CFG_ATC });
    for (const c of r) {
        expect(c.guard, `the concrete ${c.expectArm} build has NO guard blocks (superset-only)`).toBe(false);
        expect(c.arm, `the routing resolves the expected arm (${c.expectArm})`).toBe(c.expectArm);
        expect(c.match, `the ${c.expectArm} arm emits its signature body`).toBe(true);
    }
});
