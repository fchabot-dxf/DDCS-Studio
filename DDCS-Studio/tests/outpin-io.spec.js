import { test, expect } from '@playwright/test';

// Output Pin emits real DDCS raw-output M-codes (M50/M52… set, M51/M53… clear → #1552+ in the firmware I/O
// macros), instead of folding to a hint. RS274/grblHAL still uses M62-65; classic grbl still hints.
test.use({ viewport: { width: 1000, height: 800 } });

test('Output Pin emits DDCS output-bit M-codes per pin/state', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const d = getDialect('ddcs-v41');
    const e = (pin, state) => BLOCKS.outpin.emit({ pin, state, sync: true }, 0, 0, d)[0];
    return { on0: e(0, 'on'), off0: e(0, 'off'), on2: e(2, 'on'), off2: e(2, 'off'), over: e(25, 'on') };
  });
  expect(r.on0).toContain('M50');    // bit 0 set
  expect(r.off0).toContain('M51');   // bit 0 clear
  expect(r.on2).toContain('M54');    // bit 2 set (50 + 2*2)
  expect(r.off2).toContain('M55');   // bit 2 clear
  expect(r.over).toContain('out of range');   // pins 0-20 only
});
