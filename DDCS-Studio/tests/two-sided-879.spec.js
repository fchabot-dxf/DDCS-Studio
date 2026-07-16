import { test, expect } from '@playwright/test';

/**
 * t879 — TWO-SIDED JOBS, phase 1 (backlog item 11, Option A per-section flip). A `setup` boundary groups the ops of one
 * machine setup; a flat childless `flip` sibling (modeled on the xform program-rotation) names a setup index + a flip axis.
 * The emit BAKES the mirror into that setup's own coordinates (data/mirrorProgram, scoped by opRanges in emitMapped) — so
 * the sim renders side-2 toolpaths mirrored FOR FREE. Reflect about the STOCK span (re-registered to the same corner);
 * cut geometry (Z<=0) inverts through the thickness. No setup+flip -> byte-identical (goldens untouched). The flip rides
 * the SAME prog marker slot as xform (Blocks + .nc round-trip). The setup sheet loops a page per setup with the flip
 * instruction + an honest note (the prior-setup carved stock is not yet re-shown flipped — phase 3).
 */
test.use({ viewport: { width: 1300, height: 950 } });

const mv = (id, x, y, z) => ({ type: 'move', id, params: { mode: 'cut', x, y, z, feed: 200 } });
const setup = (id, idx, title, children) => ({ type: 'setup', id, params: { title, index: idx }, children });
const flip = (id, axis, s) => ({ type: 'flip', id, params: { axis, setup: s } });
const STOCK = { x: 100, y: 80, z: 20 };

test('flip about X mirrors setup-2 Y about the stock span + Z-inverts through thickness; setup-1 untouched (hand-computed)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const lines = await page.evaluate(async ([STOCK, S]) => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const mv = (id, x, y, z) => ({ type: 'move', id, params: { mode: 'cut', x, y, z, feed: 200 } });
        const stack = [
            { type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mv('m1', 10, 10, -5)] },
            { type: 'setup', id: 's2', params: { title: 'Back', index: 2 }, children: [mv('m2', 10, 10, -5)] },
            { type: 'flip', id: 'f1', params: { axis: 'X', setup: 2 } },
        ];
        return emitMapped(stack, S).lines;
    }, [STOCK, { stock: STOCK }]);
    // setup-1 stays put: G1 X10 Y10 Z-5
    expect(lines.some((l) => /G1\s+X10\s+Y10\s+Z-5\b/.test(l)), 'setup-1 is not mirrored').toBe(true);
    // setup-2 mirrored about X: Y' = 80-10 = 70 (reflect about the stock Y span); Z' = -(-5+20) = -15 (invert through thickness); X unchanged
    expect(lines.some((l) => /G1\s+X10\s+Y70\s+Z-15\b/.test(l)), 'setup-2 mirrored about X: Y 10->70, Z -5->-15, X kept 10').toBe(true);
    // and no unmirrored side-2 leak (a raw Y10 Z-5 should appear exactly once — setup-1 only)
    expect(lines.filter((l) => /Y10\s+Z-5\b/.test(l)).length, 'only setup-1 carries the un-mirrored coords').toBe(1);
});

test('flip about Y mirrors setup-2 X about the stock span (the axis is declarable — no convention imposed)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const lines = await page.evaluate(async ([S]) => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const mv = (id, x, y, z) => ({ type: 'move', id, params: { mode: 'cut', x, y, z, feed: 200 } });
        const stack = [
            { type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mv('m1', 10, 10, -5)] },
            { type: 'setup', id: 's2', params: { title: 'Back', index: 2 }, children: [mv('m2', 10, 10, -5)] },
            { type: 'flip', id: 'f1', params: { axis: 'Y', setup: 2 } },
        ];
        return emitMapped(stack, S).lines;
    }, [{ stock: STOCK }]);
    // flip about Y: X' = 100-10 = 90; Y unchanged = 10; Z' = -15
    expect(lines.some((l) => /G1\s+X90\s+Y10\s+Z-15\b/.test(l)), 'setup-2 mirrored about Y: X 10->90, Y kept 10, Z -5->-15').toBe(true);
    expect(lines.some((l) => /G1\s+X10\s+Y10\s+Z-5\b/.test(l)), 'setup-1 is not mirrored').toBe(true);
});

