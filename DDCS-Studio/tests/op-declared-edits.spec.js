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
  // steady state: panel ancestry ids == workspace ids (the round-trip/reproject has settled, so the drift is applied)
  await page.waitForFunction(() => {
    const ws = window.__blkws, out = document.getElementById('blk-gcode');
    if (!ws || !out) return false;
    const gls = [...out.querySelectorAll('.gl')];
    if (!gls.length) return false;
    const wsIds = new Set(ws.getAllBlocks(false).map((b) => b.id));
    const srcIds = [...new Set(gls.flatMap((sp) => (sp.dataset.src || '').split(',')).filter(Boolean))];
    return srcIds.length > 0 && srcIds.every((id) => wsIds.has(id));
  }, { timeout: 8000 });
}

test('a NO-EDIT blocks round-trip leaves a middle op un-edited (no false glow from socket-default drift)', async ({ page }) => {
  await seedAndOpen(page, 'middle');
  const r = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'middle');
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
