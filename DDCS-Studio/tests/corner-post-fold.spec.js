import { test, expect } from '@playwright/test';

/**
 * CORNER PER-POST FOLD (F1/E1, Option 1) — COMPLETE. The corner probe wizard leaked LITERAL Expert registers on
 * V4.1/DM500. E1 routes every leak-class through a dialect-aware seam that resolves per active post, with Expert
 * byte-IDENTICAL (the machine-verified goldens never move a byte — covered by corner-data-emit / probe-surface-block).
 * This sweep asserts the NUMERIC per-post truth (the right register or the honest degrade), NOT golden==golden.
 *
 * Classes: probe-STATUS (already clean — probecheck folds []); TRIGGER read (radiuscomp probeTrigVar); HMI (#1505 →
 * hmiline); WCS WRITE (wcsbaseinto + wcswrite: Expert #[#70]/#73 indirect / other posts G92; #883 sync → honest comment).
 */
async function emitCorner(page, params) {
    return page.evaluate(async (params) => {
        const { cornerStack } = await import('/wizards/cornerWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            out[id] = emitMapped(cornerStack(params), { dialect: getDialect(id) }).text;
        }
        return out;
    }, params);
}
const line = (txt, re) => (txt.split('\n').find((l) => re.test(l.trim())) || '').trim();

test('TRIGGER READ folds per post — Expert #1925 (byte-identical), V4.1 #1500, DM500 #864', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitCorner(page, { corner: 'FL', probeZ: true });
    // X-wall radius-comp reads the trigger into a temp: #102=[<trig>+#6]
    expect(line(t['ddcs-expert-m350'], /^#102=\[/), 'Expert trigger = #1925 (unchanged literal)').toBe('#102=[#1925+#6] ( Trigger Pos + Radius )');
    expect(line(t['ddcs-v41'], /^#102=\[/), 'V4.1 trigger = #1500 (post-probe DRO)').toBe('#102=[#1500+#6] ( Trigger Pos + Radius )');
    expect(line(t['ddcs-v3-dm500'], /^#102=\[/), 'DM500 trigger = #864 (DRO at contact)').toBe('#102=[#864+#6] ( Trigger Pos + Radius )');
    // no stray #1925 on the non-Expert posts (the leak is gone for the read)
    expect(t['ddcs-v41'], 'V4.1 emits no #1925 trigger literal').not.toMatch(/#1925/);
    expect(t['ddcs-v3-dm500'], 'DM500 emits no #1925 trigger literal').not.toMatch(/#1925/);
});

test('HMI (#1505) folds per post — Expert spaced #1505 form (byte-identical), V4.1/DM500 a plain comment (no #1505)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitCorner(page, { corner: 'FL' });
    expect(line(t['ddcs-expert-m350'], /Hover OUTSIDE/)).toBe('#1505=1 ( Hover OUTSIDE the FL corner material. Press Enter )');
    expect(line(t['ddcs-expert-m350'], /Corner FL found/)).toBe('#1505=-5000 ( Corner FL found )');
    expect(line(t['ddcs-expert-m350'], /ERROR: Probe failed/)).toBe('#1505=1 ( ERROR: Probe failed to trigger )');
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(line(t[id], /Hover OUTSIDE/), `${id} prompt → comment`).toBe('( Hover OUTSIDE the FL corner material. Press Enter )');
        expect(line(t[id], /Corner FL found/), `${id} found → comment`).toBe('( Corner FL found )');
        expect(t[id], `${id} writes no #1505`).not.toMatch(/#1505/);
    }
});

test('WCS WRITE folds per post — Expert #[#70]/#73 indirect (byte-identical), V4.1/DM500 G92; #883 sync → honest comment', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitCorner(page, { corner: 'FL', probeZ: true, syncA: true });
    const E = t['ddcs-expert-m350'];
    // Expert: the exact indirect idiom (byte-identical to the pre-E1 literals)
    expect(line(E, /^#70=\[805/)).toBe('#70=[805+[#72*5]] ( Base WCS address )');
    expect(line(E, /^#\[#70\]=#102/)).toBe('#[#70]=#102 ( Save to Active WCS X )');
    expect(line(E, /^#\[#73\]=#101/)).toBe('#[#73]=#101 ( Save to Active WCS Y )');
    expect(line(E, /^#\[#73\]=\[#1927/)).toBe('#[#73]=[#1927-#6] ( Save Active WCS Z offset - machine coord − stylus radius )');
    expect(line(E, /^#\[#74\]=#883/)).toBe('#[#74]=#883 ( Sync A offset with Y )');
    // fixed-WCS base is the literal register
    const g55 = (await emitCorner(page, { corner: 'FL', wcs: 'G55' }))['ddcs-expert-m350'];
    expect(line(g55, /^#70=810/)).toBe('#70=810 ( Base WCS address )');
    // V4.1 / DM500: G92 datum with the PER-POST trigger for Z; NO #70/#805/#[ table machinery; sync → honest comment
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(line(t[id], /G92 X#102/), `${id} X → G92`).toContain('G90 G92 X#102');
        expect(line(t[id], /G92 Y#101/), `${id} Y → G92`).toContain('G90 G92 Y#101');
        expect(t[id], `${id} has no #805 table math`).not.toMatch(/#\[805/);
        expect(t[id], `${id} has no #70 base register`).not.toMatch(/#70/);
        expect(t[id], `${id} makes no EXECUTABLE #883 slave-DRO read (the honest-degrade comment may name it)`).not.toMatch(/=#883/);
        expect(line(t[id], /slave-DRO/), `${id} sync degrades honestly`).toContain('no #883 slave-DRO equivalent');
    }
    // the Z datum uses each post's OWN trigger register (V4.1 #1502, DM500 #866)
    expect(line(t['ddcs-v41'], /G92 Z\[/)).toContain('G90 G92 Z[#1502-#6]');
    expect(line(t['ddcs-v3-dm500'], /G92 Z\[/)).toContain('G90 G92 Z[#866-#6]');
});
