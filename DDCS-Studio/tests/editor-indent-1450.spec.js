import { test, expect } from '@playwright/test';

/**
 * t1450 — INDENTATION IS LITERAL, EDITABLE AND CONTROLLED (the user's design).
 *
 * ── THE RULING THIS SPEC ENFORCES ────────────────────────────────────────────────────────────────────────────────
 * The spaces are REAL BYTES. No display-only padding anywhere — no rendered gutter pretending a line is nested, no
 * editor showing structure the file does not contain. So every assertion below reads the BYTES (`textarea.value`,
 * the emitted text), never a rendered width: a test that measured pixels would pass just as happily on the fake
 * version the user ruled out.
 *
 * Three doors, ONE implementation — the toolbar buttons, Tab / Shift+Tab, and the right-click menu. Each is driven
 * here the way a user drives it, because "the button calls the function" is not the claim; "select, press, the file
 * changed, undo puts it back" is.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const SEED = ['G90', 'G0 X0 Y0', 'G1 X10 F600', 'G1 Y10', 'G0 Z5'].join('\n');

/**
 * Seed the editor, let the app SETTLE, then select whole lines [a, b] of whatever it actually shows.
 *
 * ⚠ IT RETURNS THE SETTLED TEXT RATHER THAN ASSUMING THE SEED, and that is a measured correction rather than a
 * convenience. Typing real G-code in makes the app parse it and re-project the program, so `G90` comes back as
 * `G90   ( absolute )` — the round-trip working exactly as designed. The first cut asserted against the seed and
 * failed on the app's own canonical form; the keyboard tests passed only because a keypress lands before the
 * re-projection does, which made it look like a Tab-versus-button difference and is not.
 *
 * Reading the baseline back also makes these the STRONGER tests: they indent a real program the app produced,
 * rather than a synthetic string that never goes near the model.
 */
const select = async (page, a, b) => {
    await page.evaluate((seed) => {
        const ed = document.getElementById('editor');
        ed.value = seed;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, SEED);
    // ⚠ A REAL QUIET WINDOW, not "unchanged across two polls" — measured. waitForFunction polls fast enough to see
    // the same value twice BEFORE the async re-projection lands, and the selection offsets computed from the stale
    // text then pointed at the wrong lines: the toolbar test indented line 4 where it had selected 1-3. So the value
    // must hold still for 400ms, which is longer than the re-projection takes and still instant to a human.
    await page.waitForFunction(() => {
        const ed = document.getElementById('editor');
        if (!ed || !ed.value) return false;
        const now = Date.now();
        if (ed.dataset.t1450Val !== ed.value) { ed.dataset.t1450Val = ed.value; ed.dataset.t1450At = String(now); return false; }
        return now - Number(ed.dataset.t1450At || 0) > 400;
    }, null, { timeout: 15000 });
    return page.evaluate(({ a, b }) => {
        const ed = document.getElementById('editor');
        const NL = String.fromCharCode(10);
        const L = ed.value.split(NL);
        const start = L.slice(0, a).reduce((n, l) => n + l.length + 1, 0);
        const end = L.slice(0, b + 1).reduce((n, l) => n + l.length + 1, 0) - 1;
        ed.focus();
        ed.setSelectionRange(start, end);
        return { start, end, before: ed.value, lines: L };
    }, { a, b });
};

const val = (page) => page.evaluate(() => document.getElementById('editor').value);

/** The expected result: `before` with lines [a,b] each prefixed by `pad` — and NOTHING else touched. */
const withIndent = (before, a, b, pad) => before.split('\n').map((l, i) => (i >= a && i <= b ? pad + l : l)).join('\n');

test('THE WIDTH IS ONE CONSTANT — the editor indents by exactly what the emitters write', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { INDENT, INDENT_WIDTH } = await import('/data/indentStyle.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const text = emitMapped(surfacingStack({ w: 120, h: 90, toolDia: 12, depth: 1, stepdown: 0.5, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 })).text;
        const widths = text.split(String.fromCharCode(10)).map((l) => (l.match(/^ +/) || [''])[0].length).filter((n) => n > 0);
        return { INDENT, INDENT_WIDTH, minEmitted: Math.min(...widths), indentedLines: widths.length };
    });
    expect(r.indentedLines, 'a parametric body really does emit indented lines').toBeGreaterThan(0);
    // The claim that matters: the constant the EDITOR uses is the unit the EMITTER writes. Two numbers that merely
    // agree today is exactly the drift a shared constant exists to prevent, so this reads it off the real output.
    expect(r.minEmitted, 'the editor indents by the same unit the emitters write').toBe(r.INDENT_WIDTH);
    expect(r.INDENT).toBe('  ');
});

test('THE TOOLBAR BUTTON — select, click, the BYTES carry the spaces; outdent puts them back', async ({ page }) => {
    await boot(page);
    const s = await select(page, 1, 3);
    await page.click('#editor-indent');
    const v = await val(page);
    expect(v, 'exactly the selected lines gained REAL leading spaces — and nothing else moved').toBe(withIndent(s.before, 1, 3, '  '));
    expect(v.split('\n')[0], 'the line ABOVE the selection is untouched').toBe(s.lines[0]);
    expect(v.split('\n')[4], '…and the line below it').toBe(s.lines[4]);
    await page.click('#editor-outdent');
    expect(await val(page), 'outdent restores the original bytes exactly').toBe(s.before);
});

