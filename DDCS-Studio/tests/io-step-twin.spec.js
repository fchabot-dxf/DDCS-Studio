import { test, expect } from '@playwright/test';

/**
 * SETUP/IO increment 2, E2 — the user_io_step TWIN emit == ioStepStackResolved byte-for-byte across the mode × declared/raw
 * sweep (Expert + V4.1). The twin's deriveGuards + the declared-I/O recompose reproduce the concrete quick-insert emit.
 */
test('E2 TWIN byte-identity: user_io_step == ioStepStackResolved across mode × declared/raw × Expert + V4.1', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { ioStepDataDef } = await import('/blocks/dataOps/ioStepData.js');
        const { ioStepStackResolved } = await import('/wizards/ioStepWizard.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const SP = await import('/ui/settingsPanel.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        SP.applySettings({
            outputs: [{ id: 'coolant', type: 'custom', label: 'Coolant', pin: 3, onCode: 'M8', offCode: 'M9', group: 'io' }],
            inputs: [{ id: 'xmin', type: 'limit', axis: 'x', label: 'X min', pin: 5, level: 0, group: 'io' }],
        });
        let registerErr = null;
        try { registerUserOp(ioStepDataDef()); } catch (e) { registerErr = String((e && e.message) || e); }
        const build = builderOf('user_io_step');
        const combos = [
            { mode: 'output', outputRef: 'coolant', state: 'on' },
            { mode: 'output', outputRef: 'coolant', state: 'off' },
            { mode: 'output', outputRef: 'raw', pin: 4, state: 'on' },
            { mode: 'output', outputRef: 'raw', pin: 6, state: 'off' },
            { mode: 'input', inputRef: 'xmin', mode2: 'rise' },
            { mode: 'input', inputRef: 'raw', waitPin: 7, mode2: 'fall', timeout: 500 },
            { mode: 'dwell', sec: 2 },
            { mode: 'dwell', sec: 0.5 },
        ];
        const out = { registerErr, diffs: 0, first: null, registered: !!build };
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(prof);
            for (const c of combos) {
                let twin = null, err = null;
                try { twin = emitMapped(build(c)).text; } catch (e) { err = String((e && e.message) || e); }
                const concrete = emitMapped(ioStepStackResolved(c)).text;
                if (err || twin !== concrete) { out.diffs++; if (!out.first) out.first = { prof, c, err, twin, concrete }; }
            }
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    });
    if (r.registerErr) console.log('REGISTER ERROR: ' + r.registerErr);
    if (r.first) console.log('IO TWIN DIFF [' + r.first.prof + '] ' + JSON.stringify(r.first.c) + (r.first.err ? ' ERR=' + r.first.err : '') + '\n--TWIN--\n' + r.first.twin + '\n--CONCRETE--\n' + r.first.concrete);
    expect(r.registerErr, 'the twin def registers without error').toBe(null);
    expect(r.registered, 'user_io_step is registered').toBe(true);
    expect(r.diffs, 'the twin emit == ioStepStackResolved byte-identical across the sweep × Expert + V4.1 (0 diffs)').toBe(0);
});
