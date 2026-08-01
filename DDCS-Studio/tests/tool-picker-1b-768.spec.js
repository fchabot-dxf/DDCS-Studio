import { test, expect } from '@playwright/test';

/**
 * t768 Phase 1b — the RICH PICKER + the CONTEXT-AWARE MODAL. The mill-wizard Tool picker rows read T# · name · Ø · tip
 * glyph; a ⚙ at the row's end opens the tool-table modal PICKABLE from a wizard (Use / double-click selects the tool INTO
 * the binding + closes; add-then-use has no dead end), and EDIT-ONLY from Settings (no Use affordance). ONE composite
 * widget on the one binding — any wizard carrying the tool marker inherits it.
 */
test.use({ viewport: { width: 1200, height: 860 } });

const seedTools = (page, tools) => page.evaluate((t) => { const s = window.ddcsGetSettings(); s.atc = s.atc || {}; s.atc.tools = t; }, tools);
const openTwin = async (page, op) => {
  await page.evaluate((o) => window.openWiz(o), op);
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
};
/**
 * ⚠ t1500 — THE TOOL GEAR IS FOUND BY ITS ROW, NOT BY BEING THE FIRST ⚙ ON THE FORM.
 *
 * These specs used to take the first button whose text was '⚙'. A mill twin's form has TWO legitimate gears: this
 * one (open the tool library, pick a tool) and the WCS deep-link that EVERY twin inherits from `FIELD_LINKS` — one
 * source, no per-twin declaration. Which one came first was decided by nothing more than the order the bindings
 * happened to be concatenated in, so the spec was passing on a coincidence: it read "the wizard ⚙" as though a
 * wizard had one.
 *
 * Anchoring on the `toolNum` row says what the test means and cannot be flipped by a field-order change. It is
 * strictly MORE precise, not looser — a genuinely broken tool gear still fails every assertion below.
 */
const gearOf = () => {
    const form = document.getElementById('wiz_user_form');
    const sel = form.querySelector('[data-param="toolNum"]');
    if (!sel) return null;
    return [...sel.closest('div').querySelectorAll('button')].find((b) => b.textContent === '⚙');
};

test('the picker dropdown rows read T# · name · Ø · tip glyph', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  await seedTools(page, [{ num: 3, name: '6mm ball', type: 'ballnose', dia: 6 }, { num: 1, name: '6mm flat', type: 'endmill', dia: 6 }]);
  await openTwin(page, 'user_slot_data');
  const opts = await page.evaluate(() => [...document.getElementById('wiz_user_form').querySelector('[data-param="toolNum"]').options].map((o) => o.textContent));
  const ball = opts.find((o) => /\bT3\b/.test(o));
  expect(ball, 'the ballnose row').toBeTruthy();
  expect(ball).toMatch(/T3/);
  expect(ball).toMatch(/6mm ball/);
  expect(ball).toMatch(/Ø6/);
  expect(ball, 'a tip glyph (◗ ball)').toMatch(/◗/);
});

test('the wizard ⚙ opens a PICKABLE modal; Use selects into the binding + closes', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  await seedTools(page, [{ num: 5, name: '8mm ball', type: 'ballnose', dia: 8 }]);
  await openTwin(page, 'user_slot_data');
  const r = await page.evaluate((gearSrc) => {
    const form = document.getElementById('wiz_user_form');
    const gear = eval(`(${gearSrc})`)();
    // the two gears are DISTINCT and both real — asserted so the ambiguity that used to decide this test is visible
    const allGears = [...form.querySelectorAll('button')].filter((b) => b.textContent === '⚙');
    const gearRows = allGears.map((g) => { const c = g.closest('div').querySelector('[data-param]'); return c && c.dataset.param; });
    gear.click();
    const modal = document.getElementById('toollib-modal');
    const pickmode = modal.classList.contains('tl-pickmode');
    const useBtns = [...modal.querySelectorAll('.tl-use')];
    const useVisible = useBtns.length > 0 && getComputedStyle(useBtns[0]).display !== 'none';
    useBtns.find((b) => b.dataset.usenum === '5').click();   // Use T5
    const sel = form.querySelector('[data-param="toolNum"]');
    return { pickmode, useVisible, gearRows, boundVal: sel.value, closed: !modal.classList.contains('active') };
  }, gearOf.toString());
  // the WCS deep-link gear is a FEATURE every twin inherits; naming it here is what stops the tool gear being found
  // by position again (and would catch it silently disappearing).
  expect(r.gearRows, 'the form carries both the tool gear and the inherited WCS deep-link gear').toEqual(expect.arrayContaining(['toolNum', 'wcs']));
  expect(r.pickmode, 'the TOOL ⚙ opens the modal in PICK mode').toBe(true);
  expect(r.useVisible, 'the Use affordance is visible in pick mode').toBe(true);
  expect(r.boundVal, 'Use selected T5 INTO the wizard binding').toBe('5');
  expect(r.closed, 'the modal closed after the pick').toBe(true);
});

