import { test, expect } from '@playwright/test';

/**
 * Headline feature — WRAP A HAND-BUILT STACK: a hand-built run of loose atoms (no op wrapper) can be wrapped in
 * one editable `group` op via the editor's right-click "Group" menu, then edited as a form.
 *
 * t-opchips — REWRITTEN. This used to drive the wrap via an AUTO convenience: a PURE hand-built stack (the
 * whole program is one loose run, no real ops) auto-showed a floating "✎ Hand-built" chip on hover, with NO
 * gesture — click it and it wrapped + opened the form. That convenience shared its DOM element (`#op-edit-chip`)
 * and its hover-to-reveal mechanism with the per-op edit chip the op-chip-row ruling retired outright ("we
 * dont need the hover for these chips and that they can be always visible in the top row") — the persistent
 * chip row only has an entry per EXISTING op (flattenOps), so a program with zero ops has nothing to show a
 * chip for, and the floating element itself is gone.
 *
 * The capability this test actually cares about — wrapping a loose run into an editable group — is UNCHANGED
 * and UNAFFECTED: `groupLooseAtoms` never depended on the auto-chip, only on being CALLED with the right run of
 * ids, and the right-click "Group" menu (showGroupMenu) already resolves that run identically whether the
 * program is a MIXED stack (loose atoms among real ops) or a PURE one (the whole program is loose) — verified
 * live before rewriting this file, not assumed: right-clicking a pure 3-atom stack shows "▣ Group 3 blocks" and
 * wraps all three, the same as it always did for a mixed program's own loose run.
 *
 * ⚠ ONE GENUINE BEHAVIOUR CHANGE, found by this rewrite failing and not by inspection: the OLD auto-chip's own
 * click handler did TWO things — wrap, THEN explicitly `ddcsEditOp` the new group to open its form. The
 * right-click "Group" menu item only does the first (showGroupMenu -> groupLooseAtoms, no follow-up open) — it
 * always has, the mixed-program case just never surfaced it because nobody chained an edit onto a Duplicate-
 * style right-click before. The auto-open is not lost, though: the instant the wrap lands, the new `group` op
 * is a real, top-level op — it shows up as its own chip in the persistent row immediately, so opening it is one
 * more click on THAT chip rather than automatic. This test now drives exactly that two-step gesture.
 *
 * The second test (which existed only to assert that auto-show does NOT fire on a mixed program — a
 * distinction that no longer exists, since nothing auto-shows any more) is retired rather than kept for a
 * premise that stopped being true.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a pure hand-built stack wraps via right-click "Group" → click wraps + edits → writes back → survives reprojection', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsLooseRunAtLine && window.insertWiz);

  // a PURE hand-built stack with one exposed knob (first move's Z → "depth"). No real ops.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: -2 }, _expose: { Z: { p: 'depth', w: 'number' } } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
    { id: 'm2', type: 'move', params: { mode: 'cut', x: 50, y: 60, z: -2, feed: 800 } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // BEFORE: no op; the whole program resolves as one loose run (all 3 atoms) via the SAME right-click path a
  // mixed program already uses.
  const before = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    let hit = 0;
    for (let i = 0; i < n; i++) { const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i); if (r && r.length) hit = Math.max(hit, r.length); }
    return { hasOp: prog.some((b) => b && b.type === 'op'), looseHit: hit };
  });
  expect(before.hasOp, 'starts as loose atoms (no group yet)').toBe(false);
  expect(before.looseHit, 'the whole pure stack resolves as one loose run (3 atoms)').toBe(3);

  // RIGHT-CLICK a loose line → the "▣ Group 3 blocks" menu item → click it (→ groupLooseAtoms → ddcsEditOp).
  const menuText = await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 40, clientY: rect.top + pad + lh / 2 - ed.scrollTop }));
    const menu = document.querySelector('.op-ctx-menu');
    return menu && !menu.hidden ? Array.from(menu.querySelectorAll('button')).map((b) => b.textContent) : [];
  });
  expect(menuText.some((t) => /Group 3 blocks/.test(t)), 'the context menu offers to group all 3 loose atoms').toBe(true);
  await page.evaluate(() => {
    const menu = document.querySelector('.op-ctx-menu');
    const btn = Array.from(menu.querySelectorAll('button')).find((b) => /Group/.test(b.textContent));
    btn.click();
  });
  await page.waitForTimeout(500);   // click: groupLooseAtoms → reload → the new group's own chip renders

  // The click WRAPPED the run into one group op — verify, THEN open it via its own new chip in the row (the
  // auto-open the old chip's click used to do for free is now this one extra, explicit click).
  const wrap = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    return { groups: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length, children: grp ? (grp.children || []).length : -1, id: grp ? grp.id : null };
  });
  expect(wrap.groups, 'right-clicking Group wrapped the run in ONE group op').toBe(1);
  expect(wrap.children, 'the group holds the 3 atoms').toBe(3);
  const chipExists = await page.evaluate((id) => !!document.querySelector(`.op-chip[data-op-id="${id}"]`), wrap.id);
  expect(chipExists, 'the new group op shows up as its own chip in the persistent row immediately').toBe(true);
  await page.click(`.op-chip[data-op-id="${wrap.id}"]`);
  await page.waitForTimeout(400);

  const wrapForm = await page.evaluate(() => {
    const f = document.querySelector('#wiz_user_form [data-param="depth"]');
    return { hasField: !!f, fieldVal: f ? f.value : null };
  });
  expect(wrapForm.hasField, 'clicking the chip opened the form with the derived knob (depth)').toBe(true);
  expect(Number(wrapForm.fieldVal), 'seeded with the child\'s current value (-2)').toBe(-2);

  // EDIT the knob → -7, Insert → writes back to the group child.
  await page.evaluate(async () => {
    const f = document.querySelector('#wiz_user_form [data-param="depth"]');
    f.value = '-7'; f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    await window.insertWiz();
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const child = grp && (grp.children || [])[0];
    return { z: child ? child.params.z : null, gcode: document.getElementById('editor')?.value || '' };
  });
  expect(Number(after.z), 'the edit wrote back to the group child param').toBe(-7);
  expect(after.gcode, 'the G-code reflects the new depth').toContain('Z-7');

  // SURVIVES A REPROJECTION.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);
  const reproj = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const child = grp && (grp.children || [])[0];
    return { groups: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length, z: child ? child.params.z : null };
  });
  expect(reproj.groups, 'one group survives the reproject').toBe(1);
  expect(Number(reproj.z), 'the edit survives the reproject').toBe(-7);
});
