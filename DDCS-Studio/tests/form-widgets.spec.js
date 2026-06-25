import { test, expect } from '@playwright/test';

/**
 * P1 of the widget library — the FORM-side widget registry (ui/formWidgets.js) + typed bindings.
 * A custom op's generic form renders ONE widget per binding: number by default, or the binding's declared widget
 * (slider / dropdown / toggle / text). Locks: the right control renders per widget, and Insert reads each widget's
 * value into the committed op's params (number/enum/bool round-trip — not just number, as v1 required).
 */

const TEMPLATE = [{ type: 'move', params: { x: 0, y: 0, z: -5, feed: 100, mode: 'cut', rapid: false } }];
const BINDINGS = [
  { param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5 },                                           // → number (default)
  { param: 'feed', blockIndex: 0, key: 'feed', type: 'number', widget: 'slider', widgetConfig: { min: 0, max: 500, step: 10 }, default: 100 }, // → slider
  { param: 'mode', blockIndex: 0, key: 'mode', type: 'enum', widget: 'dropdown', widgetConfig: { options: [['Cut', 'cut'], ['Rapid', 'rapid']] }, default: 'cut' }, // → dropdown
  { param: 'rapid', blockIndex: 0, key: 'rapid', type: 'bool', widget: 'toggle', default: false },                    // → toggle
];

test('form widgets: typed bindings render the right control + Insert reads each value', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async ({ TEMPLATE, BINDINGS }) => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    U.createUserOp(U.userOpFromStack('widget_test', 'Widget Test', TEMPLATE, BINDINGS));
    window.ddcsInsertUserOp('user_widget_test');
  }, { TEMPLATE, BINDINGS });

  const form = page.locator('.uop-form');
  await expect(form).toBeVisible();

  // the right control renders per widget type
  await expect(form.locator('input[type="number"]')).toHaveCount(1);     // depth → number
  await expect(form.locator('input[type="range"]')).toHaveCount(1);      // feed → slider
  await expect(form.locator('select')).toHaveCount(1);                   // mode → dropdown
  await expect(form.locator('.ddcs-switch input[type="checkbox"]')).toHaveCount(1); // rapid → toggle

  // set each widget
  await form.locator('input[type="number"]').fill('-8');
  await page.evaluate(() => { const r = document.querySelector('.uop-form input[type="range"]'); r.value = '200'; });
  await form.locator('select').selectOption('rapid');
  await form.locator('.ddcs-switch .ddcs-slider').click();               // checkbox is visually hidden by the switch

  // Insert → the op commits into the program with the widget-read params
  await form.locator('.uop-insert').click();
  await expect(form).toHaveCount(0);

  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_widget_test'));
  expect(op, 'the user op committed into the program').toBeTruthy();
  expect(op.params.depth).toBe(-8);     // number widget
  expect(op.params.feed).toBe(200);     // slider widget (numeric)
  expect(op.params.mode).toBe('rapid'); // dropdown widget (enum string)
  expect(op.params.rapid).toBe(true);   // toggle widget (bool)

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('form widgets: corner-grid datum picker renders + reads its [X][Y] code', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    U.createUserOp(U.userOpFromStack('datum_test', 'Datum Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -5, anchor: '' } }],
      [{ param: 'anchor', blockIndex: 0, key: 'anchor', type: 'string', widget: 'corner-grid', default: '' }]));
    window.ddcsInsertUserOp('user_datum_test');
  });

  const form = page.locator('.uop-form');
  await expect(form).toBeVisible();
  await expect(form.locator('svg rect[data-code]')).toHaveCount(9);   // the 3×3 picker (same core as the block field)

  await form.locator('rect[data-code="pp"]').click();                  // pick back-right
  await form.locator('.uop-insert').click();
  await expect(form).toHaveCount(0);

  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_datum_test'));
  expect(op).toBeTruthy();
  expect(op.params.anchor).toBe('pp');

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('form widgets: registry defaults a widget per binding.type', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const FW = await import('/ui/formWidgets.js');
    const which = (b) => Object.keys(FW.FORM_WIDGETS).find((k) => FW.FORM_WIDGETS[k] === FW.resolveFormWidget(b));
    return {
      number: which({ type: 'number' }),
      enum: which({ type: 'enum' }),
      bool: which({ type: 'bool' }),
      string: which({ type: 'string' }),
      explicit: which({ type: 'number', widget: 'slider' }),  // explicit widget wins over type default
      unknown: which({ type: 'number', widget: 'nope' }),     // unknown widget falls back to type default
    };
  });
  expect(r.number).toBe('number');
  expect(r.enum).toBe('dropdown');
  expect(r.bool).toBe('toggle');
  expect(r.string).toBe('text');
  expect(r.explicit).toBe('slider');
  expect(r.unknown).toBe('number');
});
