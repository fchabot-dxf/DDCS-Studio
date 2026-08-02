import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V41_RESIDUE_CENSUS, V41_STATUS_FIELD_DEAD } from '../web/data/portingArc.js';

/**
 * t1532 — THE RESIDUE CENSUS, PINNED. Condition on the advisor's arc-reframe ruling (t1531): "the port is done"
 * rested on a SAMPLE of the Expert-literal lines outside wizards/dialects/, judged by eye. This spec re-runs the
 * exact scan `data/portingArc.js`'s `V41_RESIDUE_CENSUS` was built from and asserts the total, so "33 lines, zero
 * bypasses" is a claim that goes red the day a new literal lands, an old one moves, or a category's classification
 * stops matching what the code actually does.
 */

const webDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');
const REGISTER_PATTERN = /#578|805\+|#1925|#880|#883/;

const walk = (dir) => {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'dialects') out.push(...walk(p)); }
        else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
};

/** Mirrors the scout's own grep: a matching line survives unless its TRIMMED content starts with a comment marker. */
const matchedLines = (file) => readFileSync(file, 'utf8').split('\n')
    .map((line, i) => ({ n: i + 1, line }))
    .filter(({ line }) => REGISTER_PATTERN.test(line))
    .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

test('the census total (33 lines, 16 files, 0 bypasses) still matches a live re-scan', () => {
    const files = [...walk(join(webDir, 'wizards')), ...walk(join(webDir, 'blocks'))];
    const hits = files.map((f) => ({ file: f, lines: matchedLines(f) })).filter((h) => h.lines.length > 0);
    const totalLines = hits.reduce((n, h) => n + h.lines.length, 0);

    expect(totalLines, 'total matched lines across wizards/ + blocks/ (excluding wizards/dialects/)')
        .toBe(V41_RESIDUE_CENSUS.totalLines);
    expect(hits.length, 'files carrying at least one matched line').toBe(V41_RESIDUE_CENSUS.totalFiles);
});

test('the category counts still sum to the total, and the census still claims zero actual bypasses', () => {
    const sum = Object.values(V41_RESIDUE_CENSUS.categories).reduce((n, c) => n + c.count, 0);
    expect(sum, 'every category-count sums back to the pinned total — no line silently dropped or double-counted')
        .toBe(V41_RESIDUE_CENSUS.totalLines);
    expect(V41_RESIDUE_CENSUS.actualBypasses, 'the headline claim this whole census exists to test').toBe(0);
    for (const [name, cat] of Object.entries(V41_RESIDUE_CENSUS.categories)) {
        expect(cat.sites.length > 0, `category "${name}" names at least one site`).toBe(true);
        expect(cat.verdict, `category "${name}" never claims the actual-bypass verdict`).not.toMatch(/actual.bypass/i);
    }
});

/**
 * THE CLAIM THAT MATTERS MOST — the passthrough-rawAxis category asserts that every atom carrying an Expert-literal
 * probe-trigger FALLBACK is reachable only when `rawAxis` wins first. Asserted against the real chain rather than
 * trusted from the table: radiuscomp is pushed from exactly one place, and every one of ITS callers passes rawAxis.
 */
test('every probeSurfaceStack caller that supplies a raw fallback also supplies rawAxis (the passthrough is real)', () => {
    const probeSurfaceSrc = readFileSync(join(webDir, 'wizards', 'ops', 'probeSurface.js'), 'utf8');
    const pushSites = probeSurfaceSrc.match(/push\('radiuscomp',[^)]*\)/g) || [];
    expect(pushSites.length, 'radiuscomp is pushed from exactly one place in probeSurface.js').toBe(1);
    expect(pushSites[0], 'that push forwards rawAxis from the caller, not a fixed literal').toMatch(/rawAxis:\s*p\.rawAxis/);

    const callers = ['cornerWizard.js', 'edgeWizard.js', 'middleWizard.js', 'rotaryCenterWizard.js',
        'lathe/latheProbe.js'].map((f) => join(webDir, 'wizards', f));
    for (const f of callers) {
        const src = readFileSync(f, 'utf8');
        const calls = src.match(/probeSurfaceStack\(\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gs) || [];
        const withRaw = calls.filter((c) => /\braw:/.test(c));
        for (const c of withRaw) expect(c, `${f}: a probeSurfaceStack call supplying \`raw\` also supplies \`rawAxis\``).toMatch(/rawAxis:/);
    }
});

test('the WCS-selector default is confirmed inert on V4.1 — setWorkOffset never reads its first argument', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        const V = m.DIALECTS['ddcs-v41'];
        // the '#578' argument varies; the output must not, because V4.1's own function body never reads it
        return {
            a: V.setWorkOffset('#578', 'X', '#100').join('\n'),
            b: V.setWorkOffset('active', 'X', '#100').join('\n'),
            c: V.setWorkOffset('9999-anything-at-all', 'X', '#100').join('\n'),
        };
    });
    expect(r.a).toBe(r.b);
    expect(r.b).toBe(r.c);
});

test('the .status sub-field finding is a separate, smaller claim and stays out of the 33-line count', () => {
    expect(V41_STATUS_FIELD_DEAD.sites.length, 'four declared-but-dead .status sites, tracked but not counted').toBe(4);
    expect(V41_RESIDUE_CENSUS.totalLines, 'the formal census total is unaffected by the status-field finding').toBe(33);
});
