import { test, expect } from '@playwright/test';

// t2585 — the project's default test viewport is mobile-sized (412x915); `centerOnBlock`'s own world-to-screen
// math then places a freshly-centred block's own fields OFF the actual visible viewport (found live: a field's
// getBoundingClientRect() reported x≈768 against an innerWidth of 412), so a real mouse click at that computed
// point lands nowhere. A desktop-sized viewport (matching diag_aim_handle's own t2573 precedent) removes that
// as a variable entirely.
test.use({ viewport: { width: 1600, height: 1000 } });

/**
 * BACKLOG #61 follow-up (t2585) — `relTo` was a REAL, working mechanism (`resolveRelToIndex`+`panelStarts`,
 * consumed by `formfield`'s own point-handle relTo socket AND `cross_aim_handle`'s new one, t2583) that no
 * person could actually reach: `simstart` had no `id` FIELD to type a stable row identifier into, so `relToRow`
 * (on both consumers) was only ever set-able via a literal template — this session's own fourth instance of "a
 * declared seam with no way in" (canvasWidgets' un-authorable gestures, the registry's fieldless icon, def.sim's
 * unplaced rig-intent block).
 *
 * THE FIX: `simstart` gains an `id` field (plain author-typed text, matching `formfield`'s own `param` field's
 * shape exactly — the DECLARATION site, never itself a picker). `relToRow` (on BOTH `formfield` and
 * `cross_aim_handle`) becomes a MUST-MATCH picker (`pickerField.js`'s new `pickKind: 'relTo'`), mirroring
 * `HANDLE_ANCHOR_FIELDS`' own CLOSED doctrine (t2525) — a relTo pointing at a row nobody declared is a plain
 * authoring defect, never legitimate forward-authoring, so no `allowNew`.
 *
 * SCOPING NOTE, stated not silently assumed: no NEW save-time "dangling relTo" backstop was added (unlike
 * `handleTargetReport`'s own role for HANDLE_ANCHOR_FIELDS). The picker already prevents the typo case at
 * author time; a row deleted LATER degrades to `panelTypes.js`'s own existing graceful stock-half fallback
 * (t2583) — the SAME code path already used for a row legitimately absent under a `when`-gate at runtime, not a
 * new failure mode this turn introduces. `field` itself (the value the handle actually WRITES) still goes
 * through the pre-existing, already fail-visible HANDLE_ANCHOR_FIELDS/anchorUnresolved doctrine, untouched.
 *
 * VERIFY (reachability, not existence): bridge.js's REAL block generation gives `simstart` a real `ID` field and
 * gives `formfield`/`cross_aim_handle` a REAL `field_picker`-typed `RELTOROW` field (not the raw data-model
 * object tests every prior gesture spec already covers) · the picker's own live candidate enumeration lists a
 * REAL declared simstart id in the SAME workspace, closed (no allowNew) · a REAL save + reload renders both
 * fields correctly and a REAL mouse click on the picker lists and commits the declared id — the reload path,
 * the one t2577 already proved responds to genuine clicks, sidestepping the still-parked API-created-block
 * click bug (t2575/t2581) rather than re-hitting it.
 */

test('bridge.js gives simstart a real ID field, and formfield/cross_aim_handle a real field_picker RELTOROW field (pickKind "relTo", closed — no allowNew)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        const sim = ws.newBlock('simstart'); sim.initSvg(); sim.render();
        const ff = ws.newBlock('formfield'); ff.initSvg(); ff.render();
        const ca = ws.newBlock('cross_aim_handle'); ca.initSvg(); ca.render();
        const idField = sim.getField('ID');
        const ffField = ff.getField('RELTOROW');
        const caField = ca.getField('RELTOROW');
        const out = {
            idFieldExists: !!idField, idFieldType: idField && idField.constructor.name,
            ffFieldExists: !!ffField, ffFieldType: ffField && ffField.constructor.name,
            ffPickKind: ffField && ffField.pickKind, ffAllowNew: ffField && !!ffField.allowNew,
            caFieldExists: !!caField, caFieldType: caField && caField.constructor.name,
            caPickKind: caField && caField.pickKind, caAllowNew: caField && !!caField.allowNew,
        };
        sim.dispose(); ff.dispose(); ca.dispose();
        return out;
    });
    expect(r.idFieldExists, 'simstart has a real ID field').toBe(true);
    expect(r.idFieldType, 'ID is a plain text field, the declaration site, not a picker').not.toBe('FieldPicker');
    expect(r.ffFieldExists, 'formfield has a real RELTOROW field').toBe(true);
    expect(r.ffFieldType, 'RELTOROW is now a FieldPicker, not plain text').toBe('FieldPicker');
    expect(r.ffPickKind).toBe('relTo');
    expect(r.ffAllowNew, 'closed — no forward-authoring, same doctrine as HANDLE_ANCHOR_FIELDS').toBe(false);
    expect(r.caFieldExists, 'cross_aim_handle has a real RELTOROW field').toBe(true);
    expect(r.caFieldType).toBe('FieldPicker');
    expect(r.caPickKind).toBe('relTo');
    expect(r.caAllowNew).toBe(false);
});

test('the relTo picker\'s own live candidate enumeration lists every declared simstart id in the SAME workspace, and nothing when none are declared', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        const ca = ws.newBlock('cross_aim_handle'); ca.initSvg(); ca.render();
        const field = ca.getField('RELTOROW');
        const before = field._candidates();

        const sim1 = ws.newBlock('simstart'); sim1.initSvg(); sim1.render(); sim1.setFieldValue('wall1', 'ID');
        const sim2 = ws.newBlock('simstart'); sim2.initSvg(); sim2.render(); sim2.setFieldValue('wall2', 'ID');
        const sim3 = ws.newBlock('simstart'); sim3.initSvg(); sim3.render();   // no id set -> filtered out (falsy)
        const after = field._candidates();

        sim1.dispose(); sim2.dispose(); sim3.dispose(); ca.dispose();
        return { before, after };
    });
    expect(r.before, 'no simstart rows declared -> no candidates').toEqual([]);
    expect(r.after.sort(), 'both declared ids show, the id-less row is skipped').toEqual(['wall1', 'wall2']);
});

