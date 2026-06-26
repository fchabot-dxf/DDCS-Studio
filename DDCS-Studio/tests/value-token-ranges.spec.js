import { test, expect } from '@playwright/test';

/**
 * Unit pin for opGlow.valueTokenRanges — the WORD-level value localizer that the value-hover refinement will drive.
 * It returns the exact emitted-token char-span(s) a leaf atom's socket value occupies, located by PERTURBING that one
 * value to a sentinel and diffing the re-emit (declared by the emit, never regex-guessed).
 *
 * Validated NON-circularly against the public emitter (window.ddcsEmitMapped): for each returned {line, range},
 * splicing the sentinel string into the BASE line at that span must reproduce the emitter's perturbed line exactly —
 * which only holds if the span is precisely the value token (catches off-by-one / inversion / wrong-line).
 * Also asserts the structural guard: a value socket never changes the emit's line count.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('valueTokenRanges localizes a leaf value to its exact emitted token span', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.closeWiz
    && window.ddcsGetBlockProgram && window.ddcsEmitMapped);

  // seed a real op → the shared model holds an op stack with leaf atoms (no need to open the Blocks tab)
  await page.evaluate(async () => {
    window.ddcsLoadBlockStack([]);
    window.openWiz('surfacing', undefined, true);
    window.updateWiz();
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
  });

  const res = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const SENT = 987654.321, SS = '987654.321';
    const prog = window.ddcsGetBlockProgram() || [];
    const base = window.ddcsEmitMapped(prog);

    // collect leaf atoms (no children) carrying a finite numeric param
    const cands = [];
    (function walk(blocks) {
      for (const b of (blocks || [])) {
        const kids = b.children || [];
        if (b.params && !kids.length) for (const k in b.params) {
          if (typeof b.params[k] === 'number' && isFinite(b.params[k])) cands.push({ id: b.id, key: k });
        }
        walk(kids);
      }
    })(prog);

    // pick the first that actually localizes (is emitted, no sentinel-tail collision)
    let picked = null, ranges = null;
    for (const c of cands) { const r = glow.valueTokenRanges(c.id, c.key); if (r && r.length) { picked = c; ranges = r; break; } }
    if (!picked) return { ok: false, cands: cands.length };

    // independent re-emit with the sentinel set on the SAME leaf+key
    const clone = JSON.parse(JSON.stringify(prog));
    (function set(blocks) {
      for (const b of (blocks || [])) { if (b.id === picked.id) { b.params[picked.key] = SENT; return true; } if (set(b.children)) return true; }
      return false;
    })(clone);
    const pEmit = window.ddcsEmitMapped(clone);

    const checks = ranges.map(({ line, range }) => {
      const bl = base.lines[line], s = range[0], e = range[1];
      return { line, token: bl.slice(s, e), reconstructsPerturbed: (bl.slice(0, s) + SS + bl.slice(e)) === pEmit.lines[line], inBounds: s >= 0 && e <= bl.length && s < e };
    });
    return { ok: true, picked, count: ranges.length, checks, sameLineCount: base.lines.length === pEmit.lines.length };
  });

  expect(res.ok, `found a numeric leaf-atom param that localizes (candidates=${res.cands})`).toBe(true);
  expect(res.sameLineCount, 'perturbing a value socket does not change the emitted line count').toBe(true);
  expect(res.count, 'localized at least one emitted token').toBeGreaterThan(0);
  for (const c of res.checks) {
    expect(c.inBounds, `range is a valid [start,end) span on line ${c.line}`).toBe(true);
    expect(c.token.length, `localized token on line ${c.line} is non-empty`).toBeGreaterThan(0);
    expect(c.reconstructsPerturbed, `span on line ${c.line} (token "${c.token}") is EXACTLY the value token`).toBe(true);
  }

  // guard branches return [] (never throw / never a bogus span): unknown param key, unknown block id
  const guards = await page.evaluate(async () => {
    const glow = await import('/blocks/opGlow.js');
    const prog = window.ddcsGetBlockProgram() || [];
    const anyLeafId = (function find(bs) { for (const b of (bs || [])) { if (b && (!b.children || !b.children.length)) return b.id; const f = find(b && b.children); if (f) return f; } return null; })(prog);
    return {
      badParam: glow.valueTokenRanges(anyLeafId, '__nope__'),
      badBlock: glow.valueTokenRanges('__no-such-block__', 'x'),
      subtreeBad: glow.valueRangesForSubtree('__no-such-block__'),
    };
  });
  expect(guards.badParam, 'unknown param key → []').toEqual([]);
  expect(guards.badBlock, 'unknown block id → []').toEqual([]);
  expect(guards.subtreeBad, 'subtree of unknown block → []').toEqual([]);
});
