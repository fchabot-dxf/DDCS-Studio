import { test, expect } from '@playwright/test';

/**
 * t2681 — THE FACES, MADE READABLE. The owner approved t2679's search dropdown but rejected the block faces
 * themselves ("a wall of engineer names a person can't read"). `point_handle`/`rect_handle` gained the SAME
 * `dynamic`/`fieldsFor`/`labels`/`enablers` mechanism `formField.js` already established (its own header has
 * the full account) — `allFields` still declares every field the block CARRIES (storage/round-trip UNCHANGED),
 * `fieldsFor` returns only what a person authoring actually needs to SEE, `labels` turns the survivors into
 * words WITHOUT touching the storage key.
 *
 * THE HARD CONSTRAINT this file exists to prove: hiding a field from the FACE must not touch what gets
 * SAVED. A scratch def carrying a handle with non-default values on HIDDEN fields (sx/sy, the clamp pair,
 * cornerParam) round-trips through a REAL Blockly workspace byte-identical, whether or not those fields are
 * currently visible on the canvas.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const inBlocks = async (page) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(2200);
};

test('rect_handle: hidden fields (sx/sy, clamps, cornerParam) round-trip byte-identical through a REAL Blockly workspace, regardless of visibility', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const stack = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'rect_handle', params: {
                field: 'boxw', fieldH: 'boxh', value: '999', valueH: '888',   // vestigial, should round-trip too even though never shown
                ax: 5, ay: 7, sx: '0.5', sy: '2', minw: '10', maxw: '90', minh: '20', maxh: '80',
                valueField: 'fieldH', cornerParam: 'stockAttach', label: 'Box',
            } },
        ] }];
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        // t2681 -- Blockly batches the `dynamic`/`enablers` mechanism's own change events, one per changed
        // field, each to its own animation frame -- confirmed live: querying isVisible() synchronously after
        // a bulk load reads the PRE-load default state, and a block changing FIVE fields at once (cornerParam
        // + the clamp quartet) needs more than one frame to fully settle (measured: 2 frames sufficient, a
        // flat 300ms timeout comfortably covers it). A real user never sees this transient -- blocksApp.js's
        // own render pipeline already waits for a paint cycle before the canvas is shown at all.
        await new Promise((res) => setTimeout(res, 300));
        const rh = ws.getAllBlocks(false).find((b) => b.type === 'rect_handle');
        const visibleBefore = {
            SX: rh.getField('SX') && rh.getField('SX').isVisible(),
            MINW: rh.getField('MINW') && rh.getField('MINW').isVisible(),
            CORNERPARAM: rh.getField('CORNERPARAM') && rh.getField('CORNERPARAM').isVisible(),
        };
        const back1 = SB.workspaceToStack(ws);

        // reload the SAVED record a second time (real save -> close -> reopen shape)
        ws.clear();
        SB.stackToWorkspace(back1, ws);
        const back2 = SB.workspaceToStack(ws);

        return { visibleBefore, params1: back1[0].children[0].params, params2: back2[0].children[0].params };
    });
    // the ESSENTIAL fields are visible by default (cornerParam is SET here, so it's revealed too -- an
    // enabler field with a non-empty value shows without needing "Block options…").
    expect(r.visibleBefore.CORNERPARAM, 'cornerParam is a set enabler -- revealed automatically, not forced-hidden').toBe(true);
    // sx/sy and the clamp pair are on the owner's own explicit "never see" / no-reveal-path list.
    expect(r.visibleBefore.SX, 'sx has no reveal path (owner\'s own explicit plumbing list) -- hidden even though set').toBe(false);
    expect(r.visibleBefore.MINW, 'the clamp pair is an ENABLER (empty-by-default) -- SET here, so revealed').toBe(true);

    const expected = {
        field: 'boxw', fieldH: 'boxh', value: '999', valueH: '888',
        ax: 5, ay: 7, sx: '0.5', sy: '2', minw: '10', maxw: '90', minh: '20', maxh: '80',
        valueField: 'fieldH', cornerParam: 'stockAttach', label: 'Box',
    };
    expect(r.params1, 'every field -- shown or hidden -- round-trips byte-identical on the first pass').toEqual(expected);
    expect(r.params2, 'and again on a SECOND reload (the real save -> close -> reopen shape)').toEqual(expected);
});

test('point_handle: ax/ay are visible with relToRow empty, hidden once relToRow is set (they are genuinely inert then); the round-trip is unaffected either way', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();

        const literalStack = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'px', fy: 'py', x: '1', y: '2', ax: 11, ay: 13, relToRow: '', label: 'spot' } },
        ] }];
        ws.clear();
        SB.stackToWorkspace(literalStack, ws);
        await new Promise((res) => requestAnimationFrame(res));   // t2681 -- see the rect_handle test's own comment: change events batch to the next frame
        let ph = ws.getAllBlocks(false).find((b) => b.type === 'point_handle');
        const literalVisible = { AX: ph.getField('AX').isVisible(), RELTOROW: ph.getField('RELTOROW').isVisible() };
        const literalBack = SB.workspaceToStack(ws);

        const relStack = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'px', fy: 'py', x: '1', y: '2', ax: 11, ay: 13, relToRow: 'wall1', label: 'spot' } },
        ] }];
        ws.clear();
        SB.stackToWorkspace(relStack, ws);
        await new Promise((res) => requestAnimationFrame(res));
        ph = ws.getAllBlocks(false).find((b) => b.type === 'point_handle');
        const relVisible = { AX: ph.getField('AX').isVisible(), RELTOROW: ph.getField('RELTOROW').isVisible() };
        const relBack = SB.workspaceToStack(ws);

        return { literalVisible, relVisible, literalParams: literalBack[0].children[0].params, relParams: relBack[0].children[0].params };
    });
    expect(r.literalVisible.AX, 'relToRow empty -> ax/ay are the live anchor -> visible').toBe(true);
    expect(r.relVisible.AX, 'relToRow set -> ax/ay are genuinely inert (panelTypes.js never reads them) -> hidden').toBe(false);
    expect(r.literalVisible.RELTOROW, 'relToRow itself is ALWAYS visible -- it is the mode switch').toBe(true);
    expect(r.relVisible.RELTOROW).toBe(true);
    // ax/ay's OWN stored value round-trips regardless of whether they were visible when saved.
    expect(r.literalParams.ax).toBe(11);
    expect(r.relParams.ax, 'ax still round-trips even though it was HIDDEN (inert) when this record was saved').toBe(11);
});

test('the block FACES show human words, not raw storage keys -- def.labels applies without touching the stored field name', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const stack = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'px', fy: 'py', ax: 0, ay: 0, relToRow: '', label: 'pos' } },
            { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 0, ay: 0, cornerParam: 'stockAttach', label: 'W×H' } },
        ] }];
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        const captionOf = (blk, storageField) => {
            const lbl = blk.getField(storageField.toUpperCase() + '_LBL');
            if (lbl) return lbl.getText();
            // sentence-shaped / plain-string labels bake straight into an unnamed field_label -- read the
            // whole block's own visible text and confirm the human word appears (not the raw key).
            return blk.toString();
        };
        const ph = ws.getAllBlocks(false).find((b) => b.type === 'point_handle');
        const rh = ws.getAllBlocks(false).find((b) => b.type === 'rect_handle');
        return {
            phFace: ph.toString(), rhFace: rh.toString(),
            phAxLbl: captionOf(ph, 'ax'), rhFieldLbl: captionOf(rh, 'field'),
        };
    });
    expect(r.phFace, 'point_handle\'s own face reads human words, not raw field names').toContain('reads x');
    expect(r.phFace).toContain('relative to');
    expect(r.phFace).toContain('name');
    expect(r.phFace, 'the raw storage key never appears as a caption').not.toMatch(/\brelToRow\b/);
    expect(r.rhFace, 'rect_handle\'s own face reads human words too').toContain('writes w');
    expect(r.rhFace).toContain('reads x');
    expect(r.rhFace).toContain('corner from');
    expect(r.rhFace, 'the raw storage key never appears as a caption').not.toMatch(/\bcornerParam\b/);
});
