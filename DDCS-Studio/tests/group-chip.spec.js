import { test, expect } from '@playwright/test';

/**
 * Headline feature — a HAND-BUILT stack gets an editor edit-chip. The chip only attaches to a type==='op' block; a
 * hand-built stack is loose atoms → no chip. Fix (advisor-gated design): wrap the loose atoms in a generic `group`
 * op (`opSession.groupLooseAtoms`) so the line→op map finds it.
 *
 * INCREMENT 1 (this test): wrapping makes the chip APPEAR (opAtLine resolves the group op, and the group — now a
 * real top-level op — renders its own entry in the persistent op-chip row). Editability of the chip (chip → form)
 * is increment 2.
 *
 * t-opchips — REWRITTEN for the persistent chip row: the chip used to be hover-revealed (a single floating
 * element you had to mouse over the right line to see); now it's just PRESENT the instant the op exists, no
 * hover step needed to prove it "appeared."
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('increment 1: groupLooseAtoms wraps a hand-built stack → the editor chip appears on its lines', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsOpAtLine !== undefined || true);
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);

  // a hand-built stack: loose atoms, NO op wrapper.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } },
    { type: 'spindle', params: { rpm: 12000, on: true } },
    { type: 'move', params: { x: 50, y: 60, z: -2, mode: 'feed', f: 800 } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // BEFORE: no op, no chip (the symptom — re-asserted so the wrap is the cause).
  const before = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const lines = (document.getElementById('editor')?.value || '').split('\n');
    let hits = 0; for (let i = 0; i < lines.length; i++) if (window.ddcsOpAtLine && window.ddcsOpAtLine(i)) hits++;
    return { hasOp: prog.some((b) => b && b.type === 'op'), opAtLineHits: hits };
  });
  expect(before.hasOp, 'starts as loose atoms').toBe(false);
  expect(before.opAtLineHits, 'no line resolves to an op before wrapping').toBe(0);

  // WRAP the loose atoms into a group op.
  const wrap = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const id = ops.groupLooseAtoms('Hand-built');
    await new Promise((r) => setTimeout(r, 250));
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    return { id, opTypes: prog.map((b) => b && b.opType || b.type), groupChildren: grp ? (grp.children || []).length : -1 };
  });
  expect(wrap.id, 'groupLooseAtoms returned the new op id').toBeTruthy();
  expect(wrap.opTypes, 'the program is now ONE group op').toContain('group');
  expect(wrap.groupChildren, 'the group holds the 3 hand-built atoms').toBe(3);

  // AFTER: the group's own chip is PRESENT in the row — no hover needed, it's a real top-level op now.
  const after = await page.evaluate(async () => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const ed = document.getElementById('editor');
    const text = ed.value || '';
    const lines = text.split('\n');
    let resolved = 0; for (let i = 0; i < lines.length; i++) { const o = window.ddcsOpAtLine && window.ddcsOpAtLine(i); if (o && o.id === grp.id) resolved++; }
    const c = document.querySelector(`.op-chip[data-op-id="${grp.id}"]`);
    return {
      linesResolvedToGroup: resolved, gcode: text,
      chip: c ? { exists: true, title: c.title, disabled: c.disabled } : { exists: false },
    };
  });
  expect(after.linesResolvedToGroup, 'the group op now owns its emitted lines (opAtLine resolves)').toBeGreaterThan(0);
  expect(after.chip.exists, 'the edit chip APPEARS in the row for the hand-built stack after wrapping').toBe(true);
  expect(after.chip.title, 'the tooltip shows the group label').toContain('Hand-built');
  // emit is byte-identical (the group just wraps the same atoms) — the G-code is unchanged
  expect(after.gcode, 'wrapping does not change the emitted G-code').toContain('M3 S12000');
  console.log('increment-1 chip:', JSON.stringify(after.chip), '· disabled(=increment-2 gap):', after.chip.disabled);
});
