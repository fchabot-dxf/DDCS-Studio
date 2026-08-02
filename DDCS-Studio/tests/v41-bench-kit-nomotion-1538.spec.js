import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * t1538/t1542 — THE S5 BENCH KIT'S NO-MOTION GUARANTEE, ASSERTED. The user has a V4.1 bench unit connected over
 * SMB with no motors and nothing attached — but this kit's own correctness (as opposed to the bench's physical
 * safety net) still deserves a real check, not a claim. This asserts every `.nc` file in
 * bridge/controllers/v4.1/verify/ uses ONLY an ALLOWLISTED set of G/M-words — G90 (mode select), G92 (work-
 * coordinate redefinition, not a move), G04 (dwell), M30 (end) — so a forbidden code (G0/G1/G2/G3 motion, M3/M4
 * spindle-start, M6 tool change, or anything else) fails LOUD rather than needing to be individually denylisted.
 *
 * An ALLOWLIST rather than a denylist on purpose: a denylist only catches codes someone thought to name; an
 * allowlist catches anything unexpected, including forms nobody enumerated in advance.
 *
 * t1542 — the directory grew from 6 files to 17 during the live bench session (11 more, generated to chase down
 * the ATAN-name and WHILE questions once real hardware was in front of an operator). The ORIGINAL six keep the
 * strict sentinel-priming convention (`#190 = -99999` first, overwritten only on success); three of the eleven
 * new ones (S5j/S5l/S5m, the factory-form WHILE probes) use `#190` itself as a live loop counter starting at
 * `0` — a real, deliberate design difference, not an oversight, since the counter IS the result there. The
 * no-motion allowlist check applies to ALL 17 files without exception; the sentinel-priming check applies only
 * to the original six, where that convention was actually used.
 */

const kitDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers', 'v4.1', 'verify');
const ALLOWED_WORDS = new Set(['G90', 'G92', 'G04', 'M30']);
const CANONICAL_KIT = ['S5a_spaced.nc', 'S5b_coordword.nc', 'S5c_ifgoto.nc', 'S5d_while.nc', 'S5e_sqrt.nc', 'S5f_atan.nc'];

const ncFiles = () => readdirSync(kitDir).filter((f) => f.endsWith('.nc'));

/** Strip full-line parenthesized comments (this kit's own comment style) before scanning for G/M words. */
const codeOnly = (text) => text.split('\n').filter((l) => !l.trim().startsWith('(')).join('\n');

const gmWords = (text) => [...codeOnly(text).matchAll(/\b([GM]\d+)\b/g)].map((m) => m[1]);

test('the S5 bench kit exists — the canonical 6 (still present) plus the README', () => {
    const files = readdirSync(kitDir);
    for (const f of CANONICAL_KIT) expect(ncFiles(), `${f} is still present`).toContain(f);
    expect(files).toContain('README.md');
});

test('every .nc file in the directory is accounted for — no untracked surprise files at commit time', () => {
    expect(ncFiles().sort()).toEqual([
        'S5_ACOS.nc', 'S5_ATAN2.nc', 'S5_ATN.nc', 'S5_atan.nc',
        'S5a_spaced.nc', 'S5b_coordword.nc', 'S5c_ifgoto.nc', 'S5d_while.nc', 'S5e_sqrt.nc', 'S5f_atan.nc',
        'S5g_atan1.nc', 'S5h_while_zero.nc', 'S5i_increment.nc', 'S5j_while_factory.nc', 'S5k_incr_bare.nc',
        'S5l_while_sp1.nc', 'S5m_while_sp2.nc',
    ].sort());
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

test('every probe file, canonical or experimental, ends with M30', () => {
    for (const f of ncFiles()) {
        const code = codeOnly(readFileSync(join(kitDir, f), 'utf8')).trim();
        expect(code.split('\n').filter((l) => l.trim()).pop(), `${f} ends with M30`).toBe('M30');
    }
});

test('the canonical 6 prime #190 to the -99999 sentinel before the probe', () => {
    for (const f of CANONICAL_KIT) {
        const code = codeOnly(readFileSync(join(kitDir, f), 'utf8')).trim();
        expect(code, `${f} primes #190 to the -99999 sentinel`).toContain('#190 = -99999');
    }
});

test('the README names the confirmed SMB path and both register-reading methods', () => {
    const readme = readFileSync(join(kitDir, 'README.md'), 'utf8');
    expect(readme).toContain('\\\\10.0.0.50\\cncdisk');
    expect(readme).toContain('uservar');
    expect(readme, 'the README states a syntax error is a usable answer, not a failure').toMatch(/syntax error.*usable answer|usable answer.*syntax error/i);
});

/**
 * t1542 — made PERMANENT, not just checked once by hand: the exact nested-paren-in-comment bug (a DDCS comment
 * closes at the first `)`, so anything after parses as code — the Expert-verify HANDOFF.md safety rule 1) landed
 * in THIS directory twice — once in the canonical six at t1538, and again in S5g_atan1.nc, one of the eleven
 * files generated live at the bench, where it broke a real run. Both were caught by hand and fixed both times.
 * A future file added to this directory (the next community answer, the next probe) gets no such manual check
 * unless it's automated — mirroring tests/trig-lift-plan-1466.spec.js's own LOCK 5 for the Expert kit.
 */
test('LOCK — no verify macro in this directory carries a bracket or a nested paren inside a comment', () => {
    const offenders = [];
    for (const f of ncFiles()) {
        const src = readFileSync(join(kitDir, f), 'utf8');
        src.split('\n').forEach((line, i) => {
            if (!line.trim().startsWith('(')) return;
            if (/\(.*\(|\[|\]/.test(line) || !line.trim().endsWith(')')) {
                offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
            }
        });
    }
    expect(offenders, 'a comment closes at the first ")" and the rest parses as code — so a bracketed or '
        + 'multi-line comment can abort the whole file and be misread as the PROBE failing:\n' + offenders.join('\n'))
        .toEqual([]);
});
