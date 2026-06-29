import { test, expect } from '@playwright/test';

// EXEC-LINE-VISIBILITY: unit-level logic test for the exec-line trail feature.
// We build a fake #editor-highlight with .g-line[data-line-index] nodes in the page,
// then drive EditorManager.setActiveLine() through a sequence and assert class/attribute state.
// NOTE: this test verifies WHICH LINES GET WHICH CLASSES; it does NOT verify the CSS fade timing
// or the visual look of the accent bar. Those require human-eyes review at merge.
test.use({ viewport: { width: 1280, height: 900 } });

test('exec-line trail: active line, trail tags, cap, and clear', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && document.getElementById('editor'));

  const result = await page.evaluate(async () => {
    // Build a synthetic highlight container with 10 .g-line nodes
    const highlight = document.createElement('div');
    highlight.id = '_test_exec_trail_highlight';
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('span');
      span.className = 'g-line';
      span.setAttribute('data-line-index', String(i));
      highlight.appendChild(span);
    }
    document.body.appendChild(highlight);

    // Minimal stub of el() — just return by id, but we need to point EditorManager
    // at our synthetic highlight. We construct it manually.
    const { EditorManager } = await import('/ui/editorManager.js');

    // Construct without running setupSync/setupBackspaceButton/setupSpacebarButton
    // by patching the bare minimum after construction.
    // EditorManager constructor calls el('editor') and el('editor-highlight'). The real
    // elements exist in the page; we just swap .highlight after construction.
    const mgr = new EditorManager();
    mgr.highlight = highlight;    // redirect to our fake overlay
    mgr.activeLineIndex = null;
    mgr._execTrail = [];

    // Helper: snapshot state of all nodes
    const snap = () => {
      const out = {};
      highlight.querySelectorAll('.g-line').forEach(el => {
        const idx = el.getAttribute('data-line-index');
        out[idx] = {
          active: el.classList.contains('active-line'),
          age: el.getAttribute('data-exec-age'),
        };
      });
      return out;
    };

    // --- Drive: 3 → 4 → 5 → 6 → 7 ---
    mgr.setActiveLine(3);
    mgr.setActiveLine(4);
    mgr.setActiveLine(5);
    mgr.setActiveLine(6);
    mgr.setActiveLine(7);

    const afterSeq = snap();
    const trail = mgr._execTrail.slice();

    // --- clearActiveLine ---
    mgr.clearActiveLine();
    const afterClear = snap();

    document.body.removeChild(highlight);
    return { afterSeq, afterClear, trail };
  });

  const { afterSeq, afterClear, trail } = result;

  // (a) active line is the last one (7)
  expect(afterSeq['7'].active, 'line 7 is active').toBe(true);

  // (b) previous ~4 lines carry the trail tag with correct ascending age
  //     trail ring after 3→4→5→6→7 should be [6,5,4,3] (newest-first, capped at 5)
  expect(afterSeq['6'].age, 'line 6 = age 1 (most recent trail)').toBe('1');
  expect(afterSeq['5'].age, 'line 5 = age 2').toBe('2');
  expect(afterSeq['4'].age, 'line 4 = age 3').toBe('3');
  expect(afterSeq['3'].age, 'line 3 = age 4').toBe('4');

  // (c) lines older than the cap are NOT tagged (lines 0,1,2 never entered, line 8/9 untouched)
  expect(afterSeq['0'].age, 'line 0 has no exec-age').toBeNull();
  expect(afterSeq['2'].age, 'line 2 has no exec-age').toBeNull();
  // line 7 is active, not in the trail
  expect(afterSeq['7'].age, 'active line has no exec-age').toBeNull();

  // trail ring depth: we pushed 4 entries (3,4,5,6) before capping at 5
  expect(trail.length, 'trail ring holds 4 entries after 5 steps').toBe(4);

  // (d) clearActiveLine() removes every active+trail tag
  const anyActive = Object.values(afterClear).some(v => v.active);
  const anyAge   = Object.values(afterClear).some(v => v.age !== null);
  expect(anyActive, 'no active-line after clearActiveLine').toBe(false);
  expect(anyAge,   'no data-exec-age after clearActiveLine').toBe(false);
});
