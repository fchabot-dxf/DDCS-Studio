import { test, expect } from './support/harness.mjs';
import { mergeEng } from '../../web/data/slotPack.js';

/**
 * t2117 T5 — `mergeEng` had three defects, all found reading the real SYSDISK eng byte-for-byte (1176
 * lines, line-start census: `#` 585, `-` 390, blank 199, `&` 2 -- ZERO `(`):
 *   1. joined with a bare '\n' into a file that is 1176 CRLF, 0 bare LF.
 *   2. appended AFTER the file's own trailing `&&` end marker instead of before it.
 *   3. injected an illegal `( ===== ... )` comment line into a format with no comment syntax at all.
 * VENDOR-PACK-FIXES-PLAN.md T5.
 */

test('t2117 T5 -- additions land BEFORE a trailing && line, CRLF preserved, no illegal comment introduced', () => {
    const existing = '#100 -p0 -a3 =0 -t0 -s1"Existing" -s2" " -m10 -min=0 -max=100\r\n\r\n\r\n\r\n\r\n\r\n&&\r\n';
    const additions = '#1100 -p0 -a3 =0 -t0 -s1"New" -s2" " -m30 -min=0 -max=100';
    const { merged } = mergeEng(existing, additions);

    const ampIdx = merged.indexOf('&&');
    const addIdx = merged.indexOf('#1100');
    expect(addIdx, 'the new param line must be present').toBeGreaterThan(-1);
    expect(ampIdx, 'the trailing && marker must survive the merge').toBeGreaterThan(-1);
    expect(addIdx, 'additions must land ABOVE the && terminator, not after it').toBeLessThan(ampIdx);

    const bareLfCount = (merged.match(/(?<!\r)\n/g) || []).length;
    expect(bareLfCount, 'zero bare LF -- every line ending must be CRLF, matching the real file').toBe(0);

    expect(merged, 'no `(` comment line -- the eng format has no comment syntax at all').not.toContain('(');
});

test('t2117 T5 -- with no trailing && marker, falls back to appending (previous behaviour, still correct)', () => {
    const existing = '#100 -p0 -a3 =0 -t0 -s1"Existing" -s2" " -m10 -min=0 -max=100\n';
    const additions = '#1100 -p0 -a3 =0 -t0 -s1"New" -s2" " -m30 -min=0 -max=100';
    const { merged } = mergeEng(existing, additions);
    expect(merged.trim().endsWith(additions)).toBe(true);
    // dominant ending (bare LF in this fixture) is reused, never hardcoded to CRLF
    expect(merged).not.toContain('\r');
});

test('t2117 T5 -- paramCollisions / groupCollisions / added return contract is unchanged', () => {
    const existing = '#100 -p0 -a3 =0 -t0 -s1"Existing" -s2" " -m10 -min=0 -max=100\n';
    const additions = '#100 -p0 -a3 =0 -t0 -s1"Collide" -s2" " -m10 -min=0 -max=100\n'
        + '#1100 -p0 -a3 =0 -t0 -s1"New" -s2" " -m30 -min=0 -max=100';
    const { paramCollisions, groupCollisions, added } = mergeEng(existing, additions);
    expect(paramCollisions).toEqual([100]);
    expect(groupCollisions).toEqual([10]);
    expect(added).toEqual([1100]);
});