test('REACHABILITY: a real save + reload renders the simstart ID and cross_aim_handle RELTOROW fields, and a REAL mouse click on the picker lists and commits the declared id', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    const OPTYPE = 'user_relto_reach_pilot';
    await page.evaluate(async (t) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp(t); } catch (_) {}
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                    // relToRow starts EMPTY on purpose -- the real mouse click below is what sets it, proving the
                    // picker itself works, not just that a pre-set value round-trips.
                    { type: 'cross_aim_handle', params: { field: 'cross', axisField: 'axisF', signField: 'signF', signPosValue: 'pos', signWhenPos: '1', relToRow: '', label: '↔' } },
                ] },
                { type: 'simstart', params: { anchor: 'frac', fx: '0', fy: '0.75', zplane: 'probe', id: 'wall1' } },
                { type: 'param_group', params: { group: 'Test' }, children: [
                    { type: 'formfield', params: { param: 'axisF', label: 'Axis', dflt: 'X', bindMode: 'opparam', atomType: 'raw', key: 'text', type: 'enum', widget: 'dropdown', options: 'X=X,Y=Y' } },
                    { type: 'formfield', params: { param: 'signF', label: 'Sign', dflt: 'pos', bindMode: 'opparam', atomType: 'message', key: 'text', type: 'enum', widget: 'dropdown', options: 'Positive=pos,Negative=neg' } },
                    { type: 'formfield', params: { param: 'cross', label: 'Cross', dflt: '50', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
                ] },
            ],
            children: [
                { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                { type: 'raw', params: { text: 'X' } },
                { type: 'message', params: { text: 'pos' } },
                { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
            ],
        }];
        U.createUserOp(U.userOpFromStack(t, 'RelTo Reach Pilot', template, [], 'form2d'));
    }, OPTYPE);
    await page.evaluate((t) => window.openWiz(t), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);

    // t2585 — SAME reason as diag_aim_handle's/cross_aim_handle's own parked UI-drive tests: opening BLOCKS view
    // from scratch and dragging these blocks from the flyout hits t2581's own still-open general gesture-
    // creation blocker. Sidestepped exactly as those tests' own headers anticipated -- through the RELOAD path
    // instead (t2577's own proof: a reloaded stack's blocks respond to REAL clicks, unlike an API-created one).
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.showApp);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 'RelTo Reach Pilot');
        return d ? d.opType : null;
    });
    expect(savedOpType, 'the wizard survives a real reload').toBeTruthy();

    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
    // t2577's own finding, cited directly: the REAL reload path uses `window.ddcsLoadBlockStack` (→
    // `programModel.setStack` → Blockly serialization → `stackToWorkspace`), which is what makes a reloaded
    // block's own fields respond to genuine mouse clicks — unlike a block built via the raw `ws.newBlock()`
    // API workaround this arc's own prior tests used only for CREATING new blocks past the flyout-drag blocker.
    await page.evaluate(async (t) => { const U = await import('/blocks/userOps.js'); const d = U.listUserOps().find((x) => x.opType === t); window.ddcsLoadBlockStack(d.template); }, savedOpType);
    await page.waitForTimeout(300);

    const rendered = await page.evaluate(() => {
        const ws = window.__blkws;
        const sim = ws.getAllBlocks(false).find((b) => b.type === 'simstart');
        const ca = ws.getAllBlocks(false).find((b) => b.type === 'cross_aim_handle');
        return { simId: sim && sim.getFieldValue('ID'), caRelTo: ca && ca.getFieldValue('RELTOROW') };
    });
    expect(rendered.simId, 'the reloaded simstart block renders its declared id').toBe('wall1');
    expect(rendered.caRelTo, 'the reloaded cross_aim_handle starts with relToRow still empty (this test sets it via a real click, below)').toBe('');

    // a REAL mouse click on the RELTOROW field opens the picker, lists 'wall1', and clicking it commits.
    await page.evaluate(() => {
        const ws = window.__blkws;
        const ca = ws.getAllBlocks(false).find((b) => b.type === 'cross_aim_handle');
        ws.centerOnBlock(ca.id, true);
    });
    await page.waitForTimeout(400);
    const fieldRect = await page.evaluate(() => {
        const ws = window.__blkws;
        const ca = ws.getAllBlocks(false).find((b) => b.type === 'cross_aim_handle');
        const f = ca.getField('RELTOROW');
        const group = f.fieldGroup_ || f.getSvgRoot();
        const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(fieldRect.x, fieldRect.y);
    await page.waitForTimeout(250);
    const rowText = await page.evaluate(() => document.querySelector('.ddcs-picker-row') && document.querySelector('.ddcs-picker-row').textContent);
    expect(rowText, 'the picker lists the declared simstart id, live from this workspace').toBe('wall1');
    await page.locator('.ddcs-picker-row', { hasText: 'wall1' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(150);

    const committed = await page.evaluate(() => {
        const ws = window.__blkws;
        const ca = ws.getAllBlocks(false).find((b) => b.type === 'cross_aim_handle');
        return ca.getFieldValue('RELTOROW');
    });
    expect(committed, 'a REAL click on the candidate row committed it -- the field is reachable through the palette, not just a template').toBe('wall1');

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);
});
