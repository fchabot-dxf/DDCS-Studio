import { test, expect } from '@playwright/test';

/**
 * t1385 — THE SWITCH, SEEN. Four screenshots the dispatch asks for, each driving the REAL app rather than a harness.
 *
 * The reason these are a gate item and not decoration: every other assert in this turn reads text or traced segments, and
 * the drill family's whole point is a wizard a person operates. A switch can be byte-correct in every bridge and still
 * ship a form with a blank field or a Blocks canvas that will not render the new block — neither of which any equivalence
 * test can see. These four are the surfaces where that would show.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const SHOTS = 'test-results/t1385-shots';

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** 1 + 2 — THE WIZARD EMIT: the drill form open, and the G-code it now produces (a bolt circle, so the pattern loop shows). */
test('SHOT 1 — the wizard emit: a bolt circle, its form and its parametric G-code', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const text = emitMapped(drillStack({ pattern: 'circle', dia: 100, count: 8, depth: 12, peck: 3, feed: 120 })).text;
        // Put it in the editor, which is the surface a user reads it in.
        const ed = document.querySelector('#gcodeEditor, .gcode-editor, textarea');
        if (ed) { ed.value = text; ed.dispatchEvent(new Event('input', { bubbles: true })); }
        return { text, lines: text.split('\n').length, hasLoop: /WHILE \[#89 < 8\] DO1/.test(text), work: (text.match(/@work (\d+)/) || [])[1] };
    });
    // The claims the picture is evidence FOR, asserted so the shot cannot pass while the thing it shows is broken.
    expect(r.hasLoop, 'the emitted program walks 8 holes in a macro loop').toBe(true);
    expect(r.work, 'and declares its expected work, so the preview can tell the truth about truncation').toBeTruthy();
    expect(r.lines, 'a bolt-8 peck drill is now a SHORT program — the fold, visible as a number').toBeLessThan(45);
    await page.screenshot({ path: `${SHOTS}/1-wizard-emit.png`, fullPage: false });
});

/** 3 — THE BLOCKS BLOCK: the folded atom must actually RENDER on the Blockly canvas, with its fields. */
test('SHOT 2 — the Blocks canvas renders the folded holecycle block', async ({ page }) => {
    await boot(page);
    const tab = page.locator('[data-tab="blocks"], button:has-text("Blocks")').first();
    if (await tab.count()) await tab.click();
    await page.waitForFunction(() => window.Blockly && Blockly.getMainWorkspace(), null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const stack = drillStack({ pattern: 'circle', dia: 100, count: 8, depth: 12, peck: 3, feed: 120 });
        SB.stackToWorkspace(stack, ws);
        const all = ws.getAllBlocks(false);
        const hc = all.filter((b) => b.type === 'holecycle');
        // RENDERED, not merely present: a block that failed to render has no size (the blockly-skill's own trap).
        const sized = hc.filter((b) => { try { const s = b.getHeightWidth(); return s.height > 0 && s.width > 0; } catch (_) { return false; } });
        return {
            total: all.length, holecycle: hc.length, sized: sized.length,
            fields: hc.length ? hc[0].inputList.flatMap((i) => i.fieldRow.map((f) => f.name)).filter(Boolean) : [],
            noArray: !all.some((b) => b.type === 'array'),
            // The block's editable surface is TWO things in this codebase, and counting only one of them measures the
            // wrong property (a first cut here asserted "> 3 fields" and read 3, while the block was fully populated):
            //   named FIELDS  — the enum/text controls rendered inline (pattern, cycle, skip)
            //   value INPUTS  — every numeric param, each a math_number shadow socket (devMode's "exposable" sockets)
            valueInputs: hc.length ? hc[0].inputList.filter((i) => i.connection).map((i) => i.name).filter(Boolean) : [],
        };
    });
    expect(r.holecycle, 'the folded atom is on the canvas').toBe(1);
    expect(r.sized, 'and it RENDERED — a non-rendering block has zero size, which no emit test would catch').toBe(1);
    expect(r.noArray, 'and there is no array container any more').toBe(true);
    // The two folded knobs must both be REACHABLE on the canvas, or the Blocks view is not a real editor of this op.
    expect(r.fields, 'the pattern selector renders as a field').toContain('PATTERN');
    expect(r.fields, 'and so does the CYCLE knob the fold created').toContain('CYCLE');
    expect(r.valueInputs.length, 'and every numeric param has its own value socket').toBeGreaterThan(20);
    for (const k of ['DEPTH', 'PECK', 'FEED', 'DIA', 'COUNT']) {
        expect(r.valueInputs, `${k} is editable on the canvas — the merged block carries BOTH halves' knobs`).toContain(k);
    }
    // ⚠ AND THE BLOCKS-TAB PREVIEW MUST ACTUALLY DRAW IT. The first screenshot of this test showed "No drawable moves"
    // beside a perfectly projected parametric body, which is either a screenshot taken before the preview refreshed or a
    // real regression in the surface a user builds ops in. Not a difference worth guessing at, so it is asserted: give the
    // preview its refresh, then require a drawn path. (SHOT 3 proves the PANEL traces this family; this proves the TAB does.)
    await page.waitForFunction(() => {
        const s = document.querySelector('#blocksPane .pp-status, .blocks-preview .pp-status, .pp-status');
        return s && /\d+\s+cuts/.test(s.textContent || '');
    }, null, { timeout: 15000 });
    const drawn = await page.evaluate(() => {
        const s = document.querySelector('#blocksPane .pp-status, .blocks-preview .pp-status, .pp-status');
        return s ? s.textContent.trim() : null;
    });
    expect(drawn, 'the Blocks-tab preview draws the parametric path, and reports its real move counts').toMatch(/\d+ cuts/);
    await page.screenshot({ path: `${SHOTS}/2-blocks-block.png`, fullPage: false });
});

