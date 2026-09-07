import { test, expect } from './support/harness.mjs';

/**
 * GUI param block — xy/rect canvas GROUPING with DECLARED roles (audit #6-B). A param pill's canvas role is folded
 * into its widget value (xy-x / xy-y / rect-x/-y/-w/-h), so `extractParamBlocks` reads the role from the explicit
 * declaration — NEVER from pool position. Same-widget pills form a canvas; a repeated role starts a new one; an
 * incomplete canvas degrades to plain number knobs. Locks (this file): the grouping and ORDER-INDEPENDENCE (the
 * #6-B fix), both pure `extractParamBlocks` logic.
 *
 * NODE-TIER SPLIT: the original file also had a form-render test (page.locator('.uop-form'), a real SVG canvas)
 * and a Class-B render guard (window.__blkws, real Blockly rendering) — both real-DOM, moved verbatim to
 * tests/gui-param-grouping-drive.spec.js.
 */

test('xy/rect grouping: declared roles → group/role bindings (incomplete degrades)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget, value) => ({ type: 'param', params: { name, widget, value } });
    // a complete xy-pad + a lone xy-x (incomplete → degrades) + a complete rect
    const tmpl = [
      { type: 'move', params: { x: pill('cx', 'xy-x', 50), y: pill('cy', 'xy-y', 30), z: pill('cz', 'xy-x', 10), feed: pill('rx', 'rect-x', 0) } },
      { type: 'move', params: { x: pill('ry', 'rect-y', 0), y: pill('rw', 'rect-w', 80), z: pill('rh', 'rect-h', 60) } },
    ];
    return U.extractParamBlocks(tmpl);
  });

  const by = (p) => r.find((b) => b.param === p);
  // xy-pad pair → one group, declared roles x/y, only the first carries the widget
  expect(by('cx')).toMatchObject({ role: 'x', widget: 'xy-pad', type: 'number' });
  expect(by('cy')).toMatchObject({ role: 'y' });
  expect(by('cx').group).toBe(by('cy').group);
  expect(by('cy').widget).toBeUndefined();
  // the lone xy-x (no matching y) → incomplete canvas → degrades to a plain number knob
  expect(by('cz').group).toBeUndefined();
  expect(by('cz').role).toBeUndefined();
  expect(by('cz').widget).toBeUndefined();
  // rect four → one group, declared roles x/y/w/h
  expect(by('rx')).toMatchObject({ role: 'x', widget: 'rect' });
  expect(by('rh')).toMatchObject({ role: 'h' });
  const rg = by('rx').group;
  expect(rg && [by('ry'), by('rw'), by('rh')].every((b) => b.group === rg)).toBe(true);
  expect(rg).not.toBe(by('cx').group);
});

test('xy/rect grouping: roles are ORDER-INDEPENDENT (the #6-B fix)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget) => ({ type: 'param', params: { name, widget, value: 0 } });
    // declare Y *before* X — with positional inference this would flip the roles; with declared roles it must not
    const tmpl = [{ type: 'move', params: { y: pill('cy', 'xy-y'), x: pill('cx', 'xy-x') } }];
    const b = U.extractParamBlocks(tmpl);
    return { cx: b.find((x) => x.param === 'cx'), cy: b.find((x) => x.param === 'cy') };
  });
  // cx is X and cy is Y regardless of the pills' order in the stack
  expect(r.cx.role).toBe('x');
  expect(r.cy.role).toBe('y');
  expect(r.cx.group).toBe(r.cy.group);
});
