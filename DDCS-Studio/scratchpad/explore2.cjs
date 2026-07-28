const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

const dumpBig = (p) => p.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width > 350 && r.height > 250 && s.position === 'fixed' || (typeof el.className === 'string' && /modal|wizard|dialog|overlay|sheet/i.test(el.className) && r.width > 300)) {
      out.push({ cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  const seen = new Set();
  return out.filter(o => { if (seen.has(o.cls)) return false; seen.add(o.cls); return true; }).slice(0, 12);
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3000);

  // --- Open Pocket wizard modal ---
  await p.mouse.click(960, 500); await p.waitForTimeout(200);
  await p.locator('button.wizard-btn', { hasText: 'Mill' }).first().click();
  await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button', { hasText: 'Pocket' }).first().click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, 'wizard-pocket.png') });
  console.log('=== BIG / MODAL ELEMENTS after Pocket ===');
  console.log(JSON.stringify(await dumpBig(p), null, 2));
  console.log('canvases:', await p.locator('canvas').count(), ' svgs:', await p.locator('svg').count());
  // sub-panel toggles inside modal
  const sub = await p.evaluate(() => [...document.querySelectorAll('button,[role=tab]')].filter(e => {
    const r = e.getBoundingClientRect(); return r.width > 0 && /2d|3d|code|preview|layout|g-code|gcode/i.test((e.innerText || '') + (typeof e.className === 'string' ? e.className : ''));
  }).map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30), c: (typeof e.className === 'string' ? e.className : '').slice(0, 34), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) })).slice(0, 20));
  console.log('=== SUB-PANEL TOGGLES ==='); console.log(JSON.stringify(sub, null, 2));

  await p.keyboard.press('Escape'); await p.waitForTimeout(600);

  // --- Profiles: controller chip ---
  await p.locator('button.tab', { hasText: 'MACROS' }).first().click();
  await p.waitForTimeout(1200);
  await p.locator('#macros_ctrl_chip, button', { hasText: 'DDCS Expert' }).first().click().catch(e => console.log('chip click failed', e.message));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'profiles.png') });
  console.log('\n=== PROFILE SELECTOR CONTENT ===');
  const prof = await p.evaluate(() => [...document.querySelectorAll('button,li,option,.profile,[class*=profile],[class*=controller]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.innerText || '').trim(); }).map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 45), c: (typeof e.className === 'string' ? e.className : '').slice(0, 30), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) })).filter(e => e.y > 60 && e.y < 900).slice(0, 30));
  console.log(JSON.stringify(prof, null, 2));

  await browser.close();
  console.log('\nDONE explore2');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
