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

// ─────────────────────────────────────────────────────────────────────────────
// EDGE (E2) — inherits corner's seams + the 3 ruled additions: the spaced-confirm gate (prompt+ESC), the G31 stop/limit
// probeguard fold, and the DIRECT-nested WCS write #[#70+off]. Expert byte-identical; V4.1/DM500 zero Expert registers.
async function emitEdge(page, params) {
    return page.evaluate(async (params) => {
        const { edgeStack } = await import('/wizards/edgeWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) out[id] = emitMapped(edgeStack(params), { dialect: getDialect(id) }).text;
        return out;
    }, params);
}

test('EDGE folds per post — Expert byte-identical (confirm+ESC, stop/limit, direct WCS, #1925); V4.1/DM500 G92, no Expert registers', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitEdge(page, { axis: 'X', dir: 'pos' });
    const E = t['ddcs-expert-m350'];
    // Expert: the exact spaced confirm gate (prompt + ESC IF), stop/limit guard, direct WCS write, trigger read
    expect(line(E, /Press Enter to probe/)).toBe('#1505=1 ( Press Enter to probe X pos - ESC=cancel )');
    expect(line(E, /^IF #1505==0/)).toBe('IF #1505==0 GOTO2');
    expect(line(E, /Stop mode/)).toBe('#1905=0 ( Stop mode: decelerate )');
    expect(line(E, /Limit protect/)).toBe('#1915=2 ( Limit protect )');
    expect(line(E, /^#50=\[/)).toBe('#50=[#1925+#6] ( Edge = trigger +/- stylus radius )');
    expect(line(E, /Set Active WCS X to edge/)).toBe('#[#70+0]=#50 ( Set Active WCS X to edge )');
    // V4.1 / DM500: G92 with the per-post trigger; the confirm folds to a comment with NO ESC IF; NO stop/limit/#70/#805/#1505
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(line(t[id], /Press Enter to probe/), `${id} prompt → comment`).toBe('( Press Enter to probe X pos - ESC=cancel )');
        expect(t[id], `${id} no ESC IF (can't mis-branch on unset #1505)`).not.toMatch(/IF #1505/);
        expect(t[id], `${id} no #1505 write`).not.toMatch(/#1505=/);
        expect(t[id], `${id} no G31 stop/limit registers`).not.toMatch(/#190[0-9]|#191[0-9]/);
        expect(t[id], `${id} no #70/#805 WCS-table math`).not.toMatch(/#70|#\[805/);
        expect(t[id], `${id} no #1925 trigger literal`).not.toMatch(/#1925/);
        expect(line(t[id], /G92 X#50/), `${id} WCS write → G92`).toContain('G90 G92 X#50');
    }
    // the trigger read uses each post's OWN register
    expect(line(t['ddcs-v41'], /^#50=\[/)).toContain('#50=[#1500+#6]');
    expect(line(t['ddcs-v3-dm500'], /^#50=\[/)).toContain('#50=[#864+#6]');
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLE (E3) — inherits corner/edge's seams. Base is the BARE wcsbaseinto (no comments); writes are DIRECT #[#70+off];
// sync is the indirect #883. E3 also KILLS A LIVE BUG: middle's ESC `IF #1505==0 GOTO2` used to emit on V4.1/DM500 with
// #1505 never set → the probe was SKIPPED. Now the prompt+ESC fold together (hmiconfirm) → a comment with no IF.
async function emitMiddle(page, params) {
    return page.evaluate(async (params) => {
        const { middleStack } = await import('/wizards/middleWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) out[id] = emitMapped(middleStack(params), { dialect: getDialect(id) }).text;
        return out;
    }, params);
}

test('MIDDLE folds per post — Expert byte-identical (bare base, direct writes, #883 sync); V4.1/DM500 G92, no Expert registers, ESC-IF gone', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const t = await emitMiddle(page, { featureType: 'boss', axis: 'X', twoAxis: true, probeZ: true, syncA: true });
    const E = t['ddcs-expert-m350'];
    // Expert: the exact bytes — bare base (NO "( Read Active WCS )"), spaced prompt + ESC, direct writes, #883 sync
    expect(line(E, /^#71=#578/)).toBe('#71=#578 ( Active WCS index: 1=G54 2=G55 etc )');
    expect(E, 'middle base omits the ( Read Active WCS ) comment (bare)').not.toMatch(/\( Read Active WCS \)/);
    expect(line(E, /Hover OVER the stock top/)).toBe('#1505=1 ( Hover OVER the stock top Z datum first. Press Enter - ESC=cancel )');
    expect(line(E, /^IF #1505==0/)).toBe('IF #1505==0 GOTO2');
    expect(line(E, /Save Active WCS Z offset/)).toBe('#[#70+2]=#57 ( Save Active WCS Z offset )');
    expect(line(E, /^#\[#70\+0\]=#53/)).toBe('#[#70+0]=#53');
    expect(line(E, /^#\[#74\]=#883/)).toBe('#[#74]=#883');
    // V4.1 / DM500: G92, NO Expert registers, and the ESC IF is GONE (the killed mis-branch)
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(line(t[id], /Hover OVER the stock top/), `${id} prompt → comment`).toBe('( Hover OVER the stock top Z datum first. Press Enter - ESC=cancel )');
        expect(t[id], `${id} the ESC IF #1505 is GONE (mis-branch killed)`).not.toMatch(/IF #1505/);
        expect(t[id], `${id} no #1505 write`).not.toMatch(/#1505=/);
        expect(t[id], `${id} no #70/#805 table math`).not.toMatch(/#70|#\[805/);
        expect(t[id], `${id} no G31 stop/limit`).not.toMatch(/#190[0-9]|#191[0-9]/);
        expect(t[id], `${id} no executable #883`).not.toMatch(/=#883/);
        expect(line(t[id], /G92 Z#57/), `${id} Z → G92`).toContain('G90 G92 Z#57');
        expect(line(t[id], /G92 X#53/), `${id} X → G92`).toContain('G90 G92 X#53');
        expect(line(t[id], /slave-DRO/), `${id} sync → honest comment`).toContain('no #883 slave-DRO equivalent');
    }
});
