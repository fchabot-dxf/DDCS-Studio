import { test, expect } from '@playwright/test';

/**
 * t750 — MOBILE REACHABILITY guard. The editor op-edit chip was HOVER-ONLY (editorOpHover mousemove), so on a touch
 * device you could never re-open an op for editing from its G-code. The fix reuses the SAME chip + code path
 * (updateChipForLine) behind a touch trigger: a TAP on an op's lines reveals the chip; tap the chip to edit; tap a
 * non-op line to dismiss — desktop stays hover-only (the touch trigger is gated to pointerType 'touch').
 *
 * This spec is also the GUARD: it pins the known touch path (op-edit tap) so a future hover-only control can't ship
 * silently — if the touch trigger regresses, this goes red.
 */

// Insert an EDITABLE custom op (✎, not the 🔒 locked case) so the editor has a live line→op map — same setup as
// custom-op-chip.spec.js. Waits until the map actually resolves the op.
async function seedOp(page, type = 'user_asis') {
  await page.evaluate(async (t) => {
    if (t === 'user_asis') {
      const U = await import('/blocks/userOps.js');
      const template = [{ type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } }];
      U.createUserOp(U.userOpFromStack('asis', 'As Is', template, U.extractParamBlocks(template, new Set(), true), 'form3d'));
    }
    window.openWiz(t);
    await window.ddcsStudio.wizardManager.insert();
    window.closeWiz && window.closeWiz();
  }, type);
  await page.waitForFunction((t) => {
    const op = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op').find((b) => (b.opType || '') === t);
    if (!op || typeof window.ddcsOpAtLine !== 'function' || !window.ddcsLinesForOp) return false;
    const lines = window.ddcsLinesForOp(op.id) || [];
    return lines.length > 0 && lines.some((ln) => { const o = window.ddcsOpAtLine(ln); return o && o.id === op.id; });
  }, type, { timeout: 8000 });
}

// Reveal the chip for an op by dispatching the trigger (touch pointerup, or mouse mousemove) over its mapped lines.
// POLLS the real outcome (t710): the program's line→op map transiently rebuilds after an insert, so a one-shot
// dispatch can race it — keep re-dispatching over the lines until the chip actually shows (bounded).
const revealChip = (page, opType, touch) => page.evaluate(async ({ t, touch }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let round = 0; round < 50; round++) {
    const op = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op').find((b) => (b.opType || '') === t);
    if (op && typeof window.ddcsOpAtLine === 'function') {
      const all = (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || [0];
      const lines = all.length ? all : [0];
      const ed = document.getElementById('editor');
      for (const ln of lines) {
        const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
        const rect = ed.getBoundingClientRect();
        const x = rect.left + 30, y = rect.top + pad + ln * lh + lh / 2 - ed.scrollTop;
        ed.dispatchEvent(touch
          ? new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, clientX: x, clientY: y })
          : new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
        await sleep(15);
        const c = document.getElementById('op-edit-chip');
        if (c && !c.hidden) return { found: true, shown: true, text: c.textContent, disabled: c.disabled, opId: c.dataset.opId, targetOp: op.id };
      }
    }
    await sleep(60);
  }
  return { found: true, shown: false, targetOp: null };
}, { t: opType, touch });

test.describe('touch: op-edit chip', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('a TAP on an op reveals the ✎ Edit chip at 390px; tapping the chip edits; tapping elsewhere dismisses', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.insertWiz && window.ddcsGetBlockProgram && window.ddcsOpAtLine);
    await seedOp(page);
    await page.evaluate(() => { window.__editCalls = []; const o = window.ddcsEditOp; window.ddcsEditOp = (id) => { window.__editCalls.push(id); return o && o(id); }; });

    // 1) TAP reveals the chip (no hover)
    const r = await revealChip(page, 'user_asis', true);
    expect(r.shown, 'a touch tap reveals the chip').toBe(true);
    expect(r.text, 'the chip carries the ✎ edit affordance').toContain('✎');
    expect(r.disabled, 'the op is editable (chip enabled)').toBe(false);
    expect(r.opId, 'the chip targets the tapped op').toBe(r.targetOp);

    // 2) TAP a non-op region (far past the program) → the chip dismisses
    const dismissed = await page.evaluate(async () => {
      const ed = document.getElementById('editor'); const rect = ed.getBoundingClientRect();
      ed.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, clientX: rect.left + 30, clientY: rect.bottom + 400 }));
      await new Promise((r) => setTimeout(r, 60));
      const c = document.getElementById('op-edit-chip'); return !c || c.hidden;
    });
    expect(dismissed, 'tapping a non-op region dismisses the chip').toBe(true);

    // 3) re-reveal, then TAP the chip → the edit path fires for that op
    const r2 = await revealChip(page, 'user_asis', true);
    expect(r2.shown, 're-revealed for the edit check').toBe(true);
    await page.locator('#op-edit-chip').click();
    const edited = await page.evaluate(() => window.__editCalls);
    expect(edited, 'tapping the chip opens that op for editing').toContain(r2.targetOp);
  });
});

test.describe('desktop: hover unchanged (no regression)', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('mouse hover still reveals the chip (the touch trigger did not replace hover)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.insertWiz && window.ddcsGetBlockProgram && window.ddcsOpAtLine);
    await seedOp(page);
    const r = await revealChip(page, 'user_asis', false);
    expect(r.shown, 'hover still reveals the chip on desktop').toBe(true);
    expect(r.text).toContain('✎');
  });
});
