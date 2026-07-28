// Deep exploration: open wizard menus, a wizard modal, and each tab. Screenshot + dump.
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const URL = 'https://ddcs-studio.pages.dev/';
const OUT = path.join(__dirname, 'explore');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const DUMP = (page, minY = 0, maxY = 1400) => page.evaluate(({ minY, maxY }) => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.top >= minY && r.top < maxY;
  };
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 55);
  const sel = 'button, [role="tab"], [role="button"], [role="menuitem"], a, li, .menu-item, [data-tab], [data-view], [data-wizard], [data-op]';
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    if (!vis(el)) return;
    const txt = clean(el.innerText || el.textContent || el.getAttribute('aria-label') || el.title);
    if (!txt) return;
    const r = el.getBoundingClientRect();
    out.push({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (typeof el.className === 'string' ? el.className : '').slice(0, 34),
      dat: el.getAttribute('data-wizard') || el.getAttribute('data-op') || el.getAttribute('data-tab') || '', txt, x: Math.round(r.x), y: Math.round(r.y) });
  });
  const seen = new Set();
  return out.filter(o => { const k = o.txt + o.x + o.y; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.y - b.y || a.x - b.x);
}, { minY, maxY });

const show = (title, arr) => { console.log(`\n=== ${title} ===`); arr.forEach(d => console.log(`[${String(d.y).padStart(4)},${String(d.x).padStart(4)}] <${d.tag}${d.id ? ' #' + d.id : ''}${d.dat ? ' data=' + d.dat : ''}> "${d.txt}"  .${d.cls}`)); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3000);

  // Version / brand dropdown (hunting for "Profiles")
  try {
    await p.locator('.brand, [class*="brand"]').first().click({ timeout: 2000 });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, 'brand-menu.png') });
    show('BRAND / VERSION MENU', await DUMP(p, 20, 700));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  } catch (e) { console.log('brand click failed:', e.message); }

  // Wizard dropdown menus
  for (const name of ['Setup', 'Probe', 'ATC', 'Mill']) {
    try {
      await p.locator('button.wizard-btn', { hasText: name }).first().click({ timeout: 3000 });
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, `menu-${name}.png`) });
      show(`WIZARD MENU: ${name}`, await DUMP(p, 60, 800));
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    } catch (e) { console.log(`menu ${name} failed:`, e.message); }
  }

  // Open a real wizard modal (Mill -> first milling op)
  try {
    await p.locator('button.wizard-btn', { hasText: 'Mill' }).first().click({ timeout: 3000 });
    await p.waitForTimeout(500);
    const items = await DUMP(p, 60, 800);
    const cand = items.find(i => /pocket|facing|contour|slot|engrave/i.test(i.txt));
    console.log('\nOpening wizard item:', cand ? cand.txt : '(none found, clicking first)');
    if (cand) {
      await p.locator(`text="${cand.txt}"`).first().click({ timeout: 3000 }).catch(async () => {
        await p.mouse.click(cand.x + 20, cand.y + 8);
      });
    }
    await p.waitForTimeout(1800);
    await p.screenshot({ path: path.join(OUT, 'wizard-open.png') });
    // modal structure
    const modal = await p.evaluate(() => {
      const info = { canvases: document.querySelectorAll('canvas').length, svgs: document.querySelectorAll('svg').length,
        textareas: document.querySelectorAll('textarea').length,
        codeLike: [...document.querySelectorAll('[class*="code"],[class*="preview"],[class*="gcode"],pre')].map(e => (typeof e.className === 'string' ? e.className : '')).slice(0, 10),
        modalCls: [...document.querySelectorAll('[class*="modal"],[class*="wizard"],[class*="dialog"]')].filter(e => e.getBoundingClientRect().width > 300).map(e => (typeof e.className === 'string' ? e.className : '')).slice(0, 8) };
      return info;
    });
    console.log('\n=== WIZARD MODAL STRUCTURE ==='); console.log(JSON.stringify(modal, null, 2));
    show('WIZARD MODAL BUTTONS/TABS', (await DUMP(p, 0, 1080)).filter(d => /panel|tab|preview|3d|2d|code|save|insert|close|cancel|ok|apply/i.test(d.txt + d.cls)));
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  } catch (e) { console.log('wizard open failed:', e.message); }

  // Tabs
  for (const tab of ['BLOCKS', 'MACROS', 'GATEWAY', 'STUDIO']) {
    try {
      await p.locator('button.tab', { hasText: tab }).first().click({ timeout: 3000 });
      await p.waitForTimeout(1400);
      await p.screenshot({ path: path.join(OUT, `tab-${tab}.png`) });
      show(`TAB: ${tab}`, (await DUMP(p, 55, 700)).slice(0, 22));
    } catch (e) { console.log(`tab ${tab} failed:`, e.message); }
  }

  await browser.close();
  console.log('\nDONE deep explore. Screenshots in', OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
