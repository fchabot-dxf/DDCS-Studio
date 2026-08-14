import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert, fillField } from './support/barGesture.js';

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
        'an unresolved line in the accident-prone shape IS logged, naming the line — the condition is reachable, not dead code'
    ).toBe(true);
});

test('OUTCOME: export a Homing+Corner program, reimport it — BOTH ops survive with their real params (the algorithm fix alone closes this)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'homing' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 2, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const before = window.ddcsGetBlockProgram().filter((b) => b.type === 'op');
        const text = window.ddcsSerializeWithMarkers();
        const pm = await import('/blocks/programModel.js');
        const after = pm.importMarkedNc(text);
        return {
            beforeCount: before.length,
            beforeTypes: before.map((b) => b.opType),
            beforeCornerDist: (before[1] && before[1].params && before[1].params.dist) || null,
            afterCount: after.length,
            afterTypes: after.map((b) => b.opType),
            afterCornerDist: (after[1] && after[1].params && after[1].params.dist) || null,
        };
    });

    expect(r.beforeCount, 'sanity: the real program has 2 ops before export').toBe(2);
    // THE OUTCOME, not a marker count: BOTH ops survive the export+reimport round trip — with ONLY the
    // algorithm fix in place (homing's own raw self-wrap is back, unchanged, per t1844's own ruling).
    expect(r.afterCount, 'BOTH ops survive export+reimport — not one silently replaced by a garbage duplicate').toBe(2);
    expect(r.afterTypes[0], 'op 1 is still the homing twin').toBe(r.beforeTypes[0]);
    expect(r.afterTypes[1], 'op 2 is still the corner twin — NOT lost, NOT a garbage duplicate homing op').toBe(r.beforeTypes[1]);
    // AND with its real params, not empty/default ones (the actual failure mode this bug produced).
    expect(String(r.afterCornerDist), 'corner\'s own real param (dist=741) survives, not an empty/default param set').toBe(String(r.beforeCornerDist));
});
