import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert, fillField } from './support/barGesture.js';

/**
 * t1842 — BOTH LAYERS of the opAtLine bug (WORK-LOG t1838/t1840), guarded with two separate proofs, per the
 * advisor's own explicit order: the ALGORITHM layer (programModel.js's findOpInStack) must never accidentally
 * match an id-less `type:'op'` node, and must say so loudly when it encounters one; the BUILDER layer
 * (homingData.js's homingDataStack) must not produce such a node in the first place.
 *
 * These are independent tests on purpose — the algorithm test uses a HAND-BUILT synthetic stack, decoupled from
 * homing's own current (now-fixed) shape, so it keeps guarding the general CLASS of defect even if some future
 * builder (anywhere) reintroduces an id-less type:'op' node by a different route.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('ALGORITHM: findOpInStack never matches an id-less type:\'op\' node, and logs it loudly (synthetic, builder-independent)', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetProjection, null, { timeout: 20000 });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    // A hand-built stack matching the STRUCTURAL SHAPE of the real defect (an id-less type:'op' node nested
    // inside a REAL op, ahead of a second REAL op in program order) — but with fabricated types, so this test
    // guards the algorithm itself, not any one builder's current behavior.
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
    expect(r.opId, 'op B resolves to ITSELF, not the id-less phantom nested inside A').toBe('B');
    expect(r.opType, 'op B\'s own opType, not the phantom\'s').toBe('fakeB');
    expect(
        errors.some((e) => e.includes("findOpInStack found a type:'op' block with no id") && e.includes('phantom_no_id')),
        'the id-less node is not silently skipped — it is named in a console.error'
    ).toBe(true);
});

test('BUILDER: homingDataStack carries no bare type:\'op\' node anywhere in its own tree (matches its siblings)', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetSettings, null, { timeout: 20000 });

    const r = await page.evaluate(async () => {
        const { homingDataStack } = await import('/blocks/dataOps/homingData.js');
        const tree = homingDataStack({ axes: ['x', 'y', 'z'], run_x: true, run_y: true, run_z: true });
        const bareOpNodes = [];
        (function walk(b, path) {
            if (!b) return;
            if (b.type === 'op') bareOpNodes.push({ path, opType: b.opType, id: b.id });
            (b.children || []).forEach((c, i) => walk(c, path + '.c' + i));
            (b.uiChildren || []).forEach((c, i) => walk(c, path + '.ui' + i));
        })(tree[0], 'root');
        // The internal arms marker should still be findable — just retyped, not removed (applyHomingRecompose's
        // own anchor, WORK-LOG t1842) — confirms the fix is a RETYPE, not a silent deletion of real content.
        const armsMarker = (function find(b) {
            if (!b) return null;
            if (b.type === 'section' && b.opType === 'homing') return b;
            for (const c of (b.children || [])) { const f = find(c); if (f) return f; }
            return null;
        })(tree[0]);
        return { bareOpNodes, armsMarkerFound: !!armsMarker, armsChildCount: armsMarker ? armsMarker.children.length : 0 };
    });

    expect(r.bareOpNodes, 'NO type:\'op\' node anywhere inside homingDataStack\'s own tree').toEqual([]);
    expect(r.armsMarkerFound, 'the internal arms marker still exists, just retyped (not silently deleted)').toBe(true);
    expect(r.armsChildCount, 'the retyped marker still carries its real content (the homing arms)').toBeGreaterThan(0);
});

test('OUTCOME: export a Homing+Corner program, reimport it — BOTH ops survive with their real params', async ({ page }) => {
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
    // THE OUTCOME, not a marker count: BOTH ops survive the export+reimport round trip.
    expect(r.afterCount, 'BOTH ops survive export+reimport — not one silently replaced by a garbage duplicate').toBe(2);
    expect(r.afterTypes[0], 'op 1 is still the homing twin').toBe(r.beforeTypes[0]);
    expect(r.afterTypes[1], 'op 2 is still the corner twin — NOT lost, NOT a garbage duplicate homing op').toBe(r.beforeTypes[1]);
    // AND with its real params, not empty/default ones (the actual failure mode this bug produced).
    expect(String(r.afterCornerDist), 'corner\'s own real param (dist=741) survives, not an empty/default param set').toBe(String(r.beforeCornerDist));
});
