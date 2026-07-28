const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => { log('  DIALOG:', d.type(), JSON.stringify(d.message()).slice(0, 80)); d.accept().catch(() => {}); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(2500);

  const step = async (name, fn) => { try { await fn(); log('OK  ', name); } catch (e) { log('FAIL', name, '::', e.message.split('\n')[0]); } };
  const loc = (sel, has) => { let l = p.locator(sel); if (has) l = l.filter({ hasText: has }); return l.first(); };

  // WIZARDS
  await step('open Probe menu', async () => { await loc('button.wizard-btn', 'Probe').click(); await p.waitForTimeout(600); });
  await step('close Probe menu', async () => { await loc('button.wizard-btn', 'Probe').click(); await p.waitForTimeout(300); });
  await step('open Mill menu', async () => { await loc('button.wizard-btn', 'Mill').click(); await p.waitForTimeout(500); });
  await step('click Pocket', async () => { await loc('.toolbar-dropdown-content button', 'Pocket').click(); await p.waitForTimeout(1800); });
  log('   #wizard active?', await p.locator('#wizard.active, #wizard.overlay.active').count());
  await step('Shape -> Circle', async () => {
    const s = p.locator('#wizard select').filter({ hasText: 'Rectangle' }).first();
    log('   shape selects matching Rectangle:', await p.locator('#wizard select').filter({ hasText: 'Rectangle' }).count());
    await s.selectOption({ label: 'Circle' }); await p.waitForTimeout(1200);
  });
  await p.screenshot({ path: path.join(OUT, 'vf-circle.png') });
  await step('INSERT', async () => { await loc('#wizard button.primary', 'INSERT').click(); await p.waitForTimeout(1500); });
  const wizStillOpen = await p.locator('#wizard.active, #wizard.overlay.active').count();
  log('   after INSERT -> #wizard still open?', wizStillOpen);
  const editorLines = await p.evaluate(() => (document.querySelector('.editor-layer, textarea, [class*="editor"]')?.textContent || '').split('\n').length);
  log('   editor text lines ~', editorLines);
  await p.screenshot({ path: path.join(OUT, 'vf-after-insert.png') });
  if (wizStillOpen) { await step('fallback CANCEL', async () => { await loc('#wizard button', 'CANCEL').click(); await p.waitForTimeout(600); }); }

  // PROFILES (via MACROS chip)
  await step('go MACROS', async () => { await loc('button.tab', 'MACROS').click(); await p.waitForTimeout(1000); });
  await step('open profile chip', async () => { await p.locator('#macros_ctrl_chip').first().click(); await p.waitForTimeout(1200); });
  log('   settings modal tabs:', await p.locator('.settings-tab').count());
  await step('sidebar WCS', async () => { await loc('.settings-tab', 'WCS').click(); await p.waitForTimeout(900); });
  await step('sidebar Variables', async () => { await loc('.settings-tab', 'Variables').click(); await p.waitForTimeout(900); });
  await p.screenshot({ path: path.join(OUT, 'vf-profile-vars.png') });
  await step('close profile (Done)', async () => { await p.locator('button', { hasText: 'Done' }).first().click(); await p.waitForTimeout(700); });
  log('   settings modal still open?', await p.locator('.settings-modal.active, #settings-modal.active, .settings-content:visible').count().catch(() => '?'));

  // BLOCKS
  await step('go BLOCKS', async () => { await loc('button.tab', 'BLOCKS').click(); await p.waitForTimeout(1200); });
  log('   blk-sug-opt count:', await p.locator('.blk-sug-opt').count(), ' blk-sug-chip:', await p.locator('.blk-sug-chip').count());
  await step('click chip Tool', async () => { await p.locator('.blk-sug-opt', { hasText: 'Tool' }).first().click(); await p.waitForTimeout(700); });
  await step('click chip Move', async () => { await p.locator('.blk-sug-opt', { hasText: 'Move' }).first().click(); await p.waitForTimeout(700); });
  await p.screenshot({ path: path.join(OUT, 'vf-blocks.png') });

  // MACROS
  await step('go MACROS 2', async () => { await loc('button.tab', 'MACROS').click(); await p.waitForTimeout(1000); });
  await step('open probe.nc', async () => { await loc('.settings-tab.tree-level-2', 'probe.nc').click(); await p.waitForTimeout(900); });
  await p.screenshot({ path: path.join(OUT, 'vf-macros-probe.png') });
  await step('open sysstart.nc', async () => { await loc('.settings-tab.tree-level-2', 'sysstart.nc').click(); await p.waitForTimeout(900); });

  await browser.close();
  log('\nDONE verify-flow');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
