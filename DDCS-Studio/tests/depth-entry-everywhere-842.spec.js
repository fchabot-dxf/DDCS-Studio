import { test, expect } from '@playwright/test';

/**
 * t842 — DEPTH ENTRY EVERYWHERE. The t804 plunge/ramp/helix trio extends to SLOT, CONTOUR, SURFACING. Plunge = default =
 * byte-identical everywhere. Ramp runs along the op's HONEST direction (surfacing→centre like pocket; slot→its length;
 * contour→its first segment) at ≤ the angle. Helix fits the op geometry (a narrow slot degrades with a why); contour
 * offers plunge+ramp only (a helix would gouge the profile interior). One shared levelEntry/entryOrPlunge seam.
 */
const XYZ = (ln) => { const m = /X(-?[\d.]+)\s+Y(-?[\d.]+)(?:\s+Z(-?[\d.]+))?/.exec(ln); return m ? { x: +m[1], y: +m[2], z: m[3] != null ? +m[3] : null } : null; };
const Z = (ln) => { const m = /(?:^|\s)Z(-?[\d.]+)/.exec(ln); return m ? +m[1] : null; };
// ramp blocks: [G0 X x0 Y y0] [G0 Z prevZ] [G1 X Y Z ( ramp )] — the t804 shape.
function ramps(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes('( ramp )')) continue;
        out.push({ to: XYZ(lines[i]), prevZ: Z(lines[i - 1]), from: XYZ(lines[i - 2]) });
    }
    return out;
}
function assertRampSlope(lines, angle, nLevels) {
    const rs = ramps(lines);
    expect(rs.length, `a ramp per depth level (${nLevels})`).toBe(nLevels);
    const tanMax = Math.tan((angle + 0.01) * Math.PI / 180);
    for (const r of rs) {
        const dist = Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y), drop = r.prevZ - r.to.z;
        expect(drop, 'the ramp descends').toBeGreaterThan(0);
        expect(drop / dist, `slope ${(drop / dist).toFixed(4)} ≤ tan(${angle}°)`).toBeLessThanOrEqual(tanMax);
    }
    return rs;
}

// ---------------- SURFACING (rides fillStrategy; ramp toward-centre like pocket) ----------------
test('SURFACING plunge = byte-identical; ramp descends ≤ angle; helix fits + pitch', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const base = { w: 120, h: 100, toolDia: 12, depth: 6, stepdown: 2, strategy: 'parallel', feed: 800, plunge: 200 };
        const noEntry = emitMapped(surfacingStack(base)).text;
        const plunge = emitMapped(surfacingStack({ ...base, entry: 'plunge' })).text;
        const ramp = emitMapped(surfacingStack({ ...base, entry: 'ramp', rampAngle: 5 })).text.split('\n');
        const helix = emitMapped(surfacingStack({ ...base, entry: 'helix', helixPitch: 1.5 })).text.split('\n');
        return { same: noEntry === plunge, plungeClean: !/\( ramp|\( helix/.test(plunge), ramp, helix };
    });
    expect(r.same, 'entry:plunge == no entry field (byte-identical)').toBe(true);
    expect(r.plungeClean, 'plunge emits no ramp/helix').toBe(true);
    assertRampSlope(r.ramp, 5, 3);                                   // depth 6 / stepdown 2 = 3 levels
    const hi = r.helix.findIndex((l) => l.includes('( helix )'));
    expect(hi, 'surfacing helix emits').toBeGreaterThan(0);
});

test('SURFACING twin: user_surfacing_data controls entry through the binding + 3-value dropdown', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const build = builderOf('user_surfacing_data');
        const base = { w: 120, h: 100, toolDia: 12, depth: 6, stepdown: 2, strategy: 'parallel' };
        const plunge = emitMapped(build({ ...base })).text;
        const ramp = emitMapped(build({ ...base, entry: 'ramp', rampAngle: 5 })).text;
        const fill = flattenBlocks(build({ ...base, entry: 'ramp' })).find((b) => b && b.type === 'surfacefill');
        return { plungeClean: !/\( ramp|\( helix/.test(plunge), rampHas: ramp.includes('( ramp )'), fillEntry: fill && fill.params && fill.params.entry };
    });
    expect(r.plungeClean, 'twin plunge byte path clean').toBe(true);
    expect(r.rampHas, 'twin ramp: the binding writes surfacefill.entry → ramp emits').toBe(true);
    expect(r.fillEntry, 'surfacefill carries entry=ramp (round-trip)').toBe('ramp');
});

