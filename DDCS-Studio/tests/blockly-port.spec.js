import { test, expect } from '@playwright/test';

// Blockly port keystone: every op is a Blockly block (derived from the ops registry), and the workspace
// converts to our {type,params,children} stack which runs through the PROVEN emitMapped fold — no separate
// Blockly generator. Proven by round-tripping a real cutting op (Program Start + WCS + PlaceOnStock{ StepDown{
// StepOver(Region) } } + Program End) through the workspace and asserting the emitted G-code is unchanged.
test('Blockly bridge: stack ⇄ workspace round-trips and emits via emitMapped', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');
  await page.waitForFunction(() => window.__bk && window.__bk.ws);

  // the toolbox built from the registry shows our CNC categories
  const cats = await page.$$eval('.blocklyToolboxCategory, .blocklyTreeRow', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean));
  expect(cats.join('|')).toMatch(/Move/);
  expect(cats.join('|')).toMatch(/Coordinates/);
  expect(cats.join('|')).toMatch(/Ops/);

  const r = await page.evaluate(async () => {
    const { stackToWorkspace, workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const { emitMapped } = await import('/blocks/blockModel.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const ws = window.__bk.ws, d = getDialect('ddcs-expert-m350');
    const stack = surfacingStack({ w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, feed: 800, plunge: 200, clearance: 5, strategy: 'raster', spindle: { dir: 'cw', defaultRpm: 12000 }, endProgram: {} });
    const before = emitMapped(stack, { dialect: d }).text;
    stackToWorkspace(stack, ws);              // our stack → Blockly blocks
    const back = workspaceToStack(ws);        // Blockly blocks → our stack
    const after = emitMapped(back, { dialect: d }).text;
    return { before, after, types: back.map((b) => b.type) };
  });

  expect(r.types, 'round-trip preserves the top-level op sequence').toEqual(['progstart', 'wcs', 'placeonstock', 'progend']);
  expect(r.after, 'emit after a workspace round-trip equals emit before').toBe(r.before);
  expect(errors, errors.join('\n')).toEqual([]);
});
