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

test('two modes: complete (mid-word) vs next-word (at a boundary)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { suggestionsFor } = await import('/ui/editorAutocomplete.js');
    const m = (text) => suggestionsFor(text, text.length);
    return {
      completeMode: m('G9').mode,
      nextMode: m('G1 X10 ').mode,
      nextHits: m('G1 X10 ').hits.map((h) => h.text),     // bigram keyed on the previous token "X10" → axis words
      lineStart: m('').hits.map((h) => h.text),           // boundary with no prior token → common openers
    };
  });
  expect(r.completeMode).toBe('complete');
  expect(r.nextMode).toBe('next');
  expect(r.nextHits).toContain('Y');
  expect(r.nextHits.every((t) => /^[XYZAFSPIJK]$/.test(t)), 'next-word after an axis = axis words').toBeTruthy();
  expect(r.lineStart.length, 'line start offers openers').toBeGreaterThan(0);
});

test('next-word box renders green with a "next" tag', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.getElementById('editor') && window.ddcsGetSettings);
  await page.evaluate(() => { window.ddcsGetSettings().compose.autocomplete = true; });
  const editor = page.locator('#editor');
  await editor.click();
  await editor.fill('');
  await page.evaluate(() => document.getElementById('editor').focus());
  await page.keyboard.type('G1 X10 ');                    // trailing space → boundary → next-word mode
  // Under full-suite parallel-load the editor's autocomplete 'input' listener can attach AFTER the first keystrokes
  // (init race) and the bar can transiently hide — so poll, re-firing input each tick (caret is at the boundary)
  // until the green next-word bar renders. Robust against late wiring; assertions below are unchanged.
  await expect.poll(async () => {
    await page.evaluate(() => document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true })));
    return page.locator('.ac-bar.ac-next:not([hidden])').count();
  }, { timeout: 15000, intervals: [100, 200, 300, 500] }).toBeGreaterThan(0);
  expect(await page.locator('.ac-bar.ac-next .ac-tag').count(), 'green box carries the next tag').toBe(1);
  expect(await page.locator('.ac-bar.ac-next .ac-item').count(), 'green box offers options').toBeGreaterThan(0);
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
  await expect.poll(async () => {   // poll + re-fire input until the bar renders (init-race safe; see the next-word test)
    await page.evaluate(() => document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true })));
    return page.locator('.ac-bar:not([hidden]) .ac-item').count();
  }, { timeout: 15000, intervals: [100, 200, 300, 500] }).toBeGreaterThan(0);

  // click the first suggestion (a G9x code)
  const first = page.locator('.ac-bar .ac-item').first();
  const chosen = (await first.locator('b').textContent())?.trim();
  await first.click();

  const val = await editor.inputValue();
  expect(val.trim()).toBe(chosen);          // token "G8" replaced by full code
  expect(val.endsWith(' ')).toBeTruthy();   // code completions get a trailing space
});
