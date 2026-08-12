import { test, expect } from '@playwright/test';

/**
 * DECLARE the edit, don't INFER it. The form-vs-blocks "edited?" surfaces (chip + word/line glow + Merge/Replace
 * guard) must reflect what the user ACTUALLY edited in Blockly, recorded when the change fires — NOT a diff of a
 * fresh re-derivation against the live stack. The re-derivation can't tell a round-trip representation drift (empty
 * move sockets → `Y0 Z0`; `#var` string → `variable` record) from a real edit, so it false-glowed on a NO-EDIT
 * round-trip of every middle op. These pin both directions: a no-edit round-trip is clean; a real edit is declared.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function seedAndOpen(page, wiz) {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz && window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(async (w) => {
    window.ddcsLoadBlockStack([]);
    window.openWiz(w, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
  }, wiz);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 0, { timeout: 8000 });
  await page.waitForTimeout(400);
  // steady state: emitted-line ancestry ids == workspace ids (the round-trip/reproject has settled, so the drift is
  // applied). t1587 — the SAME condition, read off the projection map instead of the `#blk-gcode` spans: 0bd8b38c
  // deleted that pane from the Blocks shell. `emitMapped(...).map` is where those spans got their `data-src` from,
  // so this is the same ids compared the same way, one layer nearer the source. The assertions below were always
  // model-side (opGlow reads recorded edits, never the DOM), so nothing about the claim moves.
  await page.waitForFunction(() => {
    const ws = window.__blkws;
    if (!ws || !window.ddcsEmitMapped || !window.ddcsGetBlockProgram) return false;
    const map = window.ddcsEmitMapped(window.ddcsGetBlockProgram()).map || [];
    if (!map.length) return false;
    const wsIds = new Set(ws.getAllBlocks(false).map((b) => b.id));
    const srcIds = [...new Set(map.flatMap((src) => src || []).filter(Boolean))];
    return srcIds.length > 0 && srcIds.every((id) => wsIds.has(id));
  }, { timeout: 8000 });
}

test('a NO-EDIT blocks round-trip leaves a middle op un-edited (no false glow from socket-default drift)', async ({ page }) => {
  // t1732 — 'middle' opens the twin now (its coded view is retired); a real insert stores 'user_middle_data'.
  await seedAndOpen(page, 'user_middle_data');
  const r = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_middle_data');
    return { found: !!op, edited: op ? glow.isOpBlockEdited(op.id) : null, ranges: op ? glow.editedRangesForOp(op.id).length : null };
  });
  expect(r.found, 'seeded a middle op').toBe(true);
  expect(r.edited, 'a middle op that was only round-tripped (never hand-edited) is NOT flagged edited').toBe(false);
  expect(r.ranges, 'no lines glow on an unedited op').toBe(0);
});

test('a real block-field edit IS declared (op reads edited + the edited value glows)', async ({ page }) => {
  await seedAndOpen(page, 'surfacing');
  const before = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'surfacing');
    return { id: op.id, edited: glow.isOpBlockEdited(op.id) };
  });
  expect(before.edited, 'clean before any edit').toBe(false);

  // make a REAL block edit: bump a numeric value field on an atom (fires an un-muted Blockly change → declared)
  const did = await page.evaluate((opId) => {
    const ws = window.__blkws;
    const op = ws.getBlockById(opId);
    const num = op.getDescendants(false).find((b) => b.type === 'math_number');
    if (!num) return false;
    num.setFieldValue(String(Number(num.getFieldValue('NUM')) + 7), 'NUM');
    return true;
  }, before.id);
  expect(did, 'found a numeric value field to edit').toBe(true);
  await page.waitForTimeout(200);

  const after = await page.evaluate(async (opId) => {
    const glow = await import('/blocks/opGlow.js');
    return { edited: glow.isOpBlockEdited(opId), ranges: glow.editedRangesForOp(opId).length };
  }, before.id);
  expect(after.edited, 'a real field edit is DECLARED → the op reads edited').toBe(true);
  expect(after.ranges, 'the edited value glows').toBeGreaterThan(0);
});
