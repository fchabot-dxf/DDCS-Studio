import { test, expect } from '@playwright/test';

// Studio editor autocomplete: a phone-autocorrect-style float at the caret with context-aware completions.
// "G1 X" → axis words; mid-word "G8" → matching G-codes; clicking a chip inserts at the token.
test.use({ viewport: { width: 1280, height: 900 } });

test('suggestionsFor is context-aware (codes vs axis words)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { suggestionsFor } = await import('/ui/editorAutocomplete.js');
    const at = (text) => suggestionsFor(text, text.length).hits.map((h) => h.text);
    return {
      g9: at('G9'),                    // mid-word G → G-codes starting G9 (G90/91/92/94/95)
      m: at('M'),                      // M → M-codes
      axisAfterMotion: at('G1 X10 '),  // line already has motion, fresh word → axis words
      empty: at(''),                   // empty line → starters
      complete: at('G94'),             // already complete → nothing to add
    };
  });
  expect(r.g9.length).toBeGreaterThan(0);
  expect(r.g9.every((t) => t.startsWith('G9'))).toBeTruthy();
  expect(r.m.every((t) => t.startsWith('M'))).toBeTruthy();
  expect(r.axisAfterMotion).toContain('Y');
  expect(r.axisAfterMotion.every((t) => /^[XYZAFSP]$/.test(t))).toBeTruthy();
  expect(r.empty.length).toBeGreaterThan(0);
  expect(r.complete.length).toBe(0);
});

test('clicking a completion inserts it at the caret', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.getElementById('editor') && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.autocomplete = true; });

  const editor = page.locator('#editor');
  await editor.click();
  await editor.fill('');
  await page.evaluate(() => { document.getElementById('editor').focus(); });
  await page.keyboard.type('G9');
  await page.waitForSelector('.ac-bar:not([hidden]) .ac-item');

  // click the first suggestion (a G9x code)
  const first = page.locator('.ac-bar .ac-item').first();
  const chosen = (await first.locator('b').textContent())?.trim();
  await first.click();

  const val = await editor.inputValue();
  expect(val.trim()).toBe(chosen);          // token "G8" replaced by full code
  expect(val.endsWith(' ')).toBeTruthy();   // code completions get a trailing space
});
