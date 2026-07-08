import { test, expect } from '@playwright/test';

/**
 * Comm/MDI PORT E0 (t516) — the commStack SUPERSET gate (the alignment/rotaryClock E0 pattern). `commStack(P,{superset:true})`
 * carries the STRUCTURAL forks GUARDED — type(popup/status/input/beep/dwell) × the HMI cap × popupMode(0/1/3) × the
 * conditional slots/color/status-dwell/dest/cyc — and pruneGuards(P + the derived guard keys) must be BYTE-IDENTICAL to the
 * concrete commStack(P). Swept across BOTH an HMI post (Expert) and a NON-HMI post (V4.1). This is the twin's foundation.
 */
test('E0 GATE: prune(commStack superset) == concrete commStack byte-identical across the type × hmi × mode × conditional sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getCaps, resolveActivePost } = await import('/wizards/dialects/index.js');
        const { getActiveProfile, setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');

        // the DERIVED guard keys — the twin's deriveGuards computes the same (value-typed forks guard cleanly on these).
        const derive = (p) => {
            const caps = getCaps(resolveActivePost(getActiveProfile().id).id);
            const sm = (p.statusMode != null && p.statusMode !== '') ? Number(p.statusMode) : 1;
            return {
                _hmi: !!caps.hmi,
                _popupMode: Number(p.popupMode),
                _popupToast: !(Number(p.popupMode) === 1 || Number(p.popupMode) === 3),   // the toast "else" arm (form value -5000)
                _useColor: p.statusColor != null && Number(p.statusColor) !== -1,
                _hasStatusDwell: !!(p.statusDwell && Number(p.statusDwell) > 0 && sm !== -3000),
                _hasDest: !!(p.dest && String(p.dest).trim() !== ''),
                _hasCyc: (p.cycle != null && p.cycle !== '') ? Number(p.cycle) > 0 : false,
            };
        };
        const combos = [
            { type: 'popup', msg: 'Load part', popupMode: -5000 },   // toast — the real form value (the "else" arm)
            { type: 'popup', msg: 'OK?', popupMode: 1 },
            { type: 'popup', msg: 'A / B', popupMode: 3, slot1: 'X', slot3: 'Z' },
            { type: 'status', msg: 'Running', statusMode: 1 },
            { type: 'status', msg: 'Done', statusMode: 1, statusColor: 65280, statusDwell: 2000 },
            { type: 'status', msg: 'Persist', statusMode: -3000 },
            { type: 'input', msg: 'Depth', id: '#100' },
            { type: 'input', msg: 'Depth', id: '#100', dest: '#500' },
            { type: 'beep', val: 500 },
            { type: 'beep', val: 800, cycle: 100 },
            { type: 'dwell', val: 1000 },
        ];
        const out = { diffs: 0, first: null, leftover: 0, guardMax: 0, combos: combos.length };
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(prof);
            for (const c of combos) {
                const sup = commStack(c, { superset: true });
                out.guardMax = Math.max(out.guardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
                pruneGuards(sup, { ...c, ...derive(c) });
                if (JSON.stringify(sup).includes('"type":"guard"')) out.leftover++;
                const a = emitMapped(sup).text;
                const b = emitMapped(commStack(c)).text;
                if (a !== b) { out.diffs++; if (!out.first) { const al = a.split('\n'), bl = b.split('\n'); let i = 0; while (i < al.length && i < bl.length && al[i] === bl[i]) i++; out.first = { prof, c, line: i, a: al.slice(i, i + 3), b: bl.slice(i, i + 3) }; } }
            }
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    });
    if (r.first) console.log('E0 DIFF [' + r.first.prof + '] ' + JSON.stringify(r.first.c) + ' @line ' + r.first.line + '\n--PRUNED--\n' + (r.first.a || []).join('\n') + '\n--CONCRETE--\n' + (r.first.b || []).join('\n'));
    expect(r.guardMax, 'the superset carries the structural guard blocks').toBeGreaterThan(5);
    expect(r.leftover, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    expect(r.diffs, 'prune(superset) == concrete byte-identical across the full sweep × HMI + non-HMI posts (E0 gate; byte-diff ZERO)').toBe(0);
});
