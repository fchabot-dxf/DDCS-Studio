import { test, expect } from '@playwright/test';

/**
 * t1395 — THE STATUS-CHIP TAG, ASSERTED AT THE PIXEL.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────────────────────────────────────────────
 * `calcTagOf` labels the executing line in the preview's status chip: `note` for a comment, `flow` for a branch/loop,
 * `calc` for a register assignment, `set` for a mode or M-code that does not move, and NO tag for anything that moves.
 * Three of its patterns carried a literal BACKSPACE (0x08) where `\b` was meant — an escape eaten by some quoting layer,
 * invisible in every diff. `/\x08G0?[0-3]\x08/` can never match, so ordinary motion fell through to the `[MG]\d`
 * catch-all and every G0/G1 line was tagged **`set`** — "a mode with no motion" — while the tool was moving. Probes
 * (G31/G38) got the same wrong tag; M98/M99 lost `flow`.
 *
 * ── WHY THIS SPEC DRIVES THE DOM AND NOT THE FUNCTION ─────────────────────────────────────────────────────────────
 * `calcTagOf` is a closure inside `createPreviewPanel` and is not exported, so a unit test would have to re-implement it
 * — which would assert my copy of the rule rather than the app's. More to the point, the SYMPTOM is a label a user
 * reads while the sim plays. t1383 taught this exactly: a truncation message that was correct in `stats.cappedWhy` and
 * silently overwritten in the DOM passed every assert I had. So this reads the chip.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * PLAY the program and COLLECT every chip the engine paints, then read the tag per line.
 *
 * ⚠ A first version called `panel.seekLine(i)` and read the chip after each seek. Every line came back with no tag and
 * the motion assertions "passed" — VACUOUSLY, because seekLine does not paint the chip at all: it stayed on the summary
 * ("1 cuts · 1 probes · 1 rapids") for all nine lines. The chip is written by `onLineChange`, which only fires while the
 * sim is RUNNING. Caught by dumping the chip per line instead of trusting three green asserts — the same lesson as
 * t1383, one level in: a test that reads the right element at the wrong moment is still reading nothing.
 */
const chipsWhilePlaying = async (page, program) => page.evaluate(async (program) => {
    const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:520px;z-index:99999';
    document.body.appendChild(host);
    const panel = createPreviewPanel(host, { getGcode: () => program });
    panel.setGcode(program);
    await new Promise((r) => setTimeout(r, 200));
    const el = host.querySelector('.pp-status');
    const seen = [];
    const sample = () => { const t = el && el.textContent; if (t && seen[seen.length - 1] !== t) seen.push(t); };
    const run = host.querySelector('.pp-run');
    if (run) run.click();
    // Sample densely for long enough to cover the whole (tiny) program at any speed tier.
    for (let i = 0; i < 400; i++) { sample(); await new Promise((r) => setTimeout(r, 15)); }
    try { panel.stop(); } catch (_) { /* teardown best-effort */ }
    host.remove();
    return seen;
}, program);

/**
 * The tag a line SHOULD carry, declared as data beside the line it describes. `''` means "this line moves — no tag",
 * which is the half the defect broke.
 */
const PROGRAM = [
    'G90',                        // 0  a mode, no motion            → set
    '( facing pass )',            // 1  a comment                    → note
    '#81=12',                     // 2  a register assignment        → calc
    'WHILE [#83 < #81] DO2',      // 3  a loop                       → flow
    'G0 X10 Y10',                 // 4  MOTION                       → (none)
    'G1 Z-5 F100',                // 5  MOTION                       → (none)
    'G31 Z-20 F50',               // 6  a PROBE — probes are motion   → (none)
    'M99',                        // 7  a call/return                → flow
    'M30',                        // 8  end                          → set
];
/**
 * The lines this asserts on are the ones the chip actually PAINTS. A line that costs the engine no time (a bare `G90`,
 * a register assignment, the `M30`) can be stepped past between two samples, so requiring all nine would make this test
 * a timing lottery. The five below are the ones the DEFECT touched — the three that must lose their tag and the two that
 * must keep theirs — and each is asserted to have been SEEN before its tag is read, so a missed sample fails loudly
 * instead of passing as an absent tag.
 */
const EXPECT = { 1: 'note', 3: 'flow', 4: '', 5: '', 6: '' };

test('THE CHIP — every line kind gets its own tag, and MOVING lines get none', async ({ page }) => {
    await boot(page);
    const chips = await chipsWhilePlaying(page, PROGRAM.join('\n'));
    // The chip reads "<lineNo> · <raw>  [tag]". Parse the LINE NUMBER out of it so each sample is attributed to the line
    // it describes — never to the order it happened to be sampled in.
    const got = {};
    for (const c of chips) {
        const m = c.match(/^(\d+)\s+·\s+(.*?)(?:\s{2}\[([a-z]+)\])?$/);
        if (!m) continue;
        const idx = Number(m[1]) - 1;
        if (idx in EXPECT) got[idx] = m[3] || '';
    }
    // THE PREMISE: the chip really painted the executing lines. Without this the assertions below could all "pass" on an
    // empty map, which is exactly how the seekLine version fooled itself.
    // THE PREMISE, per line: it must have been PAINTED before its tag means anything. An unseen line yields `undefined`,
    // not `''`, so this cannot be satisfied by a sample that never happened — which is exactly how the first version of
    // this test fooled itself.
    for (const idx of Object.keys(EXPECT).map(Number)) {
        expect(got[idx], `line ${idx + 1} (${PROGRAM[idx]}) was painted to the chip — saw ${chips.length} chips: ${JSON.stringify(chips.slice(0, 12))}`).toBeDefined();
    }
    // THE REGRESSION THIS EXISTS FOR: motion and probe lines must carry NO tag. Before the fix all three read `set`.
    expect(got[4], 'a G0 rapid MOVES — no tag (it read "set" before the fix)').toBe('');
    expect(got[5], 'a G1 feed MOVES — no tag').toBe('');
    expect(got[6], 'a G31 PROBE moves too — no tag').toBe('');
    // …and the tags that were meant to be there still are, so the fix did not simply disable the tagging.
    expect(got[3], 'a WHILE is flow — the branch matcher works again').toBe('flow');
    expect(got[1], 'a comment is still a note (this pattern was never broken — the control)').toBe('note');
    expect(got, 'the whole observed tag map').toEqual(EXPECT);
});

/**
 * AND THE BYTES THEMSELVES — no source file may carry a literal 0x08 again.
 *
 * This is the cheap guard for an expensive class: the defect was invisible in diffs and survived for many turns, and I
 * re-introduced the same corruption twice while grounding it (a shell quoting layer turning `\b` into the control
 * character it names). A byte check costs nothing and cannot be fooled by how the source LOOKS.
 */
test('THE BYTES — no shipped or test source carries a literal backspace where an escape was meant', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const bad = [];
    const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) { walk(full); continue; }
            if (!/\.(js|cjs|mjs)$/.test(ent.name)) continue;
            const src = fs.readFileSync(full, 'utf8');
            // The byte is written as a CODE POINT, never as a literal character - a literal one here would make this
            // guard fail on itself, and would be the very corruption it exists to catch.
            let n = 0;
            for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 8) n++;
            if (n) bad.push(`${full} (${n})`);
        }
    };
    walk('web'); walk('tests');
    expect(bad, `literal 0x08 bytes found — a \\b eaten by a quoting layer: ${JSON.stringify(bad)}`).toEqual([]);
});
