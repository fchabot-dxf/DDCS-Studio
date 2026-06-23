import { test, expect } from '@playwright/test';

// Controller-specific atoms declare a gate(dialect) → reason|null. The Blocks canvas greys + warns a placed
// atom whose active post can't run it (applyOpGating), matching the wizard field-gating philosophy.
test.use({ viewport: { width: 1000, height: 800 } });

test('controller-specific atoms gate by the active post', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { getDialect, getCaps } = await import('/wizards/dialects/index.js');
    const dl = (id) => ({ id, name: id, caps: getCaps(id) });
    const ddcs = dl('ddcs-v41'), grbl = dl('grbl'), hal = dl('grblhal');
    const g = (type, d) => { const f = BLOCKS[type] && BLOCKS[type].gate; return f ? f(d) : 'NO_GATE'; };
    return {
      // classic grbl: no canned cycles / no G64 P / no generic output
      drillGrbl: g('drillcycle', grbl), drillDdcs: g('drillcycle', ddcs),
      pathGrbl: g('pathmode', grbl), pathDdcs: g('pathmode', ddcs),
      // Output Pin: real codes on DDCS + oword, gated on classic grbl
      outDdcs: g('outpin', ddcs), outHal: g('outpin', hal), outGrbl: g('outpin', grbl),
      // Wait Input: oword-only
      waitHal: g('waitinput', hal), waitDdcs: g('waitinput', ddcs),
    };
  });
  expect(r.drillGrbl).toBeTruthy();          // greyed on grbl
  expect(r.drillDdcs).toBeNull();            // runs on DDCS
  expect(r.pathGrbl).toBeTruthy();
  expect(r.pathDdcs).toBeNull();
  expect(r.outDdcs).toBeNull();              // DDCS emits M50/M51
  expect(r.outHal).toBeNull();               // oword emits M62-65
  expect(r.outGrbl).toBeTruthy();            // grbl has no generic output
  expect(r.waitHal).toBeNull();              // oword has M66
  expect(r.waitDdcs).toBeTruthy();           // DDCS uses named sensor M-codes
});
