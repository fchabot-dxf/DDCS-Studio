import { test, expect } from '@playwright/test';

/**
 * t1444 — A TOOL THAT CANNOT FIT THE FEATURE CUTS NOTHING, AND SAYS SO. The user's ruling, on every surface.
 *
 * ── THE RULING, IN THE USER'S WORDS ──────────────────────────────────────────────────────────────────────────────
 *   *"if we set a slot or pocket to .25in and have a .5 tool it shouldnt trace anything and notice user"*
 *   *"exactly equal is fine too"*
 *   …and then, extending it: *"it should apply the same for all"* — ONE predicate, every op that compares a feature
 *   dimension to a tool.
 *
 * ── WHAT IT WAS BEFORE, MEASURED ─────────────────────────────────────────────────────────────────────────────────
 * `slotPath` opened with `width = Math.max(tool, width)`. A 6.35mm slot asked of a 12.7mm tool became a **12.7mm
 * slot** — clean G-code, a confident preview, twice the width that was typed. The pocket plunged its Ø12.7 tool into
 * a "Ø6.35 pocket". A Ø6 bore of a Ø12 end mill degenerated to the same plunge. A 2.5mm engraved stroke cut with a Ø6
 * tool still emitted nine confident cutting moves. Every one of them OVERSIZE BY CONSTRUCTION and none of them said
 * anything, because each had repaired the wrong number into a plausible one before it could be noticed.
 *
 * ── WHY THIS SPEC IS TABLE-DRIVEN ────────────────────────────────────────────────────────────────────────────────
 * The law is universal, so the test is a table rather than five hand-written cases: every op states the span it
 * offers the tool, and each is driven at SMALLER / EQUAL / LARGER. A per-op test would let the next op join the
 * family without joining the law — which is exactly the drift the single predicate exists to prevent.
 */
