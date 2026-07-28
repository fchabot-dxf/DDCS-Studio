// Exploration pass: load the live site, screenshot, and dump nav structure.
const { chromium } = require('@playwright/test');

const URL = 'https://ddcs-studio.pages.dev/';
const OUT = require('path').join(__dirname, 'explore');
const fs = require('fs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newContext ? null : await ctx.newPage();
  const p = page || await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  console.log('goto', URL);
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto err', e.message));
  await p.waitForTimeout(3500);

  await p.screenshot({ path: require('path').join(OUT, '00-landing.png') });
  console.log('TITLE:', await p.title());

  // Dump top-level interactive/nav elements with visible text.
  const dump = await p.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.top < 1200;
    };
    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const sel = 'button, [role="tab"], [role="button"], a, .tab, nav *[onclick], [data-tab], [data-view]';
    const out = [];
    document.querySelectorAll(sel).forEach(el => {
      if (!vis(el)) return;
      const txt = clean(el.innerText || el.textContent || el.getAttribute('aria-label') || el.title);
      if (!txt) return;
      const r = el.getBoundingClientRect();
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        id: el.id || '',
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
        dtab: el.getAttribute('data-tab') || el.getAttribute('data-view') || '',
        txt,
        x: Math.round(r.x), y: Math.round(r.y)
      });
    });
    // de-dup by text+pos
    const seen = new Set();
    return out.filter(o => { const k = o.txt + o.x + o.y; if (seen.has(k)) return false; seen.add(k); return true; })
              .sort((a, b) => a.y - b.y || a.x - b.x);
  });
  console.log('\n=== INTERACTIVE / NAV ELEMENTS (top of page) ===');
  dump.forEach(d => console.log(`[${d.y.toString().padStart(4)},${d.x.toString().padStart(4)}] <${d.tag}${d.role ? ' role='+d.role : ''}${d.dtab ? ' data='+d.dtab : ''}${d.id ? ' #'+d.id : ''}>  "${d.txt}"  .${d.cls}`));

  console.log('\n=== CONSOLE ERRORS ===');
  console.log(errs.slice(0, 10).join('\n') || '(none)');

  await browser.close();
  console.log('\nDONE. Screenshot at', require('path').join(OUT, '00-landing.png'));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
