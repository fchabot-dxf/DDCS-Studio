import { test, expect } from '@playwright/test';

test('blockly spike renders our grammar + generates G-code', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211/blocks/blockly-spike.html');
  await page.waitForFunction(() => window.__spike && window.__spike.ws);

  // seed a program through Blockly's API: Spindle → Move(X=50,Y=20) → If(3<2){ Drill }
  const code = await page.evaluate(() => {
    const ws = window.__spike.ws;
    ws.clear();
    const mk = (t) => { const b = ws.newBlock(t); b.initSvg(); return b; };
    const num = (v) => { const b = mk('math_number'); b.setFieldValue(String(v), 'NUM'); return b; };

    const sp = mk('cnc_spindle'); sp.setFieldValue('M3', 'DIR'); sp.setFieldValue('12000', 'RPM');
    const mv = mk('cnc_move'); mv.setFieldValue('G1', 'MODE');
    mv.getInput('X').connection.connect(num(50).outputConnection);
    mv.getInput('Y').connection.connect(num(20).outputConnection);
    const cmp = mk('logic_compare'); cmp.setFieldValue('LT', 'OP');
    cmp.getInput('A').connection.connect(num(3).outputConnection);
    cmp.getInput('B').connection.connect(num(2).outputConnection);
    const iff = mk('controls_if');
    iff.getInput('IF0').connection.connect(cmp.outputConnection);
    const dr = mk('cnc_drill'); dr.setFieldValue('6', 'DIA'); dr.setFieldValue('5', 'DEPTH');
    iff.getInput('DO0').connection.connect(dr.previousConnection);

    sp.nextConnection.connect(mv.previousConnection);
    mv.nextConnection.connect(iff.previousConnection);
    sp.moveBy(40, 40);
    ws.render();
    window.__spike.regen();
    return document.getElementById('out').textContent;
  });

  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tests/_blockly-spike.png' });

  // the custom generator produced real G-code from our blocks + native value/boolean/control blocks
  expect(code).toContain('M3 S12000');
  expect(code).toContain('G1 X50 Y20');
  expect(code).toContain('3 < 2');     // logic_compare via our generator
  expect(code).toMatch(/G81/);          // the drill, emitted inside the If body
  expect(errors, errors.join('\n')).toEqual([]);
});
