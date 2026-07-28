const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => { console.log('DIALOG', d.type(), JSON.stringify(d.message()).slice(0, 120)); d.accept().catch(() => {}); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  await p.locator('button.tab').filter({ hasText: 'MACROS' }).filter({ visible: true }).first().click(); await p.waitForTimeout(1000);
  await p.locator('#macros_ctrl_chip').first().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'pull-0-profile.png') });

  // find the Pull button
  const pulls = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => /pull from controller|pull/i.test(b.textContent || '')).map(b => ({ t: (b.textContent || '').trim().slice(0, 30), x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y), vis: b.getBoundingClientRect().width > 0 })));
  console.log('PULL BUTTONS:', JSON.stringify(pulls));

  await p.locator('button').filter({ hasText: 'Pull from controller' }).first().click().catch(e => console.log('pull click err', e.message));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'pull-1-clicked.png') });

  const st = await p.evaluate(() => ({
    modals: [...document.querySelectorAll('[class*="modal"],[class*="dialog"],[class*="overlay"],[class*="sheet"],[class*="review"],[class*="diff"]')].filter(e => e.getBoundingClientRect().width > 250 && getComputedStyle(e).display !== 'none').map(e => ({ cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })),
    buttons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().y > 90).map(b => (b.textContent || '').trim().slice(0, 26)).filter(Boolean).slice(0, 30),
    text: (document.querySelector('[class*="modal"],[class*="dialog"],[class*="review"],[class*="diff"]')?.innerText || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    inputs: [...document.querySelectorAll('input:not([type=hidden]),select')].filter(i => i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().y > 90).map(i => ({ ph: i.placeholder, val: (i.value || '').slice(0, 18), tag: i.tagName.toLowerCase() })).slice(0, 12)
  }));
  console.log('AFTER PULL:', JSON.stringify(st, null, 1));

  await browser.close();
  console.log('DONE pull');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
