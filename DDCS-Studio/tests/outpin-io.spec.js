import { test, expect } from '@playwright/test';

// Output Pin: the DDCS raw-output M-codes (M50/M52… set, M51/M53… clear → #1552+ in the slib I/O macros O10050-O10091)
// are the EXPERT scriptable-I/O family (caps.inputRead) — t642 F6 grounded that V4.1/DM500 firmware has NO M50/#1552, so
// they get an honest hint (not a leaked Expert literal). RS274/grblHAL uses M62-65; classic grbl hints.
test.use({ viewport: { width: 1000, height: 800 } });

test('Output Pin emits DDCS output-bit M-codes on EXPERT; folds honestly on V4.1/DM500/grbl', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const e = (id, pin, state) => BLOCKS.outpin.emit({ pin, state, sync: true }, 0, 0, getDialect(id))[0];
    return {
      // Expert (caps.inputRead) — the real raw-output bits
      on0: e('ddcs-expert-m350', 0, 'on'), off0: e('ddcs-expert-m350', 0, 'off'),
      on2: e('ddcs-expert-m350', 2, 'on'), off2: e('ddcs-expert-m350', 2, 'off'), over: e('ddcs-expert-m350', 25, 'on'),
      // V4.1 / DM500 — no scriptable raw output → honest hint (NO leaked M50+2n)
      v41: e('ddcs-v41', 2, 'on'), dm500: e('ddcs-v3-dm500', 2, 'on'),
      // RS274 — M62
      rs274: e('rs274ngc', 2, 'on'),
    };
  });
  // Expert: the real DDCS output bits
  expect(r.on0).toContain('M50');    // bit 0 set
  expect(r.off0).toContain('M51');   // bit 0 clear
  expect(r.on2).toContain('M54');    // bit 2 set (50 + 2*2)
  expect(r.off2).toContain('M55');   // bit 2 clear
  expect(r.over).toContain('out of range');   // pins 0-20 only
  // V4.1 / DM500: an honest hint, NO Expert raw-output M-code leaked
  for (const v of [r.v41, r.dm500]) {
    expect(v).toContain('use an M-Code atom');
    expect(v).not.toMatch(/\bM5[0-9]\b/);   // no bare M50-M59 output bit
  }
  // RS274 unchanged
  expect(r.rs274).toContain('M62');
});
