import { test, expect } from '@playwright/test';

/**
 * ATC-TABLE E0 (t568) — the data-op twin seam (the toolkit applied to atc_table, THE LAST WIZARD). atcTableStack(params,
 * {superset:true}) carries BOTH include sections GUARDED by the derived _lengths/_pockets/_pocketsNA keys; pruneGuards
 * collapses to the chosen toggles → BYTE-IDENTICAL to the concrete build. Each section UNROLLS its rows from the tools[]/
 * magazine[]. E0 gates the toggle routing: prune == concrete across include toggles × table sizes × profiles.
 */
const mkTools = (n) => Array.from({ length: n }, (_, i) => ({ num: i + 1, length: 40 + i * 3, name: 'T' + (i + 1) }));
const mkMag = (n) => Array.from({ length: n }, (_, i) => ({ pocket: i + 1, x: 100 + i * 10, y: 50, z: -20 - i }));

test('E0 GATE: prune(atcTableStack superset) == concrete, byte-identical across toggles × table sizes × profiles', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ }) => {
        const { atcTableStack, atcTableGuardKeys } = await import('/wizards/atcTableWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { setActiveProfile, DEFAULT_PROFILE_ID } = await import('/shared/js/profiles/controllerProfiles.js');
        const mkTools = (n) => Array.from({ length: n }, (_, i) => ({ num: i + 1, length: 40 + i * 3, name: 'T' + (i + 1) }));
        const mkMag = (n) => Array.from({ length: n }, (_, i) => ({ pocket: i + 1, x: 100 + i * 10, y: 50, z: -20 - i }));
        let diffs = 0, first = null, guardMax = 0, leftover = 0, combos = 0;
        for (const profile of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(profile);
            for (const nt of [0, 1, 5]) for (const np of [0, 3, 8]) for (const iL of [true, false]) for (const iP of [true, false]) {
                combos++;
                const p = { tools: mkTools(nt), magazine: mkMag(np), includeLengths: iL, includePockets: iP };
                const sup = atcTableStack(p, { superset: true });
                guardMax = Math.max(guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
                pruneGuards(sup, { ...p, ...atcTableGuardKeys(p) });
                if (JSON.stringify(sup).includes('"type":"guard"')) leftover++;
                const a = emitMapped(sup).text, b = emitMapped(atcTableStack(p)).text;
                if (a !== b) { diffs++; if (!first) { const al = a.split('\n'), bl = b.split('\n'); let i = 0; while (i < al.length && al[i] === bl[i]) i++; first = { profile, nt, np, iL, iP, line: i, sup: al.slice(i, i + 3), con: bl.slice(i, i + 3) }; } }
            }
        }
        setActiveProfile(DEFAULT_PROFILE_ID);
        return { diffs, first, guardMax, leftover, combos };
    }, {});
    if (r.first) console.log('ATC-TABLE E0 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 2 profiles × 3 tool sizes × 3 pocket sizes × 2×2 toggles').toBe(72);
    expect(r.guardMax, 'the superset carries the 3 section guards (_lengths/_pockets/_pocketsNA)').toBe(3);
    expect(r.leftover, 'prune leaves ZERO guard blocks').toBe(0);
    expect(r.diffs, 'prune(superset) is BYTE-IDENTICAL to concrete atcTableStack for ALL combos').toBe(0);
});
