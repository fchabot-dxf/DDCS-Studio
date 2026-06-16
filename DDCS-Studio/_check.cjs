// Insert-accumulation check: two wizard inserts should BOTH land in one program frame, and Blocks shows both.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:3211');
  await p.waitForFunction(() => window.openWiz && window.insertWiz && window.ddcsGetBlockProgram, { timeout: 8000 });
  // insert #1 — drill (studio tab is the default)
  await p.evaluate(() => { window.openWiz('drill'); window.updateWiz(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => window.insertWiz());
  await p.waitForTimeout(600);
  // insert #2 — pocket
  await p.evaluate(() => { window.openWiz('pocket'); window.updateWiz(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => window.insertWiz());
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const count = (t) => prog.filter((b) => b && b.type === t).length;
    return {
      total: prog.length,
      types: prog.map((b) => b && b.type),
      array: count('array'),         // drill op
      stepdown: count('stepdown'),   // pocket op
      progstart: count('progstart'),
      progend: count('progend'),
    };
  });
  console.log('PROGRAM ' + JSON.stringify(r));
  console.log('ERRORS ' + JSON.stringify(errs));
  // both ops present, ONE frame (single progstart/progend), drill before pocket before M30
  const ok = r.array === 1 && r.stepdown === 1 && r.progstart === 1 && r.progend === 1
    && r.types.indexOf('progend') === r.types.length - 1;
  console.log('PASS ' + ok);
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('CHECK FAILED', e); process.exit(2); });
