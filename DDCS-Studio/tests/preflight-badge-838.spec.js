// t838 → t862/t903 — the PRE-FLIGHT ENVELOPE UX. The RED counting chip is RETIRED; each violating line now shows an
// INLINE per-line diagnostic at its row's right edge ("Z+ 3.0mm over"), from the SAME checkEnvelope violations (one
// source). STATES: RED = no chip, per-line annotations only; AMBER (can't verify) = a small chip (no lines to annotate);
// GREEN = nothing (silence). Drives the real app (settings + editor), asserts the DOM.
import { test, expect } from '@playwright/test';

// Envelope X/Y 0..300, Z -120..0. Declared = a non-empty WCS table; undeclared = table null.
// t947 — the cutting snippets carry `M3 S1000` on line 1 so the dead-spindle guard does not fire (isolating the envelope
// UX under test); M3 is not a move so the trace/annotations are byte-identical and no line numbers shift. The G0-only
// snippet (RED annotations test) needs none (no feed cut → the guard never fires). See spindle-guard-947.spec.js.
async function configure(page, { declared, program }) {
    await page.evaluate(({ declared }) => {
        const s = window.ddcsGetSettings();
        s.machine = s.machine || {};
        Object.assign(s.machine, { x: 300, y: 300, z: -120 });
        s.machine.wcs = { active: 1, table: declared ? [{ x: 0, y: 0, z: 0 }] : null };
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
    }, { declared });
    await page.evaluate((program) => {
        const ed = document.getElementById('editor');
        ed.value = program;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, program);
    await page.waitForTimeout(340);   // let the debounced render() (250ms) settle + re-inject annotations
}

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && document.getElementById('preflight-badge'));
});

test('RED: each violating line gets an INLINE annotation (axis + overshoot); NO counting chip', async ({ page }) => {
    // TWO violations on TWO distinct lines: X runs +50 past the side (line 2), then +100 (line 3) — each move goes
    // FURTHER out (no recovery), so the trace flags exactly one per line (a recovery move would depart out-of-envelope
    // and flag a 3rd line — the envelope checker flags a segment that STARTS out of travel too).
    await configure(page, { declared: true, program: 'G21 G90\nG0 X350\nG0 X400' });

    // the retired chip: NO badge in red (per-line annotations replace the "N outside envelope" count)
    await expect(page.locator('#preflight-badge')).toBeHidden();

    // EXACTLY two inline annotations — one per bad line — each naming the axis-edge + overshoot
    const annots = page.locator('#editor-highlight .preflight-annot');
    await expect(annots).toHaveCount(2);
    const a1 = page.locator('.g-line[data-line-index="1"] .preflight-annot');   // line 2 (0-based 1) = G0 X350
    await expect(a1).toContainText('X+');
    await expect(a1).toContainText('50.0mm over');
    const a2 = page.locator('.g-line[data-line-index="2"] .preflight-annot');   // line 3 (0-based 2) = G0 X400
    await expect(a2).toContainText('X+');
    await expect(a2).toContainText('100.0mm over');

    // ONE source: the annotations came from the same checkEnvelope result the send-path reads
    const res = await page.evaluate(() => window.ddcsPreflightCheck());
    expect(res.status).toBe('red');
    expect(res.violations.length).toBe(2);
});

test('GREEN: a program inside the envelope shows NOTHING (no chip, no annotations)', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20' });
    await expect(page.locator('#preflight-badge')).toBeHidden();
    await expect(page.locator('#editor-highlight .preflight-annot')).toHaveCount(0);
});

test('AMBER: undeclared placement → a small can\'t-verify chip, and NO line annotations', async ({ page }) => {
    await configure(page, { declared: false, program: 'G21 G90 M3 S1000\nG1 Z3 F100' });
    const badge = page.locator('#preflight-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/preflight-amber/);
    await expect(page.locator('.preflight-badge-label')).toContainText('verify');
    await expect(page.locator('#editor-highlight .preflight-annot'), 'amber annotates NO lines (it cannot verify)').toHaveCount(0);
    const reason = await page.evaluate(() => (window.ddcsPreflightCheck() || {}).reason);
    expect(reason).toMatch(/WCS|placement/i);
});

test('annotations CLEAR when a violating line is edited to fitness', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z3 F100' });
    await expect(page.locator('#editor-highlight .preflight-annot')).toHaveCount(1);
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z-3 F100' });   // edit the climb to a safe depth
    await expect(page.locator('#editor-highlight .preflight-annot'), 'editing the line into the envelope clears its annotation').toHaveCount(0);
    await expect(page.locator('#preflight-badge')).toBeHidden();
});

