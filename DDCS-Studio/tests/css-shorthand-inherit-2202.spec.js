import { test, expect } from '@playwright/test';

/**
 * t2202 (BACKLOG 15) — `font: <weight> <size>[/<line-height>] inherit` is INVALID CSS: `inherit` may only be
 * the font shorthand's SOLE value, never a component alongside explicit weight/size — so the WHOLE declaration
 * is silently dropped by the parser. No error, no warning; the rule looks correct in the source and renders as
 * though never written. t2173 found and flagged ONE instance (.preflight-badge-label) but left it unfixed and
 * predicted "likely others… elsewhere in styles.css." This sweep found 20 total (19 more, all copy-pasted from
 * the same bad pattern) and split every one into font-family/font-weight/font-size/line-height longhands.
 *
 * VERIFIED BY COMPUTED VALUE, never by eye (the whole category is defined by looking correct in source) — each
 * case below builds the minimal DOM the compound selector needs and reads getComputedStyle. font-size is the
 * discriminating check everywhere (it never collides with an unrelated rule in this codebase); font-weight is
 * asserted too EXCEPT on two <button>-element cases (.op-ctx-item, .sl-primary) where a separate, pre-existing,
 * unrelated rule already wins font-weight on cascade specificity regardless of whether this fix landed — a real
 * but DIFFERENT category (cascade order, not parse-time validity) and out of this item's own scope.
 */
const CASES = [
  { html: '<div class="editor-container"><span class="xform-badge-label"></span></div>', sel: '.xform-badge-label', size: '11px', weight: '700' },
  { html: '<div class="editor-container"><span class="preflight-badge-label"></span></div>', sel: '.preflight-badge-label', size: '11px', weight: '700' },
  { html: '<div class="editor-container"><div class="preflight-pop"></div></div>', sel: '.preflight-pop', size: '11px', weight: '500' },
  { html: '<div id="editor-highlight"><span class="g-line"><span class="preflight-annot"></span></span></div>', sel: '.preflight-annot', size: '10px', weight: '700' },
  { html: '<div class="editor-container"><span class="time-estimate-chip"></span></div>', sel: '.time-estimate-chip', size: '11px', weight: '600' },
  // .op-ctx-item / .sl-primary: real <button> elements. Neither weight NOR (for op-ctx-item specifically) size
  // matches the declared value here — a `<button>`-specific cascade/UA quirk this codebase's own generic
  // `button, .btn, .op-btn, .toolbar-btn` rule (or the platform's own form-control font handling) wins
  // regardless of this fix, confirmed by an unrelated bare `<button>` (no class at all) showing the SAME
  // non-declared weight. The important, in-scope fact — checked via the CSSOM below, not computed style — is
  // that the LONGHAND DECLARATION ITSELF now parses and exists; a cascade loss is a separate, real, but
  // different category (specificity, not parse-time validity) and out of this item's own scope.
  { html: '<button class="op-ctx-item"></button>', sel: '.op-ctx-item', cssomOnly: true },
  { html: '<span class="sl-active-badge"></span>', sel: '.sl-active-badge', size: '10px', weight: '700' },
  { html: '<button class="sl-primary"></button>', sel: '.sl-primary', cssomOnly: true },
  { html: '<div class="form-sec"><button class="form-sec-hdr"></button></div>', sel: '.form-sec-hdr', size: '11px', weight: '600' },
  { html: '<div id="blocks-app"><input class="blk-search"></div>', sel: '.blk-search', size: '12px' },
  { html: '<div id="blocks-app"><div class="blk-sug-chip"></div></div>', sel: '.blk-sug-chip', size: '11px', weight: '600' },
  { html: '<div id="blocks-app"><button class="blk-dev-savebtn"></button></div>', sel: '.blk-dev-savebtn', size: '11px', weight: '700' },
  { html: '<div id="blocks-app"><span class="blk-edit-chip"></span></div>', sel: '.blk-edit-chip', size: '11px', weight: '700' },
  { html: '<div id="blocks-app"><div class="blk-sug-opt"></div></div>', sel: '.blk-sug-opt', size: '11px', weight: '600' },
  { html: '<div id="blocks-app"><div class="blk-sug-opt"><kbd></kbd></div></div>', sel: '.blk-sug-opt kbd', size: '9px', weight: '600' },
  { html: '<div id="blocks-app"><div class="blk-pane-title"></div></div>', sel: '.blk-pane-title', size: '12px', weight: '700' },
  { html: '<div id="blocks-app"><button class="blk-view-btn"></button></div>', sel: '.blk-view-btn', size: '10px', weight: '700' },
  { html: '<div id="blocks-app"><button class="blk-tools-handle"></button></div>', sel: '.blk-tools-handle', size: '11px', weight: '700' },
  { html: '<div id="blocks-app"><button class="blk-openmodal"></button></div>', sel: '.blk-openmodal', size: '13px', weight: '700' },
];

