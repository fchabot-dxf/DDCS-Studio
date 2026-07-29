import { test, expect } from '@playwright/test';

/**
 * t842 — DEPTH ENTRY EVERYWHERE. The t804 plunge/ramp/helix trio extends to SLOT, CONTOUR, SURFACING. Plunge = default =
 * byte-identical everywhere. Ramp runs along the op's HONEST direction (surfacing→centre like pocket; slot→its length;
 * contour→its first segment) at ≤ the angle. Helix fits the op geometry (a narrow slot degrades with a why); contour
 * offers plunge+ramp only (a helix would gouge the profile interior). One shared levelEntry/entryOrPlunge seam.
 */
test.use({ viewport: { width: 1400, height: 1000 } });   // the two-pane wizard: form-left / viz-right → the Depth Entry cluster is visible in the form pane
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
/**
 * t1361 — READ FROM THE MOTION, NOT FROM THE TEXT. Surfacing emits its raster PARAMETRICALLY now: one ramp is written,
 * inside the depth loop, and the machine runs it once per level. `assertRampSlope` counts `( ramp )` LINES, so it read
 * "3 ramps" as "3 lines" and would now see one — a spec measuring the emitter's shape rather than the tool's path.
 *
 * The rule it was guarding is untouched and is asserted here directly: EVERY level descends by ramping, and no ramp is
 * steeper than the declared angle. Both are read off the EXECUTED toolpath, which is the thing that was ever really
 * meant, and which is true of a loop and a list alike. (SLOT and CONTOUR below still emit literal descents and keep
 * the text helper — this is surfacing's reading changing, not the trio's rule.)
 */
test('SURFACING plunge = byte-identical; ramp descends ≤ angle; helix fits + pitch', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const base = { w: 120, h: 100, toolDia: 12, depth: 6, stepdown: 2, strategy: 'parallel', feed: 800, plunge: 200 };
        const noEntry = emitMapped(surfacingStack(base)).text;
        const plunge = emitMapped(surfacingStack({ ...base, entry: 'plunge' })).text;
        const ramp = emitMapped(surfacingStack({ ...base, entry: 'ramp', rampAngle: 5 })).text;
        const helix = emitMapped(surfacingStack({ ...base, entry: 'helix', helixPitch: 1.5 })).text;
        // every CUTTING move that loses height — a plunge has no XY run, a ramp/helix does.
        const descents = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid && s.z2 < s.z1 - 1e-9)
            .map((s) => ({ run: Math.hypot(s.x2 - s.x1, s.y2 - s.y1), drop: s.z1 - s.z2 }));
        return { same: noEntry === plunge, plungeClean: !/\( ramp|\( helix/.test(plunge),
            rampEmits: /\( ramp \)/.test(ramp), helixEmits: /\( helix/.test(helix),
            rampDescents: descents(ramp), helixDescents: descents(helix) };
    });
    expect(r.same, 'entry:plunge == no entry field (byte-identical)').toBe(true);
    expect(r.plungeClean, 'plunge emits no ramp/helix').toBe(true);
    // RAMP — depth 6 / stepdown 2 = 3 levels, so the loop ramps three times when it RUNS.
    expect(r.rampEmits, 'surfacing ramp emits').toBe(true);
    expect(r.rampDescents.length, 'a ramp per depth level (3), counted by executing the loop').toBe(3);
    const tanMax = Math.tan(5.01 * Math.PI / 180);
    for (const d of r.rampDescents) {
        expect(d.run, 'the descent really ramps (it travels in XY), it does not plunge').toBeGreaterThan(0);
        expect(d.drop, 'the ramp descends').toBeGreaterThan(0);
        expect(d.drop / d.run, `slope ${(d.drop / d.run).toFixed(4)} ≤ tan(5°)`).toBeLessThanOrEqual(tanMax);
    }
    // HELIX — and the PITCH is visible in the count: 1.5mm/rev over a 2mm bite is FUP(2/1.5)=2 revs, 24 segments a
    // rev, three levels = 144 descending segments. A plunge or a single lead-in could not produce that number.
    expect(r.helixEmits, 'surfacing helix emits').toBe(true);
    expect(r.helixDescents.length, 'the helix descends as 2 revolutions x 24 segments, per level (pitch 1.5 over a 2mm bite)').toBe(144);
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
        // t1361 — the twin's body block is `surfaceraster` now; `surfacefill` is not in a surfacing stack any more, so
        // this lookup found nothing and the socket assert below was reading undefined. Same binding, same socket key,
        // the block it lands on is the one the switch collapsed the pair into.
        const fill = flattenBlocks(build({ ...base, entry: 'ramp' })).find((b) => b && b.type === 'surfaceraster');
        return { plungeClean: !/\( ramp|\( helix/.test(plunge), rampHas: ramp.includes('( ramp )'), fillEntry: fill && fill.params && fill.params.entry };
    });
    expect(r.plungeClean, 'twin plunge byte path clean').toBe(true);
    expect(r.rampHas, 'twin ramp: the binding writes surfaceraster.entry → ramp emits').toBe(true);
    expect(r.fillEntry, 'surfaceraster carries entry=ramp (round-trip)').toBe('ramp');
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

// ---------------- SIM plays every mode + the twin FORMS show the cluster (screenshots) ----------------
test('SIM plays all modes per op (trace) + each twin FORM renders the Depth Entry cluster', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram);
    // (a) the sim plays each mode — traceToolpath the emit (the exact path the preview animates) → segments produced
    const play = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { slotStack } = await import('/wizards/slotWizard.js');
        const { contourStack } = await import('/wizards/contourWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const segs = (text) => (traceToolpath(text, {}).segments || []).length;
        const out = {};
        for (const [k, st, base] of [
            ['surf', surfacingStack, { w: 120, h: 100, toolDia: 12, depth: 6, stepdown: 2 }],
            ['slot', slotStack, { ax: 0, ay: 0, bx: 60, by: 0, width: 20, toolDia: 6, depth: 4, stepdown: 1.5 }],
            ['cont', contourStack, { shape: 'rect', w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 1.5 }],
        ]) {
            const modes = k === 'cont' ? ['plunge', 'ramp'] : ['plunge', 'ramp', 'helix'];
            out[k] = {};
            for (const m of modes) out[k][m] = segs(emitMapped(st({ ...base, entry: m, rampAngle: 5, helixPitch: 1.5 })).text);
        }
        return out;
    });
    for (const k of Object.keys(play)) for (const m of Object.keys(play[k])) expect(play[k][m], `${k} ${m} traces (the sim plays it)`).toBeGreaterThan(3);

    // (b) each twin FORM renders the Depth Entry cluster — open, set the mode to reveal the when-gated fields, screenshot
    for (const [op, mode] of [['user_surfacing_data', 'helix'], ['user_slot_data', 'helix'], ['user_contour_data', 'ramp']]) {
        await page.evaluate((op) => window.openWiz(op), op);
        await page.waitForSelector('#wizard', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(300);
        const sel = page.locator('#wizard select').filter({ has: page.locator('option[value="ramp"]') }).first();
        if (await sel.count()) { await sel.selectOption(mode).catch(() => {}); await page.waitForTimeout(250); await sel.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await page.waitForTimeout(150); }
        await expect(page.locator('#wizard'), `${op} form shows a Depth Entry field`).toContainText('Depth Entry');
        await page.locator('#wizard').screenshot({ path: testInfo.outputPath(`form-${op}.png`) });
        await page.evaluate(() => window.closeWiz && window.closeWiz());
        await page.waitForTimeout(250);
    }
});
