import { test, expect } from '@playwright/test';

/**
 * t748 — HEADER NEVER-CLIPS + THE WIDER CHEVRON.
 *  (1) The nav row is CONTENT-DRIVEN (min-height + flex, tab font on clamp()) so the tab TOPS can never clip
 *      vertically — the header GROWS with its content (larger OS/min font, text-only zoom) instead of cropping it.
 *  (2) A DECLARED yield order (HEADER_YIELD in commandDeck.js) sheds width in sequence when space runs short:
 *      hy-logo (logo drops its subtitle + shrinks) → is-compact (op-button labels) → hy-tabscale (tab labels a step)
 *      → is-mini (inactive tabs → icon) → is-tiny (all tabs → icon). The applied classes are always an in-order prefix.
 *  (3) The quick-menu chevron has a real ≥44px touch target (a transparent ::before expander) on mobile + desktop.
 *
 * Browser zoom Z at physical width W is layout-equivalent to an effective CSS width W/Z (fonts + boxes scale together),
 * so the width×zoom sweep is exercised as effective widths. View-only change → emit is untouched (no emit code changed).
 */

const YIELD = ['hy-logo', 'is-compact', 'hy-tabscale', 'is-mini', 'is-tiny'];
const WIDTHS = [1920, 1366, 1024, 768, 540, 390];
const ZOOMS = [1, 1.25, 1.5];

// Real readiness (t710 doctrine): let the rAF-wrapped _fitAppHeader settle after a real viewport change — no fixed sleep.
const settle = async (page) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
};

// Worst vertical overflow of the tab GLYPHS (icon + label) beyond the header box — the true "tab top clipped" metric
// (scrollHeight misses VISIBLE overflow; the header sits at viewport y=0, so any glyph above header.top is clipped).
const glyphOverflow = () => {
  const h = document.querySelector('.app-header');
  const hr = h.getBoundingClientRect();
  let above = 0, below = 0;
  for (const t of h.querySelectorAll('.hdr-tabs .tab')) {
    for (const k of t.querySelectorAll('.app-ico, .app-tx')) {
      if (getComputedStyle(k).display === 'none') continue;
      const r = k.getBoundingClientRect();
      above = Math.max(above, hr.top - r.top);
      below = Math.max(below, r.bottom - hr.bottom);
    }
  }
  return { hdrH: Math.round(hr.height), above: Math.round(above), below: Math.round(below) };
};

test('no tab-top clips across the full width×zoom sweep (tab glyphs stay within the header box)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => document.fonts && document.fonts.ready);

  const clips = [];
  for (const W of WIDTHS) {
    for (const Z of ZOOMS) {
      const eff = Math.round(W / Z);
      await page.setViewportSize({ width: eff, height: 900 });
      await settle(page);
      const m = await page.evaluate(glyphOverflow);
      // 1px tolerance for sub-pixel rounding of the clamped (fractional) font — anything more is a real clip.
      if (m.above > 1 || m.below > 1) clips.push(`${W}@${Z}(=${eff}): above=${m.above} below=${m.below}`);
    }
  }
  expect(clips, `tab glyphs must never clip the header box; offenders: ${clips.join(' | ')}`).toEqual([]);
});

test('the header is CONTENT-DRIVEN: a much larger tab font GROWS the header instead of clipping the tabs', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 1366, height: 900 });
  await settle(page);

  const base = await page.evaluate(glyphOverflow);
  expect(base.hdrH, 'resting header height is the declared 54px').toBeGreaterThanOrEqual(54);

  // Force a big header font (simulates larger OS base / min-font-size / text-only accessibility zoom).
  const big = await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = '__big';
    s.textContent = `.app-header .tab { font-size: 40px !important; } .app-header .tab .app-ico svg { width: 58px !important; height: 58px !important; }`;
    document.head.appendChild(s);
    const h = document.querySelector('.app-header');
    const hr = h.getBoundingClientRect();
    let above = 0, below = 0;
    for (const t of h.querySelectorAll('.hdr-tabs .tab')) for (const k of t.querySelectorAll('.app-ico, .app-tx')) {
      if (getComputedStyle(k).display === 'none') continue;
      const r = k.getBoundingClientRect();
      above = Math.max(above, hr.top - r.top); below = Math.max(below, r.bottom - hr.bottom);
    }
    return { hdrH: Math.round(hr.height), above: Math.round(above), below: Math.round(below) };
  });
  // min-height (not fixed height) means the header GREW to hold the bigger content — and the glyphs did NOT clip.
  expect(big.hdrH, 'the header grew with its content (content-driven, not fixed)').toBeGreaterThan(base.hdrH);
  expect(big.above, 'even at a huge font the tab tops are not clipped').toBeLessThanOrEqual(1);
  await page.evaluate(() => { const s = document.getElementById('__big'); if (s) s.remove(); });
});