test('every fixed font:…inherit rule now computes its declared size (and weight, where nothing else contends)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  for (const c of CASES) {
    if (c.cssomOnly) {
      // Find the ACTUAL parsed rule (not the cascade-resolved computed style) and confirm the browser accepted
      // font-size/font-weight as real declarations — this is what "the shorthand no longer voids the
      // declaration" actually means, independent of a separate cascade/specificity outcome.
      const r = await page.evaluate((sel) => {
        for (const sheet of document.styleSheets) {
          let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
          for (const rule of rules) {
            if (rule.selectorText === sel) return { fontSize: rule.style.getPropertyValue('font-size'), fontWeight: rule.style.getPropertyValue('font-weight') };
          }
        }
        return null;
      }, c.sel);
      expect(r, `${c.sel} rule found in a loaded stylesheet`).toBeTruthy();
      expect(r.fontSize, `${c.sel} font-size PARSED (not voided)`).not.toBe('');
      expect(r.fontWeight, `${c.sel} font-weight PARSED (not voided)`).not.toBe('');
      continue;
    }
    const r = await page.evaluate((c) => {
      const host = document.createElement('div');
      host.innerHTML = c.html;
      document.body.appendChild(host);
      const el = host.querySelector(c.sel);
      const cs = getComputedStyle(el);
      const out = { size: cs.fontSize, weight: cs.fontWeight };
      host.remove();
      return out;
    }, c);
    expect(r.size, `${c.sel} font-size`).toBe(c.size);
    if (c.weight) expect(r.weight, `${c.sel} font-weight`).toBe(c.weight);
  }
});

/** The mobile-only drawer handle needs the 860px media query active to render its rule at all. */
/** `.blk-drawer-handle` is a real <button>, so (like .op-ctx-item/.sl-primary above) its computed font-size
 *  can coincidentally collide with the generic `button,.btn,…{font-size:12px}` rule's OWN value regardless of
 *  whether THIS fix landed — a genuine confound that made an earlier version of this test pass on unfixed code
 *  too (caught by the non-vacuity check itself: git-stash the CSS, expect this to go red, and it didn't). Fixed
 *  by checking the CSSOM directly (recursing into the @media rule) rather than the cascade-resolved computed
 *  style, matching the .op-ctx-item / .sl-primary pattern above for the same reason. */
test('the mobile drawer handle (@media 860px) — the rule itself parsed, not just something that happens to match', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText === '#blocks-app .blk-drawer-handle') return { fontSize: rule.style.getPropertyValue('font-size'), fontWeight: rule.style.getPropertyValue('font-weight') };
        if (rule.cssRules) { const found = walk(rule.cssRules); if (found) return found; }
      }
      return null;
    };
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
      const found = walk(rules);
      if (found) return found;
    }
    return null;
  });
  expect(r, '.blk-drawer-handle rule found (inside its @media block)').toBeTruthy();
  expect(r.fontSize, '.blk-drawer-handle font-size PARSED (not voided)').not.toBe('');
  expect(r.fontWeight, '.blk-drawer-handle font-weight PARSED (not voided)').not.toBe('');
});
