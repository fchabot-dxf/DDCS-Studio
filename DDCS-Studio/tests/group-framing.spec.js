import { test, expect } from '@playwright/test';

/**
 * Hand-built group — FRAMING parity (turn 7): a built-in op's stack includes progstart..progend (spindle rpm /
 * clearance / retract), so its form can expose those. A hand-built group used to EXCLUDE framing. Now groupLooseAtoms
 * SPANS the adjacent framing into the group, and deriveGroupDef auto-surfaces rpm/clearance/retractZ as knobs — so a
 * hand-built program's form reaches the same spindle/retract knobs. Grouping framing is emit-byte-identical EXCEPT
 * for one new leading line (a group emits its children in order at its slot, unchanged) — see the next paragraph.
 * Drives the REAL studio view.
 *
 * t2363 — a hand-built group now carries its OWN title too (`( Hand-built )`, or the group's own custom name):
 * makeOp's declared `label` (BACKLOG owner-report / north star principle 3) is emitted for every op container,
 * a `group` included — no reason a hand-built program should be the one silent case left. `groupLooseAtoms`
 * (opSession.js) sets `op.label = label || 'Hand-built'`, so the generic mechanism (blockEmitter.js) supplies
 * that text as this op's own title line, same as any other silent op. This is a genuine, intended behaviour
 * change (a real new title where none existed) — REBASELINED below, not silenced: the assertion now expects
 * exactly that one extra line, prepended, rather than requiring the pre-t2363 byte-identical text.
 *
 * t-opchips — the trigger for `groupLooseAtoms` changed from the (now-retired) auto-hover chip to the right-click
 * "Group" menu — see group-auto.spec.js's own header for the full account of why. `looseRunAtLine` (what the
 * menu resolves against) already spans framing correctly; this file's own subject (framing parity) is untouched.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a hand-built program with framing → group spans progstart/progend → form exposes rpm/clearance/retractZ + writes back', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.insertWiz && window.ddcsLooseRunAtLine);

  // a FULL hand-built program: Program Start (rpm/clearance) + moves + Program End (retractZ). No real op.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'ps', type: 'progstart', params: { rpm: 10000, dir: 'cw', spinUp: 0, clearance: 5 } },
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: 5 } },
    { id: 'm2', type: 'move', params: { mode: 'cut', x: 50, y: 60, z: -2, feed: 800 } },
    { id: 'pe', type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 25, park: false, parkX: 0, parkY: 0, end: 'M30' } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);
  const gcodeBefore = await page.evaluate(() => document.getElementById('editor')?.value || '');

  // find a loose-run line (a move's projected line; framing lines resolve to null), right-click it → Group → click.
  const lineIdx = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    for (let i = 0; i < n; i++) { const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i); if (r && r.length) return i; }
    return -1;
  });
  expect(lineIdx, 'a loose-run line resolves even with framing present (the Group menu item can appear)').toBeGreaterThanOrEqual(0);
  await page.evaluate((li) => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 40, clientY: rect.top + pad + li * lh + lh / 2 - ed.scrollTop }));
    const menu = document.querySelector('.op-ctx-menu');
    const btn = menu && !menu.hidden ? Array.from(menu.querySelectorAll('button')).find((b) => /Group/.test(b.textContent)) : null;
    if (btn) btn.click();
  }, lineIdx);
  await page.waitForTimeout(600);

  // the group SPANS the framing: children = [progstart, m1, m2, progend]; G-code unchanged (emit byte-identical).
  const wrap = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    return {
      topLen: prog.length,
      childTypes: grp ? (grp.children || []).map((c) => c.type) : [],
      gcode: document.getElementById('editor')?.value || '',
    };
  });
  expect(wrap.topLen, 'the whole framed program collapsed to ONE group').toBe(1);
  expect(wrap.childTypes, 'the group SPANS the framing (progstart … progend)').toEqual(['progstart', 'move', 'move', 'progend']);
  // t2363 — grouping now adds exactly ONE new leading line (the group's own title, from its declared label);
  // everything else stays byte-identical to the pre-group text.
  expect(wrap.gcode, 'grouping the framing adds only its own title line, nothing else changes').toBe('( Hand-built )\n' + gcodeBefore);

  // t-opchips — the wrap no longer auto-opens the form (that was the retired auto-chip's own extra step); the
  // new group is a real top-level op, so it renders its own chip immediately — click it to open the form.
  const grpId = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    return grp ? grp.id : null;
  });
  await page.click(`.op-chip[data-op-id="${grpId}"]`);
  await page.waitForTimeout(400);

  // the form auto-surfaced the framing knobs (no _expose needed — parity with built-ins).
  const form = await page.evaluate(() => {
    const q = (p) => document.querySelector(`#wiz_user_form [data-param="${p}"]`);
    const rpm = q('rpm'), clr = q('clearance'), rz = q('retractZ');
    return { rpm: rpm ? rpm.value : null, clearance: clr ? clr.value : null, retractZ: rz ? rz.value : null };
  });
  expect(Number(form.rpm), 'rpm knob seeded from progstart').toBe(10000);
  expect(Number(form.clearance), 'clearance knob seeded from progstart').toBe(5);
  expect(Number(form.retractZ), 'retractZ knob seeded from progend').toBe(25);

  // edit rpm → 8000, insert → writes back to the progstart child.
  await page.evaluate(async () => {
    const f = document.querySelector('#wiz_user_form [data-param="rpm"]');
    f.value = '8000'; f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    await window.insertWiz();
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const ps = grp && (grp.children || []).find((c) => c.type === 'progstart');
    return { rpm: ps ? ps.params.rpm : null, gcode: document.getElementById('editor')?.value || '' };
  });
  expect(Number(after.rpm), 'the rpm edit wrote back to the progstart child').toBe(8000);
  expect(after.gcode, 'the emitted spindle speed reflects the new rpm').toContain('S8000');

  // SURVIVES A REPROJECTION.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);
  const reproj = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const ps = grp && (grp.children || []).find((c) => c.type === 'progstart');
    return { groups: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length, rpm: ps ? ps.params.rpm : null, childTypes: grp ? (grp.children || []).map((c) => c.type) : [] };
  });
  expect(reproj.groups, 'one group survives the reproject').toBe(1);
  expect(reproj.childTypes, 'the framing stays inside the group after reproject').toEqual(['progstart', 'move', 'move', 'progend']);
  expect(Number(reproj.rpm), 'the rpm edit survives the reproject').toBe(8000);
});
