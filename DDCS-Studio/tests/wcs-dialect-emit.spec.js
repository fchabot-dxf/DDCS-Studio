import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * WCS DIALECT-AWARE RESTRUCTURE (t475 E0) — the WCS-set flow rides ONE `wcszero` atom (dialect.wcsZeroAtCurrent), resolved
 * per-post at EMIT. VERIFY: (1) M350 BYTE-IDENTICAL to the pre-restructure golden (the intermediate-var register form,
 * dump-grounded) across the sweep — ZERO diff. (2) NON-M350 emits the CORRECT per-dialect WCS-set (a CORRECTNESS CHANGE
 * from the old M350-hardcoded #880 leak): rs274/grbl → G10 L20; v41/dm500 → G90 G92; NOT #880. Captures the before/after
 * for the advisor's review.
 */
const GOLDEN = JSON.parse(fs.readFileSync('tests/fixtures/wcs-golden.json', 'utf8'));

test('M350 byte-identical (ZERO) + non-M350 the correct per-dialect WCS-set', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async (golden) => {
        const { wcsStack } = await import('/wizards/wcsWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const emit = (p, id) => emitMapped(wcsStack(p), { dialect: getDialect(id) }).text;   // emitMapped takes { dialect } (settings), NOT a bare post
        const SYS = ['0', '54', '55', '59'];
        const AXES = [{ axisX: true }, { axisX: true, axisY: true }, { axisX: true, axisY: true, axisZ: true }, { axisY: true, axisZ: true }];
        const SYNC = [{ sync: false }, { sync: true, slave: '3' }, { sync: true, slave: '4' }];
        const sweep = [];
        for (const sys of SYS) for (const ax of AXES) for (const sy of SYNC) sweep.push({ sys, ...ax, ...sy });

        let m350Diffs = 0, first = null;
        for (let i = 0; i < sweep.length; i++) {
            const a = emit(sweep[i], 'ddcs-expert-m350'), b = golden.m350[i].emit;
            if (a !== b) { m350Diffs++; if (!first) first = { p: sweep[i], a, b }; }
        }
        const after = {};
        for (const id of ['ddcs-v41', 'ddcs-v3-dm500', 'rs274ngc', 'grbl']) after[id] = emit({ sys: '54', axisX: true, axisY: true }, id);
        const rs274auto = emit({ sys: '0', axisX: true, axisY: true, axisZ: true }, 'rs274ngc');
        return { m350Diffs, first, after, rs274auto, cases: sweep.length };
    }, GOLDEN);

    if (r.first) console.log('M350 DIFF @ ' + JSON.stringify(r.first.p) + '\n--- NEW ---\n' + r.first.a + '\n--- GOLDEN ---\n' + r.first.b);
    console.log('=== NON-M350 AFTER (fixed G54, zero X+Y) ===');
    for (const id in r.after) console.log('[' + id + ' BEFORE]\n' + (GOLDEN.before[id] || 'n/a') + '\n[' + id + ' AFTER]\n' + r.after[id]);
    console.log('[rs274 auto XYZ]\n' + r.rs274auto);

    expect(r.cases).toBe(48);
    expect(r.m350Diffs, 'M350 emit is BYTE-IDENTICAL to the pre-restructure golden across the sweep (ZERO)').toBe(0);
    // non-M350 correctness: the dialect's PERSISTENT WCS-set, NOT the M350-hardcoded #880 and NOT the temporary G92
    expect(r.after['rs274ngc'], 'rs274 emits G10 L20').toContain('G10 L20 P1 X0 Y0');
    expect(r.after['rs274ngc'].includes('#880'), 'rs274 no longer leaks the M350 DRO #880').toBe(false);
    expect(r.after['grbl'], 'grbl emits G10 L20').toContain('G10 L20 P1 X0 Y0');
    // v41 — the persistent active WORK registers (#1506-1509=0), grounded in zeroxy/zeroall; NOT G92, NOT #880
    expect(r.after['ddcs-v41'], 'v41 zeroes the active work registers #1506/#1507').toContain('#1506=0');
    expect(r.after['ddcs-v41'], 'v41 #1507=0').toContain('#1507=0');
    expect(r.after['ddcs-v41'].includes('G92'), 'v41 no longer uses the temporary G92').toBe(false);
    expect(r.after['ddcs-v41'].includes('#880'), 'v41 no longer leaks the M350 DRO #880').toBe(false);
    // dm500 — the DUMP-GROUNDED G92 datum (per defprobe.nc); NOT the inferred/un-dumped #804 register (register-name ≠ macro-usage)
    expect(r.after['ddcs-v3-dm500'], 'dm500 sets the datum via G92 (grounded in defprobe.nc)').toContain('G90 G92 X0 Y0');
    expect(r.after['ddcs-v3-dm500'].includes('#804'), 'dm500 does NOT ship the inferred/un-dumped #804 register').toBe(false);
});
