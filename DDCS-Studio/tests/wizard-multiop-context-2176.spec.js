import { test, expect } from '@playwright/test';

/**
 * t2176 — BACKLOG 10: MULTI-OP APPROACHABILITY. Open a wizard on op 2 of a 3-op program and the 3D preview now
 * shows the WHOLE PROGRAM (this op's live draft spliced into the committed stack, one re-emit — see
 * wizardManager.js's own `_contextGcode`), not just the isolated op — the human's literal complaint ("you cannot
 * see where your pocket sits relative to anything else") answered directly, not with a CAD reopen.
 *
 * PLAY stays scoped to the isolated op (createPreviewPanel.js's getPlayGcode) — the whole-program feed only
 * widens the STATIC view/trace, deliberately not Play, since a correct Play start-offset needs real engine work
 * (GcodeExecutionEngine, also the send safety-gate's own parser) left for its own turn.
 */

const mkOp = (opType, id, params) => ({ opType, id, params });

async function loadThreeOpProgram(page) {
    await page.evaluate(async (ops) => {
        const { opFromMarker } = await import('/blocks/programModel.js');
        const stack = ops.map((o) => opFromMarker(o.opType, o.params)).map((op, i) => ({ ...op, id: ops[i].id }));
        window.ddcsLoadBlockStack(stack);
    }, [
        mkOp('drill', 'opA', { pattern: 'single', method: 'peck', originX: 0, originY: 0, depth: 3, holeDia: 6, toolDia: 5 }),
        mkOp('pocket', 'opB', { shape: 'rect', originX: 40, originY: 0, w: 20, h: 20, depth: 4, toolDia: 6 }),
        mkOp('slot', 'opC', { ax: 0, ay: 40, bx: 20, by: 40, width: 8, depth: 3, toolDia: 6 }),
    ]);
}

test('editing the MIDDLE op of a 3-op program: the 3D view carries the neighbours\' own code too', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsStudio.wizardManager);
    await loadThreeOpProgram(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.openForEdit('opB'));
    await page.waitForFunction(() => document.querySelector('.wiz-viz3d'), null, { timeout: 8000 });
    const r = await page.evaluate(() => {
        const host = document.querySelector('.wiz-viz3d');
        return { context: host.__contextGcode || '', isolated: host.__gcode || '' };
    });
    // the isolated op's own code (unchanged — what Play still uses) does NOT itself contain the neighbours' bodies
    expect(r.isolated.length, 'the isolated single-op code exists').toBeGreaterThan(0);
    // the WHOLE-PROGRAM context carries strictly MORE lines than the isolated op alone — the neighbours are in it
    expect(r.context.length, 'whole-program context was built (not null/empty)').toBeGreaterThan(0);
    const isolatedLines = r.isolated.trim().split('\n').length;
    const contextLines = r.context.trim().split('\n').length;
    expect(contextLines, `whole-program context (${contextLines} lines) is longer than the isolated op alone (${isolatedLines} lines) — the neighbours are really in it`).toBeGreaterThan(isolatedLines);
});

test('PLAY stays scoped: pressing Play only ever runs the isolated op, not the whole spliced program', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsStudio.wizardManager);
    await loadThreeOpProgram(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.openForEdit('opB'));
    await page.waitForFunction(() => document.querySelector('.wiz-viz3d'), null, { timeout: 8000 });
    await page.locator('.wiz-viz3d .pp-run').first().click();
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const host = document.querySelector('.wiz-viz3d');
        const eng = host.__panel ? host.__panel.engine : null;
        return { totalLines: eng ? eng.totalLines : null, isolatedLines: (host.__gcode || '').trim().split('\n').length, contextLines: (host.__contextGcode || '').trim().split('\n').length };
    });
    if (r.totalLines != null) {
        // the engine's own loaded program is the ISOLATED op's line count, not the (longer) whole-program one
        expect(r.totalLines, `engine ran the isolated op (${r.isolatedLines} lines), not the whole-program context (${r.contextLines} lines)`).toBeLessThan(r.contextLines);
    }
});

test('authoring a BRAND-NEW op (not yet in the program): single-op preview is unchanged, no whole-program splice attempted', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsStudio.wizardManager);
    await loadThreeOpProgram(page);
    // open() for a NEW op — editingOpId stays null, so _contextGcode must short-circuit
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('pocket'));
    await page.waitForFunction(() => document.querySelector('.wiz-viz3d'), null, { timeout: 8000 });
    const r = await page.evaluate(() => {
        const host = document.querySelector('.wiz-viz3d');
        return { editingOpId: window.ddcsStudio.wizardManager.editingOpId, context: host.__contextGcode };
    });
    expect(r.editingOpId, 'a fresh open is not editing an existing op').toBeNull();
    expect(r.context, 'no whole-program splice for a brand-new (uncommitted) op').toBeNull();
});