/** 4 — A BOLT CIRCLE MID-PLAY: the preview drawing the WHOLE path, which is what the t1383 trace-cap work bought. */
test('SHOT 3 — a bolt circle mid-play: the whole path drawn, and the preview says nothing was truncated', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // A HELICAL BORE on a 24-hole bolt circle — the exact config t1381 measured as truncating at a twelfth.
        const text = emitMapped(drillStack({ method: 'helical', ramp: 'helix', pattern: 'circle', dia: 100, count: 24, holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120 })).text;
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;width:1400px;height:900px;z-index:99999;background:var(--bg,#111)';
        document.body.appendChild(host);
        const panel = createPreviewPanel(host, { getGcode: () => text });
        panel.setGcode(text);
        await new Promise((res) => setTimeout(res, 1200));
        const st = host.querySelector('.pp-status');
        return { status: st ? st.textContent : null, isError: st ? st.classList.contains('has-error') : null, lines: text.split('\n').length };
    });
    // THE PAYOFF, asserted: this is the config that used to draw a twelfth of its path in silence.
    expect(r.status, 'the preview reports real move counts, not a truncation').not.toMatch(/truncated/i);
    expect(r.isError, 'and is not in the error state').toBe(false);
    expect(r.status, 'a helical bore on 24 holes really does cut a lot').toMatch(/\d+ cuts/);
    expect(r.lines, 'from a program of well under a hundred lines — the literal was ~11700').toBeLessThan(100);
    await page.screenshot({ path: `${SHOTS}/3-boltcircle-midplay.png`, fullPage: false });
});

/** 5 — THE CAM PENDANT TABLE: the drill op's exposable/baked knobs as the CAM modal shows them. */
test('SHOT 4 — the CAM pendant knob table for the switched drill op', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
        const c = classifyExposable(drillDataDef());
        const rows = Object.entries(c).map(([param, v]) => ({ param, exposable: v.exposable, role: v.role, reason: v.reason }));
        // Render the declared table into the page so the screenshot shows the REASONS, which is the reviewable part.
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0e1116;color:#dfe6ee;font:12px/1.5 ui-monospace,monospace;padding:18px;overflow:auto';
        host.innerHTML = '<h2 style="font:600 15px system-ui;margin:0 0 10px">t1385 — CAM pendant knobs, drill op (post-switch)</h2>'
            + '<table style="border-collapse:collapse;width:100%"><tr style="text-align:left;color:#8fa3b8"><th>param</th><th>role</th><th>mode</th><th>why</th></tr>'
            + rows.map((x) => `<tr style="border-top:1px solid #232a33"><td style="padding:3px 8px">${x.param}</td><td style="padding:3px 8px">${x.role}</td>`
                + `<td style="padding:3px 8px;color:${x.exposable ? '#7ee081' : '#e0b97e'}">${x.exposable ? 'EXPOSE' : 'bake'}</td>`
                + `<td style="padding:3px 8px;color:#8fa3b8">${x.reason}</td></tr>`).join('') + '</table>';
        document.body.appendChild(host);
        return { rows, n: rows.length, feedRole: (c.feed || {}).role };
    });
    expect(r.n, 'every bound param is classified — the table is complete, not a sample').toBeGreaterThan(25);
    // The row this turn declared: feed is a VALUE (it rides val()), which is what repairs the accidental de-classification
    // an unlisted atom would have caused. It is still baked, and the table shows the reason (the place fold) rather than
    // hiding it — that remaining block is a measured finding, flagged for a ruling, not a silent gap.
    expect(r.feedRole, 'feed is declared a value role — the regression an unlisted atom would have caused is repaired').toBe('value');
    await page.screenshot({ path: `${SHOTS}/4-cam-knob-table.png`, fullPage: false });
});
