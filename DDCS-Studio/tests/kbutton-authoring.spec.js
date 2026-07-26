import { test, expect } from '@playwright/test';

// t1191 — K-BUTTON AUTHORING: (1) the K-buttons panel shows 16 keys (Expert/M3K); (2) the editor '＋ Make ▾' menu
// consolidates CAM slot + K-button (no 3rd floating button); (3) 'Make → K-button' turns the current program into a
// K-key macro (reusing the K-buttons panel machinery: ensureKbtn store, macroFileText Generate, pushKbutton Push).
test.use({ viewport: { width: 1400, height: 1000 } });

test('Part 1: the K-buttons panel shows 16 keys (K1..K16)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_kbtn"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_kbtn"]').click());
  await page.waitForFunction(() => document.querySelectorAll('#kbuttons_list .kbtn-row').length > 0);
  const rows = await page.evaluate(() => document.querySelectorAll('#kbuttons_list .kbtn-row').length);
  const last = await page.evaluate(() => { const r = [...document.querySelectorAll('#kbuttons_list .kbtn-row')].pop(); return r ? r.getAttribute('data-k') : null; });
  expect(rows, '16 K-button rows').toBe(16);
  expect(last, 'the last is K16').toBe('16');
});

test('Parts 2+3: editor ＋Make▾ menu → K-button saves + Generate; CAM slot item opens the authoring', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsEditorMakeMenu && document.getElementById('editor-cam-btn') && window.ddcsGetSettings);
  await page.evaluate(() => { document.getElementById('editor').value = 'G0 X0 Y0\nG1 Z-2 F100\nG1 X10\nM30\n'; });
  // Part 2 — the button is a Make menu, NOT a standalone CAM-slot button
  const label = await page.evaluate(() => document.getElementById('editor-cam-btn').textContent.trim());
  expect(label, 'the editor button is the ＋ Make ▾ menu').toContain('Make');
  await page.evaluate(() => document.getElementById('editor-cam-btn').click());
  await page.waitForSelector('#editor-make-menu [data-mk="kbtn"]', { timeout: 8000 });
  const items = await page.evaluate(() => [...document.querySelectorAll('#editor-make-menu [data-mk]')].map((b) => b.dataset.mk));
  expect(items, 'the menu has CAM slot + K-button').toEqual(['cam', 'kbtn']);

  // Part 3 — Make → K-button → pick K3 + name → Save + Generate
  await page.click('#editor-make-menu [data-mk="kbtn"]');
  await page.waitForSelector('#mkb-overlay #mkb_key', { timeout: 8000 });
  const keyOptCount = await page.evaluate(() => document.querySelectorAll('#mkb-overlay #mkb_key option').length);
  expect(keyOptCount, 'the key picker offers all 16 keys').toBe(16);
  await page.selectOption('#mkb-overlay #mkb_key', '3');
  await page.fill('#mkb-overlay #mkb_name', 'Test K3');
  await page.click('#mkb-overlay [data-mk="gen"]');   // Save + Generate
  await page.waitForFunction(() => !document.getElementById('mkb-overlay'), null, { timeout: 8000 });
  const saved = await page.evaluate(() => { const m = (window.ddcsGetSettings().macros || []).find((x) => (x.trigger || {}).kind === 'kbutton' && (x.trigger || {}).key === 3); return m ? { name: m.name, body: m.body } : null; });
  const genInserted = await page.evaluate(() => document.getElementById('editor').value.includes('key-3.nc'));
  expect(saved && saved.name, 'K3 saved with the name').toBe('Test K3');
  expect(saved.body, 'K3 body is the program').toContain('G1 Z-2');
  expect(genInserted, 'Generate inserted key-3.nc into the editor (reused kgen)').toBe(true);

  // the K-buttons panel reflects K3
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_kbtn"]'));
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_kbtn"]').click());
  await page.waitForFunction(() => document.querySelector('#kbuttons_list .kbtn-row[data-k="3"] .kb-f[data-f="name"]'));
  const panelName = await page.evaluate(() => document.querySelector('#kbuttons_list .kbtn-row[data-k="3"] .kb-f[data-f="name"]').value);
  expect(panelName, 'the K-buttons panel shows K3 = Test K3').toBe('Test K3');

  // Part 2 — the CAM slot menu item still opens the CAM authoring
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForSelector('#editor-cam-btn');
  await page.evaluate(() => document.getElementById('editor-cam-btn').click());
  await page.waitForSelector('#editor-make-menu [data-mk="cam"]', { timeout: 8000 });
  await page.click('#editor-make-menu [data-mk="cam"]');
  const camOpened = await page.waitForSelector('.cam-auth-overlay', { timeout: 8000 }).then(() => true).catch(() => false);
  expect(camOpened, 'CAM slot item opens the CAM authoring (unchanged)').toBe(true);
});
