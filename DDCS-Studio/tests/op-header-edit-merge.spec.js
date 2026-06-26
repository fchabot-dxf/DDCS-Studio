import { test, expect } from '@playwright/test';

/**
 * BLOCKS-TAB CLOBBER GUARD (NEAR #3) — the counterpart to op-params-complete.spec.js.
 *
 * Typed ops (corner/edge/middle/circular) render as a header block (a dropdown + flags) wrapping their atoms in an
 * editable `DO` body (bridge.js gives every op a DO input; stackBridge fills it with editable atoms). So a coarse
 * header-dropdown change can collide with a fine-grained hand-edit of the body. The Blocks-tab field-change listener
 * (blocksApp.js) MUST route a header change on a hand-edited op through `mergeOpBlocks` (3-way merge, preserves the
 * edit) — NOT the wholesale `replaceOp` (rebuilds from params, silently clobbers the body). That guard is the fix;
 * this is its regression test. Without it, flipping the dropdown wipes the injected atom and the op reads pristine.
 *
 * Symptom-level, not unit-level: it drives the ACTUAL gesture (setFieldValue on the header block in __blkws) so the
 * real listener decides merge-vs-replace, then asserts the injected body atom survived.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const MARKER = 'SENTINEL_BLOCK_EDIT_42';

const openBlocks = async (page) => {
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length >= 0);
  await page.waitForTimeout(150);   // let the change listener settle after the model→workspace rebuild
};

test('Blocks-tab header-dropdown edit on a hand-edited typed op MERGES (preserves the body), never clobbers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.closeWiz
    && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack && window.showApp);

  // 1. Insert an edge probe — a typed header op (edge_op: an AXIS dropdown + an editable DO body).
  const opId = await page.evaluate(async () => {
    window.ddcsLoadBlockStack([]);
    window.openWiz('edge', undefined, true);   // third arg bypasses the hardware prereq prompt
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'edge');
    return op ? op.id : null;
  });
  expect(opId, 'edge probe op was inserted').toBeTruthy();

  // 2. Hand-edit: inject a distinctive raw atom into the op's DO body — a block-only edit with no form counterpart.
  //    (ddcsGetBlockProgram round-trips into ddcsLoadBlockStack — it's exactly what replaceOp/mergeOpBlocks feed it.)
  const preEdited = await page.evaluate(async ({ opId, MARKER }) => {
    const glow = await import('/blocks/opGlow.js');
    const prog = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b }));
    const op = prog.find((b) => b && b.id === opId);
    op.children = [...(op.children || []), { type: 'raw', id: 'raw_marker_42', params: { text: MARKER } }];
    window.ddcsLoadBlockStack(prog);
    (await import('/blocks/opEdits.js')).recordEdit(opId, 'raw_marker_42', {});   // declare the injection (a live drag fires this; the model-poke can't)
    return glow.isOpBlockEdited(opId);
  }, { opId, MARKER });
  expect(preEdited, 'injecting a body atom makes the op read as block-edited (precondition)').toBe(true);

  // 3. The REAL gesture under test: flip the AXIS header dropdown on the edge_op block in the Blocks workspace.
  await openBlocks(page);
  const flip = await page.evaluate(() => {
    const ws = window.__blkws;
    const blk = ws.getAllBlocks().find((b) => b.type === 'edge_op');
    if (!blk) return { ok: false, reason: 'no edge_op block in the workspace' };
    const before = blk.getFieldValue('AXIS');
    const next = before === 'X' ? 'Y' : 'X';
    blk.setFieldValue(next, 'AXIS');   // fires the field-change listener → its merge-vs-replace decision
    return { ok: true, before, next };
  });
  expect(flip.ok, flip.reason).toBe(true);
  await page.waitForTimeout(250);   // let the listener merge + reload the stack

  // 4. Assert the header change applied AND the injected atom survived AND the op still reads as block-edited.
  //    Under the buggy replaceOp path, children would be rebuilt from params: no marker, stillEdited === false.
  const after = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'edge');
    return {
      axis: op && op.params && op.params.axis,
      childrenJson: JSON.stringify((op && op.children) || []),
      stillEdited: op ? glow.isOpBlockEdited(op.id) : null,
    };
  });

  expect(after.axis, 'header dropdown change reached params').toBe(flip.next);
  expect(after.childrenJson, 'injected body atom survived the header flip (merged, not clobbered)').toContain(MARKER);
  expect(after.stillEdited, 'op still block-edited → the hand-edit was preserved, not wholesale-rebuilt').toBe(true);
});
