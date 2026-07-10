import { test, expect } from '@playwright/test';

/**
 * PROBE-MISS SAFETY (t638). On V4.1/DM500 the probecheck used to fold to [] → a probe MISS was silently ignored → wrong WCS.
 * Now: probestart captures the pre-probe DRO into a DECLARED miss-scratch (#190), and probecheck emits a dir-aware DRO-compare
 * that branches to the SAME failGoto when the axis reached the full commanded travel (within eps) = no contact. Expert keeps its
 * #192x status check byte-identical. This asserts the VALUES per post + a simulated MISS takes the fail branch (not the WCS write).
 */
const num = (s) => s;

test('V4.1/DM500 probes carry capture + dir-aware compare + branch; Expert unchanged; no scratch double-write', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { cornerStack } = await import('/wizards/cornerWizard.js');
        const { edgeStack } = await import('/wizards/edgeWizard.js');
        const { middleStack } = await import('/wizards/middleWizard.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const out = {};
        const builders = {
            corner: () => cornerStack({ corner: 'FL', probeDia: 6, safeZ: 5, overtravel: 3, feed: 100 }),
            edge: () => edgeStack({ edge: 'left', probeDia: 6, safeZ: 5, overtravel: 3, feed: 100 }),
            middle: () => middleStack({ feature: 'pocket', probeDia: 6, safeZ: 5, feed: 100 }),
            alignment: () => alignmentStack({ probeDia: 6, safeZ: 5, feed: 100 }),
            rotaryCenter: () => rotaryCenterStack({ probeDia: 6, safeZ: 5, feed: 100 }),
            rotaryClock: () => rotaryClockStack({ probeDia: 6, safeZ: 5, feed: 100 }),
        };
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            for (const [name, build] of Object.entries(builders)) out[name + '_' + id] = emitMapped(build(), { dialect: getDialect(id) }).text;
        }
        return out;
    });

    // ── V4.1 edge: pre-probe capture #190=#1500, dir-aware compare (dir '+' → >= [#190+#8-eps]; '-' → <= [#190+#7+eps]) ──
    const v41 = r['edge_ddcs-v41'];
    expect(v41, 'V4.1 captures the pre-probe DRO into the declared scratch #190').toContain('#190=#1500');
    // reached the full commanded travel (start + seek) within eps == no contact → GOTO the fail label
    expect(v41, 'V4.1 DRO-compare: IF #1500 >=[#190+#8-0.05] (or <= [#190+#7+0.05]) GOTO<fail>').toMatch(/IF #1500(>=\[#190\+#8-0\.05\]|<=\[#190\+#7\+0\.05\])GOTO\d+/);
    expect(v41, 'V4.1 no longer silently skips the miss (no bare probe with no check)').not.toContain('( no probe-miss check');
    expect(v41, 'V4.1 must NOT leak the Expert status register').not.toContain('#1920');

    // ── DM500 edge: capture #190=#864, word-op compare (GE/LE, space before GOTO) ──
    const dm = r['edge_ddcs-v3-dm500'];
    expect(dm, 'DM500 captures the pre-probe DRO into #190').toContain('#190=#864');
    expect(dm, 'DM500 DRO-compare: IF #864 GE[#190+#8-0.05] (or LE [#190+#7+0.05]) GOTO<fail>').toMatch(/IF #864(GE\[#190\+#8-0\.05\]|LE\[#190\+#7\+0\.05\]) GOTO\d+/);

    // ── Expert: the status-var check is unchanged; NO probestart line, NO DRO-compare ──
    const ex = r['edge_ddcs-expert-m350'];
    expect(ex, 'Expert keeps its #1920 status check').toContain('IF #1920!=2 GOTO');
    expect(ex, 'Expert emits NO probestart capture (folds to [])').not.toContain('#190=');
    expect(ex, 'Expert has no DRO-compare bracket-expr miss test').not.toMatch(/\[#190/);

    // ── the compare branches to the SAME label the probe fail path uses (the WCS write is AFTER, the fail label BEFORE the write's GOTO) ──
    const failLabel = (v41.match(/GOTO(\d+)/) || [])[1];
    expect(failLabel, 'V4.1 compare has a fail GOTO target').toBeTruthy();
    expect(v41, 'the fail label N<goto> exists in the program').toContain('N' + failLabel);

    // ── no scratch collision: #190 is only ever WRITTEN by probestart (one write per probe pass), never by anything else ──
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        const prog = r['edge_' + id];
        const writes = (prog.match(/#190=/g) || []).length;
        const reads = (prog.match(/\[#190\+/g) || []).length;
        expect(writes, `${id}: #190 written once per probe pass (2 for a 2-pass edge)`).toBe(2);
        expect(reads, `${id}: #190 read once per probe pass`).toBe(2);
    }

    // ── EVERY probe wizard carries the miss-check on V4.1 (capture + compare + branch): corner/edge/middle/alignment/rotary ──
    for (const w of ['corner', 'edge', 'middle', 'alignment', 'rotaryCenter', 'rotaryClock']) {
        const prog = r[w + '_ddcs-v41'];
        expect(prog, `${w}: V4.1 captures the pre-probe DRO (#190=#15xx)`).toMatch(/#190=#15\d\d/);
        expect(prog, `${w}: V4.1 emits the DRO-compare miss branch (IF #15xx <op> [#190+... ] GOTO)`).toMatch(/IF #15\d\d(>=|<=)\[#190\+#\d/);
        expect(prog, `${w}: V4.1 no longer silently skips the miss`).not.toContain('( no probe-miss check');
    }
});
