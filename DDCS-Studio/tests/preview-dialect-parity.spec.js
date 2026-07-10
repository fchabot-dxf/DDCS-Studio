import { test, expect } from '@playwright/test';

/**
 * PREVIEW DIALECT PARITY (t634). The wizard PREVIEW (code panel + sim) emitted `emitMapped(stack).text` with NO dialect →
 * DEFAULT_DIALECT (Expert) on every post, so it LIED on V4.1/DM500 (showed Expert #1925/#805 instead of the real #1500/#864).
 * INSERT already folds per post (programModel/dialectOpts). t634 threads activeDialectOpts() into every wizard generate() +
 * the data-op preview, so preview text == insert text per post. The sim engine is dialect-agnostic (it plays G31/DM500
 * move-until-input + populates all DRO bases) so the non-Expert forms trace to a drawable route.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500'];

test('generate() folds per ACTIVE post (== the insert-path emit); v41 shows #1500 not #1925; Expert unchanged; sim plays each', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (POSTS) => {
        const { CornerWizard, cornerStack } = await import('/wizards/cornerWizard.js');
        const { EdgeWizard, edgeStack } = await import('/wizards/edgeWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const cornerP = { corner: 'FL', probeDia: 6, safeZ: 5, overtravel: 3, feed: 100 };
        const edgeP = { edge: 'left', probeDia: 6, safeZ: 5, overtravel: 3, feed: 100 };
        const cw = new CornerWizard(), ew = new EdgeWizard();
        const out = {};
        for (const id of POSTS) {
            setActiveProfile(id);
            const genCorner = cw.generate(cornerP);           // the PREVIEW path (now threads activeDialectOpts)
            const genEdge = ew.generate(edgeP);
            const insCorner = emitMapped(cornerStack(cornerP), { dialect: getDialect(id) }).text;   // the INSERT path (programModel/dialectOpts)
            const insEdge = emitMapped(edgeStack(edgeP), { dialect: getDialect(id) }).text;
            let trace = null;
            try { const e = new GcodeExecutionEngine({ stock: { x: 100, y: 80, z: 20 }, autoAnswer: true }); trace = e.trace(genEdge).stats; } catch (err) { trace = { err: String(err) }; }
            out[id] = { genCorner, genEdge, cornerMatchesInsert: genCorner === insCorner, edgeMatchesInsert: genEdge === insEdge, trace };
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    }, POSTS);

    // preview == insert on EVERY post (the parity)
    for (const id of POSTS) {
        expect(r[id].cornerMatchesInsert, `corner preview == insert @ ${id}`).toBe(true);
        expect(r[id].edgeMatchesInsert, `edge preview == insert @ ${id}`).toBe(true);
    }
    // per-post trigger register in the CORNER preview (#1925 Expert / #1500 V4.1 / #864 DM500)
    expect(r['ddcs-expert-m350'].genCorner, 'Expert preview uses #1925 (unchanged)').toContain('#1925');
    expect(r['ddcs-v41'].genCorner, 'V4.1 preview uses #1500').toContain('#1500');
    expect(r['ddcs-v41'].genCorner, 'V4.1 preview has NO Expert #1925').not.toContain('#1925');
    expect(r['ddcs-v3-dm500'].genCorner, 'DM500 preview uses #864').toContain('#864');
    expect(r['ddcs-v3-dm500'].genCorner, 'DM500 preview has NO Expert #1925').not.toContain('#1925');
    // the preview genuinely CHANGES per post (was Expert-on-all-posts before)
    expect(r['ddcs-v41'].genCorner).not.toBe(r['ddcs-expert-m350'].genCorner);
    // the sim plays each post's edge emit to a drawable route
    for (const id of POSTS) {
        expect(r[id].trace.drawable, `edge sim traces a drawable route @ ${id}`).toBe(true);
        expect(r[id].trace.probe, `edge sim fires the probes @ ${id}`).toBeGreaterThan(0);
    }
});

test('REAL-SYMPTOM: the edge wizard preview panel shows the V4.1 emit (no #1925), then Expert (with #1925)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);

    // V4.1 active → open the edge wizard → the preview code panel shows the V4.1 emit
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-v41'); });
    await page.evaluate(() => window.openWiz('edge'));
    await page.waitForSelector('#wiz_edge_code', { timeout: 8000 });
    await page.waitForFunction(() => (document.getElementById('wiz_edge_code')?.textContent || '').length > 20, null, { timeout: 8000 });
    const v41Panel = await page.evaluate(() => document.getElementById('wiz_edge_code').textContent || '');
    expect(v41Panel, 'the V4.1 edge preview panel has NO Expert #1925 register').not.toContain('#1925');
    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/preview-v41.png' });

    // switch to Expert → the panel re-renders with the Expert emit (#1925 back)
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForFunction(() => (document.getElementById('wiz_edge_code')?.textContent || '').includes('#1925'), null, { timeout: 8000 });
    const expertPanel = await page.evaluate(() => document.getElementById('wiz_edge_code').textContent || '');
    expect(expertPanel, 'the Expert edge preview panel uses #1925').toContain('#1925');
    expect(expertPanel, 'the panel actually changed between posts').not.toBe(v41Panel);
    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/preview-expert.png' });
});
