import { test, expect } from '@playwright/test';

/**
 * Headline feature — AUTO layer: a PURE hand-built stack (the whole program is one loose run, no real ops) auto-shows
 * the editable ✎ chip with NO right-click gesture. No model mutation on render — the chip just appears (resolved via
 * ddcsAutoGroupRunAtLine); clicking it WRAPS the run in a group op (groupLooseAtoms) then opens the increment-2 form.
 *
 * Advisor constraint (verified by the 2nd test): auto-show ONLY when the whole program is a single loose run. A MIXED
 * program (loose runs among real ops) does NOT auto-show — the right-click "Group" gesture owns those.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('AUTO: a pure stack auto-shows the chip (no gesture) → click wraps + edits → writes back → survives reprojection', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsAutoGroupRunAtLine && window.insertWiz);

  // a PURE hand-built stack with one exposed knob (first move's Z → "depth"). No real ops → the unambiguous AUTO case.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: -2 }, _expose: { Z: { p: 'depth', w: 'number' } } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
    { id: 'm2', type: 'move', params: { mode: 'cut', x: 50, y: 60, z: -2, feed: 800 } },
  ]));
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(300);

  // BEFORE: no op; the WHOLE program resolves as one auto-group run (all 3 atoms).
  const before = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    let autoHit = 0;
    for (let i = 0; i < n; i++) { const r = window.ddcsAutoGroupRunAtLine && window.ddcsAutoGroupRunAtLine(i); if (r && r.length) autoHit = Math.max(autoHit, r.length); }
    return { hasOp: prog.some((b) => b && b.type === 'op'), autoHit };
  });
  expect(before.hasOp, 'starts as loose atoms (no group yet — no mutation on render)').toBe(false);
  expect(before.autoHit, 'the whole pure stack resolves as one auto-group run (3 atoms)').toBe(3);

  // HOVER (no right-click!) → the ✎ chip appears AUTOMATICALLY, then click it (→ wrap + edit).
  const chip = await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + lh / 2 - ed.scrollTop }));
    const c = document.getElementById('op-edit-chip');
    const info = { hidden: c.hidden, disabled: c.disabled, text: c.textContent };
    c.click();   // → groupLooseAtoms(autoRun) → ddcsEditOp(newGroup)
    return info;
  });
  expect(chip.hidden, 'the chip auto-appears on hover with NO gesture').toBe(false);
  expect(chip.disabled, 'and it is editable (✎, not 🔒)').toBe(false);
  expect(chip.text, 'the auto-chip is the hand-built editor').toContain('✎');
  expect(chip.text).toContain('Hand-built');
  await page.waitForTimeout(500);   // click: groupLooseAtoms (reload) → _openGroupForEdit (async import + render)

  // The click WRAPPED the run (the explicit mutation, not on render) and opened the increment-2 form.
  const wrapForm = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const f = document.querySelector('#wiz_user_form [data-param="depth"]');
    return { groups: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length, children: grp ? (grp.children || []).length : -1, hasField: !!f, fieldVal: f ? f.value : null };
  });
  expect(wrapForm.groups, 'clicking the auto-chip wrapped the run in ONE group op').toBe(1);
  expect(wrapForm.children, 'the group holds the 3 atoms').toBe(3);
  expect(wrapForm.hasField, 'the form opened with the derived knob (depth)').toBe(true);
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
  await page.evaluate(() => window.showApp('editor'));
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

test('AUTO: a MIXED program does NOT auto-show — the right-click "Group" gesture owns those (advisor constraint)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsAutoGroupRunAtLine && window.ddcsLooseRunAtLine);

  // a MIXED program: a loose run + a REAL drill op.
  await page.evaluate(async () => {
    const { makeOp, _builderAtoms } = await import('/blocks/opBuilders.js');
    const params = { pattern: 'line', originX: 0, originY: 0, lcount: 2, spacing: 10, angle: 0, depth: -3, feed: 200, clearance: 5, method: 'peck', peck: 1, holeDia: 3 };
    window.ddcsLoadBlockStack([
      { id: 'a1', type: 'move', params: { mode: 'rapid', x: 5, y: 5, z: -1 } },
      { id: 'a2', type: 'spindle', params: { rpm: 9000, on: true } },
      makeOp('drill', params, _builderAtoms('drill', params)),
    ]);
  });
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(300);

  // autoGroupRunAtLine returns null for EVERY line (a real op exists), but looseRunAtLine still resolves the run (the gesture works).
  const res = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    let anyAuto = false, looseLine = -1;
    for (let i = 0; i < n; i++) {
      if (window.ddcsAutoGroupRunAtLine && window.ddcsAutoGroupRunAtLine(i)) anyAuto = true;
      if (looseLine < 0 && window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i)) looseLine = i;
    }
    // hover a loose line → no chip (auto-show is scoped out of mixed programs).
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + looseLine * lh + lh / 2 - ed.scrollTop }));
    return { anyAuto, looseResolves: looseLine >= 0, chipHidden: document.getElementById('op-edit-chip').hidden };
  });
  expect(res.anyAuto, 'a mixed program NEVER auto-shows the chip').toBe(false);
  expect(res.looseResolves, 'but the right-click gesture still resolves the loose run').toBe(true);
  expect(res.chipHidden, 'hovering a loose line in a mixed program shows no auto-chip').toBe(true);
});
