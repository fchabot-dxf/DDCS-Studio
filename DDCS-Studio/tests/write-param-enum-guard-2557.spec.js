import { test, expect } from '@playwright/test';

/**
 * t2557 — `_writeParam` (panelTypes.js) used to round EVERY handle write through `r3()` — `Math.round(n*1000)/1000`
 * — unconditionally, with no type check. Every gesture built so far (length/point/rect/radial/scaleX/shear/
 * projLength) only ever writes numbers, so this never fired. `probeVector` (canvasWidgets.js:169) is the FIRST
 * declared gesture whose drag() writes ENUM STRINGS (`fieldAxis: 'X'|'Y'`, `fieldDir: 'pos'|'neg'`) alongside a
 * number (`field: dist`) — canvasWidgets.js:168's own comment already flagged this verbatim ("axis/dir are
 * STRINGS — the view's setFields must pass enums through, not round them like a number"), left unbuilt by a
 * prior turn rather than wired unsafely. `r3('X')` = `Math.round(NaN)/1000` = `NaN` → the field would be set to
 * the STRING `"NaN"`, matching no `<option>`. Fixed with a one-line type guard: `typeof val === 'number' ?
 * r3(val) : val`. This is a latent bug in a path every one of the 7 shipped gestures shares (t1806's own test
 * above exercises the SAME `_writeParam`/`setFields` machinery for numeric writes) — not probeVector-specific,
 * just never triggered before probeVector's own enum outputs existed.
 *
 * Mirrors t1806's own synthetic-host pattern (same file, above): a hand-built `def.bindings` (no full op-
 * registration/block round-trip needed — this tests the panelTypes.js render+write layer directly), a
 * synthetic DOM host with real `<select>`/`<input>` fields, `layoutSpecFromOp`'s real `onDrag` fired with a
 * world position that drives probeVector's own cardinal-snap logic (canvasWidgets.js:175-182).
 */

test('t2557: probeVector\'s drag writes STRING axis/dir fields correctly (would corrupt to "NaN" without the guard)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const r = await page.evaluate(async () => {
        const PT = await import('/wizards/ops/panelTypes.js');
        const def = {
            opType: 't2557_probe_synth',
            bindings: [
                { param: 'ax', blockIndex: 0, key: 'axis', type: 'enum', group: 'pv', role: 'axis', anchor: { kind: 'probeVector', cx: 0, cy: 0, minR: 0, maxR: 200, label: 'probe' } },
                { param: 'dr', blockIndex: 0, key: 'dir', type: 'enum', group: 'pv', role: 'dir' },
                { param: 'ds', blockIndex: 0, key: 'dist', type: 'number', group: 'pv', role: 'dist' },
            ],
        };
        const host = document.createElement('div'); host.id = 'test_2557_host';
        const axSel = document.createElement('select'); axSel.dataset.param = 'ax';
        axSel.innerHTML = '<option value="X">X</option><option value="Y">Y</option>'; axSel.value = 'X';
        const drSel = document.createElement('select'); drSel.dataset.param = 'dr';
        drSel.innerHTML = '<option value="pos">pos</option><option value="neg">neg</option>'; drSel.value = 'pos';
        const dsInp = document.createElement('input'); dsInp.dataset.param = 'ds'; dsInp.value = '20';
        host.append(axSel, drSel, dsInp); document.body.appendChild(host);

        try {
            PT.setFormHost(() => document.getElementById('test_2557_host'));
            const spec = PT.layoutSpecFromOp(def, { ax: 'X', dr: 'pos', ds: 20 });
            const h = (spec.handles || []).find((h) => h.id && h.id.endsWith('_probe'));
            if (!h) return { error: 'no probeVector handle built', handles: spec.handles };
            // Drag to world (0, 30): |dy| > |dx| -> axis should resolve to 'Y'; dy >= 0 -> dir 'pos'.
            spec.onDrag(h.id, { x: 0, y: 30 });
            return { axisAfter: axSel.value, dirAfter: drSel.value, distAfter: dsInp.value };
        } finally {
            host.remove();
        }
    });

    expect(r.error, r.error).toBeUndefined();
    expect(r.axisAfter, 'axis field must resolve to the STRING "Y", never "NaN"').toBe('Y');
    expect(r.dirAfter, 'dir field must resolve to the STRING "pos", never "NaN"').toBe('pos');
    expect(Number(r.distAfter), 'the numeric dist field is unaffected — still rounds correctly').toBeCloseTo(30, 1);
});
