import { test, expect } from '@playwright/test';

/**
 * t1842/t1844 — the opAtLine bug (WORK-LOG t1838/t1840/t1842/t1844), ALGORITHM layer only.
 *
 * t1842 shipped TWO fixes: the algorithm (programModel.js's findOpInStack, an identity check so an id-less
 * type:'op' node can never match by accident) and the builder (homingData.js's homingDataStack, retyping its
 * own internal arms-marker away from 'op'). t1844 REVERTED the builder fix — full-suite gate found it trips
 * FIVE separate structural/parity/round-trip guards (fork-parity-1593, guard-roundtrip-1595 ×2,
 * homing-stock-poisons-1832 ×2) that all notice a genuine RETYPE, a different claim from "byte-identical emit."
 * The wrapper is load-bearing (`applyHomingRecompose`'s own anchor, found at t1842) and a structural retype that
 * trips five guards is more risk than the benefit justifies — homing's own odd shape (a raw, id-less type:'op'
 * fragment nested inside every stored homing instance) STAYS. Do not "fix" it again without re-reading t1842's
 * own load-bearing finding and t1844's own guard-trip list.
 *
 * KEPT: the algorithm fix. Proven at t1842 (and re-confirmed here, "OUTCOME") to fully close the round trip on
 * its own — the builder fix never closed the bug, it only silenced the new warning by removing its own trigger.
 *
 * t1844 also SHARPENED the algorithm's own logging. The first cut (t1842) logged on every ENCOUNTER of an
 * id-less type:'op' node during a search — which, with the builder fix reverted, would fire on every single line
 * of every homing op in the app, regardless of whether the search actually failed. An over-broad proxy for the
 * real hazard (this project's own third instance of that shape this session). Sharpened to fire ONLY when BOTH
 * (a) the search failed to resolve any op for the line, AND (b) that line's own ancestry carries the specific
 * `undefined` (not `null`) padding that an id-less node could otherwise have matched by accident — the actual
 * cost, not just the node's mere existence somewhere in the tree.
 *
 * t1846 sharpened it ONE MORE TIME. t1844's own condition still fired on a real, ordinary program's own trailing
 * M30 line — program-level framing (`progend`/`endprogram`, `programFraming.js`) is a real, declared, id-less
 * top-level sibling too, and a framing line resolving to no op is the CORRECT answer, not an anomaly. Checked,
 * not assumed, that framing is identifiable at the resolution point: `stack`'s own top-level elements carry a
 * DECLARED type (`progstart`/`progend`/`endprogram`/`xform`/`entry`/`flip`) — the same vocabulary
 * `_isLooseTop`'s own existing exclusion already partially uses. The log now stays quiet whenever the stack
 * contains a declared framing element (every real program), while still firing on a genuinely odd shape that
 * carries none (the synthetic test below).
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('ALGORITHM: resolution that succeeds despite a nested id-less type:\'op\' node stays silent (no false alarm)', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetProjection, null, { timeout: 20000 });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    // A hand-built stack matching the STRUCTURAL SHAPE of the real defect (an id-less type:'op' node nested
    // inside a REAL op, ahead of a second REAL op in program order) — fabricated types, decoupled from homing's
    // own current shape, so this guards the general CLASS, not any one builder's present behavior.
    const stack = [
        { id: 'A', type: 'op', opType: 'fakeA', children: [
            { type: 'op', opType: 'phantom_no_id', children: [{ type: 'raw', params: { text: 'G0 X1' } }] },
            { type: 'raw', params: { text: 'G0 X2' } },
        ] },
        { id: 'B', type: 'op', opType: 'fakeB', children: [{ type: 'raw', params: { text: 'G0 Y1' } }] },
    ];

    const r = await page.evaluate(async (s) => {
        window.ddcsLoadBlockStack(s);
        await new Promise((res) => setTimeout(res, 100));
        const proj = window.ddcsGetProjection();
        const bLine = proj.map.findIndex((a) => a && a[0] === 'B');
        const op = window.ddcsOpAtLine(bLine);
        return { bLine, opId: op && op.id, opType: op && op.opType };
    }, stack);

    expect(r.bLine, 'sanity: op B genuinely owns a real line').toBeGreaterThanOrEqual(0);
    expect(r.opId, 'op B resolves to ITSELF, not the id-less phantom nested inside A — never matched by accident').toBe('B');
    expect(r.opType, 'op B\'s own opType, not the phantom\'s').toBe('fakeB');
    expect(
        errors.some((e) => e.includes('could not be resolved to an op')),
        'the search SUCCEEDED (found B correctly) — nothing bad happened, so nothing is logged (sharpened t1844: encounter alone is not the hazard, an unresolved line is)'
    ).toBe(false);
});

test('ALGORITHM: a line that genuinely cannot be resolved, in the accident-prone ancestry shape, IS logged loudly', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetProjection, null, { timeout: 20000 });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    // An id-less TOP-LEVEL op: makeOp() always assigns a real id to a real top-level op, so this shape is not
    // reachable via any current real user gesture — it exists here to prove the sharpened condition is REAL
    // code, not dead code (the advisor's own explicit worry), by constructing the exact failure it targets:
    // a line whose own resolution genuinely fails, with the specific undefined-padded ancestry shape.
    const stack = [{ type: 'op', opType: 'orphan_no_id', children: [{ type: 'raw', params: { text: 'G0 X9' } }] }];

    const r = await page.evaluate(async (s) => {
        window.ddcsLoadBlockStack(s);
        await new Promise((res) => setTimeout(res, 100));
        const proj = window.ddcsGetProjection();
        const op = window.ddcsOpAtLine(0);
        return { op, anc0HasUndefined: (proj.map[0] || []).some((v) => v === undefined) };
    }, stack);

    expect(r.op, 'the search genuinely fails to resolve this line — no real op to find').toBeNull();
    expect(r.anc0HasUndefined, 'sanity: this line\'s own ancestry carries the accident-prone undefined padding').toBe(true);
    expect(
        errors.some((e) => e.includes('could not be resolved to an op') && e.includes('line 0')),
        'an unresolved line in the accident-prone shape IS logged, naming the line — the condition is reachable, not dead code (this hand-built stack deliberately carries NO progstart/progend/endprogram/xform/entry/flip element, so t1846\'s own framing exclusion does not apply here — the odd shape is genuinely unexplained)'
    ).toBe(true);
});

// t1920 — FIXTURE CHANGED, claim unchanged. A real bar-gesture Insert now REPLACES the program (t1916/t1918/
// t1920's own ruling: a Studio-canvas program is always exactly one op) — two live inserts can no longer produce
// a 2-op program at all. Built directly instead, via the SAME production functions the (deleted) accumulation
// path used to call (`opBuilders.js`'s own `makeOp`/`_builderAtoms`), matching `prog-marker-slot-812.spec.js`'s
// own established hand-built-fixture pattern. Two TOP-LEVEL ops (not nested) because this test's own claim needs
// `opAtLine` to resolve each — same reasoning as `segment-frame-derivation-1838.spec.js`. Params captured from a
// real single-op live insert (homing's own shipped defaults; corner's own shipped defaults).
const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

test('ALGORITHM: a normal program\'s own trailing M30 (program framing, not a missing op) stays silent', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        // This test's own claim needs the M30 to be a TOP-LEVEL, unowned framing sibling — the shape a real
        // accumulated program used to have (progend's own separate M30, corner's own internal one stripped by
        // opSession.js's now-deleted normalizeEnds since corner wasn't first). Reproduced by hand here: strip
        // corner's own internal `endprogram` (it carries one by original design, same as t1916's own finding) and
        // add ONE fresh top-level terminator, matching normalizeEnds' own old output shape exactly.
        const stripEndprogram = (arr) => (arr || []).filter((b) => {
            if (b && b.type === 'endprogram') return false;
            if (b && b.children) b.children = stripEndprogram(b.children);
            return true;
        });
        cornerOp.children = stripEndprogram(cornerOp.children);
        window.ddcsLoadBlockStack([homingOp, cornerOp, { type: 'endprogram', params: {} }]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });

    const r = await page.evaluate(() => {
        const proj = window.ddcsGetProjection();
        const nullLines = [];
        for (let i = 0; i < proj.lines.length; i++) { const op = window.ddcsOpAtLine(i); if (!op) nullLines.push(i); }
        return { lastLine: proj.lines[proj.lines.length - 1], nullLines };
    });

    expect(r.lastLine, 'sanity: the program genuinely ends with the M30 program-framing line').toBe('M30');
    expect(r.nullLines.length, 'M30 is the one and only unresolved line — correctly unowned, not a symptom').toBe(1);
    expect(
        errors.some((e) => e.includes('could not be resolved to an op')),
        'a REAL program\'s own framing line stays quiet — t1846\'s own framing exclusion, verified on a real gesture, not just reasoned about'
    ).toBe(false);
});

test('OUTCOME: export a Homing+Corner program, reimport it — BOTH ops survive with their real params (the algorithm fix alone closes this)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // t1920 — this test's own EXPORT-SIDE fixture can no longer come from two live inserts (a real bar-gesture
    // Insert now REPLACES; see this file's own earlier note). Built directly instead — serializeWithMarkers/
    // importMarkedNc don't care how the 2-op stack was built, only its resulting shape, so this substitution is
    // exact for this test's own purpose. The IMPORT-SIDE behavior under test (multi_step wrapping) is unaffected —
    // that's t1916's own surviving feature, untouched this turn.
    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([homingOp, cornerOp]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const before = window.ddcsGetBlockProgram().filter((b) => b.type === 'op');
        const text = window.ddcsSerializeWithMarkers();
        const pm = await import('/blocks/programModel.js');
        const after = pm.importMarkedNc(text);
        // t1916 — the user's own ruling: a multi-op .nc imports as ONE op carrying N steps, not N flat top-level
        // ops. Find the wrapper and read ITS children — the algorithm fix this test names is unchanged underneath
        // (both ops still resolve correctly by identity, per findOpInStack's own fix); only the TOP-LEVEL shape
        // importMarkedNc now produces changed, deliberately, per the user's own ruling.
        const wrapper = after.find((b) => b && b.type === 'op' && b.opType === 'multi_step');
        const steps = (wrapper && wrapper.children) || [];
        return {
            beforeCount: before.length,
            beforeTypes: before.map((b) => b.opType),
            beforeCornerDist: (before[1] && before[1].params && before[1].params.dist) || null,
            hasWrapper: !!wrapper,
            stepCount: steps.length,
            stepTypes: steps.map((b) => b.opType),
            afterCornerDist: (steps[1] && steps[1].params && steps[1].params.dist) || null,
        };
    });

    expect(r.beforeCount, 'sanity: the real program has 2 ops before export').toBe(2);
    // THE OUTCOME, not a marker count: BOTH ops survive the export+reimport round trip — with ONLY the
    // algorithm fix in place (homing's own raw self-wrap is back, unchanged, per t1844's own ruling).
    expect(r.hasWrapper, 'a multi-op import wraps into ONE multi_step op (t1916 — the user\'s own ruling)').toBe(true);
    expect(r.stepCount, 'BOTH ops survive export+reimport, as steps — not one silently replaced by a garbage duplicate').toBe(2);
    expect(r.stepTypes[0], 'step 1 is still the homing twin').toBe(r.beforeTypes[0]);
    expect(r.stepTypes[1], 'step 2 is still the corner twin — NOT lost, NOT a garbage duplicate homing op').toBe(r.beforeTypes[1]);
    // AND with its real params, not empty/default ones (the actual failure mode this bug produced).
    expect(String(r.afterCornerDist), 'corner\'s own real param (dist=741) survives, not an empty/default param set').toBe(String(r.beforeCornerDist));
});
