import { test, expect } from './support/harness.mjs';
import { tapCycle } from '../../web/wizards/ops/tap.js';

/**
 * t2117 T1 — rigid tapping was emitting `M3 S<rpm>` + `G84` against a FREE-RUNNING analog spindle: no
 * `M180` (switch to servo spindle) and no `M29` (synchronise the spindle to Z) anywhere in the whole
 * web tree, confirmed by grep before the fix. Failure mode is a snapped tap, not a bad finish.
 * VENDOR-PACK-FIXES-PLAN.md T1, sourced from foinnc's own `G83_G84钻孔攻丝指令说明/G84测试.txt`.
 *
 * t2118 (advisor review) — THAT FIX ITSELF WAS THE BLOCKER: it replaced M3 with M29, and M29 does not
 * START a spindle, it SYNCHRONISES an already-running SERVO one. `rigidOk` only checked `p.rigid` + the
 * Expert post; nothing checked whether the machine's own spindle is actually servo-wired. On an ANALOG
 * spindle (confirmed live: the human's own machine reads Pr079=0/Analog on both SYSDISK captures) the
 * rigid branch fed the tap to full depth with a DEAD spindle. Fixed: `tapCycle` now reads the LIVE
 * `settings.spindle.tapCapable` attestation at EMIT TIME (`liveTapCapable()`) and folds to the safe
 * floating-holder cycle when it is not attested — regardless of how `p.rigid` became true (a stored
 * value surviving a machine swap, or the Blocks tab, which had no gate of its own at all).
 */

const pt = { x: 10, y: 0 };
const rigidParams = { clearance: 2, depth: 10, rpm: 2000, pitch: 1, dwell: 0.3, rigid: true };
const expertDialect = { id: 'ddcs-expert-m350' };

/** Temporarily attest (or not) a live spindle interface, mirroring what userOpView.js's own form-time
 *  _rigidOk reads from window.ddcsGetSettings().spindle.tapCapable — restores whatever was there before,
 *  even if the test body throws, so one test's mock can never leak into the next. */
function withTapCapable(tapCapable, fn) {
    const prev = globalThis.window.ddcsGetSettings;
    globalThis.window.ddcsGetSettings = () => ({ spindle: { tapCapable } });
    try { fn(); } finally { globalThis.window.ddcsGetSettings = prev; }
}

test('t2117 T1 -- rigid tap emits M180 / M29 S<rpm> / G98 G84 / M181, in that order', () => {
    withTapCapable(true, () => {
        const lines = tapCycle(pt, rigidParams, expertDialect);
        const iM180 = lines.findIndex((l) => l.startsWith('M180'));
        const iM29 = lines.findIndex((l) => l.startsWith('M29 S2000'));
        const iG84 = lines.findIndex((l) => l.includes('G98 G84'));
        const iM181 = lines.findIndex((l) => l.startsWith('M181'));
        expect(iM180, 'M180 (servo spindle) must be present').toBeGreaterThanOrEqual(0);
        expect(iM29, 'M29 must follow M180').toBeGreaterThan(iM180);
        expect(iG84, 'G98 G84 must follow M29 -- WITHOUT M29 first the tap is not synced').toBeGreaterThan(iM29);
        expect(iM181, 'M181 (back to analog spindle) must be the last spindle-mode line').toBeGreaterThan(iG84);
    });
});

test('t2117 T1 -- the rigid branch no longer emits the old unsynced M3+G84 shape', () => {
    withTapCapable(true, () => {
        const lines = tapCycle(pt, rigidParams, expertDialect);
        const bareM3 = lines.some((l) => /^M3\s+S\d+\s*$/.test(l.split('(')[0].trim()));
        expect(bareM3, 'a bare M3 S<rpm> (no M29 sync) must not appear in the rigid branch').toBe(false);
    });
});

test('t2117 T1 -- G84 still carries X/Y and G80 still cancels the cycle (deliberate divergence from the vendor sample kept)', () => {
    withTapCapable(true, () => {
        const lines = tapCycle(pt, rigidParams, expertDialect);
        const g84Line = lines.find((l) => l.includes('G98 G84'));
        expect(g84Line).toContain('X10');
        expect(g84Line).toContain('Y0');
        expect(lines.some((l) => l.startsWith('G80'))).toBe(true);
    });
});

test('t2117 T1 -- the floating-holder (non-rigid) branch is untouched by the vendor fix', () => {
    withTapCapable(true, () => {
        const lines = tapCycle(pt, { ...rigidParams, rigid: false }, expertDialect);
        const joined = lines.join('\n');
        expect(joined).not.toContain('M180');
        expect(joined).not.toContain('M29');
        expect(joined).toContain('M3 S2000');
        expect(joined).toContain('M4 S2000');
    });
});

test('t2117 T1 -- rigid stays gated to the Expert dialect; a non-Expert post still falls back honestly', () => {
    withTapCapable(true, () => {
        const v41Dialect = { id: 'ddcs-v41' };
        const lines = tapCycle(pt, rigidParams, v41Dialect);
        const joined = lines.join('\n');
        expect(joined).not.toContain('M180');
        expect(joined).toContain('M3 S2000');
    });
});

// ── t2118 -- THE BLOCKER ITSELF, closed: an emit-time attestation gate, not just the form's grey ──────────────

test('t2118 -- rigid:true on an UNATTESTED (non-tapCapable) spindle folds to the SAFE floating-holder cycle, not a dead spindle', () => {
    withTapCapable(false, () => {
        const lines = tapCycle(pt, rigidParams, expertDialect);
        const joined = lines.join('\n');
        expect(joined, 'must NOT emit the no-M3 servo sequence on an unattested/analog spindle').not.toContain('M180');
        expect(joined, 'must NOT emit M29 -- it starts nothing on an analog spindle').not.toContain('M29');
        expect(joined, 'must fall back to the real spindle-start word').toContain('M3 S2000');
    });
});

test('t2118 -- rigid:true with NO settings available at all (headless/undefined) also folds to the safe cycle', () => {
    const prev = globalThis.window.ddcsGetSettings;
    delete globalThis.window.ddcsGetSettings;
    try {
        const lines = tapCycle(pt, rigidParams, expertDialect);
        const joined = lines.join('\n');
        expect(joined, 'ignorance must never read as attestation').not.toContain('M180');
        expect(joined).toContain('M3 S2000');
    } finally {
        globalThis.window.ddcsGetSettings = prev;
    }
});

test('t2118 -- rigid:true, tapCapable:true, but a non-Expert dialect still folds to the safe cycle (both gates required)', () => {
    withTapCapable(true, () => {
        const v41Dialect = { id: 'ddcs-v41' };
        const lines = tapCycle(pt, rigidParams, v41Dialect);
        const joined = lines.join('\n');
        expect(joined).not.toContain('M180');
        expect(joined).toContain('M3 S2000');
    });
});
