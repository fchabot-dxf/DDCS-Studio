import { test, expect } from '@playwright/test';

/**
 * editor-toolbar-2078 — the editor's floating buttons become ONE ROW (t2078).
 *
 * They were seven separately absolutely-positioned buttons over the pane's bottom-left corner, each with a
 * hand-computed left/bottom offset: adding one meant recomputing the next multiple of 36px, and a label change
 * silently overlapped its neighbour. The human spotted the empty strip above the editor and asked for the lot to
 * move into it. Anchored RIGHT so it never starts on the pre-flight badge's home (top-left), and the badge keeps
 * the higher z-index — the human's call, so a safety readout is never hidden behind a convenience button.
 *
 * Also here: Make/Transform lost their word labels (icon + chevron only), Clear moved out of the HEADER into the
 * pane it acts on, and Load/Insert/Export moved to the quick menu — the human's own refinement of t1227's rule:
 * those act on the program AS A WHOLE (empty editor, or finished one), never mid-edit.
 *
 * t2173 (tail, human: "insert is redundant beside load remove it completely") — Insert REMOVED entirely, not
 * relocated; the quick-menu test below now proves two rows (Load/Export), not three.
 */
test.use({ viewport: { width: 1400, height: 900 } });

test('editor toolbar: one row, the six pane tools, none absolutely positioned', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const tb = document.querySelector('.editor-toolbar');
    if (!tb) return { ok: false };
    const ids = [...tb.querySelectorAll('button')].map((b) => b.id);
    // one ROW means their vertical CENTRES line up — not identical tops: an icon button and a text button have
    // different heights, and a centred flex row aligns their middles, so equal-tops would be the wrong assertion.
    const mids = ids.map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return b.top + b.height / 2; });
    const spread = Math.max(...mids) - Math.min(...mids);
    return {
      ok: true, ids, sameRow: spread <= 2,   // within 2px = the same row
      stray: ids.filter((id) => getComputedStyle(document.getElementById(id)).position === 'absolute'),
      gone: ['editor-indent','editor-outdent','editor-comment','editor-file-btn','transferBtn'].filter((id) => document.getElementById(id)),
      clearOutOfHeader: !document.querySelector('.hdr-controls #btn-clear'),
    };
  });
  expect(r.ok).toBe(true);
  expect(r.ids).toEqual(['editor-cam-btn','align-rotate-btn','btn-undo','btn-redo','btn-clear','editor-copy-btn']);
  expect(r.sameRow, 'one row, not a stack of hand-placed offsets').toBe(true);
  expect(r.stray, 'nothing still absolutely positioned').toEqual([]);
  expect(r.gone, 'retired buttons are gone').toEqual([]);
  expect(r.clearOutOfHeader, 'clear moved out of the header into the pane it acts on').toBe(true);
});

test('Make and Transform are icon-only but still named for screen readers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const r = await page.evaluate(() => ['editor-cam-btn','align-rotate-btn'].map((id) => {
    const b = document.getElementById(id);
    return { id, text: b.textContent.replace(/\s/g, ''), svg: !!b.querySelector('svg'), label: b.getAttribute('aria-label') || '', title: !!b.title };
  }));
  for (const b of r) {
    expect(b.svg, `${b.id} renders an icon`).toBe(true);
    expect(b.label.length > 0, `${b.id} keeps an accessible name`).toBe(true);
    expect(b.title, `${b.id} keeps its tooltip`).toBe(true);
  }
  expect(r[0].text, 'Make keeps only its chevron, no word label').toBe('▾');
  expect(r[1].text, 'Transform is icon-only').toBe('');
});

test('Load / Export are reachable from the quick menu, wired to the one implementation; Insert is gone', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  await page.click('#hdrPostBtn');
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const acts = [...document.querySelectorAll('#hdrPostMenu [data-act]')].map((b) => b.dataset.act);
    return { acts, hasHandlers: ['loadGcodeFile','downloadFile'].every((f) => typeof window[f] === 'function'), hasInsertHandler: typeof window.insertGcodeFile === 'function' };
  });
  expect(r.acts, 'the two program-file rows are in the quick menu').toEqual(expect.arrayContaining(['fileLoad','fileExport']));
  expect(r.acts, 'Insert stays out of the menu (t2173)').not.toContain('fileInsert');
  expect(r.hasHandlers, 'they call the same globals the editor menu called — one implementation').toBe(true);
  expect(r.hasInsertHandler, 'and its own handler is deleted, not just unrouted').toBe(false);
});
