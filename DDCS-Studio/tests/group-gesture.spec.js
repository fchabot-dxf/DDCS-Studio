import { test, expect } from '@playwright/test';

/**
 * Headline feature — increment 3: the IN-CONTEXT "Group" gesture. Blockly is single-select, so there is no
 * multi-select: the gesture is RIGHT-CLICK any atom in a loose run → a context-menu "Group" item → wraps the
 * CONTIGUOUS loose run that atom belongs to into ONE editable `group` op. Each loose run groups independently.
 *
 * Verify-first: this drives the REAL editor right-click → the real "Group" menu button → the real hover ✎ chip,
 * AND survives a reprojection (leave the Blocks tab and return). No model shortcut for the gesture itself.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// dispatch a real contextmenu event at the editor row for projected line `lineIdx`, return the menu button labels.
async function rightClickEditorLine(page, lineIdx) {
  return page.evaluate((lineIdx) => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    const x = rect.left + 40, y = rect.top + pad + lineIdx * lh + lh / 2 - ed.scrollTop;
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    const menu = document.querySelector('.op-ctx-menu');
    const items = menu && !menu.hidden ? [...menu.querySelectorAll('.op-ctx-item')].map((b) => b.textContent) : [];
    return { menuShown: !!(menu && !menu.hidden), items };
  }, lineIdx);
}

test('increment 3: right-click a loose atom → "Group" wraps its contiguous run → chip appears (survives reproject)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsLooseRunAtLine);

  // a hand-built stack: loose atoms, NO op wrapper. Real hand-built atoms come from Blockly with stable ids (the
  // line→block map keys on them), so seed ids the way the workspace→stack projection would.
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
    { id: 'm2', type: 'move', params: { x: 50, y: 60, z: -2, mode: 'feed', f: 800 } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // BEFORE: loose, no op; a middle-ish line resolves to a loose RUN (not an op).
  const before = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const lines = (document.getElementById('editor')?.value || '').split('\n');
    let runHit = 0, opHit = 0;
    for (let i = 0; i < lines.length; i++) {
      if (window.ddcsOpAtLine && window.ddcsOpAtLine(i)) opHit++;
      const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i);
      if (r && r.length) runHit = Math.max(runHit, r.length);
    }
    return { hasOp: prog.some((b) => b && b.type === 'op'), opHit, runHit };
  });
  expect(before.hasOp, 'starts as loose atoms').toBe(false);
  expect(before.opHit, 'no line resolves to an op before grouping').toBe(0);
  expect(before.runHit, 'a loose line resolves to the full contiguous run (all 3 atoms)').toBe(3);

  // GESTURE: right-click a line that belongs to the loose run → the "Group" menu appears.
  // find a line index that resolves to a loose run.
  const lineIdx = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    for (let i = 0; i < n; i++) { const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i); if (r && r.length) return i; }
    return -1;
  });
  expect(lineIdx, 'found a loose-run line to right-click').toBeGreaterThanOrEqual(0);

  const menu = await rightClickEditorLine(page, lineIdx);
  expect(menu.menuShown, 'the context menu appears on a loose run').toBe(true);
  expect(menu.items.join(' '), 'the menu offers a Group item for the run').toContain('Group');
  expect(menu.items.join(' '), 'and it names the run size (3 blocks)').toContain('3');

  // click the Group item → the run is wrapped in one group op.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Group/.test(b.textContent));
    btn.click();
  });
  await page.waitForTimeout(250);

  const wrap = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    return { topTypes: prog.map((b) => b && (b.opType || b.type)), groupChildren: grp ? (grp.children || []).length : -1, grpId: grp ? grp.id : null };
  });
  expect(wrap.topTypes, 'the loose run is now ONE group op').toEqual(['group']);
  expect(wrap.groupChildren, 'the group holds the 3 hand-built atoms').toBe(3);

  // AFTER: hover the editor → the ✎ chip appears on the grouped lines (the headline win).
  const after = await page.evaluate(async () => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const ed = document.getElementById('editor');
    const text = ed.value || '';
    const firstLine = (window.ddcsLinesForOp && window.ddcsLinesForOp(grp.id) || [0])[0] || 0;
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + firstLine * lh + lh / 2 - ed.scrollTop }));
    await new Promise((r) => setTimeout(r, 60));
    const c = document.getElementById('op-edit-chip');
    return { gcode: text, chip: c ? { hidden: c.hidden, text: c.textContent } : { hidden: true, text: '' } };
  });
  expect(after.chip.hidden, 'the edit chip APPEARS on the grouped run').toBe(false);
  expect(after.chip.text, 'the chip shows the group label').toContain('Hand-built');
  expect(after.gcode, 'grouping does not change the emitted G-code').toContain('M3 S12000');

  // SURVIVES A REPROJECTION: leave to the Blocks tab (projects through Blockly) and back to the editor — the group
  // op is still ONE op and the chip still appears (the step every green-but-incomplete test skipped).
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);

  const reproj = await page.evaluate(async () => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const ed = document.getElementById('editor');
    if (!grp) return { stillOneGroup: false, chipHidden: true, children: -1 };
    const firstLine = (window.ddcsLinesForOp && window.ddcsLinesForOp(grp.id) || [0])[0] || 0;
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + firstLine * lh + lh / 2 - ed.scrollTop }));
    await new Promise((r) => setTimeout(r, 60));
    const c = document.getElementById('op-edit-chip');
    return {
      stillOneGroup: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length === 1,
      children: (grp.children || []).length,
      chipHidden: c ? c.hidden : true,
    };
  });
  expect(reproj.stillOneGroup, 'the group op survives a reprojection (Blocks tab round-trip)').toBe(true);
  expect(reproj.children, 'and still holds its 3 atoms').toBe(3);
  expect(reproj.chipHidden, 'the chip still appears after the reproject').toBe(false);
});

test('increment 3: a MIXED program groups ONLY the clicked loose run — the real op + the other run are untouched', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsLooseRunAtLine);

  // a MIXED program: loose run A · a REAL drill op · loose run B. Each loose run must group independently.
  await page.evaluate(async () => {
    const { makeOp, _builderAtoms } = await import('/blocks/opBuilders.js');
    const drill = makeOp('drill', { pattern: 'line', originX: 0, originY: 0, lcount: 2, spacing: 10, angle: 0, depth: -3, feed: 200, clearance: 5, method: 'peck', peck: 1, holeDia: 3 }, _builderAtoms('drill', { pattern: 'line', originX: 0, originY: 0, lcount: 2, spacing: 10, angle: 0, depth: -3, feed: 200, clearance: 5, method: 'peck', peck: 1, holeDia: 3 }));
    window.ddcsLoadBlockStack([
      { id: 'a1', type: 'move', params: { x: 5, y: 5, z: -1, mode: 'rapid' } },
      { id: 'a2', type: 'spindle', params: { rpm: 9000, on: true } },
      drill,
      { id: 'b1', type: 'move', params: { x: 80, y: 80, z: -1, mode: 'rapid' } },
      { id: 'b2', type: 'dwell', params: { sec: 1 } },
    ]);
  });
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // the two loose runs resolve to DISTINCT runs; the drill lines resolve to NO loose run (it's a real op).
  const runs = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    const seen = [];
    for (let i = 0; i < n; i++) {
      const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i);
      if (r && r.length) { const key = r.join(','); if (!seen.includes(key)) seen.push(key); }
    }
    return seen;
  });
  expect(runs.sort(), 'exactly two independent loose runs (A and B), the drill is excluded').toEqual(['a1,a2', 'b1,b2']);

  // right-click run A's first line → "Group 2 blocks" → only run A wraps; drill + run B stay loose/untouched.
  const lineA = await page.evaluate(() => {
    const n = (document.getElementById('editor')?.value || '').split('\n').length;
    for (let i = 0; i < n; i++) { const r = window.ddcsLooseRunAtLine && window.ddcsLooseRunAtLine(i); if (r && r.join(',') === 'a1,a2') return i; }
    return -1;
  });
  const menu = await rightClickEditorLine(page, lineA);
  expect(menu.items.join(' '), 'Group offered for run A (2 blocks)').toMatch(/Group 2 block/);

  await page.evaluate(() => { [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Group/.test(b.textContent)).click(); });
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const groups = prog.filter((b) => b && b.type === 'op' && b.opType === 'group');
    return {
      topTypes: prog.map((b) => b && (b.opType || b.type)),
      groupCount: groups.length,
      groupChildren: groups[0] ? (groups[0].children || []).length : -1,
      drillStillThere: prog.some((b) => b && b.type === 'op' && b.opType === 'drill'),
      runBStillLoose: prog.some((b) => b && b.id === 'b1') && prog.some((b) => b && b.id === 'b2'),
    };
  });
  expect(after.groupCount, 'exactly ONE group was created (run A only)').toBe(1);
  expect(after.groupChildren, 'the group holds only run A (2 atoms)').toBe(2);
  expect(after.drillStillThere, 'the real drill op is untouched').toBe(true);
  expect(after.runBStillLoose, 'run B stays loose (each run groups independently)').toBe(true);
  expect(after.topTypes, 'order preserved: group · drill · loose · loose').toEqual(['group', 'drill', 'move', 'dwell']);
});
