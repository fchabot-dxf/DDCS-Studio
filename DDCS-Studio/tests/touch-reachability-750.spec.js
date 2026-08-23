import { test, expect } from '@playwright/test';

/**
 * t750 — MOBILE REACHABILITY guard. The editor op-edit chip used to be HOVER-ONLY (editorOpHover mousemove), so
 * on a touch device you could never re-open an op for editing from its G-code — the fix (this file, originally)
 * added a tap-to-reveal trigger behind pointerType 'touch'.
 *
 * t-opchips — REWRITTEN. Ruling 1 ("we dont need the hover for these chips and that they can be always visible
 * in the top row") retired reveal-on-any-gesture entirely — the chip is PERSISTENT now, at every width and every
 * input mode, so there is no tap-to-reveal step left to guard and no tap-elsewhere-to-dismiss cycle (nothing was
 * ever hidden to dismiss). What t750's own concern — REACHABILITY on a touch device — still means today: is the
 * chip actually THERE and TAPPABLE at phone width, with no hover precondition a touch device can never satisfy.
 * This file now guards that instead, at both phone width and desktop (the SAME persistent chip, not two paths
 * to keep in sync — there is no separate "touch path" any more to regress out of sync with a "desktop path").
 */

// Insert an EDITABLE custom op (✎, not the 🔒 locked case) so the editor has a live line→op map — same setup as
// custom-op-chip.spec.js. Waits until the map actually resolves the op AND its chip has rendered.
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
    return !!(op && document.querySelector(`.op-chip[data-op-id="${op.id}"]`));
  }, type, { timeout: 8000 });
}

test.describe('touch: persistent op chip', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the chip is visible with NO gesture at 390px (touch); tapping it edits that op', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.insertWiz && window.ddcsGetBlockProgram);
    await seedOp(page);
    await page.evaluate(() => { window.__editCalls = []; const o = window.ddcsEditOp; window.ddcsEditOp = (id) => { window.__editCalls.push(id); return o && o(id); }; });

    // t-opchips — NO gesture at all: the chip is already there, straight after seeding, on a fresh touch page
    // load. This is the whole point of ruling 1 — reachability no longer depends on a tap-to-reveal step a
    // touch device could get wrong (or a user could not discover).
    const chip = await page.evaluate(() => {
      const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
      const el = op && document.querySelector(`.op-chip[data-op-id="${op.id}"]`);
      return el ? { exists: true, disabled: el.disabled, opId: el.dataset.opId, targetOp: op.id } : { exists: false };
    });
    expect(chip.exists, 'the chip is present with no tap/hover needed').toBe(true);
    expect(chip.disabled, 'the op is editable (chip enabled)').toBe(false);
    expect(chip.opId, 'the chip targets the seeded op').toBe(chip.targetOp);

    // TAP the chip → the edit path fires for that op (a real touch tap, not a mouse click standing in for one).
    const box = await page.locator(`.op-chip[data-op-id="${chip.targetOp}"]`).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const edited = await page.evaluate(() => window.__editCalls);
    expect(edited, 'tapping the chip opens that op for editing').toContain(chip.targetOp);
  });
});

test.describe('desktop: the same persistent chip (no separate path to regress out of sync)', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('the chip is visible with no hover needed on desktop either; clicking it edits that op', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.insertWiz && window.ddcsGetBlockProgram);
    await seedOp(page);
    const chip = await page.evaluate(() => {
      const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
      return op ? { exists: !!document.querySelector(`.op-chip[data-op-id="${op.id}"]`), targetOp: op.id } : { exists: false };
    });
    expect(chip.exists, 'the chip is present on desktop too, no hover needed to reveal it').toBe(true);
    await page.click(`.op-chip[data-op-id="${chip.targetOp}"]`);
    await page.waitForTimeout(150);
    const wizActive = await page.evaluate(() => document.getElementById('wizard').classList.contains('active'));
    expect(wizActive, 'clicking the chip opened the wizard').toBe(true);
  });
});
