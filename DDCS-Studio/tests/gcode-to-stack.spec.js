import { test, expect } from '@playwright/test';

// Layer 1: G-code → leaf-atom parser. The inverse of blockModel.emit for line-level atoms. The core guarantee
// is ROUND-TRIP: emit(stack) → parse → emit must be byte-identical for the leaf ops (so editing/projecting
// G-code through blocks loses nothing). Unrecognized lines fall back to a `raw` block (verbatim).
test.use({ viewport: { width: 1000, height: 800 } });

test('leaf stack round-trips: emit → parse → emit is byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockModel.js');
    const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
    const stack = [
      { type: 'distmode', params: { dist: 'abs' } },
      { type: 'spindle', params: { rpm: 12000, dir: 'cw' } },
      { type: 'wcs', params: { wcs: 'G55' } },
      { type: 'coolant', params: { flow: 'flood' } },
      { type: 'tool', params: { n: 2 } },
      { type: 'feed', params: { rate: 300 } },
      { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5 } },
      { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 200 } },
      { type: 'move', params: { mode: 'probe', x: 0, y: 0, z: -10, feed: 50 } },
      { type: 'arc', params: { arc: 'cw', x: 20, y: 20, i: 5, j: 5, feed: 100 } },
      { type: 'arc', params: { arc: 'ccw', x: 0, y: 0, i: -5, j: -5, feed: 100 } },
      { type: 'comment', params: { text: 'hello world' } },
      { type: 'mcode', params: { code: 154 } },
      { type: 'spindle', params: { rpm: 0, dir: 'cw' } },   // → M5
      { type: 'endprogram', params: {} },                    // → M30 (default dialect)
    ];
    const text1 = emitMapped(stack).text;
    const parsed = parseGcodeToStack(text1);
    const text2 = emitMapped(parsed).text;
    return { text1, text2, parsedTypes: parsed.map((b) => b.type) };
  });

  expect(r.text2).toBe(r.text1);   // exact round-trip
  // every line became a typed leaf (no raw fallback for known ops)
  expect(r.parsedTypes).not.toContain('raw');
  expect(r.parsedTypes).toEqual([
    'distmode', 'spindle', 'wcs', 'coolant', 'tool', 'feed',
    'move', 'move', 'move', 'arc', 'arc', 'comment', 'mcode', 'spindle', 'endprogram',
  ]);
});

test('#var / [expr] coordinates survive as literals; unknown lines → raw', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { parseLine } = await import('/blocks/gcodeToStack.js');
    return {
      varMove: parseLine('G0 X#9   ( travel )'),
      exprMove: parseLine('G1 X[a+1] Z-3 F200   ( cut )'),
      unknown: parseLine('G65 P8583 A#1 B#2'),
      commentOnly: parseLine('( Surfacing )'),
      blank: parseLine('   '),
    };
  });
  expect(r.varMove).toEqual({ type: 'move', params: { mode: 'rapid', x: '#9' } });   // single-axis kept
  expect(r.exprMove.params.x).toBe('[a+1]');
  expect(r.exprMove.params.z).toBe(-3);
  expect(r.unknown.type).toBe('raw');
  expect(r.unknown.params.text).toContain('G65');
  expect(r.commentOnly).toEqual({ type: 'comment', params: { text: 'Surfacing' } });
  expect(r.blank).toBe(null);
});