test('the declared yield order engages in sequence (applied classes are always an in-order prefix of HEADER_YIELD)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => document.fonts && document.fonts.ready);

  const applied = async () => page.evaluate((Y) => {
    const cls = [...document.querySelector('.app-header').classList];
    return Y.filter((c) => cls.includes(c));
  }, YIELD);
  const isPrefix = (arr) => arr.every((c, i) => c === YIELD[i]);   // engaged steps are exactly YIELD[0..n]

  // Wide desktop: no yield (everything fits).
  await page.setViewportSize({ width: 1600, height: 900 }); await settle(page);
  expect(await applied(), 'wide desktop needs no yield').toEqual([]);

  // Narrowing widths: each applied set is an in-order prefix, and it only grows as width shrinks (monotone).
  let prevLen = 0;
  for (const W of [1600, 1000, 820, 700, 560, 430, 390]) {
    await page.setViewportSize({ width: W, height: 900 }); await settle(page);
    const a = await applied();
    expect(isPrefix(a), `@${W}px the engaged steps ${JSON.stringify(a)} are an in-order prefix of the declared order`).toBe(true);
    expect(a.length, `@${W}px the yield only deepens as width shrinks`).toBeGreaterThanOrEqual(prevLen);
    prevLen = a.length;
  }
  // Phone tier: the logo has yielded FIRST (subtitle dropped) and tabs are icon-only (the last step).
  expect(prevLen, 'the phone tier engaged the full declared order').toBe(YIELD.length);

  // At a realistic desktop tier the nav fits with no page overflow (the yield actually resolved the overflow).
  await page.setViewportSize({ width: 820, height: 900 }); await settle(page);
  await page.waitForFunction(() => { const h = document.querySelector('.app-header'); return h.scrollWidth <= h.clientWidth; }, null, { timeout: 4000 });
});

test('the quick-menu chevron has a >=44px touch target on desktop and phone', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  for (const W of [1366, 390]) {
    await page.setViewportSize({ width: W, height: 844 });
    await settle(page);
    const hit = await page.evaluate(() => {
      const btn = document.getElementById('hdrPostBtn');
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const onBtn = (x, y) => { const e = document.elementFromPoint(x, y); return e === btn || (e && btn.contains(e)); };
      let hw = 0; for (let d = 0; d <= 30; d++) { if (onBtn(cx - d, cy) && onBtn(cx + d, cy)) hw = d; else break; }
      let hh = 0; for (let d = 0; d <= 30; d++) { if (onBtn(cx, cy - d) && onBtn(cx, cy + d)) hh = d; else break; }
      // the expander must not steal clicks from the neighbouring tab / brand
      const tab = document.querySelector('.hdr-tabs .tab'); const tr = tab.getBoundingClientRect();
      const tabHit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
      return { hitW: hw * 2, hitH: hh * 2, tabClickable: tab === tabHit || tab.contains(tabHit) };
    });
    expect(hit.hitW, `chevron hit width >=44px @${W}`).toBeGreaterThanOrEqual(44);
    expect(hit.hitH, `chevron hit height >=44px @${W}`).toBeGreaterThanOrEqual(44);
    expect(hit.tabClickable, `the expander does not steal the neighbouring tab's clicks @${W}`).toBe(true);
  }
});
