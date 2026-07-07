import { test, expect } from '@playwright/test';

/**
 * HOMING H2 — the limit SWITCH-TYPE catalog (mechanical vs proximity; per-EDGE; SIM-CONFIG only, emit byte-identical).
 * VERIFY: (1) SWITCH_TYPES is a declared set (mechanical standoff 0 / proximity standoff Sn, each with a render glyph);
 * (2) limitSwitchTrips uses the per-edge standoff — a PROXIMITY switch trips Sn BEFORE the edge (non-contact), a mechanical
 * one AT the edge (the trip position differs by Sn); (3) the per-edge picker persists (row.switchType → the flat limits
 * config, round-trip); (4) emit BYTE-IDENTICAL (no macro reads the switch type). + a screenshot of the picker on a limit row.
 */
test('SWITCH_TYPES catalog + limitSwitchTrips standoff (proximity trips Sn before the edge, mechanical at it)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { SWITCH_TYPES, switchStandoff } = await import('/engine/switchTypes.js');
        const { limitSwitchTrips } = await import('/engine/limitSwitches.js');
        const mech = SWITCH_TYPES.find((s) => s.type === 'mechanical'), prox = SWITCH_TYPES.find((s) => s.type === 'proximity');
        // X travel +300 → span [0,300], the MIN edge is at 0. Put the tool 2mm from that edge (x=2).
        const machine = { x: 300, y: 300, z: -120 }, tool = { x: 2, y: 150, z: -60 };
        const mechCfg = { xMinPin: 5, xMinLevel: 0, xMinSwitchType: 'mechanical' };
        const proxCfg = { xMinPin: 5, xMinLevel: 0, xMinSwitchType: 'proximity' };
        const mechTrip = limitSwitchTrips(tool, machine, mechCfg);   // x=2 vs mechanical edge=0 → NO trip
        const proxTrip = limitSwitchTrips(tool, machine, proxCfg);   // x=2 vs proximity trip 0+3=3 → TRIP, edgePos 3
        const mechAtEdge = limitSwitchTrips({ x: 0, y: 150, z: -60 }, machine, mechCfg);   // mechanical trips AT the edge (0)
        return {
            mech: { standoff: mech.standoff, render: mech.render, label: mech.label, hasHelp: !!mech.help },
            prox: { standoff: prox.standoff, render: prox.render, label: prox.label, hasHelp: !!prox.help },
            mechTripCount: mechTrip.length, proxTripCount: proxTrip.length,
            proxEdgePos: proxTrip[0] && proxTrip[0].edgePos, mechEdgePos: mechAtEdge[0] && mechAtEdge[0].edgePos,
            proxStandoff: switchStandoff('proximity'), mechStandoff: switchStandoff('mechanical'), defStandoff: switchStandoff(''),
        };
    });
    // (1) the declared catalog
    expect(r.mech.standoff, 'mechanical standoff = 0 (trips AT the edge)').toBe(0);
    expect(r.mech.render, 'mechanical render glyph').toBe('plunger');
    expect(r.prox.standoff, 'proximity standoff = a default Sn (3mm)').toBe(3);
    expect(r.prox.render, 'proximity render glyph').toBe('sensor-face');
    expect(r.mech.hasHelp && r.prox.hasHelp, 'each type carries a help string (INPUT_TYPES shape)').toBe(true);
    expect(r.defStandoff, 'unknown/legacy → mechanical (standoff 0)').toBe(0);
    // (2) the standoff shifts the trip: proximity trips Sn BEFORE the edge; mechanical only AT it
    expect(r.mechTripCount, 'mechanical does NOT trip 2mm from the edge').toBe(0);
    expect(r.proxTripCount, 'proximity DOES trip 2mm from the edge (within Sn=3)').toBe(1);
    expect(r.proxEdgePos, 'proximity trip position = the edge + Sn (0+3=3)').toBe(3);
    expect(r.mechEdgePos, 'mechanical trip position = the edge (0)').toBe(0);
    expect(r.proxEdgePos - r.mechEdgePos, 'the trip positions differ by exactly Sn').toBe(3);
});

test.use({ viewport: { width: 1200, height: 700 } });
test('per-edge picker persists (row.switchType → flat limits) + emit BYTE-IDENTICAL + screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const rt = await page.evaluate(async () => {
        const { syncIO } = await import('/ui/settingsPanel.js');
        const s = window.ddcsGetSettings();
        s.inputs = [{ id: 'limit_x_min', type: 'limit', axis: 'x_min', label: 'Limit X−', pin: 5, level: 0, switchType: 'proximity' }];
        syncIO();   // mirror the rows → the flat settings.limits the sim reads
        const emit = await (async () => {
            const { homingStack } = await import('/wizards/homingWizard.js');
            const { emitMapped } = await import('/blocks/blockEmitter.js');
            return emitMapped(homingStack({ axes: ['z'], config: { z: { method: 'native' } }, machine: { z: -120 } })).text;
        })();
        return { xMinSwitchType: s.limits.xMinSwitchType, xMaxSwitchType: s.limits.xMaxSwitchType, emit };
    });
    expect(rt.xMinSwitchType, 'the picker value round-trips to the flat limits config').toBe('proximity');
    expect(rt.xMaxSwitchType, 'an unset edge defaults to mechanical').toBe('mechanical');
    // (4) emit byte-identical — the emitted homing macro does NOT reference the switch type (sim-config only)
    expect(/switchtype|proximity|standoff/i.test(rt.emit), 'the emitted macro does NOT reference the switch type').toBe(false);

    // screenshot the picker on a limit row (render the ioTable directly with a limit row)
    await page.evaluate(async () => {
        const { renderIoTable } = await import('/ui/ioTable.js');
        const c = document.createElement('div'); c.id = 'io_shot';
        c.style.cssText = 'position:fixed; top:20px; left:20px; right:20px; background:#141a21; color:#cdd6e0; padding:18px; border:1px solid #2a3340; border-radius:8px; z-index:99999; font:13px system-ui;';
        c.innerHTML = '<div style="margin-bottom:10px; color:#9fb3c8;">Hardware ▸ Inputs — a limit switch with the H2 Switch-type picker</div>';
        document.body.appendChild(c);
        const list = [{ id: 'limit_x_min', type: 'limit', axis: 'x_min', label: 'Limit X−', pin: 5, level: 0, switchType: 'proximity' }];
        renderIoTable(c, 'input', list, () => {});   // 'input' (singular) — the kind isInput checks
    });
    await page.waitForTimeout(200);
    await page.locator('#io_shot').screenshot({ path: 'scratchpad/switch_type_picker.png' });
    const has = await page.evaluate(() => { const opts = [...document.querySelectorAll('#io_shot select option')].map((o) => o.textContent); return { hasMechanical: opts.includes('Mechanical'), hasProximity: opts.includes('Proximity') }; });
    expect(has.hasMechanical && has.hasProximity, 'the Switch-type picker renders Mechanical + Proximity on the limit row').toBe(true);
});
