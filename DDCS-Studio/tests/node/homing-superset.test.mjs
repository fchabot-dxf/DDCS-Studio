import { test, expect } from './support/harness.mjs';

/**
 * HOMING E0 (t546) — the data-op twin seam. homingStack(params, {superset:true}) carries EVERY axis's home block GUARDED by
 * its run-tick (_run<AX>, canonical order x/y/z/a/b; rotary a/b = the setzero arm). pruneGuards collapses to the selected set
 * → BYTE-IDENTICAL to the concrete build. The emit is SETTINGS-dependent (seek dist = machine span + margin; direction = the
 * declared <edge>Home) — those ride the params here (the twin will bind them from settings via deriveGuards/postInstantiate,
 * E1). NOTE: E0 gates the axis-SELECTION in CANONICAL order; the run-ORDER reorder is the twin's unroll (E1, comm precedent).
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. No twin-seeding needed at all — works directly with
 * `homingStack`/`pruneGuards`/`emitMapped`, never the user-ops registry.
 */
test('E0 GATE: prune(homingStack superset) == concrete homingStack, byte-identical across the selection × Z-sign × declared-home sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const ALL = ['x', 'y', 'z', 'a', 'b'];
        const runFlags = (axes) => { const o = {}; for (const a of ALL) o['_run' + a.toUpperCase()] = axes.includes(a); return o; };
        // canonical-order selections × Z signs × declared-home variants (zMaxHome / zMinHome / none-fallback)
        const sels = [['x'], ['z'], ['x', 'z'], ['x', 'y', 'z'], ['a'], ['a', 'b'], ['x', 'y', 'z', 'a', 'b'], ['y', 'z']];
        const machines = [{ x: 600, y: 400, z: -120 }, { x: 600, y: 400, z: 500 }];
        const limitsV = [{ zMaxHome: true, xMinHome: true, yMinHome: true }, { zMinHome: true }, {}];
        const cfg = { x: { enable: true, backoff: 5, seekFeed: 800, slowFeed: 100 }, y: { enable: true, backoff: 5 }, z: { enable: true, backoff: 5 }, a: {}, b: {} };
        let diffs = 0, first = null, guardMax = 0, leftover = 0, combos = 0;
        for (const axes of sels) for (const machine of machines) for (const limits of limitsV) {
            combos++;
            const c = { axes, config: cfg, machine, limits, softLimits: true };
            const sup = homingStack(c, { superset: true });
            guardMax = Math.max(guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            pruneGuards(sup, { ...c, ...runFlags(axes) });
            if (JSON.stringify(sup).includes('"type":"guard"')) leftover++;
            const a = emitMapped(sup).text, b = emitMapped(homingStack(c)).text;
            if (a !== b) { diffs++; if (!first) { const al = a.split('\n'), bl = b.split('\n'); let i = 0; while (i < al.length && al[i] === bl[i]) i++; first = { axes, machine, limits, line: i, sup: al.slice(i, i + 3), con: bl.slice(i, i + 3) }; } }
        }
        return { diffs, first, guardMax, leftover, combos };
    });
    if (r.first) console.log('HOMING E0 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 8 selections × 2 Z signs × 3 declared-home variants').toBe(48);
    expect(r.guardMax, 'the superset carries one guard per axis (x/y/z/a/b = 5)').toBe(5);
    expect(r.leftover, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    expect(r.diffs, 'prune(superset) is BYTE-IDENTICAL to concrete homingStack for ALL 48 combos (byte-diff = ZERO)').toBe(0);
});

/** The concrete/default path is UNCHANGED by the E0 seam — homingStack() (no opts) emits exactly as before. */
test('E0 golden: the concrete build (no superset) is unchanged — a plain G31 seek, no guard blocks', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const c = { axes: ['z'], config: { z: { enable: true, backoff: 5 } }, machine: { z: -120 }, limits: { zMaxHome: true } };
        const stack = homingStack(c);
        return { emit: emitMapped(stack).text, hasGuard: JSON.stringify(stack).includes('"type":"guard"') };
    });
    expect(r.hasGuard, 'the concrete build has NO guard blocks (superset-only)').toBe(false);
    expect(r.emit, 'the concrete build still emits the simple G31 seek').toContain('G31 Z');
    expect(r.emit, 'no M98 native call from the wizard').not.toContain('M98P501');
});