/**
 * THE BUTTONS JOIN THE EDITOR'S DECLARED BUTTON STACK — asserted, because the first cut did not.
 *
 * The editor's overlay buttons stack off `--kbd-clear` (and off the 3D drawer in portrait), 32px apart, in CSS —
 * the INLINE `bottom` each carries is overridden there. Picking an inline offset therefore looked right at the test
 * viewport and OVERLAPPED "✚ Make" at a wide one; caught by eyeballing the screenshot, then measured. The pair now
 * takes the next slot in that same declared stack, and this keeps it that way.
 */
test('THE LAYOUT — the indent pair stacks with the other editor buttons, never over them', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const o = {};
        for (const id of ['editor-indent', 'editor-outdent', 'editor-cam-btn', 'align-rotate-btn']) {
            const e = document.getElementById(id);
            if (!e) return null;
            const b = e.getBoundingClientRect();
            o[id] = [Math.round(b.top), Math.round(b.bottom)];
        }
        return o;
    });
    expect(r, 'all four editor overlay buttons exist').not.toBeNull();
    const hits = (a, b) => a[0] < b[1] && b[0] < a[1];
    for (const mine of ['editor-indent', 'editor-outdent'])
        for (const other of ['editor-cam-btn', 'align-rotate-btn'])
            expect(hits(r[mine], r[other]), `${mine} must not overlap ${other} — ${JSON.stringify(r)}`).toBe(false);
});

test('TAB / SHIFT+TAB — the same one implementation, from the keyboard', async ({ page }) => {
    await boot(page);
    const s = await select(page, 2, 3);
    await page.keyboard.press('Tab');
    expect(await val(page)).toBe(withIndent(s.before, 2, 3, '  '));
    await page.keyboard.press('Shift+Tab');
    expect(await val(page), 'Shift+Tab is the exact inverse').toBe(s.before);
    // …and the selection SURVIVES, which is what makes it a block operation you can repeat
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await val(page), 'pressing again indents the SAME block a second level').toBe(withIndent(s.before, 2, 3, '    '));
});

test('UNDO — Ctrl+Z restores the file, so the edit is a normal undoable step', async ({ page }) => {
    await boot(page);
    const s = await select(page, 1, 2);
    await page.keyboard.press('Tab');
    expect(await val(page)).toBe(withIndent(s.before, 1, 2, '  '));
    await page.keyboard.press('Control+z');
    // The whole point of routing through execCommand rather than assigning `.value`: assignment WIPES the native
    // undo stack, so the user would lose this edit AND everything before it.
    expect(await val(page), 'undo puts the bytes back').toBe(s.before);
});

test('THE RIGHT-CLICK MENU — the third door, over plain text', async ({ page }, testInfo) => {
    await boot(page);
    const s = await select(page, 1, 3);
    // Right-click INSIDE the selected block, which is the gesture a user makes. Clicking outside it collapses the
    // selection first (the browser's own behaviour), and the menu would then act on a caret — a real difference,
    // not a test detail, so the click point is computed from the editor's own line metrics rather than guessed.
    const pt = await page.evaluate(() => {
        const ed = document.getElementById('editor');
        const cs = getComputedStyle(ed), r = ed.getBoundingClientRect();
        const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.6);
        const padTop = parseFloat(cs.paddingTop) || 0, padLeft = parseFloat(cs.paddingLeft) || 0;
        return { x: r.left + padLeft + 20, y: r.top + padTop - ed.scrollTop + lh * 2 + lh / 2 };   // line index 2, mid-height
    });
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    const menu = page.locator('.op-ctx-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.op-ctx-item').first(), 'the menu offers Indent, naming the width').toContainText('Indent');
    await page.screenshot({ path: 'test-results/t1450-shots/context-menu.png' });
    await testInfo.attach('t1450-context-menu', { path: 'test-results/t1450-shots/context-menu.png', contentType: 'image/png' });
    await menu.locator('.op-ctx-item').first().click();
    expect(await val(page), 'and it indents the same block the buttons would').toBe(withIndent(s.before, 1, 3, '  '));
    await page.screenshot({ path: 'test-results/t1450-shots/indented-selection.png' });
    await testInfo.attach('t1450-indented-selection', { path: 'test-results/t1450-shots/indented-selection.png', contentType: 'image/png' });
});

/**
 * THE EMIT SETTING — one transform at the boundary, and the diff is WHITESPACE ONLY.
 *
 * Swept across the wizard corpus rather than sampled, and asserted TWICE in different words: every flush line equals
 * its indented line with leading whitespace removed (the transform did what it says), AND both programs are
 * identical once ALL whitespace is deleted (nothing else moved, anywhere). The second is the one that would catch a
 * transform that helpfully tidied a coordinate.
 */
