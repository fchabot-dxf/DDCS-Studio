import { test, expect } from '@playwright/test';

/**
 * SETUP/IO increment 2 — the grouped I/O-step wizard E1: the emit CORE. ioStepStack emits the right G-code per MODE
 * (output / input / dwell) × DECLARED-I/O vs RAW-pin × dialect, and the SUPERSET gate holds (prune == concrete).
 * Ground truth: Expert output = the DECLARED on/off M-code (RAW) or M(50+2n) raw; input = the WHILE-poll of the pin
 * (slib O10300); dwell = G04 P{ms}.
 */
test('E1 emit: ioStepStack emits correct G-code per mode × declared/raw (Expert), + Wait-Input support flag', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { ioStepStackResolved, ioInputSupported } = await import('/wizards/ioStepWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const SP = await import('/ui/settingsPanel.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        // seed a declared output (Coolant, M8/M9) + a declared input (X-min limit, pin 5)
        SP.applySettings({
            outputs: [{ id: 'coolant', type: 'custom', label: 'Coolant', pin: 3, onCode: 'M8', offCode: 'M9', group: 'io' }],
            inputs: [{ id: 'xmin', type: 'limit', axis: 'x', label: 'X min', pin: 5, level: 0, group: 'io' }],
        });
        setActiveProfile('ddcs-expert-m350');
        const emit = (p) => emitMapped(ioStepStackResolved(p)).text;
        return {
            outDeclaredOn: emit({ mode: 'output', outputRef: 'coolant', state: 'on' }),
            outDeclaredOff: emit({ mode: 'output', outputRef: 'coolant', state: 'off' }),
            outRawOn: emit({ mode: 'output', outputRef: 'raw', pin: 4, state: 'on' }),
            inDeclared: emit({ mode: 'input', inputRef: 'xmin', mode2: 'rise' }),
            inRaw: emit({ mode: 'input', inputRef: 'raw', pin: 7, mode2: 'fall' }),
            dwell: emit({ mode: 'dwell', sec: 2 }),
            inputSupportedExpert: ioInputSupported(),
        };
    });
    console.log('IO EMIT (Expert):\n' + JSON.stringify(r, null, 2));
    // output — DECLARED emits the configured M-code (dialect-independent); label as a comment
    expect(r.outDeclaredOn).toContain('M8');
    expect(r.outDeclaredOn.toLowerCase()).toContain('coolant');
    expect(r.outDeclaredOff).toContain('M9');
    // output — RAW pin 4 → DDCS Expert M(50+2*4)=M58 (on)
    expect(r.outRawOn).toContain('M58');
    // input — DECLARED polls the declared pin 5 via the Expert WHILE-poll (slib O10300)
    expect(r.inDeclared).toContain('#[1520+5]');
    expect(r.inDeclared.toLowerCase()).toContain('x min');
    // input — RAW pin 7 → the WHILE-poll of pin 7
    expect(r.inRaw).toContain('#[1520+7]');
    // dwell — G04 P{ms} (Expert P is ms → 2 s = 2000)
    expect(r.dwell).toContain('G04 P2000');
    expect(r.inputSupportedExpert, 'Wait-Input is supported on Expert (inputRead)').toBe(true);
});

test('E1 superset GATE: prune(ioStepStack superset) == concrete across the mode × declared/raw sweep (Expert + V4.1)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { ioStepStack, resolveIoParams } = await import('/wizards/ioStepWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const SP = await import('/ui/settingsPanel.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        SP.applySettings({
            outputs: [{ id: 'coolant', type: 'custom', label: 'Coolant', pin: 3, onCode: 'M8', offCode: 'M9', group: 'io' }],
            inputs: [{ id: 'xmin', type: 'limit', axis: 'x', label: 'X min', pin: 5, level: 0, group: 'io' }],
        });
        // the twin's deriveGuards computes the same keys off the RESOLVED params
        const derive = (rp) => ({ _mode: rp.mode || 'output', _outDeclared: !!rp.outDeclared, _inDeclared: !!rp.inDeclared });
        const combos = [
            { mode: 'output', outputRef: 'coolant', state: 'on' },
            { mode: 'output', outputRef: 'coolant', state: 'off' },
            { mode: 'output', outputRef: 'raw', pin: 4, state: 'on' },
            { mode: 'output', outputRef: 'raw', pin: 6, state: 'off' },
            { mode: 'input', inputRef: 'xmin', mode2: 'rise' },
            { mode: 'input', inputRef: 'raw', pin: 7, mode2: 'fall', timeout: 500 },
            { mode: 'dwell', sec: 2 },
            { mode: 'dwell', sec: 0.5 },
        ];
        const out = { diffs: 0, first: null, leftover: 0, guardMax: 0 };
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(prof);
            for (const c of combos) {
                const rp = resolveIoParams(c);
                const sup = ioStepStack(rp, { superset: true });
                out.guardMax = Math.max(out.guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
                pruneGuards(sup, { ...rp, ...derive(rp) });
                if (JSON.stringify(sup).includes('"type":"guard"')) out.leftover++;
                const a = emitMapped(sup).text, b = emitMapped(ioStepStack(rp)).text;
                if (a !== b) { out.diffs++; if (!out.first) out.first = { prof, c, a, b }; }
            }
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    });
    if (r.first) console.log('IO E0 DIFF [' + r.first.prof + '] ' + JSON.stringify(r.first.c) + '\n--PRUNED--\n' + r.first.a + '\n--CONCRETE--\n' + r.first.b);
    expect(r.guardMax, 'the superset carries the mode + declared/raw guard blocks').toBeGreaterThan(3);
    expect(r.leftover, 'prune leaves ZERO guard blocks').toBe(0);
    expect(r.diffs, 'prune(superset) == concrete byte-identical across the sweep × Expert + V4.1').toBe(0);
});