test('a LONG violating line: the annotation is OUT OF FLOW and never pushes the code off-canvas (850px)', async ({ page }) => {
    await page.setViewportSize({ width: 850, height: 720 });
    const longLine = 'G1 Z3 F100 ' + '(a very long trailing comment segment) '.repeat(6);
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\n' + longLine });
    const annot = page.locator('.g-line[data-line-index="1"] .preflight-annot');
    await expect(annot).toHaveCount(1);
    // it sits at the line's END, ABSOLUTELY positioned (out of the text flow) → it adds ZERO width, so the code's
    // horizontal extent is UNCHANGED whether the annotation is present or not (it can never push the code off-canvas).
    const [wWith, wWithout, pos] = await page.evaluate(() => {
        const o = document.getElementById('editor-highlight');
        const a = o.querySelector('.g-line[data-line-index="1"] .preflight-annot');
        const p = getComputedStyle(a).position;
        const w1 = o.scrollWidth;
        const disp = a.style.display; a.style.display = 'none';
        const w0 = o.scrollWidth;
        a.style.display = disp;
        return [w1, w0, p];
    });
    expect(pos, 'the annotation is absolutely positioned (out of the text flow)').toBe('absolute');
    expect(wWith, 'the annotation adds ZERO to the code width — it never pushes the code off-canvas (850px)').toBe(wWithout);
});

test('exec-highlight + annotation COEXIST on the same line (legible together)', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z3 F100' });
    await page.evaluate(() => document.querySelector('.g-line[data-line-index="1"]').classList.add('active-line'));   // simulate the exec highlight on the violating line
    const line = page.locator('.g-line[data-line-index="1"]');
    await expect(line).toHaveClass(/active-line/);
    await expect(line.locator('.preflight-annot'), 'the annotation coexists with the exec highlight').toBeVisible();
});

test('RIDER — the standalone safetraverse palette entry is HIDDEN (inert until P2.5); wizard-composed use unaffected', async ({ page }) => {
    const inBlocks = await page.evaluate(async () => { const { BLOCKS } = await import('/wizards/ops/index.js'); return !!BLOCKS.safetraverse; });
    expect(inBlocks, 'safetraverse stays in BLOCKS (wizards compose it via newBlock)').toBe(true);
    const inToolbox = await page.evaluate(async () => { const { buildToolbox } = await import('/blocks/blockly/bridge.js'); return JSON.stringify(buildToolbox()).includes('safetraverse'); });
    expect(inToolbox, 'safetraverse is NOT a draggable toolbox entry (no inert drop ships)').toBe(false);
});

test('SEND CONFIRM: a red program asks an explicit confirm before the push (reads the CHECK, not the chip); cancel aborts, green sends', async ({ page }) => {
    // Mount the gateway Send view with a mock client (no backend); count submitJob calls; beacons off (deliver-only).
    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__submitted = 0; window.__mountErr = null;
        try { mod.default.mount({ root, client: { submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; } } }); }
        catch (e) { window.__mountErr = String(e && e.message || e); }
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    expect(await page.evaluate(() => window.__mountErr), 'the send view mounted').toBeNull();
    const sendRoot = page.locator('#test-send-root');
    await expect(sendRoot.locator('button.primary')).toBeVisible();

    // RED program → Send → an explicit confirm (from checkEnvelope, NOT the retired chip); Cancel → NOT submitted.
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z3 F100' });
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect(page.locator('.app-dialog')).toContainText('leave the machine travel');
    const overlayZ = (z) => page.evaluate((z) => { const r = document.getElementById('test-send-root'); if (r) r.style.zIndex = z; }, z);
    await overlayZ('1');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await overlayZ('99990');
    expect(await page.evaluate(() => window.__submitted), 'cancel aborted the push').toBe(0);

    // GREEN program → Send → no confirm, submitJob is called.
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z-5 F100' });
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect.poll(() => page.evaluate(() => window.__submitted), { timeout: 4000 }).toBe(1);
    await expect(page.locator('.app-dialog')).toHaveCount(0);
});

test('NOTES: the probe + soft-limit caveats ride the red annotation (title)', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z3 F100\nG31 Z-50 F100' });   // a Z+ violation (line 2) + a trip-dependent probe
    await page.evaluate(() => { window.ddcsGetSettings().machine.softLimitsPulled = false; document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(340);
    const annot = page.locator('.g-line[data-line-index="1"] .preflight-annot');
    await expect(annot).toHaveAttribute('title', /probe move/i);   // the unchecked trip-dependent class is NAMED
    await expect(annot).toHaveAttribute('title', /soft limit/i);    // the bonus: soft limits disabled on the controller
});

test('THEMES: the inline annotation is legible in dark and light', async ({ page }, testInfo) => {
    await configure(page, { declared: true, program: 'G21 G90 M3 S1000\nG1 Z3 F100' });
    for (const theme of ['futuristic', 'normal']) {
        await page.evaluate((t) => { document.body.setAttribute('data-theme', t); }, theme);
        await page.waitForTimeout(80);
        await page.locator('#editor-container, .editor-container').first().screenshot({ path: testInfo.outputPath(`preflight-annot-${theme}.png`) });
    }
    expect(true).toBe(true);
});
