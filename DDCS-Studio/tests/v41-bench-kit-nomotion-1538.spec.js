import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * t1538 — THE S5 BENCH KIT'S NO-MOTION GUARANTEE, ASSERTED. The user has a V4.1 bench unit connected over SMB
 * with no motors and nothing attached — but this kit's own correctness (as opposed to the bench's physical
 * safety net) still deserves a real check, not a claim. This asserts every `.nc` file in
 * bridge/controllers/v4.1/verify/ uses ONLY an ALLOWLISTED set of G/M-words — G90 (mode select), G92 (work-
 * coordinate redefinition, not a move), G04 (dwell), M30 (end) — so a forbidden code (G0/G1/G2/G3 motion, M3/M4
 * spindle-start, M6 tool change, or anything else) fails LOUD rather than needing to be individually denylisted.
 *
 * An ALLOWLIST rather than a denylist on purpose: a denylist only catches codes someone thought to name; an
 * allowlist catches anything unexpected, including forms nobody enumerated in advance.
 */

const kitDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers', 'v4.1', 'verify');
const ALLOWED_WORDS = new Set(['G90', 'G92', 'G04', 'M30']);

const ncFiles = () => readdirSync(kitDir).filter((f) => f.endsWith('.nc'));

/** Strip full-line parenthesized comments (this kit's own comment style) before scanning for G/M words. */
const codeOnly = (text) => text.split('\n').filter((l) => !l.trim().startsWith('(')).join('\n');

const gmWords = (text) => [...codeOnly(text).matchAll(/\b([GM]\d+)\b/g)].map((m) => m[1]);

test('the S5 bench kit exists — exactly 6 probe files plus the README', () => {
    const files = readdirSync(kitDir);
    expect(ncFiles().sort()).toEqual(
        ['S5a_spaced.nc', 'S5b_coordword.nc', 'S5c_ifgoto.nc', 'S5d_while.nc', 'S5e_sqrt.nc', 'S5f_atan.nc']);
    expect(files).toContain('README.md');
});

test('every G/M-word in every probe file is on the allowlist — no motion, no spindle-start, no tool change', () => {
    for (const f of ncFiles()) {
        const words = gmWords(readFileSync(join(kitDir, f), 'utf8'));
        expect(words.length > 0, `${f} contains at least one G/M-word`).toBe(true);
        const forbidden = words.filter((w) => !ALLOWED_WORDS.has(w));
        expect(forbidden, `${f}: every G/M-word is allowlisted`).toEqual([]);
    }
});

test('no probe file contains a motion G-word or a spindle/tool M-word as a bare substring, belt and braces', () => {
    // an explicit alternation, not a character class -- G0 (bare rapid) has no trailing 1/2/3 digit, so a
    // \bG0?[123]\b-style class would silently NEVER match it. Caught by the non-vacuity check itself: the first
    // version of this test used that class, injected a literal "G0 X5" into a probe file, and the test STAYED
    // GREEN. Rewritten to name each forbidden word explicitly instead of inferring a pattern.
    const FORBIDDEN = /\b(G0|G00|G1|G01|G2|G02|G3|G03|M3|M03|M4|M04|M6|M06)\b/;
    for (const f of ncFiles()) {
        const code = codeOnly(readFileSync(join(kitDir, f), 'utf8'));
        expect(code, `${f} has no motion, spindle-start, or tool-change word`).not.toMatch(FORBIDDEN);
    }
});

test('every probe file ends with M30 and primes #190 to the sentinel before the probe', () => {
    for (const f of ncFiles()) {
        const code = codeOnly(readFileSync(join(kitDir, f), 'utf8')).trim();
        expect(code.split('\n').filter((l) => l.trim()).pop(), `${f} ends with M30`).toBe('M30');
        expect(code, `${f} primes #190 to the -99999 sentinel`).toContain('#190 = -99999');
    }
});

test('the README names the confirmed SMB path and both register-reading methods', () => {
    const readme = readFileSync(join(kitDir, 'README.md'), 'utf8');
    expect(readme).toContain('\\\\10.0.0.50\\cncdisk');
    expect(readme).toContain('uservar');
    expect(readme, 'the README states a syntax error is a usable answer, not a failure').toMatch(/syntax error.*usable answer|usable answer.*syntax error/i);
});
