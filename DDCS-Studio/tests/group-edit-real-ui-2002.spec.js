import { test, expect } from '@playwright/test';

/**
 * t2002 — setGroupChildParams's REAL UI door, finally driven end to end (parked function-level at t1992: the
 * door needs a derived group def + the generic widget form, more scaffolding than that turn honestly allowed).
 *
 * The door: `window.ddcsEditOp(groupId)` (the editor hover-chip / right-click "✎ Edit" handler) →
 * `wizardManager.openForEdit` → `_openGroupForEdit` → `devMode.deriveGroupDef` derives a generic widget form from
 * the group's STORED children → the user edits a real `[data-param]` field → `window.insertWiz()` (the real
 * Insert button) → `wizardManager.insert()` detects the editing op is a group → `userOpView.applyGroupEdits` →
 * `opSession.setGroupChildParams` writes the edit back into the group's own children.
 *
 * THE SCAFFOLDING THAT MADE THIS BUILDABLE: `deriveGroupDef`'s FRAMING_KNOBS auto-exposes a `progstart`'s own
 * `clearance`/`rpm` and a `progend`'s own `retractZ` as real widget-bound fields WITHOUT needing the `_expose`
 * knob-marking t391 normally requires (framing carries no `_expose` at all — `isAtom` skips it, so it is a fixed,
 * always-on exposure). `groupLooseAtoms` absorbs ADJACENT progstart/progend into a hand-built group's own
 * children (parity with a built-in op's stack) — so a plain `[progstart, move, progend]` triple, once grouped,
 * genuinely renders an editable `clearance` field in the generic form. No group needs custom-op `_expose` seeding
 * to be exercised for real.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.openWiz
        && window.updateWiz && window.insertWiz && window.ddcsEditOp && window.showApp);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);
}

// Real "+ Add as a 2nd operation" gesture (t1942's own established flow, reused from edit-nested-op-1958.spec.js)
// — the path that always produces a `multi_step` wrapper for 2+ top-level ops (groupConsecutiveOps).
async function addSecondOp(page, opType) {
    await page.evaluate((t) => { window.openWiz(t, undefined, true); window.updateWiz(); }, opType);
    await page.evaluate(() => { window.insertWiz(); });   // fire without awaiting — hangs on the confirm dialog
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Add as a 2nd operation")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
}

// Open a group's real generic-widget form via the REAL door (ddcsEditOp, the chip/context-menu handler) and wait
// for the derived form to actually render (`_openGroupForEdit` awaits `deriveGroupDef`'s dynamic import, so the
// DOM lags one microtask behind the call — this is not fire-and-forget from the test's own point of view).
async function openGroupForm(page, groupId) {
    await page.evaluate((gid) => window.ddcsEditOp(gid), groupId);
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForSelector('#wiz_user_form [data-param="clearance"]', { timeout: 8000 });
}

test('(1) TOP-LEVEL → PROMOTED: a hand-built group, wrapped into a multi_step by a real 2nd-op Add, reconciles a field edit through the ACTUAL widget form', async ({ page }) => {
    await boot(page);

    const gidA = await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { type: 'progstart', id: 'ps1', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'move', id: 'm1', params: { mode: 'rapid', x: 10, y: 10, z: 5 } },
            { type: 'progend', id: 'pe1', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ]);
        const ops = await import('/blocks/opSession.js');
        return ops.groupLooseAtoms('Group A', ['m1']);
    });
    expect(gidA, 'the hand-built group actually formed').toBeTruthy();

    const before = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).map((b) => b && b.type));
    expect(before, 'sanity: ONE top-level op before the Add — no wrapper needed yet').toEqual(['op']);

    // THE REAL 2ND-OP GESTURE — promotes the canvas into a multi_step (groupConsecutiveOps: any run of 2+ ops wraps).
    await addSecondOp(page, 'drill');
    const shape = await page.evaluate((gid) => {
        const prog = window.ddcsGetBlockProgram() || [];
        const isTop = prog.some((b) => b && b.id === gid);
        return { topTypes: prog.map((b) => b && b.opType), groupStillTop: isTop };
    }, gidA);
    expect(shape.topTypes, 'the canvas really did promote into ONE multi_step wrapper').toEqual(['multi_step']);
    expect(shape.groupStillTop, 'the group is now NESTED — the case that silently broke before t1958/t1992').toBe(false);

    // THE REAL DOOR: the editor hover-chip / context-menu handler, the generic form it derives, the real widget.
    await openGroupForm(page, gidA);
    const field = page.locator('#wiz_user_form [data-param="clearance"]');
    const baseline = await field.inputValue();
    expect(baseline, 'sanity: the pre-edit form value is NOT the value we are about to seed').not.toBe('37.25');
    await field.fill('37.25');
    await field.dispatchEvent('change');

    // THE REAL INSERT — wizardManager.insert() detects a group edit and calls applyGroupEdits → setGroupChildParams.
    await page.evaluate(() => window.insertWiz());

    const after = await page.evaluate(async (gid) => {
        const pm = await import('/blocks/programModel.js');
        const grp = pm.findOpById(window.ddcsGetBlockProgram() || [], gid);
        const ps = grp && grp.children && grp.children.find((b) => b && b.type === 'progstart');
        return { clearance: ps && ps.params && ps.params.clearance, stillNested: !(window.ddcsGetBlockProgram() || []).some((b) => b && b.id === gid) };
    }, gidA);
    expect(after.stillNested, 'the group is still nested after the commit (Insert did not flatten/replace the wrapper)').toBe(true);
    expect(after.clearance, 'the NESTED group\'s own child reconciled the seeded value, via the real form + real Insert').toBe(37.25);
});

test('(2) GROUP-IN-GROUP: a group dragged inside another group (t1986) still reconciles a field edit through the real form, on the NESTED group only', async ({ page }) => {
    await boot(page);

    const { gidA, gidB } = await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { type: 'progstart', id: 'psA', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'move', id: 'm1', params: { mode: 'rapid', x: 10, y: 10, z: 5 } },
            { type: 'progend', id: 'peA', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
            { type: 'progstart', id: 'psB', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 9, skim: false } },
            { type: 'move', id: 'm2', params: { mode: 'cut', x: 20, y: 20, z: -2, feed: 200 } },
            { type: 'progend', id: 'peB', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ]);
        const ops = await import('/blocks/opSession.js');
        const gidA = ops.groupLooseAtoms('Group A', ['m1']);
        const gidB = ops.groupLooseAtoms('Group B', ['m2']);
        return { gidA, gidB };
    });
    expect(gidA && gidB, 'both hand-built groups formed').toBeTruthy();

    // t1986's own live-confirmed drag: connect Group B's block right after Group A's last child, via Blockly's
    // real connection object (not hand-built JSON) — the same mechanism edit-nested-op-1958.spec.js's own
    // function-level test used, driven here through to the real form instead of a bare setGroupChildParams call.
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(({ gidA, gidB }) => window.__blkws && window.__blkws.getBlockById(gidA) && window.__blkws.getBlockById(gidB), { gidA, gidB }, { timeout: 8000 });
    await page.evaluate(({ gidA, gidB }) => {
        const ws = window.__blkws;
        const blkA = ws.getBlockById(gidA), blkB = ws.getBlockById(gidB);
        const gcodeInput = blkA.getInput('GCODE');
        let cur = gcodeInput.connection.targetBlock();
        while (cur && cur.nextConnection && cur.nextConnection.targetBlock()) cur = cur.nextConnection.targetBlock();
        (cur ? cur.nextConnection : gcodeInput.connection).connect(blkB.previousConnection);
    }, { gidA, gidB });
    await page.evaluate(async () => {
        const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
        window.ddcsLoadBlockStack(workspaceToStack(window.__blkws));
    });
    await page.evaluate(() => window.showApp('studio'));
    await page.waitForTimeout(300);

    const nestCheck = await page.evaluate(({ gidA, gidB }) => {
        const prog = window.ddcsGetBlockProgram() || [];
        return { aTop: prog.some((b) => b && b.id === gidA), bTop: prog.some((b) => b && b.id === gidB) };
    }, { gidA, gidB });
    expect(nestCheck.aTop, 'Group A stays top-level').toBe(true);
    expect(nestCheck.bTop, 'sanity: Group B is genuinely nested inside Group A now, not top-level').toBe(false);

    // Capture Group A's OWN clearance BEFORE touching B, so we can assert A is untouched afterward.
    const aBefore = await page.evaluate(async (gidA) => {
        const pm = await import('/blocks/programModel.js');
        const grp = pm.findOpById(window.ddcsGetBlockProgram() || [], gidA);
        const ps = grp && grp.children && grp.children.find((b) => b && b.type === 'progstart');
        return ps && ps.params && ps.params.clearance;
    }, gidA);

    // THE REAL DOOR, on the NESTED group specifically.
    await openGroupForm(page, gidB);
    const field = page.locator('#wiz_user_form [data-param="clearance"]');
    const baseline = await field.inputValue();
    expect(baseline, 'sanity: B\'s own pre-edit value (9, not A\'s 5) is NOT the value we are about to seed').not.toBe('61.5');
    expect(baseline, 'sanity: the derived form really did seed from B\'s OWN stored clearance (9), not A\'s (5)').toBe('9');
    await field.fill('61.5');
    await field.dispatchEvent('change');
    await page.evaluate(() => window.insertWiz());

    const result = await page.evaluate(async ({ gidA, gidB }) => {
        const pm = await import('/blocks/programModel.js');
        const prog = window.ddcsGetBlockProgram() || [];
        const grpA = pm.findOpById(prog, gidA), grpB = pm.findOpById(prog, gidB);
        const psA = grpA && grpA.children && grpA.children.find((b) => b && b.type === 'progstart');
        const psB = grpB && grpB.children && grpB.children.find((b) => b && b.type === 'progstart');
        return { bStillNested: !prog.some((b) => b && b.id === gidB), clearanceA: psA && psA.params && psA.params.clearance, clearanceB: psB && psB.params && psB.params.clearance };
    }, { gidA, gidB });
    expect(result.bStillNested, 'Group B is still nested inside Group A after the commit').toBe(true);
    expect(result.clearanceB, 'the NESTED group\'s own child reconciled the seeded value').toBe(61.5);
    expect(result.clearanceA, 'the OUTER group\'s own field is untouched by an edit made on its nested child').toBe(aBefore);
});
