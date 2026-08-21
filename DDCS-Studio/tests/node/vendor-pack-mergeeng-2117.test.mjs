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

    // t2118 -- not.toContain('(') was stronger than the property the code actually earns: real eng files carry
    // mid-line '(' inside -s1"..." labels routinely (26-57 occurrences per file, advisor-measured against all
    // seven real captures), so this blocked the exact real-file fixture it should have invited. The property
    // that matters is that no line STARTS a `( ===== ... )` comment -- the format has no comment syntax, but
    // a label is free to contain a literal paren.
    expect(merged.split(/\r?\n/).some((l) => l.trimStart().startsWith('(')),
        'no line starts a ( comment -- the eng format has no comment syntax at all').toBe(false);
});

test('t2117 T5 -- with no trailing && marker, falls back to appending (previous behaviour, still correct)', () => {
    const existing = '#100 -p0 -a3 =0 -t0 -s1"Existing" -s2" " -m10 -min=0 -max=100\n';
    const additions = '#1100 -p0 -a3 =0 -t0 -s1"New" -s2" " -m30 -min=0 -max=100';
    const { merged } = mergeEng(existing, additions);
    // t2118 -- a bare-LF fixture with ZERO CR is exactly the shape a real caller (a textarea) always produces,
    // so this now defaults to CRLF (item 2's own fix) rather than reusing the fixture's own LF -- asserting the
    // param landed, not the exact byte tail, since the line ending itself changed on purpose.
    expect(merged).toContain(additions.replace(/\n/g, '\r\n'));
    expect(merged.endsWith('\r\n')).toBe(true);
});

test('t2118 -- item 2: a genuinely CR-bearing input (not a textarea round-trip) still picks its OWN dominant ending', () => {
    // 1 real CRLF pair + 2 bare LF -- crlfCount(1) !== 0, so this skips the zero-CR default and falls to the
    // genuine comparison, where LF still dominates numerically and must still win.
    const existingMixed =
        '#100 -p0 -a3 =0 -t0 -s1"A" -s2" " -m10 -min=0 -max=100\r\n' +
        '#200 -p0 -a3 =0 -t0 -s1"B" -s2" " -m11 -min=0 -max=100\n' +
        '#300 -p0 -a3 =0 -t0 -s1"C" -s2" " -m12 -min=0 -max=100\n';
    const additions = '#1100 -p0 -a3 =0 -t0 -s1"New" -s2" " -m30 -min=0 -max=100';
    const { merged } = mergeEng(existingMixed, additions);
    expect(merged.endsWith('\n') && !merged.endsWith('\r\n')).toBe(true);
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
