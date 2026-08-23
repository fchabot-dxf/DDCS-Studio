import { test, expect } from '@playwright/test';

/**
 * Headline feature — increment 2: the grouped run's chip → an EDITABLE FORM.
 *
 * Increment 1 made the chip appear (LOCKED 🔒); increment 3 added the right-click "Group" gesture. This closes the
 * loop: a group's chip is now ✎ (editable), clicking it derives a form from the group's STORED children `_expose`
 * (the OFF-RECORDS path — devMode.deriveGroupDef, NOT the live-workspace deriveAuthoredDef), editing a knob writes
 * surgically back into the bound child param, and the whole thing SURVIVES a reprojection (Blocks-tab round-trip).
 *
 * Verify-first (the advisor's non-negotiable): drive the REAL gesture end-to-end — right-click→Group, click the real
 * chip, the real form opens, edit the real field, insert, then reproject and re-open. No model shortcuts for the gesture.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// dispatch a real contextmenu at editor row `lineIdx`, returning the menu button labels.
async function rightClickEditorLine(page, lineIdx) {
  return page.evaluate((lineIdx) => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    const x = rect.left + 40, y = rect.top + pad + lineIdx * lh + lh / 2 - ed.scrollTop;
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, lineIdx);
}

// t-opchips — the group's chip is now PERSISTENT (no hover needed: it's a real top-level op the instant it's
// grouped, so the row already shows it). Find it by data-op-id, read its state, click it (→ window.ddcsEditOp
// → wizardManager.openForEdit → _openGroupForEdit, async). Returns { exists, disabled, title } — icon-only now,
// so the label (and the increment-1-vs-2 🔒-vs-✎ distinction) lives in `title`/`disabled`, not chip text.
async function clickGroupChip(page) {
  return page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const chip = grp && document.querySelector(`.op-chip[data-op-id="${grp.id}"]`);
    const info = { exists: !!chip, disabled: chip ? chip.disabled : null, title: chip ? chip.title : null };
    if (chip) chip.click();
    return info;
  });
}

test('increment 2: group chip → editable form → edit a knob → writes back → survives reprojection', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsLooseRunAtLine && window.insertWiz);

  // A hand-built stack with ONE EXPOSED knob: the first move's Z is exposed as "depth" (record._expose, the blob #13
  // persists + stackBridge round-trips). FN('z')='Z'. This is the state after a user ticks the knob in the Blocks tab.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: -2 }, _expose: { Z: { p: 'depth', w: 'number' } } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
    { id: 'm2', type: 'move', params: { mode: 'cut', x: 50, y: 60, z: -2, feed: 800 } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // GESTURE: right-click a loose-run line → "Group" → the run becomes one group op.
  const lineIdx = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    for (let i = 0; i < n; i++) { const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i); if (r && r.length) return i; }
    return -1;
  });
  expect(lineIdx, 'found a loose-run line').toBeGreaterThanOrEqual(0);
  await rightClickEditorLine(page, lineIdx);
  await page.evaluate(() => { [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Group/.test(b.textContent)).click(); });
  await page.waitForTimeout(250);

  // The chip is now ENABLED (increment 2) — increment 1 disabled it (🔒), this is clickable.
  const chip = await clickGroupChip(page);
  expect(chip.exists, 'the chip appears in the persistent row for the grouped run').toBe(true);
  expect(chip.disabled, 'increment 2: the group chip is now EDITABLE (not the 🔒 lock)').toBe(false);
  expect(chip.title, 'the tooltip carries the label').toContain('Hand-built');
  await page.waitForTimeout(350);   // _openGroupForEdit is async (dynamic import devMode + render)

  // The form OPENED, derived from the group's stored children: a "depth" field seeded with the child's current Z (-2).
  const form = await page.evaluate(() => {
    const wiz = document.getElementById('wizard');
    const panel = document.getElementById('wiz_user');
    const f = document.querySelector('#wiz_user_form [data-param="depth"]');
    return {
      wizActive: !!(wiz && wiz.classList.contains('active')),
      panelShown: !!(panel && panel.style.display !== 'none'),
      hasField: !!f,
      fieldVal: f ? f.value : null,
    };
  });
  expect(form.wizActive, 'the wizard overlay opened').toBe(true);
  expect(form.panelShown, 'the shared #wiz_user form panel is shown').toBe(true);
  expect(form.hasField, 'the form derived the exposed knob (depth) from the stored children').toBe(true);
  expect(Number(form.fieldVal), 'the knob is seeded with the child\'s current value (z = -2)').toBe(-2);

  // EDIT the knob → -5, then Insert → the value writes surgically back into the group child's z param.
  await page.evaluate(async () => {
    const f = document.querySelector('#wiz_user_form [data-param="depth"]');
    f.value = '-5';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    await window.insertWiz();
  });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const child = grp && (grp.children || [])[0];
    return { z: child ? child.params.z : null, children: grp ? (grp.children || []).length : -1, gcode: document.getElementById('editor')?.value || '' };
  });
  expect(Number(after.z), 'the edit wrote back to the group child param (z = -5)').toBe(-5);
  expect(after.children, 'the group still holds its 3 atoms (surgical edit, not a regenerate)').toBe(3);
  expect(after.gcode, 'the emitted G-code reflects the new depth').toContain('Z-5');

  // SURVIVES A REPROJECTION: leave to Blocks (projects through Blockly) and back — the group, its edited value, and its
  // knob exposure all persist, so re-opening the chip re-derives the form showing -5 (the step incomplete tests skip).
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);

  const reproj = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const groups = prog.filter((b) => b && b.type === 'op' && b.opType === 'group');
    const child = groups[0] && (groups[0].children || [])[0];
    return { groups: groups.length, z: child ? child.params.z : null, hasExpose: !!(child && child._expose) };
  });
  expect(reproj.groups, 'one group survives the reproject').toBe(1);
  expect(Number(reproj.z), 'the edited depth survives the reproject').toBe(-5);
  expect(reproj.hasExpose, 'the knob exposure survives (so the form re-derives)').toBe(true);

  // Re-open the chip after the reproject → the form re-derives from the stored children, now showing the edited -5.
  const chip2 = await clickGroupChip(page);
  expect(chip2.disabled, 'the reprojected group chip is still editable').toBe(false);
  await page.waitForTimeout(350);
  const reField = await page.evaluate(() => { const f = document.querySelector('#wiz_user_form [data-param="depth"]'); return f ? Number(f.value) : null; });
  expect(reField, 're-opening the group after the reproject shows the edited value (-5)').toBe(-5);
});
