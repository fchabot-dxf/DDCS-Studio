import { test, expect } from '@playwright/test';

// Phase-1 port: the Blockly Blocks tab is DERIVED from the ops registry. This proves the full palette
// loads and the generator (reusing def.emit) produces correct G-code for leaf/Machine/Move/Ops atoms,
// including value sockets (math_number plugged into Move's X/Y).
test('derived Blockly palette renders + generator matches the emit kernels', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');
  await page.waitForFunction(() => window.__bk && window.__bk.ws);

  // the toolbox built from the registry has our CNC categories + the native ones
  const cats = await page.$$eval('.blocklyToolboxCategory, .blocklyTreeRow', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean));
  expect(cats.join('|')).toMatch(/Move/);
  expect(cats.join('|')).toMatch(/Machine/);
  expect(cats.join('|')).toMatch(/Ops/);

  // seed Spindle(cw,12000) → Move(cut, X=50, Y=20) → Drill(defaults) → Dwell(default), then read G-code
  const code = await page.evaluate(() => {
    const ws = window.__bk.ws; ws.clear();
    const mk = (t) => { const b = ws.newBlock(t); b.initSvg(); return b; };
    const num = (v) => { const b = mk('math_number'); b.setFieldValue(String(v), 'NUM'); return b; };
    const sp = mk('spindle'); sp.setFieldValue('cw', 'DIR');
    const mv = mk('move'); mv.setFieldValue('cut', 'MODE');
    mv.getInput('X').connection.connect(num(50).outputConnection);
    mv.getInput('Y').connection.connect(num(20).outputConnection);
    const dr = mk('drill'), dw = mk('dwell');
    sp.nextConnection.connect(mv.previousConnection);
    mv.nextConnection.connect(dr.previousConnection);
    dr.nextConnection.connect(dw.previousConnection);
    sp.moveBy(40, 40); ws.render(); window.__bk.regen();
    return document.getElementById('out').textContent;
  });

  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tests/_blockly-port.png' });

  expect(code).toContain('M3 S12000');               // spindle kernel
  expect(code).toContain('G1 X50 Y20 Z0 F200');      // move kernel, X/Y from value sockets
  expect(code).toMatch(/G1 Z-5/);                    // drill peck kernel
  expect(code).toContain('G04 P1000');               // dwell kernel (dialect-correct: Expert P=ms, so 1s -> P1000)
  expect(errors, errors.join('\n')).toEqual([]);
});
