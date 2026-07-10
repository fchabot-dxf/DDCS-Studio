import { test, expect } from '@playwright/test';

/**
 * CORNER PER-POST FOLD (F1/E1, Option 1). The corner probe wizard leaked LITERAL Expert registers on V4.1/DM500.
 * E1 routes each class through a dialect-aware seam that resolves per active post, with Expert byte-IDENTICAL (the
 * machine-verified goldens never move a byte — those are covered by corner-data-emit / probe-surface-block).
 * This sweep asserts the NUMERIC per-post truth (the right register or the honest degrade), NOT golden==golden.
 *
 * DONE + covered here: (1) TRIGGER READ — radiuscomp asks the dialect (probeTrigVar) for the trigger register per
 * axis; (2) HMI — the #1505 note folds via the hmiline atom. STILL PENDING (next increment): the WCS-write class
 * (wcsBaseInto + indirect write) — until then the #[#70]/#[#73] WCS writes remain Expert-literal on V4.1/DM500.
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
    // the Z-surface comp reads the Z trigger (#1927 / #1502 / #866) — note: its WCS TARGET (#[#73]) is the pending WCS class
    expect(line(t['ddcs-v41'], /^#\[#73\]=\[/), 'V4.1 Z trigger = #1502').toContain('#1502');
    expect(line(t['ddcs-v3-dm500'], /^#\[#73\]=\[/), 'DM500 Z trigger = #866').toContain('#866');
    // no stray #1925 on the non-Expert posts (the leak is gone for the read)
    expect(t['ddcs-v41'], 'V4.1 emits no #1925 trigger literal').not.toMatch(/#1925/);
    expect(t['ddcs-v3-dm500'], 'DM500 emits no #1925 trigger literal').not.toMatch(/#1925/);
});

test('HMI (#1505) folds per post — Expert spaced #1505 form (byte-identical), V4.1/DM500 a plain comment (no #1505)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitCorner(page, { corner: 'FL' });
    // Expert: the exact spaced assign form (byte-identical to the pre-E1 literal)
    expect(line(t['ddcs-expert-m350'], /Hover OUTSIDE/)).toBe('#1505=1 ( Hover OUTSIDE the FL corner material. Press Enter )');
    expect(line(t['ddcs-expert-m350'], /Corner FL found/)).toBe('#1505=-5000 ( Corner FL found )');
    expect(line(t['ddcs-expert-m350'], /ERROR: Probe failed/)).toBe('#1505=1 ( ERROR: Probe failed to trigger )');
    // V4.1/DM500: the operator instruction survives as a plain comment, with NO unmapped #1505 write
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(line(t[id], /Hover OUTSIDE/), `${id} prompt → comment`).toBe('( Hover OUTSIDE the FL corner material. Press Enter )');
        expect(line(t[id], /Corner FL found/), `${id} found → comment`).toBe('( Corner FL found )');
        expect(t[id], `${id} writes no #1505`).not.toMatch(/#1505/);
    }
});
