import { test, expect } from './support/harness.mjs';

/**
 * Comm/MDI PORT 1b-ii — the user_comm_data TWIN emit == commStack byte-for-byte across the type sweep × HMI + non-HMI.
 */
test('TWIN byte-identity: user_comm_data == commStack across the type sweep × HMI + non-HMI posts', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commDataDef } = await import('/blocks/dataOps/commData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        let registerErr = null;
        try { registerUserOp(commDataDef()); } catch (e) { registerErr = String((e && e.message) || e); }
        const build = builderOf('user_comm_data');
        const combos = [
            { type: 'popup', msg: 'Load part', popupMode: -5000 },
            { type: 'popup', msg: 'Continue?', popupMode: 1 },
            { type: 'popup', msg: 'Pick', popupMode: 3, slot1: 'A', slot2: 'B', slot3: 'C', slot4: 'D' },
            { type: 'status', msg: 'Running', statusMode: 1 },
            { type: 'status', msg: 'Done', statusMode: 1, statusColor: 65280, statusDwell: 2000 },
            { type: 'input', msg: 'Enter depth', id: '#120', dest: '#500' },
            { type: 'beep', val: 800, cycle: 100 },
            { type: 'dwell', val: 1000 },
        ];
        const out = { registerErr, diffs: [], count: 0 };
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(prof);
            for (const c of combos) {
                let twin = null, err = null;
                try { twin = emitMapped(build(c)).text; } catch (e) { err = String((e && e.message) || e); }
                const builtin = emitMapped(commStack(c)).text;
                if (err || twin !== builtin) {
                    out.count++;
                    if (out.diffs.length < 3) {
                        const tl = (twin || '').split('\n'), bl = builtin.split('\n');
                        let i = 0; while (i < tl.length && i < bl.length && tl[i] === bl[i]) i++;
                        out.diffs.push({ prof, c, err, line: i, twin: tl.slice(i, i + 4), builtin: bl.slice(i, i + 4) });
                    }
                }
            }
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    });
    if (r.registerErr) console.log('REGISTER ERROR: ' + r.registerErr);
    for (const d of r.diffs) console.log('DIFF [' + d.prof + '] ' + JSON.stringify(d.c) + (d.err ? ' ERR=' + d.err : '') + ' @line ' + d.line + '\n--TWIN--\n' + (d.twin || []).join('\n') + '\n--BUILTIN--\n' + (d.builtin || []).join('\n') + '\n');
    expect(r.registerErr, 'the twin def registers without error').toBe(null);
    expect(r.count, 'the twin emit == commStack byte-identical across the sweep × HMI + non-HMI (0 diffs)').toBe(0);
});
