import { test, expect } from '@playwright/test';

/**
 * t820 (bundle 2) — FORM-SECTION COLLAPSE on long twin forms. renderOpForm gains collapsible sections from the bindings'
 * EXISTING `section` declarations (no per-wizard code): a long form (> threshold rows AND ≥2 sections) renders a tappable
 * header per section that folds its rows; state is app-wide per section KIND (panePrefs, key ddcs_form_sections); a short
 * form stays plain. The motion reuses the paneAccordion engine + theme drawer tokens. Folded ≠ removed (the rows stay in
 * the DOM — the form-integrity + help guards still pass, verified in form-kernel-720 / field-help-798).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openWiz(page, type) {
  await page.evaluate((t) => window.openWiz(t), type);
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param]'), null, { timeout: 8000 });
}

test('a LONG form (pocket) renders collapsible sections; folding one survives a reload', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => { try { localStorage.removeItem('ddcs_form_sections'); } catch (_) {} });
  await openWiz(page, 'user_pocket_data');
  const before = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('#wiz_user_form .form-sec')];
    return { n: secs.length, titles: secs.map((s) => s.querySelector('.form-sec-title').textContent), firstCollapsed: secs[0].getAttribute('data-collapsed'), hdrH: secs[0].querySelector('.form-sec-hdr').offsetHeight };
  });
  expect(before.n, 'the pocket form has ≥2 collapsible sections').toBeGreaterThanOrEqual(2);
  // t2627 — pocket migrated onto the declared group_box tree (contour's/slot's own recipe): resectioned from
  // the old canonical GEOMETRY/TOOL & CUT split to the shell's own 5 real names (SHAPE/TOOL/TOOL &
  // STEPOVER/DEPTH & FEED/REST MACHINING, pocket-form-reproduction-2301.spec.js) — 'TOOL & CUT' no longer
  // exists as a section title for pocket. 'TOOL & STEPOVER' is its closest still-present analog.
  expect(before.titles, 'the sections are the declared kinds').toContain('TOOL & STEPOVER');
  expect(before.firstCollapsed, 'default = expanded').toBe('0');
  expect(before.hdrH, 'the section header is a ≥44px touch target').toBeGreaterThanOrEqual(44);

  // fold "TOOL & STEPOVER"
  await page.evaluate(() => { const s = [...document.querySelectorAll('#wiz_user_form .form-sec')].find((x) => x.querySelector('.form-sec-title').textContent === 'TOOL & STEPOVER'); s.querySelector('.form-sec-hdr').click(); });
  await page.waitForTimeout(450);   // let the fold animate + persist
  const folded = await page.evaluate(() => {
    const s = [...document.querySelectorAll('#wiz_user_form .form-sec')].find((x) => x.querySelector('.form-sec-title').textContent === 'TOOL & STEPOVER');
    return { collapsed: s.getAttribute('data-collapsed'), pref: (() => { try { return JSON.parse(localStorage.getItem('ddcs_form_sections') || '{}')['TOOL & STEPOVER']; } catch (_) { return null; } })() };
  });
  expect(folded.collapsed, 'the section is folded').toBe('1');
  expect(folded.pref, 'the fold persisted app-wide (panePrefs)').toBe(true);

  // RELOAD → reopen → the section starts collapsed (survives reload)
  await page.reload();
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await openWiz(page, 'user_pocket_data');
  const after = await page.evaluate(() => { const s = [...document.querySelectorAll('#wiz_user_form .form-sec')].find((x) => x.querySelector('.form-sec-title').textContent === 'TOOL & STEPOVER'); return s ? s.getAttribute('data-collapsed') : null; });
  expect(after, 'the folded section is remembered across reload').toBe('1');
  // folded ≠ removed: the folded section's fields are still in the DOM (the guards depend on this)
  const stillThere = await page.evaluate(() => document.querySelectorAll('#wiz_user_form .form-sec [data-param]').length);
  expect(stillThere, 'folded rows remain in the DOM (folded ≠ removed)').toBeGreaterThan(4);
});

test('a SHORT form renders NO collapse chrome (where sensible)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await openWiz(page, 'user_wcs_data');
  const n = await page.evaluate(() => document.querySelectorAll('#wiz_user_form .form-sec').length);
  expect(n, 'a short form (≤ threshold rows) stays plain — no section chrome').toBe(0);
});

test('spot-check: 3 twins — long forms sectionize, short forms stay plain', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  const out = {};
  for (const t of ['user_pocket_data', 'user_surfacing_data', 'user_wcs_data']) {
    try { await openWiz(page, t); out[t] = await page.evaluate(() => ({ secs: document.querySelectorAll('#wiz_user_form .form-sec').length, params: document.querySelectorAll('#wiz_user_form [data-param]').length })); }
    catch (_) { out[t] = { secs: -1 }; }
    await page.evaluate(() => window.closeWiz && window.closeWiz());
    await page.waitForTimeout(150);
  }
  // pocket is long → sectionized; wcs is short → plain. (surfacing may be either — just assert it opened without error.)
  expect(out.user_pocket_data.secs, 'pocket sectionizes').toBeGreaterThanOrEqual(2);
  expect(out.user_wcs_data.secs, 'wcs stays plain').toBe(0);
  expect(out.user_surfacing_data.secs, 'surfacing rendered its form').toBeGreaterThanOrEqual(0);
});

test('THEMES: the section chrome renders legibly in every theme (screenshots)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await openWiz(page, 'user_pocket_data');
  for (const th of ['studio', 'normal', 'steampunk', 'futuristic', 'organic']) {
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), th);
    await page.waitForTimeout(120);
    const painted = await page.evaluate(() => { const h = document.querySelector('#wiz_user_form .form-sec-hdr'); return h ? h.offsetHeight : 0; });
    expect(painted, `theme ${th}: the section header renders as a ≥44px tappable bar`).toBeGreaterThanOrEqual(44);
    await page.locator('#wiz_user_form').screenshot({ path: `scratchpad/form-sec-${th}.png` }).catch(() => {});
  }
});
