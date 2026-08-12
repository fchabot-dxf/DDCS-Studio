import { test, expect } from '@playwright/test';

/**
 * WORD-LEVEL override glow. editedRangesForOp diffs the clean form rebuild against the live block stack and
 * returns [{ line, range }] for the editor overlay:
 *   - a value-edited LEAF atom → range = [start,end) covering just the changed token (glow the word, not the line),
 *   - an INJECTED atom (a wholly new line) → range = null (whole-line glow).
 * This is the "glow the exact edit" ask (NEXT-TASKS) — the precise half that line lists can't do.
 *
 * t1732 port note — NO TWIN EQUIVALENT for this test's SPECIFIC TECHNIQUE, confirmed by direct inspection (not
 * guessed) — per instruction, STOPPING and reporting rather than inventing a workaround. Both tests below manually
 * mutate a leaf atom found by walking the PLAIN op.children tree (`ddcsGetBlockProgram()`'s serialized form),
 * then call `recordEdit(op.id, asn.id, {...})` to declare the edit — mirroring what a LIVE Blockly field edit
 * would do. For the old raw 'edge' type this worked because its stored atoms carried a `.id`. For the twin
 * ('user_edge_data'), it does not: dumping the found 'assign' leaf live gives
 * `{"type":"assign","params":{"var":"#1","value":"...", "note":"..."},"_group":null}` — THREE keys, no `id` at
 * all. `recordEdit(opId, atomId, detail)` is `if (opId && atomId) _bag(opId).set(atomId, detail)` — a falsy
 * `atomId` (`asn.id === undefined`) makes it a silent no-op, confirmed live (`opEditMap(op.id)` reads back `null`
 * immediately after the call, before any async/timing could be a factor). This isn't a selector or timing issue;
 * it's that a twin's EXECUTION-mouth atoms (the plain atoms a stack-builder like edgeStack(params) returns) have
 * no individual identity in their SERIALIZED form — only the live Blockly WORKSPACE block Blockly creates for
 * them gets an id (Blockly assigns it), which is exactly the path `op-declared-edits.spec.js`'s passing test
 * uses instead (`ws.getBlockById(...).getDescendants(false).find(...)`, then a REAL `setFieldValue` — never a
 * manual plain-object mutation + recordEdit call). That test already proves the underlying glow MECHANISM works
 * correctly for twins; what has no equivalent here is specifically "synthesize an edit by id-addressing a plain
 * execution atom directly," which requires an id that twin atoms don't carry in this representation.
 */
test.fixme('editedRangesForOp: word-level range for a value edit, whole-line for an injection — t1732: twin execution atoms carry no .id in their plain (non-Blockly) form, so recordEdit(op.id, atom.id, ...) silently no-ops; needs a human/advisor ruling', async ({ page }) => {
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

    // t1732 — 'edge' opens the twin now (its coded view is retired); a real insert stores 'user_edge_data'.
    window.ddcsLoadBlockStack([]);
    window.openWiz('user_edge_data', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'user_edge_data');
    if (!op) return { error: 'no edge op' };

    const oe = await import('/blocks/opEdits.js');

    // (1) OVERRIDE — edit a numeric assign value to a longer, distinctive value (DECLARE it as a live edit would)
    const ov = clone(op.children);
    const asn = findLeaf(ov, (b) => b.type === 'assign' && b.params && /^-?\d+(\.\d+)?$/.test(String(b.params.value)));
    if (!asn) return { error: 'no numeric assign leaf' };
    const fromVal = asn.params.value;
    asn.params.value = '987654';
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: ov } : b));
    oe.recordEdit(op.id, asn.id, { paramKey: 'value', from: fromVal, to: '987654' });
    const overrideRanges = ops.editedRangesForOp(op.id);

    // (2) INJECTION — add a brand-new comment atom (no base match)
    oe.clearOpEdits(op.id);   // independent sub-case
    const inj = clone(op.children);
    inj.push({ type: 'comment', id: 'wgInj1', params: { text: 'hand-added' } });
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: inj } : b));
    oe.recordEdit(op.id, 'wgInj1', {});
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
// t1732 — same root cause as the test above (twin execution atoms carry no .id in their plain form); see its note.
test.fixme('editorOpHover wraps the changed token in a .word-edited span — t1732: same no-.id root cause as the sibling test above', async ({ page }) => {
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
    // t1732 — 'edge' opens the twin now (its coded view is retired); a real insert stores 'user_edge_data'.
    window.ddcsLoadBlockStack([]);
    window.openWiz('user_edge_data', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    const prog = window.ddcsGetBlockProgram() || [];
    const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'user_edge_data');
    const ov = clone(op.children);
    const asn = findLeaf(ov, (b) => b.type === 'assign' && b.params && /^-?\d+(\.\d+)?$/.test(String(b.params.value)));
    const fromVal = asn.params.value;
    asn.params.value = '987654';
    window.ddcsLoadBlockStack(prog.map((b) => (b && b.id === op.id) ? { ...b, children: ov } : b));
    (await import('/blocks/opEdits.js')).recordEdit(op.id, asn.id, { paramKey: 'value', from: fromVal, to: '987654' });   // declare the edit (a live field change fires this)
    await new Promise((res) => setTimeout(res, 150));   // editor reproject + MutationObserver
    window.ddcsRefreshBlockGlow && window.ddcsRefreshBlockGlow();
    const spans = Array.from(document.querySelectorAll('#editor-highlight .g-line .word-edited'));
    return { gLines: document.querySelectorAll('#editor-highlight .g-line').length, spanTexts: spans.map((s) => s.textContent) };
  });

  expect(r.gLines).toBeGreaterThan(0);          // editor overlay is populated
  expect(r.spanTexts).toContain('987654');      // only the changed token is wrapped
});
