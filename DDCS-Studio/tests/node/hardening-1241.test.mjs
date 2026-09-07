import { test, expect } from './support/harness.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * t1241 — THE HARDENING BATCH's own guards.
 *
 * The point of this file is that each fix here was a CLASS, not an incident: a setter that re-traced the route and
 * left the running engine behind, an anchor expression hand-copied instead of shared, a token declared and never read.
 * A test that only checked today's six sites would let the seventh in tomorrow, so these are TRIPWIRES on the shape.
 *
 * TIER MIGRATION (batch 12): this file now lives one directory deeper (tests/node/, not tests/), so the two
 * relative paths below (the web/ root, and smoke.manifest.mjs) both go up ONE MORE level than the original.
 */
const web = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'web');
const read = (p) => readFileSync(join(web, p), 'utf8');

test('A TRIPWIRE — every panel setter that re-traces also reseeds a running engine', () => {
    const src = read('viz/createPreviewPanel.js');
    // the ONE path both a setter and a listener must take
    expect(src, 'the reseed seam exists').toMatch(/function reseedRunning\(/);
    expect(src, 'and the re-trace-plus-reseed pair that setters call').toMatch(/function retraceAndReseed\(/);

    // Enumerate every place that re-traces (a bare setGcode() with no argument = "re-trace the current program") and
    // require it to be inside the shared pair or to be the seam/entry points themselves. A NEW setter that hand-rolls
    // `if (active) setGcode();` trips this immediately — which is the whole class.
    // The allow-list is the DECLARED set of sites that reseed by another route, each for a stated reason:
    //   retraceAndReseed / setSeatAtStart — the shared pair (setSeatAtStart predates it and restarts explicitly)
    //   onStartDrag / ensureViz          — followed by replayFromStart(), which restarts the run itself
    //   setMode                          — calls stopPlay() first, so there IS no running engine to reseed
    //   setGcode / refresh / setActive   — the entry points a re-trace is made OF
    const allowed = new Set(['retraceAndReseed', 'setSeatAtStart', 'scheduleLiveRestart', 'refresh', 'setActive', 'setGcode', 'setMode', 'onStartDrag', 'ensureViz']);
    const offenders = [];
    const lines = src.split('\n');
    let fn = '';
    lines.forEach((l, i) => {
        const m = l.match(/^\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (m) fn = m[1];
        if (/\bsetGcode\(\s*\)/.test(l) && !/function retraceAndReseed/.test(l) && !allowed.has(fn)) offenders.push(`${i + 1}: ${fn || '(top level)'} — ${l.trim().slice(0, 90)}`);
    });
    expect(offenders, 'a re-trace outside the shared pair leaves a running play on stale config').toEqual([]);
});

test('A5 — the route TRACE cannot mutate the persistent var store (the serial-number leak)', () => {
    const src = read('ui/gcodePreviewTab.js');
    expect(src, 'the store is copied unless a RUN explicitly asks to persist').toMatch(/const m = persist \? src : new Map\(src\)/);
    const panel = read('viz/createPreviewPanel.js');
    expect(panel, 'the trace asks for a throwaway copy').toMatch(/createVarStore\(\{ persist: false \}\)/);
    expect(panel, 'and the run asks for the persistent one').toMatch(/createVarStore\(\{ persist: true \}\)/);
});

test('B TRIPWIRE — the pass-anchor expression lives in ONE place', () => {
    const src = read('engine/GcodeExecutionEngine.js');
    const inlines = (src.match(/passAnchorFor\(this\._passStarts/g) || []).length;
    expect(inlines, 'only _anchor() itself may call passAnchorFor — every other site goes through _anchor()/_worldOf').toBe(1);
    expect(src, 'and the limit/home lamps map a PASS-LOCAL position through the seam (they used to assume pass 0)')
        .toMatch(/const w = this\._worldOf\(pos\);/);
});

test('C13 — the dead per-type dim multiplier is gone from the 2D paint', () => {
    const src = read('viz/toolpath2d.js');
    expect(src, 'no multiplication by a token the palette no longer declares').not.toMatch(/PATH_TYPES\[t\][\s\S]{0,12}\.dim/);
    expect(read('viz/pathStyle.js'), 'and the palette really does not declare it').not.toMatch(/\bdim:\s/);
});

test('D16 — a declared token nobody reads is not left in the palette', () => {
    const style = read('viz/pathStyle.js');
    expect(style, 'shape was deleted (the arc is a pass-SOURCE fact, not a path-TYPE one)').not.toMatch(/shape:\s*'(line|arc)'/);
    expect(style, 'and the deletion says why').toMatch(/t1241 D16/);
});

test('D15 — the declared showMagazine intent is actually applied', () => {
    expect(read('viz/opSimContext.js'), 'the program intent applies it').toMatch(/panel\.setShowMagazine\(/);
    expect(read('viz/createPreviewPanel.js'), 'and the panel exposes the setter it calls').toMatch(/function setShowMagazine\(/);
});

test('E — the two contract guards are in the smoke tier', async () => {
    const { SMOKE_SPECS } = await import('../smoke.manifest.mjs');
    expect(SMOKE_SPECS, 'the zero-boot-errors / new-file 404 tripwire').toContain('check-console.spec.js');
    expect(SMOKE_SPECS, 'the op-type → declared-intent contract').toContain('op-sim-context.spec.js');
});

test('C14 — the legend chips carry a DASH SAMPLE, so Rapid and Safe travel are tellable apart', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const src = read('viz/createPreviewPanel.js');
    expect(src, 'each chip renders its own declared dash').toMatch(/class="lg-dash"/);
    expect(src, 'read from the ONE dash token, not re-invented').toMatch(/dashFor\(/);
    // and the two same-hue types really do differ by dash in the palette
    const r = await page.evaluate(async () => {
        const { PATH_TYPES } = await import('/viz/pathStyle.js');
        return { rapid: PATH_TYPES.rapid.dash, lifted: PATH_TYPES.lifted.dash, sameHue: PATH_TYPES.rapid.color === PATH_TYPES.lifted.color };
    });
    expect(r.sameHue, 'they share a hue — which is exactly why colour alone could not distinguish them').toBe(true);
    expect(JSON.stringify(r.rapid), 'rapid is solid').toBe('[]');
    expect(r.lifted.length, 'safe travel is dashed').toBeGreaterThan(0);
});
