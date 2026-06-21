import { test, expect } from '@playwright/test';

// The Variables tab browses the SHARED variableDB as a single <pre> of "id  description" text (fast with
// thousands of vars — not thousands of DOM rows), built lazily on open, with a filter box.
test.use({ viewport: { width: 1280, height: 900 } });

test('Variables tab renders the shared DB as fast text + filters by search', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.variableDB);
  await page.waitForFunction(() => window.ddcsStudio.variableDB.getAll().length > 0, null, { timeout: 8000 });
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.getElementById('set_var_list'));

  const r = await page.evaluate(() => {
    document.querySelector('.settings-tab[data-target="set_tab_variables"]').click();
    const pre = document.getElementById('set_var_list');
    return {
      tag: pre.tagName,
      childCount: pre.childElementCount,                       // 0 = single text node (the perf goal)
      lines: pre.textContent ? pre.textContent.split('\n').length : 0,
      total: window.ddcsStudio.variableDB.getAll().length,
    };
  });
  expect(r.tag, 'a <pre> text block').toBe('PRE');
  expect(r.childCount, 'no per-variable DOM rows (text only)').toBe(0);
  expect(r.total, 'shared DB has variables').toBeGreaterThan(1);
  expect(r.lines, 'one line per variable').toBe(r.total);

  // Filter to a specific id → fewer lines (uses the shared db.search()).
  const filtered = await page.evaluate(() => {
    const all = window.ddcsStudio.variableDB.getAll();
    const term = String(all[0].i);
    const s = document.getElementById('set_var_search'); s.value = term; s.dispatchEvent(new Event('input', { bubbles: true }));
    return { lines: document.getElementById('set_var_list').textContent.split('\n').length, total: all.length };
  });
  expect(filtered.lines, 'search narrowed the list').toBeLessThan(filtered.total);
  expect(filtered.lines, 'but still has matches').toBeGreaterThan(0);
});
