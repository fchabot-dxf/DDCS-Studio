import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71 (t2557, the eighth and last-assessed gesture) — the GUI PROBE-VECTOR-HANDLE canvas block.
 * `probe_vector_handle`, nested inside a `feature_canvas` block's own mouth, DECLARES a draggable AXIS-ALIGNED
 * probe-reach handle: a fixed anchor (cx/cy, the probe's own start point) + THREE role-tagged params sharing
 * one group — `field` (dist, a number) + `fieldAxis` ('X'/'Y') + `fieldDir` ('pos'/'neg') — each a MUST-MATCH
 * picker (bridge.js HANDLE_ANCHOR_FIELDS) naming an EXISTING param an "Op Param" `formfield` elsewhere in the
 * stack already binds. Same template as `rect_handle` (two role-tagged params, one group) extended to three.
 *
 * THE ONE GENUINE DIFFERENCE from every prior gesture: `fieldAxis`/`fieldDir` are ENUM STRINGS, not numbers —
 * canvasWidgets.js's own probeVector.drag() (declared, never wired until now) writes 'X'/'Y' and 'pos'/'neg'
 * literally. `panelTypes.js`'s `_writeParam` used to round EVERY write via `r3()` unconditionally, which would
 * have silently corrupted these to an unmatched `<select>` value — fixed as its own, separately-committed
 * change (t2557 pt1, `write-param-enum-guard-2557.spec.js`) before this block was wired on top of it.
 *
 * VERIFY (assert-the-value): round-trip (all 3 roles, resolved + unresolved) · gesture math (cardinal snap +
 * clamp, an independent truth) · authored + dragged through the REAL UI (the t2517/t2525 bar) · a real reload
 * survives · emit CHANGES for BOTH the enum outputs and the numeric one.
 */

const OPTYPE = 'user_pv_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'probe_vector_handle', params: { field: 'dist', fieldAxis: 'axis', fieldDir: 'dir', cx: '0', cy: '0', minR: '', maxR: '', label: 'probe' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'axis', label: 'Axis', dflt: 'X', bindMode: 'opparam', atomType: 'raw', key: 'text', type: 'enum', widget: 'dropdown', options: 'X=X,Y=Y' } },
                { type: 'formfield', params: { param: 'dir', label: 'Dir', dflt: 'pos', bindMode: 'opparam', atomType: 'message', key: 'text', type: 'enum', widget: 'dropdown', options: 'Positive=pos,Negative=neg' } },
                { type: 'formfield', params: { param: 'dist', label: 'Dist', dflt: '20', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'raw', params: { text: 'X' } },
            { type: 'message', params: { text: 'pos' } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'PV Pilot', template, [], 'form2d'));
`;

test('round-trip: a probe_vector_handle nested in feature_canvas MERGES its anchor onto all THREE real bindings it names, or fails visibly if one is missing', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'probe_vector_handle', params: { field: 'dist', fieldAxis: 'axis', fieldDir: 'dir', cx: '0', cy: '0', minR: '', maxR: '', label: 'probe' } },
        ] };
        const real = [
            { param: 'dist', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 20, blockIndex: 0 },
            { param: 'axis', type: 'enum', match: { type: 'progstart' }, key: 'dir', default: 'X', blockIndex: 0 },
            { param: 'dir', type: 'enum', match: { type: 'progend' }, key: 'end', default: 'pos', blockIndex: 1 },
        ];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedAnchors = U.handleBindingsFromStack([fc], real.slice(0, 1));   // no real binding named 'axis'/'dir' -> one resolved, two unresolved
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one probe_vector_handle -> three anchor entries (dist/axis/dir)').toBe(3);
    const byRole = Object.fromEntries(r.anchors.map((a) => [a.role, a]));
    expect(byRole.dist.param).toBe('dist');
    expect(byRole.axis.param).toBe('axis');
    expect(byRole.dir.param).toBe('dir');
    expect(byRole.dist.match, 'MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(byRole.axis.key).toBe('dir');
    expect(byRole.dir.key).toBe('end');
    expect(byRole.dist.anchor).toEqual({ kind: 'probeVector', cx: 0, cy: 0, minR: null, maxR: null, label: 'probe' });
    expect(r.merged.filter((b) => ['dist', 'axis', 'dir'].includes(b.param)).length).toBe(3);
    // reverse round-trip
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'probe_vector_handle', params: { field: 'dist', fieldAxis: 'axis', fieldDir: 'dir', value: '20', cx: '0', cy: '0', minR: '', maxR: '', label: 'probe' } }]);
    // FAIL VISIBLY: axis/dir don't resolve -> anchorUnresolved for those two, dist still resolves
    expect(r.unresolvedAnchors.filter((a) => a.anchorUnresolved).length).toBe(2);
    expect(r.unresolvedAnchors.find((a) => a.role === 'dist').anchorUnresolved).toBeFalsy();
});

test('the PROBE-VECTOR gesture writes the CARDINAL-SNAPPED axis/dir enums + the clamped distance from its fixed anchor (assert the values, not just moved)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { cx: 0, cy: 0, axis: 'X', dir: 'pos', dist: 20, field: 'dist', fieldAxis: 'axis', fieldDir: 'dir', minR: 1, maxR: 100, label: 'probe' };
        const place = CANVAS_GESTURES.probeVector.place(d);                              // at rest: (cx + 20, cy) = (20, 0)
        const dragX = CANVAS_GESTURES.probeVector.drag(d, { x: 35, y: 5 });              // |35|>=|5| -> axis X, dx>=0 -> pos, dist = hypot(35,5)
        const dragYneg = CANVAS_GESTURES.probeVector.drag(d, { x: -3, y: -40 });         // |−3|<|−40| -> axis Y, dy<0 -> neg
        const dragClamped = CANVAS_GESTURES.probeVector.drag(d, { x: 0.2, y: 0.1 });     // hypot ~0.22, below minR(1) -> clamps to 1
        return { place, dragX, dragYneg, dragClamped };
    });
    expect(r.place, 'the handle rests at the anchor + dist along the axis/dir').toEqual({ x: 20, y: 0, kind: 'size', label: 'probe', value: 20 });
    expect(r.dragX.axis, 'a drag mostly along X snaps axis to X').toBe('X');
    expect(r.dragX.dir, 'a positive X drag snaps dir to pos').toBe('pos');
    expect(r.dragX.dist, 'the distance is the real hypot, not the raw axis component').toBeCloseTo(Math.hypot(35, 5), 6);
    expect(r.dragYneg.axis, 'a drag mostly along Y snaps axis to Y').toBe('Y');
    expect(r.dragYneg.dir, 'a negative Y drag snaps dir to neg').toBe('neg');
    expect(r.dragClamped.dist, 'a drag below the declared minR clamps at the bound').toBe(1);
});

test('a probe-vector-handle op: def.bindings MERGE the anchor onto all three real bindings; layoutSpecFromOp renders the handle; emit CHANGES for the enum outputs AND the numeric one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    await page.evaluate(async (code) => { await eval('(async()=>{' + code + '})()'); }, PILOT.replace(/\$\{OPTYPE\}/g, OPTYPE));
    await page.evaluate((t) => window.openWiz(t), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(async (t) => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const params = U.defaultParams(def);
        const anchored = (def.bindings || []).filter((b) => b.anchor);
        const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const h = (spec.handles || []).find((x) => /_probe$/.test(x.id));
        const base = U.defaultParams(def);
        const emitDefault = emitMapped(builderOf(t)(base)).text;
        const emitAxis = emitMapped(builderOf(t)({ ...base, axis: 'Y' })).text;
        const emitDir = emitMapped(builderOf(t)({ ...base, dir: 'neg' })).text;
        const emitDist = emitMapped(builderOf(t)({ ...base, dist: 40 })).text;
        return {
            anchorCount: anchored.length, anchorKinds: anchored.map((b) => b.anchor.kind),
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y,
            axisChanges: emitDefault !== emitAxis, dirChanges: emitDefault !== emitDir, distChanges: emitDefault !== emitDist,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorCount, 'all three role-tagged bindings (dist/axis/dir) now carry the merged anchor').toBe(3);
    expect(r.anchorKinds, 'every one declares the SAME probeVector kind').toEqual(['probeVector', 'probeVector', 'probeVector']);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable probe-vector handle for the merged bindings').toBe(true);
    expect(r.handleX, "the handle sits at cx(0) + dist(20, from the formfield's own dflt) along X").toBe(20);
    expect(r.handleY).toBe(0);
    expect(r.axisChanges, 'the axis enum reaches emit').toBe(true);
    expect(r.dirChanges, 'the dir enum reaches emit').toBe(true);
    expect(r.distChanges, 'the numeric dist reaches emit').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2517/t2525 BAR: three formfields placed FIRST, then feature_canvas + probe_vector_handle picking all three, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes the axis dropdown, dir dropdown, AND dist field, and the emitted G-code', async ({ page }) => {
    async function clearSearch() { await page.evaluate(() => { const s = document.querySelector('.blk-search'); if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(100); }
    async function searchFor(text) { await clearSearch(); const s = page.locator('.blk-search'); await s.click(); await s.fill(text); await page.waitForTimeout(250); }
    async function flyoutBlockCenter(type) {
        return page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            if (!blk) return null;
            const root = blk.getSvgRoot();
            const target = root.querySelector('text.blocklyText, .blocklyText') || root.querySelector('path.blocklyPath') || root;
            const rect = target.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }, type);
    }
    async function flyoutDragOffset(type, wantNext) {
        return page.evaluate(({ t, wantNext }) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const grabRect = (root.querySelector('text.blocklyText, .blocklyText') || root).getBoundingClientRect();
            const grabPt = { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 };
            const conn = wantNext ? blk.previousConnection : (blk.previousConnection || blk.outputConnection);
            if (!conn) return { dx: 0, dy: 0 };
            const off = conn.getOffsetInBlock();
            const blockRect = root.getBoundingClientRect();
            const connScreen = { x: blockRect.left + off.x * fws.scale, y: blockRect.top + off.y * fws.scale };
            return { dx: grabPt.x - connScreen.x, dy: grabPt.y - connScreen.y };
        }, { t: type, wantNext: !!wantNext });
    }
    async function dragFlyoutBlockTo(type, targetPt) {
        const grab = await flyoutBlockCenter(type);
        const off = await flyoutDragOffset(type);
        const dropX = targetPt.x + off.dx, dropY = targetPt.y + off.dy;
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 5 });
        await page.mouse.move(dropX, dropY, { steps: 20 });
        await page.waitForTimeout(80);
        await page.mouse.move(dropX, dropY, { steps: 2 });
        await page.mouse.up();
        await page.waitForTimeout(300);
    }
    async function mouthPoint(blockType, inputName) {
        return page.evaluate(({ blockType, inputName }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
            const inp = blk.inputList.find((i) => i.name === inputName);
            const off = inp.connection.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, { blockType, inputName });
    }
    async function stackBottomPoint(blockType, nth) {
        return page.evaluate(({ t, nth }) => {
            const ws = window.__blkws;
            const blks = ws.getAllBlocks(false).filter((b) => b.type === t);
            const blk = blks[nth || 0];
            const conn = blk.nextConnection;
            const off = conn.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, { t: blockType, nth });
    }
    async function centerOn(blockType, nth) {
        await page.evaluate(({ t, nth }) => { const ws = window.__blkws; const blks = ws.getAllBlocks(false).filter((b) => b.type === t); const blk = blks[nth || 0]; if (blk) ws.centerOnBlock(blk.id, true); }, { t: blockType, nth });
        await page.waitForTimeout(400);
    }
    async function fieldRect(blockType, fieldName, nth) {
        return page.evaluate(({ blockType, fieldName, nth }) => {
            const ws = window.__blkws;
            const blks = ws.getAllBlocks(false).filter((b) => b.type === blockType);
            const blk = blks[nth || 0];
            const f = blk.getField(fieldName);
            const group = f.fieldGroup_ || f.getSvgRoot();
            const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, { blockType, fieldName, nth });
    }
    async function setDropdownField(blockType, fieldName, optionText, nth) {
        await clearSearch();
        await centerOn(blockType, nth);
        const rect = await fieldRect(blockType, fieldName, nth);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.blocklyMenuItem', { hasText: optionText }).first().click({ timeout: 3000 });
        await page.waitForTimeout(150);
    }
    async function setTextField(blockType, fieldName, value, nth) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName, nth);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(150);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(String(value));
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
    }
    async function setPickerField(blockType, fieldName, matchText, nth) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName, nth);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.ddcs-picker-row', { hasText: matchText }).first().click({ timeout: 3000 });
        await page.waitForTimeout(150);
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // 1) user_root
    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    // 2) progstart + raw + message + progend into EXECUTION. dist targets progstart.clearance (a real numeric
    //    field); axis/dir target `raw`.text/`message`.text (VERBATIM emit) rather than progstart.dir/progend.end
    //    -- both of THOSE fields binarize their own real semantics (dir==='ccw'?'M4':'M3', end==='M2'?'M2':'M30')
    //    so an arbitrary 'X'/'Y' or 'pos'/'neg' write wouldn't visibly change their emitted line at all, which
    //    would make this test's own emit-changes assertion fail for a reason UNRELATED to the wiring being
    //    tested (caught live: an earlier version of this test used progstart.dir/progend.end and failed exactly
    //    this way -- not a wiring bug, a bad choice of synthetic write TARGET).
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);
    let bottom = await stackBottomPoint('progstart');
    await searchFor('raw g-code');
    await dragFlyoutBlockTo('raw', bottom);
    bottom = await stackBottomPoint('raw');
    await searchFor('message');
    await dragFlyoutBlockTo('message', bottom);
    bottom = await stackBottomPoint('message');
    await searchFor('program end');
    await dragFlyoutBlockTo('progend', bottom);

    // 3) param_group into PRESENTATION, then THREE formfields (axis -> raw.text, dir -> message.text,
    //    dist -> progstart.clearance) -- BEFORE the handle, since its own pickers need these params to exist.
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    await setTextField('formfield', 'PARAM', 'axis');
    await setTextField('formfield', 'LABEL', 'Axis');
    await setDropdownField('formfield', 'WIDGET', 'Dropdown');
    await setTextField('formfield', 'OPTIONS', 'X=X,Y=Y');
    await setTextField('formfield', 'DFLT', 'X');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'raw');
    await setTextField('formfield', 'KEY', 'text');

    const ff1Bottom = await stackBottomPoint('formfield');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', ff1Bottom);
    await setTextField('formfield', 'PARAM', 'dir', 1);
    await setTextField('formfield', 'LABEL', 'Dir', 1);
    await setDropdownField('formfield', 'WIDGET', 'Dropdown', 1);
    await setTextField('formfield', 'OPTIONS', 'Positive=pos,Negative=neg', 1);
    await setTextField('formfield', 'DFLT', 'pos', 1);
    await setDropdownField('formfield', 'BINDMODE', 'Op Param', 1);
    await setPickerField('formfield', 'ATOMTYPE', 'message', 1);
    await setTextField('formfield', 'KEY', 'text', 1);

    const ff2Bottom = await stackBottomPoint('formfield', 1);
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', ff2Bottom);
    await setTextField('formfield', 'PARAM', 'dist', 2);
    await setTextField('formfield', 'LABEL', 'Dist', 2);
    await setTextField('formfield', 'DFLT', '20', 2);
    await setDropdownField('formfield', 'BINDMODE', 'Op Param', 2);
    await setPickerField('formfield', 'ATOMTYPE', 'progstart', 2);
    await setTextField('formfield', 'KEY', 'clearance', 2);

    // 4) feature_canvas stacked after param_group, then probe_vector_handle into ITS OWN mouth, picking all three
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await setDropdownField('feature_canvas', 'PANEL', '+ 2D');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('probe vector handle');
    await dragFlyoutBlockTo('probe_vector_handle', fcMouth);
    await setPickerField('probe_vector_handle', 'FIELD', 'dist');
    await setPickerField('probe_vector_handle', 'FIELDAXIS', 'axis');
    await setPickerField('probe_vector_handle', 'FIELDDIR', 'dir');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        const h = ws.getAllBlocks(false).find((b) => b.type === 'probe_vector_handle');
        return { field: h.getFieldValue('FIELD'), fieldAxis: h.getFieldValue('FIELDAXIS'), fieldDir: h.getFieldValue('FIELDDIR') };
    });
    expect(fieldsSet.field, 'the picker committed an EXISTING param name, not free text').toBe('dist');
    expect(fieldsSet.fieldAxis).toBe('axis');
    expect(fieldsSet.fieldDir).toBe('dir');

    // 5) save via the REAL dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2557 probe vector handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2557 probe vector handle pilot (live)');
        return d ? d.opType : null;
    });
    expect(savedOpType, 'the saved wizard survives a REAL reload, found by listUserOps').toBeTruthy();

    await page.evaluate((t) => window.openWiz(t), savedOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const rendered = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const c = document.getElementById('userVizContainer');
        const svg = c && c.querySelector('svg');
        return {
            hasAxisField: !!f.querySelector('[data-param="axis"]'), hasDirField: !!f.querySelector('[data-param="dir"]'), hasDistField: !!f.querySelector('[data-param="dist"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, rect.fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasAxisField && rendered.hasDirField && rendered.hasDistField, 'all three params render real form rows').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'exactly one interactive handle renders on the canvas').toBe(1);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle, mostly along +X (so axis snaps to 'X', dir
    // to 'pos' -- same as the default, but the DISTANCE moves) then a second drag mostly along -Y (axis 'Y',
    // dir 'neg' -- both enums flip from their defaults) to prove the enum outputs genuinely reach the form.
    const axisBefore = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="axis"]').value);
    const dirBefore = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="dir"]').value);
    const distBefore = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="dist"]').value);

    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('circle.fc-handle, rect.fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    // t2557 — measured live: this canvas's WORLD Y is inverted relative to SCREEN Y (the standard CNC-canvas
    // convention, Y-up world vs Y-down screen). Dragging the mouse UP (screen y - 70) produced world dy >= 0
    // ('pos', not 'neg') even though axis correctly snapped to Y -- confirms the gesture math itself is right,
    // the FIRST drag direction chosen for this test was just screen-relative instead of world-relative. Dragging
    // DOWN on screen (y + 70) is world dy < 0 -> 'neg'.
    await page.mouse.move(handleRect.x, handleRect.y + 70, { steps: 15 });   // mostly screen-down -> world -Y -> axis Y, dir neg
    await page.mouse.move(handleRect.x, handleRect.y + 70, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const axisAfter = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="axis"]').value);
    const dirAfter = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="dir"]').value);
    const distAfter = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="dist"]').value);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2557-probe-vector-handle-emit-wired.png', clip: _b }); }

    const emit = await page.evaluate(async ({ t, axisBefore, dirBefore, distBefore, axisAfter, dirAfter, distAfter }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, axis: axisBefore, dir: dirBefore, dist: Number(distBefore) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, axis: axisAfter, dir: dirAfter, dist: Number(distAfter) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, axisBefore, dirBefore, distBefore, axisAfter, dirAfter, distAfter });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(axisAfter, 'a REAL mouse drag on the SVG handle changed the axis dropdown to the STRING "Y" (never "NaN"/empty)').toBe('Y');
    expect(dirAfter, 'the dir dropdown changed to the STRING "neg"').toBe('neg');
    expect(Number(distAfter), 'the dist field changed to a real number reflecting the drag distance').not.toBe(Number(distBefore));
    expect(emit.emitAfter, 'the exact before/after field values a real drag produced emit DIFFERENT G-code').not.toBe(emit.emitBefore);
});