test.use({ viewport: { width: 1200, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Every op that compares a feature dimension to a tool: how to build it at a given span, and the span's name. */
const OPS = `[
  { name: 'slot (width)', span: 6, bigger: 12, build: (s, t) => M.slotPath({ x0: 0, y0: 0, x1: 60, y1: 0, width: s, tool: t, stepoverPct: 40, depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, entry: 'plunge' }) },
  { name: 'bore (hole Ø)', span: 12, bigger: 20, build: (s, t) => M.BLOCKS.holecycle.emit({ pattern: 'single', cycle: 'bore-step', x0: 0, y0: 0, holeDia: s, toolDia: t, depth: 3, pitch: 0.5, feed: 300, clearance: 5 }) },
  { name: 'drill/peck (hole Ø)', span: 12, bigger: 20, build: (s, t) => M.BLOCKS.holecycle.emit({ pattern: 'single', cycle: 'peck', x0: 0, y0: 0, holeDia: s, toolDia: t, depth: 3, peck: 1, feed: 300, clearance: 5 }) },
  { name: 'engraved stroke', span: 2.5, bigger: 6, build: (s, t) => M.BLOCKS.filltext.lines({ text: 'A', font: 'single-stroke', height: 12, width: 1, strokeWidth: s, toolDia: t, stepoverPct: 50, feed: 400, plunge: 120, clearance: 4, x: 0, y: 0 }, -1) },
  { name: 'pocket (min side)', span: 12, bigger: 80, build: (s, t) => M.pocketEmit({ shape: 'rect', originX: 0, originY: 0, w: s, h: s, toolDia: t, stepoverPct: 40, depth: 3, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' }) },
  { name: 'cpocket (Ø)', span: 12, bigger: 50, build: (s, t) => M.pocketEmit({ shape: 'circle', originX: 0, originY: 0, dia: s, toolDia: t, stepoverPct: 40, depth: 3, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'spiral' }) }
]`;

const HARNESS = `
async () => {
    const slotM = await import('/wizards/ops/slot.js');
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const M = { slotPath: slotM.slotPath, BLOCKS, pocketEmit: (p) => emitMapped(pocketStack(p)).text.split(String.fromCharCode(10)) };
    const run = (lines) => {
        const t = traceToolpath(lines.join(String.fromCharCode(10)));
        return { refused: !!t.stats.refused, why: t.stats.refusedWhy || '', cuts: (t.segments || []).filter((s) => !s.rapid).length };
    };
    return { M, run };
}`;

test('THE LAW, on every op that compares a feature to a tool: smaller REFUSES, equal is ALLOWED, larger cuts', async ({ page }) => {
    await boot(page);
    const rows = await page.evaluate(async ({ H, OPS }) => {
        const { M, run } = await (eval(H))();
        // eslint-disable-next-line no-unused-vars
        const list = eval(OPS);
        return list.map((o) => ({
            name: o.name,
            smaller: run(o.build(o.span / 2, o.span)),
            equal: run(o.build(o.span, o.span)),
            larger: run(o.build(o.bigger, o.span)),
        }));
    }, { H: HARNESS, OPS });

    console.log('TOOL FIT 1444:\n' + rows.map((r) => `  ${r.name.padEnd(22)} smaller=${r.smaller.refused}/${r.smaller.cuts}  equal=${r.equal.refused}/${r.equal.cuts}  larger=${r.larger.refused}/${r.larger.cuts}`).join('\n'));
    expect(rows.length, 'the table really covers the family').toBeGreaterThanOrEqual(6);

    for (const r of rows) {
        // STRICTLY SMALLER — refuses, and cuts NOTHING. Both halves matter: a refusal that still emitted motion would
        // be the same defect wearing an apology.
        expect(r.smaller.refused, `${r.name}: strictly smaller than the tool must REFUSE`).toBe(true);
        expect(r.smaller.cuts, `${r.name}: …and trace nothing at all`).toBe(0);
        expect(r.smaller.why, `${r.name}: in the operator's words, with BOTH numbers`).toMatch(/No toolpath — the [\d.]+mm tool cannot fit the [\d.]+mm /);
        // EXACTLY EQUAL — allowed, as shipped. This is the half a blanket "too small" rule would have broken, and it
        // is the normal way to cut a tool-sized feature.
        expect(r.equal.refused, `${r.name}: EXACTLY equal is a legitimate exact fit — never refused`).toBe(false);
        expect(r.equal.cuts, `${r.name}: …and it really cuts`).toBeGreaterThan(0);
        // LARGER — the ordinary walk, untouched.
        expect(r.larger.refused, `${r.name}: larger than the tool is ordinary work`).toBe(false);
        expect(r.larger.cuts, `${r.name}: …and cuts more than the exact fit`).toBeGreaterThan(0);
    }
});

/**
 * THE PREVIEW SURFACE, FOR REAL — the wizard's OWN emit through the REAL panel, read at the DOM.
 *
 * Driven end to end (wizard params → generate → the shipping preview panel) rather than by handing the panel a
 * hand-written program, because the claim under test is "the user sets .25in with a .5 tool and sees why", and a
 * synthetic program would prove the panel works while saying nothing about what the wizard hands it.
 */
for (const C of [
    { op: 'SLOT', file: '/wizards/slotWizard.js', cls: 'SlotWizard', params: { ax: 0, ay: 0, bx: 60, by: 0, width: 6.35, toolDia: 12.7, depth: 3, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5 }, word: 'slot' },
    { op: 'POCKET', file: '/wizards/pocketWizard.js', cls: 'PocketWizard', params: { shape: 'rect', originX: 0, originY: 0, w: 6.35, h: 40, toolDia: 12.7, depth: 3, stepdown: 1.5, stepoverPct: 40, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' }, word: 'pocket' },
])
    test(`THE SURFACE — a too-small ${C.op} traces NOTHING and the preview says why`, async ({ page }, testInfo) => {
        await boot(page);
        const r = await page.evaluate(async (C) => {
            const mod = await import(C.file);
            const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
            const nc = new mod[C.cls]().generate(C.params);
            const host = document.createElement('div');
            host.style.cssText = 'width:1100px;height:640px;position:fixed;left:0;top:0;background:#111;z-index:99999';
            host.className = 'ddcs-t1444-host';
            document.body.appendChild(host);
            const panel = createPreviewPanel(host, { getGcode: () => nc });
            panel.setGcode(nc);
            await new Promise((res) => setTimeout(res, 500));
            const el = host.querySelector('.pp-status');
            return { nc, text: el ? el.textContent : null, isError: el ? el.classList.contains('has-error') : null,
                hasMotion: /^\s*G[0-9]+\s+[XY]/m.test(nc) };
        }, C);

        // (1) NOTHING TO TRACE — the program carries no motion at all, which is what "shouldnt trace anything" means
        expect(r.hasMotion, 'the emitted program contains NO motion — nothing to trace').toBe(false);
        expect(r.nc, '…because it refused, in the family\'s form').toMatch(/#1505\s*=\s*1/);
        // (2) THE USER IS NOTICED — the panel's own status line, in operator words, with both numbers
        expect(r.text, 'the preview status line explains the empty path').toContain('cannot fit');
        expect(r.text, 'naming the TOOL').toContain('12.7mm');
        expect(r.text, `naming the ${C.word.toUpperCase()}`).toContain('6.35mm');
        expect(r.text, 'and it is NOT the generic empty-program line').not.toBe('No drawable moves');
        // (3) …as an ERROR, not a warning. A program that cannot cut what was asked is not an advisory.
        expect(r.isError, 'styled as an error').toBe(true);

        // Saved to a durable path (the t1391-shots convention) as well as attached, so the notice can be EYEBALLED
        // after the run rather than only on failure — "the preview says why" is a claim about a pixel.
        await page.locator('.ddcs-t1444-host').screenshot({ path: `test-results/t1444-shots/${C.op.toLowerCase()}-refusal.png` });
        await testInfo.attach(`t1444-${C.op.toLowerCase()}-refusal`, { path: `test-results/t1444-shots/${C.op.toLowerCase()}-refusal.png`, contentType: 'image/png' });
    });

/**
 * ⚠ THE FALSE POSITIVE THIS NEARLY SHIPPED, LOCKED. `#1505` is NOT only an error flag on the Expert — the dialect
 * drives the HMI through it too (`hmiPrompt` → `#1505=1(Hover OVER…)`, `hmiToast` → `#1505=-5000(msg)`). The first
 * detector keyed on the register alone and would have put a red REFUSED banner on every corner probe that asks the
 * operator to jog. The discriminator is the ERROR:/FAULT: LABEL, not the register and not the bracket style.
 */
test('A PROMPT IS NOT A REFUSAL — the #1505 detector reads the label, not the register', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const t = (nc) => { const s = traceToolpath(nc).stats; return { refused: !!s.refused, why: s.refusedWhy || '' }; };
        return {
            jogPrompt: t('#1505=1 ( Hover OVER the corner and press Cycle Start )' + NL + 'G0 X10 Y10'),
            toast: t('#1505=-5000(Probe complete)' + NL + 'G0 X10 Y10'),
            atcParen: t('#1505=1 ( ERROR: Tool Setter missed )'),
            atomSemi: t('#1505=1   ;ERROR: the 12.7mm tool cannot fit the 6.35mm slot'),
            cleared: t('#1505=0   ;ERROR: this one did not fire'),
        };
    });
    expect(r.jogPrompt.refused, 'a jog PROMPT is not a refusal — this is the false positive').toBe(false);
    expect(r.toast.refused, 'nor is an HMI toast').toBe(false);
    expect(r.atcParen.refused, 'an ATC refusal in the PAREN form IS one — the label is the mark, not the bracket').toBe(true);
    expect(r.atcParen.why).toBe('Tool Setter missed');
    expect(r.atomSemi.refused, 'and so is an atom refusal in the semicolon form').toBe(true);
    expect(r.cleared.refused, 'a guard that WROTE ZERO has cleared, not refused').toBe(false);
});

/** THE PACK — the operator hears it at build, not at the machine (braces; the emit is the belt). */
test('THE PACK REFUSES TOO — strictly smaller never becomes a CAM slot', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { camTypeOf } = await import('/data/opCamMap.js');
        const c = (opType, params) => camTypeOf({ opType, params });
        return {
            slotSmall: c('slot', { width: 6.35, toolDia: 12.7 }),
            slotEqual: c('slot', { width: 6, toolDia: 6 }),
            slotWide: c('slot', { width: 12, toolDia: 6 }),
            pocketSmall: c('pocket', { shape: 'rect', w: 6.35, h: 40, toolDia: 12.7 }),
            pocketEqual: c('pocket', { shape: 'rect', w: 6, h: 40, toolDia: 6 }),
            cpocketSmall: c('pocket', { shape: 'circle', dia: 5, toolDia: 12 }),
        };
    });
    expect(r.slotSmall.unsupported, 'a slot the tool cannot fit is refused at PACK').toContain('cannot fit');
    expect(r.pocketSmall.unsupported, 'and a pocket').toContain('cannot fit');
    expect(r.cpocketSmall.unsupported, 'and a circular one — the shape fork must not get in first').toContain('cannot fit');
    // …and the EQUAL case still packs, on both, which is the half that proves the gate is the ruling and not a blanket
    expect(r.slotEqual.camType, 'exactly tool-width still packs').toBe('slot');
    expect(r.pocketEqual.camType, '…and so does an exactly tool-sized pocket').toBe('pocket');
    // (the WIDE slot gate is t1442's separate find — asserted in its own spec, named here so the two are not confused)
    expect(r.slotWide.unsupported, 'a slot WIDER than its tool refuses for the other reason — the centreline macro').toContain('centreline');
});