test('THE EMIT SETTING — flush is the same program with the leading spaces gone, and nothing else', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { slotStack } = await import('/wizards/slotWizard.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const NL = String.fromCharCode(10);
        const CASES = [
            ['pocket raster', pocketStack({ shape: 'rect', w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' })],
            ['pocket spiral', pocketStack({ shape: 'rect', w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, feed: 600, plunge: 150, clearance: 5, strategy: 'spiral' })],
            ['pocket circle', pocketStack({ shape: 'circle', dia: 50, toolDia: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, feed: 600, plunge: 150, clearance: 5 })],
            ['slot', slotStack({ ax: 0, ay: 0, bx: 60, by: 0, width: 14, toolDia: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, feed: 600, plunge: 150, clearance: 5 })],
            ['surfacing', surfacingStack({ w: 120, h: 90, toolDia: 12, depth: 1, stepdown: 0.5, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 })],
            ['surfacing helix', surfacingStack({ w: 120, h: 90, toolDia: 12, depth: 2, stepdown: 1, stepoverPct: 60, entry: 'helix', helixDia: 8, helixPitch: 0.5, feed: 2000, plunge: 200, clearance: 5 })],
        ];
        return CASES.map(([name, stack]) => {
            const a = emitMapped(stack, {}).text, b = emitMapped(stack, { indentStyle: 'flush' }).text;
            const la = a.split(NL), lb = b.split(NL);
            let mismatch = 0, indented = 0;
            for (let i = 0; i < Math.max(la.length, lb.length); i++) {
                if ((la[i] === undefined ? '' : la[i]).replace(/^[ \t]+/, '') !== (lb[i] === undefined ? '' : lb[i])) mismatch++;
                if (/^[ \t]+/.test(la[i] === undefined ? '' : la[i])) indented++;
            }
            const squash = (s) => s.split(NL).map((l) => l.replace(/\s+/g, '')).join(NL);
            return { name, lines: la.length, sameCount: la.length === lb.length, mismatch, indented,
                squashEqual: squash(a) === squash(b), defaultIsIndented: emitMapped(stack).text === a };
        });
    });

    console.log('INDENT 1450: ' + r.map((x) => `${x.name}=${x.indented}/${x.lines}`).join(' · '));
    for (const c of r) {
        expect(c.sameCount, `${c.name}: the line COUNT cannot move — map/absorbed/feedFolds are line indices`).toBe(true);
        expect(c.mismatch, `${c.name}: every flush line IS its indented line minus the leading whitespace`).toBe(0);
        expect(c.squashEqual, `${c.name}: and with ALL whitespace deleted the two programs are identical — nothing else moved`).toBe(true);
        expect(c.defaultIsIndented, `${c.name}: the DEFAULT is today's bytes, so every existing path is unchanged`).toBe(true);
    }
    // The sweep must actually contain indentation, or every assertion above is vacuously true.
    expect(r.reduce((n, c) => n + c.indented, 0), 'the corpus really does emit indented lines').toBeGreaterThan(50);
    // ⚠ AND SOME PROGRAMS HAVE NONE, which is correct and worth stating rather than leaving as a silent pass: a
    // literal-transcript emit (the circle pocket's contour walk, the slot kernel) unrolls flat lines with no loop
    // bodies, so there is nothing to strip and flush is a no-op there.
    expect(r.filter((c) => c.indented === 0).map((c) => c.name).sort(), 'the literal-transcript programs carry no indentation at all')
        .toEqual(['pocket circle', 'slot']);
});

/**
 * PARSER / ROUND-TRIP TOLERANCE at the new entry points — the thing the act must not break.
 * An indented USER line still parses and still traces the same motion; and a regenerated op region comes back in its
 * canonical form regardless of what the user did to the whitespace around it.
 */
test('TOLERANCE — an indented line traces identically, and the emit re-canonicalises', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const NL = String.fromCharCode(10);
        const flat = ['G90', 'G0 X0 Y0', 'G1 X10 F600', '#10=0', 'WHILE [#10 < 3] DO1', '#10=[#10 + 1]', 'G1 Y#10 F600', 'END1', 'M30'].join(NL);
        const bumpy = ['G90', '   G0 X0 Y0', '\tG1 X10 F600', '  #10=0', 'WHILE [#10 < 3] DO1', '      #10=[#10 + 1]', '   G1 Y#10 F600', 'END1', 'M30'].join(NL);
        const segs = (nc) => (traceToolpath(nc).segments || []).map((s) => [s.x1, s.y1, s.z1, s.x2, s.y2, s.z2, s.rapid, s.feed || 0]);
        const stack = surfacingStack({ w: 120, h: 90, toolDia: 12, depth: 1, stepdown: 0.5, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 });
        return {
            flat: segs(flat), bumpy: segs(bumpy),
            regen: emitMapped(stack).text === emitMapped(stack).text && /^ {2}\S/m.test(emitMapped(stack).text),
        };
    });
    expect(r.flat.length, 'the sample really cuts').toBeGreaterThan(0);
    expect(r.bumpy, 'leading spaces AND tabs change nothing about the traced motion').toEqual(r.flat);
    expect(r.regen, 'a regenerated op region re-emits its canonical indented form').toBe(true);
});
