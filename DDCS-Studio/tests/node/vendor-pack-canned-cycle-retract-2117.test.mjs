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

test('t2117 T2 -- every REAL canned-cycle emit starts G98 G8x', () => {
    // t2118 -- 'bore' dropped from this loop: it no longer emits a canned-cycle line on DDCS at all (see the
    // dedicated bore test below) -- it would have made this loop's own assertion fail, correctly.
    for (const cycle of ['drill', 'dwell', 'peck']) {
        const p = { cycle, x: 10, y: 5, z: -5, r: 2, q: 1, dwell: 0.5, feed: 200 };
        const [line] = drillCycleBlock.emit(p, 0, 0, expertDialect);
        expect(line, `cycle=${cycle}: ${line}`).toMatch(/^G98 G8[123]\b/);
    }
});

test('t2117 T2 -- G99 is never offered as a field, and the emit never produces it', () => {
    // t2118 -- renamed from "names WHY" (it never tested that, and passed on a full revert -- genuinely
    // vacuous). What it actually verifies: G99 never appears in cycle output, across every real cycle.
    for (const cycle of ['drill', 'dwell', 'peck']) {
        const p = { cycle, x: 10, y: 5, z: -5, r: 2, q: 1, feed: 200 };
        const [line] = drillCycleBlock.emit(p, 0, 0, expertDialect);
        expect(line, `cycle=${cycle}`).not.toContain('G99');
    }
});

test('t2118 -- bore (G85) does not exist on DDCS: folds to an honest comment, never a dead G85 line', () => {
    const p = { cycle: 'bore', x: 10, y: 5, z: -5, r: 2, feed: 200 };
    const [line] = drillCycleBlock.emit(p, 0, 0, expertDialect);
    // the whole line is wrapped in ( ... ) -- inert commentary, no real G-code word emitted -- even though the
    // EXPLANATION inside the comment legitimately names "G85" as the code that does not exist.
    expect(line.startsWith('('), `expected a folded comment, got: ${line}`).toBe(true);
    expect(line.trim().endsWith(')'), `expected the whole line wrapped as a comment, got: ${line}`).toBe(true);
});

test('t2117 T2 -- noFlow dialects (grbl) still fold to the comment path, unchanged', () => {
    const p = { cycle: 'peck', x: 10, y: 5, z: -5, r: 2, q: 1, feed: 200 };
    const [line] = drillCycleBlock.emit(p, 0, 0, grblDialect);
    expect(line.startsWith('(')).toBe(true);
    expect(line).not.toContain('G98');
});
