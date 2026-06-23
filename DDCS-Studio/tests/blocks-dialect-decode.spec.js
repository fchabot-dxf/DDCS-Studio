import { test, expect } from '@playwright/test';

// Per-dialect parse recognizers: each controller's dialect-specific ops (probe cycle, probe-read/check,
// machine-move, set-WCS, IF/GOTO/label, HMI) must decode to PROPER blocks (no `raw`) and round-trip
// byte-identically through that dialect. Mirrors the verified emit forms 1:1. (Centroid deferred; DM500's
// multi-line move-until-input probe is a known gap — excluded here, kept verbatim by the parser.)
test.use({ viewport: { width: 1000, height: 800 } });

const STACKS = {
  'ddcs-expert-m350': [
    { type: 'assign', params: { var: '#100', value: '500', note: 'feed' } },
    { type: 'label', params: { n: 1 } },
    { type: 'probe', params: { axis: 'Z', to: -10, feed: 100, port: 3, level: 0 } },
    { type: 'probecheck', params: { axis: 'Z', goto: 9 } },
    { type: 'proberead', params: { axis: 'Z', var: '#50' } },
    { type: 'readmachine', params: { axis: 'Z', var: '#57' } },
    { type: 'ifgoto', params: { lhs: '#50', op: '>', rhs: '0', goto: 2 } },
    { type: 'setworkoffset', params: { wcs: '#578', axis: 'X', value: '#50' } },
    { type: 'message', params: { text: 'check setup' } },
    { type: 'asknumber', params: { var: '#100', prompt: 'enter value' } },
    { type: 'pause', params: {} },
    { type: 'goto', params: { n: 1 } },
    { type: 'machinemove', params: { axis: 'Z', to: '#99', var: '#99' } },
    { type: 'dwell', params: { sec: 1 } },
    { type: 'spindle', params: { rpm: 12000, dir: 'cw' } },
  ],
  'ddcs-v41': [
    { type: 'assign', params: { var: '#100', value: '500' } },
    { type: 'probe', params: { axis: 'Z', to: -10, feed: 100 } },
    { type: 'proberead', params: { axis: 'Z', var: '#50' } },
    { type: 'ifgoto', params: { lhs: '#50', op: '>', rhs: '0', goto: 2 } },
    { type: 'label', params: { n: 1 } },
    { type: 'goto', params: { n: 1 } },
    { type: 'setworkoffset', params: { wcs: '#578', axis: 'Z', value: '-10' } },
    { type: 'machinemove', params: { axis: 'Z', to: '#99', var: '#99' } },
    { type: 'dwell', params: { sec: 1 } },
    { type: 'pause', params: {} },
  ],
  'ddcs-v3-dm500': [
    { type: 'assign', params: { var: '#100', value: '500' } },
    { type: 'proberead', params: { axis: 'Z', var: '#50' } },
    { type: 'ifgoto', params: { lhs: '#1505', op: '==', rhs: '0', goto: 10 } },
    { type: 'label', params: { n: 1 } },
    { type: 'goto', params: { n: 1 } },
    { type: 'setworkoffset', params: { wcs: '#578', axis: 'Z', value: '-10' } },
    { type: 'dwell', params: { sec: 2 } },
    { type: 'pause', params: {} },
  ],
  'rs274ngc': [
    { type: 'assign', params: { var: '#100', value: '500' } },
    { type: 'probe', params: { axis: 'Z', to: -10, feed: 100 } },
    { type: 'proberead', params: { axis: 'Z', var: '#50' } },
    { type: 'readmachine', params: { axis: 'Z', var: '#57' } },
    { type: 'ifgoto', params: { lhs: '#50', op: '>', rhs: '0', goto: 5 } },
    { type: 'label', params: { n: 5 } },
    { type: 'setworkoffset', params: { wcs: 1, axis: 'Z', value: '-10' } },
    { type: 'message', params: { text: 'hello world' } },
    { type: 'machinemove', params: { axis: 'Z', to: '#99', var: '#99' } },
    { type: 'dwell', params: { sec: 1 } },
    { type: 'pause', params: {} },
  ],
};

for (const [dialectId, stack] of Object.entries(STACKS)) {
  test(`${dialectId}: dialect-specific ops decode to proper blocks (no raw) and round-trip`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async ({ dialectId, stack }) => {
      const { emitMapped } = await import('/blocks/blockModel.js');
      const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
      const { getDialect } = await import('/wizards/dialects/index.js');
      const dialect = getDialect(dialectId);
      const text1 = emitMapped(stack, { dialect }).text;
      const parsed = parseGcodeToStack(text1, { dialect });
      const text2 = emitMapped(parsed, { dialect }).text;
      return { text1, text2, parsedTypes: parsed.map((b) => b.type), inputTypes: stack.map((b) => b.type) };
    }, { dialectId, stack });

    expect(r.parsedTypes, `${dialectId}: no line fell back to raw`).not.toContain('raw');
    expect(r.text2, `${dialectId}: round-trips byte-identically through the dialect recognizers`).toBe(r.text1);
  });
}