test('opened from Settings the SAME modal is EDIT-ONLY (no Use affordance)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await seedTools(page, [{ num: 2, name: '4mm flat', type: 'endmill', dia: 4 }]);
  const r = await page.evaluate(async () => {
    const { openToolLibrary } = await import('/ui/settingsPanel.js');
    openToolLibrary();   // no onPick → edit-only (the Settings entry)
    const modal = document.getElementById('toollib-modal');
    const useBtns = [...modal.querySelectorAll('.tl-use')];
    return { exists: !!modal, active: modal.classList.contains('active'), pickmode: modal.classList.contains('tl-pickmode'), useVisible: useBtns.length > 0 && getComputedStyle(useBtns[0]).display !== 'none' };
  });
  expect(r.exists && r.active, 'the edit modal opens').toBe(true);
  expect(r.pickmode, 'Settings opens edit-only (not pick mode)').toBe(false);
  expect(r.useVisible, 'no Use affordance from Settings').toBe(false);
});

test('add-then-use has no dead end: add a tool in the modal, then Use it, in one visit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
  await seedTools(page, []);   // empty library
  await openTwin(page, 'user_slot_data');
  const r = await page.evaluate((gearSrc) => {
    const form = document.getElementById('wiz_user_form');
    eval(`(${gearSrc})`)().click();   // the TOOL row's gear (see gearOf) — not whichever ⚙ renders first
    const modal = document.getElementById('toollib-modal');
    modal.querySelector('#toollib-add').click();   // ADD a tool
    // fill a field so the new tool isn't an all-blank row (libraryTools drops those) — the real add-then-use flow
    const newRow = [...modal.querySelectorAll('#toollib-rows tr')].pop();
    const dia = newRow.querySelector('[data-field="dia"]'); dia.value = '6'; dia.dispatchEvent(new Event('input', { bubbles: true }));
    const added = [...modal.querySelectorAll('.tl-use')].pop();
    const addedNum = added.dataset.usenum;
    added.click();   // USE the just-added tool — same visit
    const sel = form.querySelector('[data-param="toolNum"]');
    return { addedNum, boundVal: sel.value, closed: !modal.classList.contains('active') };
  }, gearOf.toString());
  expect(r.addedNum, 'a tool was added').toBeTruthy();
  expect(r.boundVal, 'the just-added tool is now selected in the wizard (no dead end)').toBe(r.addedNum);
  expect(r.closed, 'the modal closed after Use').toBe(true);
});

test('composability: toolBindingsFor gives ANY stack carrying the toolsel marker the same toolpick binding', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { toolBindingsFor } = await import('/blocks/dataOps/deriveBindings.js');
    const { appendToolSel } = await import('/wizards/ops/toolsel.js');
    // a MINIMAL custom wizard stack (not a mill twin) carrying the tool marker
    const stack = [{ type: 'user_root', params: {}, uiChildren: [], children: appendToolSel([{ type: 'progstart', params: {} }, { type: 'progend', params: {} }]) }];
    const binds = toolBindingsFor(stack);
    const b = binds.find((x) => x.param === 'toolNum');
    return { count: binds.length, hasToolpick: !!b && b.widget === 'toolpick', key: b && b.key };
  });
  expect(r.hasToolpick, 'a custom stack with the marker inherits the toolpick widget by identity').toBe(true);
  expect(r.key, 'bound to the marker socket').toBe('toolNum');
});
