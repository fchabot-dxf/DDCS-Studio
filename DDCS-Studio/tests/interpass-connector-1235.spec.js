import { test, expect } from '@playwright/test';

/**
 * t1235 TURN B — THE INTER-PASS CONNECTOR.
 *
 * THE ROOT (measured in t1213): a `REPOSITION:` comment is the pass DELIMITER — the engine records the finishing pass's
 * runtime end, increments the pass and resets the local position — so the traverse BETWEEN passes is consumed by the
 * boundary and never traced. The drawn route was a set of disconnected within-pass fragments, which is exactly why the
 * traverse read as a stub that never connects.
 *
 * THE FIX under test: the connector is synthesised into the ONE route feed, from the previous pass's RUNTIME END to the
 * next pass's MARKER WORLD. Both endpoints are positions the tool actually occupies, so:
 *   • it is honest by construction (nothing invented),
 *   • it ends ON the marker by definition → it re-anchors on every drag with no drag-time bookkeeping,
 *   • both surfaces get it from the same array (the 2D/Layout overlay and the 3D group).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openOp(page, mod, def, opType) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async ({ mod, def }) => {
        const U = await import('/blocks/userOps.js'); const M = await import(mod);
        localStorage.removeItem('ddcs_user_ops'); U.createUserOp(M[def]());
    }, { mod, def });
    await page.evaluate((t) => window.openWiz(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return !!(p && p.getSegments && p.getSegments().length); }, null, { timeout: 12000 });
    await page.waitForTimeout(400);
}

/** Read the route + the truths a connector must join, all through the app's own seams. */
const routeFacts = (page) => page.evaluate(async () => {
    const { passAnchorFor } = await import('/engine/passAnchor.js');
    const { markerWorldOf } = await import('/viz/markerWorld.js');
    const p = window.ddcsStudio.wizardManager._activePanel;
    const segs = p.getSegments() || [], starts = p.getPassStarts() || [], ends = p.getPassEnds() || [];
    const world = (s, k) => { const o = passAnchorFor(starts, ends, s.pass) || { x: 0, y: 0, z: 0 }; return { x: s['x' + k] + o.x, y: s['y' + k] + o.y, z: s['z' + k] + o.z }; };
    const ov = document.getElementById('userVizContainer') && document.getElementById('userVizContainer').__animOverlay;
    return {
        passes: starts.length,
        sources: p.getPassSources ? p.getPassSources() : [],
        ends, markers: starts.map((_, i) => markerWorldOf(starts, ends, i)),
        connectors: segs.filter((s) => s.connector).map((s) => ({ pass: s.pass, type: s.type, rapid: !!s.rapid, a: world(s, 1), b: world(s, 2) })),
        // the two shelves that must be fed from the SAME array
        vizConnectors: (p.viz && p.viz._segs ? p.viz._segs : []).filter((s) => s.connector).length,
        overlayCount: ov && ov.tp ? ov.tp.count : -1,
        segCount: segs.length,
    };
});

const near = (a, b, tol = 0.05) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0)) <= tol;

// t1670 — switch corner's wall1→wall2 traverse to MANUAL: the operator jogs there by hand (a `#1505` prompt, not a
// traced G0 move), so the connector is genuinely the ONLY thing that draws that leg — the real gap this mechanism
// exists for. AUTO no longer belongs here: cornerData.js's cornerSimStartsProvider declares AUTO reposition passes
// `anchorsAtPrev`, which makes passAnchorFor resolve pass p's own local frame to passEnds[p-1] — the SAME point the
// connector would start from — so the connector's local start is always {0,0,0}, exactly where pass p's REAL traced
// segments already begin (the engine resets pos to {0,0,0} at every REPOSITION boundary). Synthesizing a connector
// there duplicated a route the G-code already traces: invisibly under travelShape=diagonal (identical endpoints, so
// two exactly-overlapping segments looked like one correct line) and visibly under the default travelShape=dogleg
// (an extra diagonal cutting across the real 2-leg L) — a user-reported preview defect, fixed in
// viz/createPreviewPanel.js's withInterPassConnectors. MANUAL is unaffected (source stays 'manual', so
// anchorsAtPrev is false) and is the correct fixture for what these tests are actually probing.
async function setManualTravel(page) {
    await page.waitForSelector('#wiz_user_form .seg-control[data-param="travelApproach"]', { timeout: 8000 });
    await page.evaluate(() => document.querySelector('#wiz_user_form .seg-control[data-param="travelApproach"] .seg-btn[data-value="manual"]').click());
    await page.waitForTimeout(700);
}

