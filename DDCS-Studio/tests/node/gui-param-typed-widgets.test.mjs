import { test, expect } from './support/harness.mjs';

/**
 * GUI param block — TYPED widgets (dropdown presets + numeric toggle). A param block always lives in a NUMERIC
 * socket, so every widget commits a NUMBER (valid by construction, no emitter changes): dropdown = a numeric
 * preset from its `options` list ("Rough=500, Finish=1500"); toggle = 1/0. Locks (this file): the widget dropdown
 * offers the four choices, and parseParamOptions + extractParamBlocks derive the right binding.
 *
 * NODE-TIER SPLIT: the original file also had a form-render test (page.locator('.uop-form'), real select/click)
 * and a Class-B render guard (window.__blkws, real Blockly rendering) — both real-DOM, moved verbatim to
 * tests/gui-param-typed-widgets-drive.spec.js. This file keeps only the pure logic test.
 */

test('typed param: widget choices + parseParamOptions + extractParamBlocks derive numeric bindings', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const U = await import('/blocks/userOps.js');

    // a dropdown pill (with presets) and a toggle pill, each plugged into a numeric socket
    const tmpl = [{ type: 'move', params: {
      x: 0, y: 0,
      feed: { type: 'param', params: { name: 'feed', widget: 'dropdown', value: 500, options: 'Rough=500, Finish=1500' } },
      z:    { type: 'param', params: { name: 'coolant', widget: 'toggle', value: 0 } },
    } }];
    const bindings = U.extractParamBlocks(JSON.parse(JSON.stringify(tmpl)));   // copy → don't mutate our literal

    return {
      paramFields: BLOCKS.param.fields,
      optionsDefault: BLOCKS.param.defaults.options,
      parsed: U.parseParamOptions('Rough=500, Finish=1500\nbad=xx\n750'),
      bindings,
    };
  });

  // the param def grew the `options` field (presets) — kept a plain string default
  expect(r.paramFields).toContain('options');
  expect(r.optionsDefault).toBe('');

  // parser: numeric presets only ("bad=xx" dropped), a bare number → [label=value]
  expect(r.parsed).toEqual([['Rough', 500], ['Finish', 1500], ['750', 750]]);

  // extractParamBlocks: dropdown → numeric binding + widgetConfig.options; toggle → numeric binding + widget
  const feed = r.bindings.find((b) => b.param === 'feed');
  const cool = r.bindings.find((b) => b.param === 'coolant');
  expect(feed).toMatchObject({ key: 'feed', type: 'number', default: 500, widget: 'dropdown' });
  expect(feed.widgetConfig.options).toEqual([['Rough', 500], ['Finish', 1500]]);
  expect(cool).toMatchObject({ key: 'z', type: 'number', default: 0, widget: 'toggle' });
  expect(cool.widgetConfig).toBeUndefined();   // a toggle needs no config
});