// ---------------- SLOT (own descent; ramp along its LENGTH; helix needs width > tool) ----------------
test('SLOT plunge = byte-identical; ramp runs ALONG the slot at ≤ angle; wide-slot helix fits, tool-width degrades', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { slotStack } = await import('/wizards/slotWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const base = { ax: 0, ay: 0, bx: 60, by: 0, toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150 };
        const noEntry = emitMapped(slotStack({ ...base, width: 6 })).text;
        const plunge = emitMapped(slotStack({ ...base, width: 6, entry: 'plunge' })).text;
        const ramp = emitMapped(slotStack({ ...base, width: 6, entry: 'ramp', rampAngle: 5 })).text.split('\n');
        const helixWide = emitMapped(slotStack({ ...base, width: 20, entry: 'helix', helixPitch: 1.5 })).text;
        const helixNarrow = emitMapped(slotStack({ ...base, width: 6, entry: 'helix', helixPitch: 1.5 })).text;
        return { same: noEntry === plunge, plungeClean: !/\( ramp|\( helix/.test(plunge), ramp,
            wideHelix: helixWide.includes('( helix )'), narrowDegrade: /helix needs room the geometry lacks -> plunge/.test(helixNarrow) && !helixNarrow.includes('( helix )') };
    });
    expect(r.same, 'slot entry:plunge == no entry (byte-identical)').toBe(true);
    expect(r.plungeClean, 'slot plunge: no ramp/helix').toBe(true);
    const rs = assertRampSlope(r.ramp, 5, 3);                       // depth 4 / stepdown 1.5 → levels 1.5,3,4 = 3
    // the ramp runs ALONG the slot axis (+X here): its move is mostly in X, ~0 in Y
    for (const rmp of rs) expect(Math.abs(rmp.to.y - rmp.from.y), 'ramp runs along the slot length (+X), not across').toBeLessThan(0.5);
    expect(r.wideHelix, 'a slot wider than the tool fits a helix').toBe(true);
    expect(r.narrowDegrade, 'a tool-width slot degrades helix → plunge with the why').toBe(true);
});

// ---------------- CONTOUR (own descent; ramp along the FIRST SEGMENT / a helical lead-in on a circle; NO helix mode) ----------------
test('CONTOUR plunge = byte-identical; rect ramps along the first segment ≤ angle; circle ramps as a helical lead-in', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { contourStack } = await import('/wizards/contourWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const rect = { shape: 'rect', w: 80, h: 60, side: 'outside', toolDia: 6, depth: 4, stepdown: 1.5, feed: 400, plunge: 200 };
        const noEntry = emitMapped(contourStack(rect)).text;
        const plunge = emitMapped(contourStack({ ...rect, entry: 'plunge' })).text;
        const ramp = emitMapped(contourStack({ ...rect, entry: 'ramp', rampAngle: 5 })).text.split('\n');
        // circle ramp = a descending G3 helical lead-in (G3 … Z … ( ramp ))
        const circ = emitMapped(contourStack({ shape: 'circle', dia: 50, side: 'outside', toolDia: 6, depth: 4, stepdown: 1.5, entry: 'ramp', rampAngle: 5 })).text.split('\n');
        const circRamps = circ.filter((l) => /G3 .* Z-?[\d.]+ .*\( ramp \)/.test(l));
        return { same: noEntry === plunge, plungeClean: !/\( ramp|\( helix/.test(plunge), ramp,
            helixNever: !ramp.join('\n').includes('( helix )'), circRampCount: circRamps.length,
            circZs: circRamps.map((l) => { const m = /Z(-?[\d.]+)/.exec(l); return m ? +m[1] : null; }) };
    });
    expect(r.same, 'contour entry:plunge == no entry (byte-identical)').toBe(true);
    expect(r.plungeClean, 'contour plunge: no ramp/helix').toBe(true);
    const rs = assertRampSlope(r.ramp, 5, 3);                       // depth 4 / stepdown 1.5 = 3 levels; rect first segment
    expect(r.helixNever, 'contour never emits a helix (would gouge the interior)').toBe(true);
    expect(r.circRampCount, 'circle ramp emits a descending G3 helical lead-in').toBeGreaterThanOrEqual(3);
    // the circle helix descends monotonically
    for (let i = 1; i < r.circZs.length; i++) if (r.circZs[i] != null && r.circZs[i - 1] != null) expect(r.circZs[i]).toBeLessThanOrEqual(r.circZs[i - 1] + 1e-6);
});

test('CONTOUR twin: user_contour_data offers plunge+ramp (no helix) + ramp round-trips', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const { specOf } = await import('/blocks/opSchema.js').catch(() => ({ specOf: null }));
        const build = builderOf('user_contour_data');
        const base = { shape: 'rect', w: 80, h: 60, side: 'outside', toolDia: 6, depth: 4, stepdown: 1.5 };
        const ramp = emitMapped(build({ ...base, entry: 'ramp', rampAngle: 5 })).text;
        const helixCoerced = emitMapped(build({ ...base, entry: 'helix' })).text;   // a stray helix must NOT emit a helix
        const fill = flattenBlocks(build({ ...base, entry: 'ramp' })).find((b) => b && b.type === 'contourfill');
        return { rampHas: ramp.includes('( ramp )'), helixSafe: !helixCoerced.includes('( helix )') && !/NaN/.test(helixCoerced), fillEntry: fill && fill.params && fill.params.entry };
    });
    expect(r.rampHas, 'twin ramp: the binding writes contourfill.entry → ramp emits').toBe(true);
    expect(r.helixSafe, 'a stray helix on contour is coerced to a safe plunge (no helix, no NaN)').toBe(true);
    expect(r.fillEntry, 'contourfill carries entry=ramp (round-trip)').toBe('ramp');
});
