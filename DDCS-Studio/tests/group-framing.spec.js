import { test, expect } from '@playwright/test';

/**
 * Hand-built group — FRAMING parity (turn 7): a built-in op's stack includes progstart..progend (spindle rpm /
 * clearance / retract), so its form can expose those. A hand-built group used to EXCLUDE framing. Now groupLooseAtoms
 * SPANS the adjacent framing into the group, and deriveGroupDef auto-surfaces rpm/clearance/retractZ as knobs — so a
 * hand-built program's form reaches the same spindle/retract knobs. Grouping framing is emit-byte-identical (a group
 * emits its children in order at its slot). Drives the REAL studio view + auto-chip path.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a hand-built program with framing → group spans progstart/progend → form exposes rpm/clearance/retractZ + writes back', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.insertWiz && window.ddcsAutoGroupRunAtLine);

  // a FULL hand-built program: Program Start (rpm/clearance) + moves + Program End (retractZ). No real op → AUTO case.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'ps', type: 'progstart', params: { rpm: 10000, dir: 'cw', spinUp: 0, clearance: 5 } },
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: 5 } },
    { id: 'm2', type: 'move', params: { mode: 'cut', x: 50, y: 60, z: -2, feed: 800 } },
    { id: 'pe', type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 25, park: false, parkX: 0, parkY: 0, end: 'M30' } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);
  const gcodeBefore = await page.evaluate(() => document.getElementById('editor')?.value || '');

  // find a loose-run line (a move's projected line; framing lines resolve to null), hover it → auto-chip → click.
  const lineIdx = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    for (let i = 0; i < n; i++) { const r = window.ddcsAutoGroupRunAtLine && window.ddcsAutoGroupRunAtLine(i); if (r && r.length) return i; }
    return -1;
  });
  expect(lineIdx, 'a loose-run line resolves even with framing present (the auto-chip can appear)').toBeGreaterThanOrEqual(0);
  await page.evaluate((li) => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + li * lh + lh / 2 - ed.scrollTop }));
    document.getElementById('op-edit-chip').click();
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
  expect(wrap.gcode, 'grouping the framing is emit byte-identical').toBe(gcodeBefore);

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