test('BYTE-IDENTITY: a setup wrapper is transparent; a two-setup stack with NO flip is un-mirrored (goldens safe)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async ([S]) => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const mv = (id, x, y, z) => ({ type: 'move', id, params: { mode: 'cut', x, y, z, feed: 200 } });
        const flat = emitMapped([mv('m1', 10, 10, -5)], S).text;
        const wrapped = emitMapped([{ type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mv('m1', 10, 10, -5)] }], S).text;
        // two setups, NO flip block declared → NOTHING mirrors (byte-identical to two flat moves)
        const twoFlat = emitMapped([mv('a', 10, 10, -5), mv('b', 20, 20, -6)], S).text;
        const twoSetupNoFlip = emitMapped([
            { type: 'setup', id: 's1', params: { title: 'F', index: 1 }, children: [mv('a', 10, 10, -5)] },
            { type: 'setup', id: 's2', params: { title: 'B', index: 2 }, children: [mv('b', 20, 20, -6)] },
        ], S).text;
        return { flat, wrapped, twoFlat, twoSetupNoFlip };
    }, [{ stock: STOCK }]);
    expect(r.wrapped, 'a setup with no flip is a transparent group (byte-identical to the un-wrapped op)').toBe(r.flat);
    expect(r.twoSetupNoFlip, 'two setups with no flip declared → un-mirrored (byte-identical)').toBe(r.twoFlat);
});

test('the flip rides the prog marker: .nc export carries {flipAxis,flipSetup}; reimport recovers the flip sibling', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.ddcsSerializeWithMarkers, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const PM = await import('/blocks/programModel.js');
        const mkOp = (id, label, mx) => ({ type: 'op', id, opType: 'pocket', label, params: { depth: 5 }, children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x: mx, y: 10, z: -5, feed: 200 } }] });
        const stack = [
            { type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mkOp('o1', 'Front', 10)] },
            { type: 'setup', id: 's2', params: { title: 'Back', index: 2 }, children: [mkOp('o2', 'Back', 10)] },
            { type: 'flip', id: 'f1', params: { axis: 'X', setup: 2 } },
        ];
        window.ddcsLoadBlockStack(stack);
        const text = window.ddcsSerializeWithMarkers();
        const restored = PM.importMarkedNc(text);
        const rf = restored.find((b) => b && b.type === 'flip');
        return { hasAxis: /"flipAxis":"X"/.test(text), hasSetup: /"flipSetup":2/.test(text), rfAxis: rf && rf.params && rf.params.axis, rfSetup: rf && rf.params && Number(rf.params.setup) };
    });
    expect(r.hasAxis, 'the prog marker carries flipAxis').toBe(true);
    expect(r.hasSetup, 'the prog marker carries flipSetup').toBe(true);
    expect(r.rfAxis, 'reimport recovers a flip sibling with the axis').toBe('X');
    expect(r.rfSetup, 'reimport recovers the setup index').toBe(2);
});

test('the SETUP SHEET loops a page per setup with the flip instruction + honest carve note; the estimate splits per setup', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.openSetupSheet, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const SS = await import('/ui/setupSheet.js');
        const mkOp = (id, label, mx) => ({ type: 'op', id, opType: 'pocket', label, params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x: mx, y: 10, z: -5, feed: 200 } }] });
        const stack = [
            { type: 'setup', id: 's1', params: { title: 'Front', index: 1 }, children: [mkOp('o1', 'Front pocket', 10)] },
            { type: 'setup', id: 's2', params: { title: 'Back', index: 2 }, children: [mkOp('o2', 'Back pocket', 10)] },
            { type: 'flip', id: 'f1', params: { axis: 'X', setup: 2 } },
        ];
        window.ddcsLoadBlockStack(stack);
        SS.openSetupSheet();
        const pg = document.getElementById('setupSheetPage');
        const setups = [...pg.querySelectorAll('.ss-setup')];
        const split = SS.setupTimeSplit();
        return {
            count: setups.length,
            hasBreak: setups.some((s) => /page-break-before/.test(s.getAttribute('style') || '')),
            flipInstr: /Flip the part about the X axis/.test(pg.innerHTML),
            splitLen: split && split.length,
            splitIdx: split && split.map((g) => g.index),
        };
    });
    expect(r.count, 'one section per setup (two pages)').toBe(2);
    expect(r.hasBreak, 'the second setup starts a new page').toBe(true);
    expect(r.flipInstr, 'the flip instruction is stated from the declaration').toBe(true);
    expect(r.splitLen, 'the estimate splits into two per-setup groups').toBe(2);
    expect(r.splitIdx, 'the split is keyed by setup index').toEqual([1, 2]);
    await page.locator('#setupSheetPage').screenshot({ path: testInfo.outputPath('t879-setup-sheet.png') });
});