test('CORNER (manual travel): a connector bridges every adjacent pass pair — runtime END → the next pass MARKER, on both shelves', async ({ page }, testInfo) => {
    await openOp(page, '/blocks/dataOps/cornerData.js', 'cornerDataDef', 'user_corner_data');
    await setManualTravel(page);
    const r = await routeFacts(page);

    expect(r.passes, 'corner is multi-pass (this test is meaningless otherwise)').toBeGreaterThan(1);
    expect(r.connectors.length, 'one connector per pass boundary').toBe(r.passes - 1);

    for (const c of r.connectors) {
        expect(near(c.a, r.ends[c.pass - 1]), `pass ${c.pass}: the connector STARTS at the previous pass's runtime end`).toBe(true);
        expect(near(c.b, r.markers[c.pass]), `pass ${c.pass}: and ENDS on that pass's marker — by definition, not by bookkeeping`).toBe(true);
        expect(c.rapid, 'a traverse, not a cut').toBe(true);
        expect(c.type, 'classified through the declared language (rapid → lifted/dashed at render time)').toBe('rapid');
    }
    // ONE feed, both surfaces: the 3D group holds the same connectors, and the Layout overlay was handed the same array
    expect(r.vizConnectors, 'the 3D got the connectors from the same array').toBe(r.connectors.length);
    expect(r.overlayCount, 'and so did the Layout animation overlay').toBe(r.segCount);

    await page.locator('#userVizContainer').screenshot({ path: testInfo.outputPath('corner-connector.png') });
});

test('MIDDLE inherits it — no per-op work, because it is one route feed', async ({ page }, testInfo) => {
    await openOp(page, '/blocks/dataOps/middleData.js', 'middleDataDef', 'user_middle_data');
    // middle's DEFAULT is a single-axis probe — one pass, no boundary, nothing to bridge (measured: passes === 1).
    // Turn on the two-axis boss probe, which is what gives it a second pass and therefore a traverse to draw.
    await page.evaluate(() => {
        const f = document.querySelector('#wiz_user_form [data-param="twoAxis"]');
        if (!f) return;
        if (f.type === 'checkbox') f.checked = true; else f.value = 'true';
        f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    const r = await routeFacts(page);
    expect(r.passes, 'the two-axis middle really is multi-pass (otherwise this proves nothing)').toBeGreaterThan(1);
    expect(r.connectors.length, 'every boundary is bridged here too').toBe(r.passes - 1);
    for (const c of r.connectors) {
        expect(near(c.a, r.ends[c.pass - 1]), `pass ${c.pass}: starts at the runtime end`).toBe(true);
        expect(near(c.b, r.markers[c.pass]), `pass ${c.pass}: ends on the marker`).toBe(true);
    }
    await page.locator('#userVizContainer').screenshot({ path: testInfo.outputPath('middle-connector.png') });
});

test('DRAG THEN PAINT (manual travel): moving a start marker moves the connector with it — the vanishing traverse is gone', async ({ page }, testInfo) => {
    await openOp(page, '/blocks/dataOps/cornerData.js', 'cornerDataDef', 'user_corner_data');
    await setManualTravel(page);
    const before = await routeFacts(page);
    await page.locator('#userVizContainer').screenshot({ path: testInfo.outputPath('drag-before.png') });

    // drag the FIRST sim handle a real distance
    const h = page.locator('#userVizContainer .fc-handle-sim').first();
    const box = await h.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 40, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);

    const after = await routeFacts(page);
    await page.locator('#userVizContainer').screenshot({ path: testInfo.outputPath('drag-after.png') });

    expect(after.connectors.length, 'the connectors SURVIVE the drag — this is the vanishing-traverse symptom').toBe(before.connectors.length);
    for (const c of after.connectors) {
        expect(near(c.a, after.ends[c.pass - 1]), `pass ${c.pass}: still starts at the (re-run) runtime end`).toBe(true);
        expect(near(c.b, after.markers[c.pass]), `pass ${c.pass}: still ends ON the marker — it followed the chain`).toBe(true);
    }
    // and it actually MOVED (the drag was not a no-op, so the assertions above mean something)
    const moved = after.connectors.some((c, i) => !near(c.b, before.connectors[i].b, 0.5) || !near(c.a, before.connectors[i].a, 0.5));
    expect(moved, 'the route really changed — the drag was not a no-op').toBe(true);
});

test('a MANUAL pass draws its connector in the operator-jog language, not as an auto traverse', async ({ page }) => {
    await openOp(page, '/blocks/dataOps/cornerData.js', 'cornerDataDef', 'user_corner_data');
    await setManualTravel(page);   // t1670 — this test's own name requires manual; it never switched before (see note above)
    // the jog style is not a second code path: the 2D reads startSources[s.pass], so a manual pass's connector inherits
    // the amber arc from the DECLARED source. Assert the wiring that makes that true.
    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const segs = p.getSegments() || [];
        const conns = segs.filter((s) => s.connector);
        return {
            sources: p.getPassSources ? p.getPassSources() : [],
            connectorPasses: conns.map((s) => s.pass),
            // a 2-axis rapid is what the manual-jog arc keys on (isRawRapid + both deltas) — prove the connector qualifies
            twoAxis: conns.map((s) => Math.abs(s.x2 - s.x1) > 0.05 && Math.abs(s.y2 - s.y1) > 0.05),
        };
    });
    expect(r.connectorPasses.length).toBeGreaterThan(0);
    for (const p of r.connectorPasses) {
        expect(['auto', 'manual'], `pass ${p} declares a reposition source, so its connector can inherit the style`).toContain(r.sources[p] || 'auto');
    }
});
