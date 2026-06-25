import { test, expect } from '@playwright/test';

/**
 * WORD-LEVEL override glow. editedRangesForOp diffs the clean form rebuild against the live block stack and
 * returns [{ line, range }] for the editor overlay:
 *   - a value-edited LEAF atom → range = [start,end) covering just the changed token (glow the word, not the line),
 *   - an INJECTED atom (a wholly new line) → range = null (whole-line glow).
 * This is the "glow the exact edit" ask (NEXT-TASKS) — the precise half that line lists can't do.
 */
test('editedRangesForOp: word-level range for a value edit, whole-line for an injection', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack && window.ddcsGetProjection);

  const r = await page.evaluate(async () => {
    const ops = await import('/blocks/opGlow.js');
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const findLeaf = (blocks, pred) => {
      for (const b of (blocks || [])) {
        if (!b) continue;
        if ((!b.children || !b.children.length) && pred(b)) return b;
        if (b.children) { const f = findLeaf(b.children, pred); if (f) return f; }
      }
      return null;
    };

    window.ddcsLoadBlockStack([]);
    window.openWiz('edge', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'edge');
    if (!op) return { error: 'no edge op' };

    // (1) OVERRIDE — edit a numeric assign value to a longer, distinctive value
    const ov = clone(op.children);
    const asn = findLeaf(ov, (b) => b.type === 'assign' && b.params && /^-?\d+(\.\d+)?$/.test(String(b.params.value)));
    if (!asn) return { error: 'no numeric assign leaf' };
    asn.params.value = '987654';
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: ov } : b));
    const overrideRanges = ops.editedRangesForOp(op.id);

    // (2) INJECTION — add a brand-new comment atom (no base match)
    const inj = clone(op.children);
    inj.push({ type: 'comment', id: 'wgInj1', params: { text: 'hand-added' } });
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: inj } : b));
    const injectRanges = ops.editedRangesForOp(op.id);

    return { overrideRanges, injectRanges };
  });

  expect(r.error).toBeUndefined();

  // OVERRIDE → at least one WORD-LEVEL (non-null) range, and it's a proper sub-span
  const words = r.overrideRanges.filter((x) => x.range);
  expect(words.length).toBeGreaterThan(0);
  for (const w of words) {
    expect(w.range[0]).toBeGreaterThanOrEqual(0);
    expect(w.range[1]).toBeGreaterThan(w.range[0]);
  }
  // the edited value is 6 chars → the changed token span is small (not the whole multi-token line)
  expect(words.some((w) => w.range[1] - w.range[0] === 6)).toBe(true);

  // INJECTION → at least one WHOLE-LINE (null range) entry
  expect(r.injectRanges.some((x) => x.range === null)).toBe(true);
});

// The RENDERER actually wraps the changed token in a .word-edited span in the editor overlay (the real symptom).
test('editorOpHover wraps the changed token in a .word-edited span', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack && window.ddcsRefreshBlockGlow);

  const r = await page.evaluate(async () => {
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const findLeaf = (blocks, pred) => {
      for (const b of (blocks || [])) {
        if (!b) continue;
        if ((!b.children || !b.children.length) && pred(b)) return b;
        if (b.children) { const f = findLeaf(b.children, pred); if (f) return f; }
      }
      return null;
    };
    window.ddcsLoadBlockStack([]);
    window.openWiz('edge', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'edge');
    const ov = clone(op.children);
    const asn = findLeaf(ov, (b) => b.type === 'assign' && b.params && /^-?\d+(\.\d+)?$/.test(String(b.params.value)));
    asn.params.value = '987654';
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: ov } : b));
    await new Promise((res) => setTimeout(res, 150));   // editor reproject + MutationObserver
    window.ddcsRefreshBlockGlow && window.ddcsRefreshBlockGlow();
    const spans = Array.from(document.querySelectorAll('#editor-highlight .g-line .word-edited'));
    return { gLines: document.querySelectorAll('#editor-highlight .g-line').length, spanTexts: spans.map((s) => s.textContent) };
  });

  expect(r.gLines).toBeGreaterThan(0);          // editor overlay is populated
  expect(r.spanTexts).toContain('987654');      // only the changed token is wrapped
});
