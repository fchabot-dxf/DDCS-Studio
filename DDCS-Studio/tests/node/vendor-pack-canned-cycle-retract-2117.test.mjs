import { test, expect } from './support/harness.mjs';
import { drillCycleBlock } from '../../web/wizards/ops/cnc.js';

/**
 * t2117 T2 — zero `G98`/`G99` anywhere in the web tree before this fix: the canned-cycle retract plane
 * was whatever modal the previously-composed op happened to leave live, silently — between holes that
 * is the difference between clearing a clamp and driving through it. Both of foinnc's own examples write
 * `G98 G83 ...` / `G98 G84 ...`. VENDOR-PACK-FIXES-PLAN.md T2.
 */

const expertDialect = { id: 'ddcs-expert-m350', name: 'DDCS Expert', caps: {} };
const grblDialect = { id: 'grbl', name: 'grbl', caps: { flow: 'none' } };

test('t2117 T2 -- every canned-cycle emit starts G98 G8x', () => {
    for (const cycle of ['drill', 'dwell', 'peck', 'bore']) {
        const p = { cycle, x: 10, y: 5, z: -5, r: 2, q: 1, dwell: 0.5, feed: 200 };
        const [line] = drillCycleBlock.emit(p, 0, 0, expertDialect);
        expect(line, `cycle=${cycle}: ${line}`).toMatch(/^G98 G8[1235]\b/);
    }
});

test('t2117 T2 -- the retract-plane comment names WHY, and G99 stays unoffered', () => {
    const p = { cycle: 'peck', x: 10, y: 5, z: -5, r: 2, q: 1, feed: 200 };
    const [line] = drillCycleBlock.emit(p, 0, 0, expertDialect);
    expect(line).not.toContain('G99');
});

test('t2117 T2 -- noFlow dialects (grbl) still fold to the comment path, unchanged', () => {
    const p = { cycle: 'peck', x: 10, y: 5, z: -5, r: 2, q: 1, feed: 200 };
    const [line] = drillCycleBlock.emit(p, 0, 0, grblDialect);
    expect(line.startsWith('(')).toBe(true);
    expect(line).not.toContain('G98');
});
