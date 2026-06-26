import { test, expect } from '@playwright/test';

// Blocks palette: the overloaded 'Machine' bucket is split into granular semantic categories
// (Spindle & Feed / Coordinates / Program / Probing / Signals), and pathMode moves to Move.
test('toolbox uses the granular categories (no overloaded Machine)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { buildToolbox } = await import('/blocks/blockly/bridge.js');
    const tb = buildToolbox();
    const ops = (tb.contents.find((c) => /Atoms/.test(c.name)) || { contents: [] }).contents;   // ops categories now nest under ⚛ Atoms
    const names = ops.map((c) => c.name);
    const catOf = (type) => { for (const c of ops) if (c.contents.some((b) => b.type === type)) return c.name; return null; };
    return {
      names,
      spindle: catOf('spindle'), wcs: catOf('wcs'), mcode: catOf('mcode'),
      proberead: catOf('proberead'), pathmode: catOf('pathmode'), progstart: catOf('progstart'),
    };
  });
  expect(r.names, 'no overloaded Machine category').not.toContain('Machine');
  expect(r.names, 'granular groups present').toEqual(expect.arrayContaining(['Spindle & Feed', 'Coordinates', 'Program', 'Probing', 'Signals']));
  expect(r.spindle, 'spindle → Spindle & Feed').toBe('Spindle & Feed');
  expect(r.wcs, 'wcs → Coordinates').toBe('Coordinates');
  expect(r.progstart, 'progStart → Program').toBe('Program');
  expect(r.proberead, 'probeRead → Probing').toBe('Probing');
  expect(r.mcode, 'mcode → Signals').toBe('Signals');
  expect(r.pathmode, 'pathMode → Move').toBe('Move');
});
