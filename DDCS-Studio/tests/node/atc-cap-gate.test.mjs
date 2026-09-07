import { test, expect } from './support/harness.mjs';

/**
 * ATC CAP GATE + probe-miss (t640). Three fixes: (1) the ATC pneumatic/drawbar M-codes DECLARE cap:'atc' → they fold to a
 * comment on a non-ATC post (V4.1/DM500) instead of leaking Expert-only pneumatics; (2) applyLineSuppression's blanket cap-ON
 * early-return is closed so the declared-cap gate runs on #vars+flow posts (it slipped straight through before); (3) the
 * tool-setter probes (atcLength/atcToolCheck) carry the DRO-compare miss-check (a missed setter = a WRONG tool offset).
 * Expert is byte-identical throughout (caps.atc=true → the gate is a no-op there).
 */
test('V4.1 folds the ATC pneumatic M-codes; Expert emits them; the tool-setter probes carry the miss-check', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestStack } = await import('/wizards/atcTestWizard.js');
        const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
        const { atcLengthStack } = await import('/wizards/atcLengthWizard.js');
        const { atcToolCheckStack } = await import('/wizards/atcToolCheckWizard.js');
        const { emitMapped, newBlock } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const em = (stack, id) => emitMapped(stack, { dialect: getDialect(id) }).text;
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41']) {
            out['test_' + id] = em(atcTestStack({ mode: 'drawbar' }), id);
            out['change_' + id] = em(atcChangeStack({ method: 'firmware', callMacro: false }), id);
            out['length_' + id] = em(atcLengthStack({}), id);
            out['check_' + id] = em(atcToolCheckStack({}), id);
        }
        // the applyLineSuppression "slipped through the early return" case: a #var line (→ the OLD early-return fired on a vars+flow
        // post) FOLLOWED by a cap:'atc' M-code. Before t640 the early-return skipped gating → M154 leaked onto V4.1.
        const mk = (t, extra) => { const b = newBlock(t); b.params = { ...b.params, ...extra }; return b; };
        const capStack = [mk('assign', { var: '#1', value: '1', note: 'a var line' }), mk('mcode', { code: 154, note: 'drawbar', cap: 'atc' })];
        out.cap_expert = em(capStack, 'ddcs-expert-m350');
        out.cap_v41 = em(capStack, 'ddcs-v41');
        return out;
    });

    // ── atcTest drawbar: Expert emits the pneumatics; V4.1 folds every one to a `( gated: … )` comment (no bare executable M-code) ──
    for (const M of ['M154', 'M155', 'M300', 'M301', 'M302']) {
        expect(r['test_ddcs-expert-m350'], `Expert emits the pneumatic ${M}`).toMatch(new RegExp('^' + M + '\\b', 'm'));
        expect(r['test_ddcs-v41'], `V4.1 does NOT emit a bare executable ${M}`).not.toMatch(new RegExp('^' + M + '\\b', 'm'));
        expect(r['test_ddcs-v41'], `V4.1 folds ${M} to a gated comment`).toContain(`( gated: ${M}`);
    }
    // ── atcChange firmware push dance: the pneumatic cylinders/vacuum/dust (M15x/M16x) + M19 fold on V4.1 ──
    for (const M of ['M159', 'M157', 'M160', 'M163', 'M156', 'M161']) {
        expect(r['change_ddcs-expert-m350'], `Expert emits ${M}`).toMatch(new RegExp('^' + M + '\\b', 'm'));
        expect(r['change_ddcs-v41'], `V4.1 folds ${M}`).not.toMatch(new RegExp('^' + M + '\\b', 'm'));
    }

    // ── the applyLineSuppression fix: a cap:'atc' line on a vars+flow post (V4.1) — previously slipped the early-return — is now gated ──
    expect(r.cap_expert, 'Expert (caps.atc=true) emits the cap:atc M154 unchanged').toMatch(/^M154\b/m);
    expect(r.cap_expert, 'Expert still runs the #var line (no gating)').toContain('#1=1');
    expect(r.cap_v41, 'V4.1 gates the cap:atc M154 even though it runs #vars + flow (early-return closed)').toContain('( gated: M154');
    expect(r.cap_v41, 'V4.1 keeps the #var line (that cap is fine)').toContain('#1=1');

    // ── Part 3: the tool-setter probes carry the miss-check on V4.1 (capture + dir-'-' DRO-compare); Expert keeps #192x ──
    for (const w of ['length', 'check']) {
        expect(r[w + '_ddcs-v41'], `${w}: V4.1 captures the pre-probe DRO (#190=#15xx)`).toMatch(/#190=#15\d\d/);
        expect(r[w + '_ddcs-v41'], `${w}: V4.1 DRO-compare branches on a miss (dir '-')`).toMatch(/IF #15\d\d<=\[#190\+#7\+0\.05\]GOTO\d+/);
        expect(r[w + '_ddcs-expert-m350'], `${w}: Expert keeps its per-axis #192x status check (Z=#1922)`).toMatch(/IF #192\d!=2 GOTO/);
        expect(r[w + '_ddcs-expert-m350'], `${w}: Expert emits NO probestart capture`).not.toContain('#190=');
    }
});
