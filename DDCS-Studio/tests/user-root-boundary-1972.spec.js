import { test, expect } from '@playwright/test';

/**
 * t1972 — MAKE THE `user_root` INVARIANT REAL, both halves.
 *
 * t1964 made `findOpInStack` treat `user_root` as blanket-opaque (fixing the regression where homing's own
 * legacy internal fragment, given a real id by a Blockly round-trip, got matched as if it were the real
 * `user_homing_data` op). t1966 then proved the opposite failure: Blockly's own `connect()` lets a user drag an
 * ALREADY-PLACED, genuinely addressable op into ANOTHER op's `user_root` EXECUTION mouth (no `check:` restricts
 * that input, and nothing sanitises it on read-back) — a blanket boundary silently hides THAT real op's own Edit
 * chip and export marker too, the same symptom class from the other direction.
 *
 * t1972's fix: `findOpInStack` now recurses INTO a `user_root` (necessary to reach a legitimately nested
 * `user_`-prefixed op), but a `type:'op'` match found there only counts if its own `opType` carries the
 * `USER_OP_PREFIX` (already declared in `userOps.js`, already enforced by `validateUserOp` for top-level ops).
 * Homing's own `'homing'` fragment is not `user_`-prefixed and stays excluded — the t1964 regression cannot
 * return. A genuinely nested `user_`-prefixed op (this file's own reproduction of t1966's hazard) DOES resolve.
 *
 * Both halves are asserted here, together, in the same file — per the dispatch: "Both, or the fix trades one
 * bug for the other."
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function clickNow(page, selector) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); }, selector);
}

const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

test('HALF 1 — a real op nested inside another op\'s user_root gets its own Edit chip and survives an export/import round-trip', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Build a placed Corner op (real, id-bearing) — the exact t1966 reproduction: dock it into a FRESH user_root's
    // own EXECUTION mouth via Blockly's real connect() API, the same compatibility check a mouse drag uses.
    await page.evaluate(async (cornerParams) => {
        const OB = await import('/blocks/opBuilders.js');
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([cornerOp]);
    }, CORNER_PARAMS);
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'user_corner_data'), { timeout: 8000 });

    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const nested = await page.evaluate(async () => {
        const ws = window.__blkws;
        const prog = window.ddcsGetBlockProgram();
        const cornerId = prog.find((b) => b.opType === 'user_corner_data').id;
        const cornerWsBlock = ws.getBlockById(cornerId);
        const userRootBlock = ws.newBlock('user_root');
        userRootBlock.initSvg(); userRootBlock.render();
        const execInput = userRootBlock.getInput('EXECUTION');
        execInput.connection.connect(cornerWsBlock.previousConnection);

        // Read the workspace back through the SAME reader the app uses on every Blocks-tab sync, and push the
        // result into the live program model so opAtLine/the hover chip operate on this exact nested shape.
        const sbMod = await import('/blocks/blockly/stackBridge.js');
        const readBack = sbMod.workspaceToStack(ws);
        window.ddcsLoadBlockStack(readBack);
        return { cornerId, topLevel: readBack.map((b) => ({ type: b && b.type, opType: b && b.opType })) };
    });
    // Sanity: the nested shape is genuinely what t1966 proved — corner is NOT a top-level op anymore, it's buried
    // inside a bare user_root with no opType of its own.
    expect(nested.topLevel.some((b) => b.opType === 'user_corner_data'), 'corner is no longer a top-level op — it is nested').toBe(false);
    expect(nested.topLevel.some((b) => b.type === 'user_root'), 'the outer user_root sits at the top level').toBe(true);

    await page.waitForTimeout(500);   // let the reprojection settle before reading proj.map

    // THE EDIT CHIP — opAtLine must resolve the NESTED corner op, not null (a blanket-opaque boundary would
    // return null here, since the only top-level entry is the bare user_root, which has no opType).
    const resolved = await page.evaluate((cornerId) => {
        // find any projected line belonging to the nested corner op
        const lines = window.ddcsLinesForOp ? window.ddcsLinesForOp(cornerId) : [];
        const line = lines.length ? lines[0] : null;
        const op = line != null ? window.ddcsOpAtLine(line) : null;
        return { line, opId: op && op.id, opType: op && op.opType };
    }, nested.cornerId);
    expect(resolved.line, 'sanity: corner\'s own lines are still tracked in the projection').not.toBeNull();
    expect(resolved.opType, 'opAtLine resolves the NESTED op itself, not null and not the outer wrapper').toBe('user_corner_data');
    expect(resolved.opId, 'and it is the SAME corner instance, by id').toBe(nested.cornerId);

    // THE EXPORT MARKER — must name the real nested op, not silently drop it.
    const exported = await page.evaluate(() => {
        const text = window.ddcsSerializeWithMarkers();
        return text.split('\n').filter((l) => l.includes('@DDCS:1'));
    });
    expect(exported.length, 'exactly one marker, for the nested corner op').toBe(1);
    expect(exported[0], 'the marker names the REAL nested op').toContain('"op":"user_corner_data"');
});

test('HALF 2 — homing\'s own legacy fragment still does NOT resolve (the t1964 regression guard stays green)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
    await page.evaluate(async (homingParams) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        window.ddcsLoadBlockStack([homingOp]);
    }, HOMING_PARAMS);
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'user_homing_data'), { timeout: 8000 });

    // The Blocks-tab round-trip is what gives homing's own internal 'homing' fragment a real Blockly id — the
    // exact trigger t1964 traced.
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const exported = await page.evaluate(() => {
        const text = window.ddcsSerializeWithMarkers();
        return text.split('\n').filter((l) => l.includes('@DDCS:1'));
    });
    expect(exported.length, 'exactly one marker for the real homing op').toBe(1);
    expect(exported[0], 'the marker names the REAL user_homing_data op, not its internal "homing" fragment').toContain('"op":"user_homing_data"');
    expect(exported[0]).not.toContain('"op":"homing"');
});
