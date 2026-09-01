import { test, expect } from '@playwright/test';
import { dragHandleRenderTruth, assertDragRenderFaithful } from './support/dragRenderTruth.js';
import { PREVIEW_MUTATIONS } from './support/previewMutations.js';

/**
 * t2463 (BACKLOG #61, ARC A / L1) — THE MUTATION MANIFEST RUNNER. For every entry in
 * `tests/support/previewMutations.js`: apply → assert the gate goes RED → remove → assert it goes GREEN.
 * Both halves matter (a mutation that stays red after removal is a broken mutation, not a caught defect).
 *
 * MUTATIONS NEVER TOUCH DISK — `page.route()` rewrites the served response body in-flight, per file, for the
 * lifetime of one test's `page` only. Nothing here ever calls `fs.writeFile`/`git checkout`; there is no
 * cleanup path to forget, because there is nothing on disk to clean up. `git status --porcelain` is asserted
 * clean of every source file the manifest names at the end of this file, as the literal proof.
 */

/** Route every `{path, find, replace}` mutation to the live page. Grouped by `path` FIRST — two mutations
 *  targeting the SAME served file (styles.css's own two hunks, featureCanvas.js's own two) must apply to the
 *  SAME fetched body in one handler; registering one `page.route()` per mutation on an identical pattern means
 *  each handler independently re-fetches the ORIGINAL body and only one ever wins the `fulfill()` — a real bug
 *  caught live on this file's own first run (styles.css's second hunk silently never applied). Asserts each
 *  `find` string appears in the served source EXACTLY once — a mutation that silently matches zero or many
 *  times is a bug in the manifest itself (a stale find-string after an unrelated edit), not a quiet no-op. */
async function applyMutations(page, files) {
    const byPath = new Map();
    for (const f of files) { if (!byPath.has(f.path)) byPath.set(f.path, []); byPath.get(f.path).push(f); }
    for (const [path, muts] of byPath) {
        await page.route(`**${path}`, async (route) => {
            const response = await route.fetch();
            // t2463 — this repo checks out CRLF (`core.autocrlf`, confirmed live: served files carry `\r\n`);
            // the manifest's own find/replace strings are authored as plain `\n`. Normalizing BOTH sides to LF
            // for the match is functionally safe (neither JS nor CSS parsing cares about line-ending style) and
            // avoids either hand-encoding `\r\n` into every multi-line manifest entry or a silent 0-hit failure
            // on any find string spanning more than one line.
            let body = (await response.text()).replace(/\r\n/g, '\n');
            for (const { find, replace } of muts) {
                const hits = body.split(find).length - 1;
                if (hits !== 1) throw new Error(`mutation manifest: "${path}" find-string matched ${hits} times (expected exactly 1) — the manifest is stale`);
                body = body.replace(find, replace);
            }
            await route.fulfill({ response, body });
        });
    }
}

async function bootPocketRect(page) {
    await page.goto('/?debug=feat');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.evaluate(async () => {
        const { _framed, makeOp } = await import('/blocks/opBuilders.js');
        const params = { shape: 'rect', strategy: 'spiral', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wcs: 'active' };
        const framed = _framed('user_pocket_data', params);
        const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
        const op = makeOp('user_pocket_data', params, bare);
        const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
        window.ddcsLoadBlockStack(stack);
    });
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
    await page.waitForTimeout(400);
}

async function bootSurfacing(page) {
    await page.goto('/?debug=feat');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.evaluate(async () => {
        const { _framed, makeOp } = await import('/blocks/opBuilders.js');
        const params = { w: 100, h: 60, toolDia: 10, stepoverPct: 60, depth: 1, originX: 0, originY: 0, wcs: 'active' };
        const framed = _framed('user_surfacing_data', params);
        const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
        const op = makeOp('user_surfacing_data', params, bare);
        const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
        window.ddcsLoadBlockStack(stack);
    });
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 3);
    await page.waitForTimeout(400);
}

/** Runs a drag-render-truth probe; returns {ok, detail} instead of throwing, so the CALLER decides whether
 *  pass or fail is the expected outcome (mirrors emitEquivalence's own {pass, diffs} shape, not a bare assert). */
async function probeDrag(page, boot, hid, dragOpts) {
    await boot(page);
    const positions = await dragHandleRenderTruth(page, hid, dragOpts);
    try {
        assertDragRenderFaithful(positions, { label: hid });
        return { ok: true, positions };
    } catch (e) {
        return { ok: false, detail: e.message, positions };
    }
}

/** The flyout-popup probe (entry 3, synthetic) — opens a t2453 tool-number picker on a canvas placed well away
 *  from the viewport corner, and checks the popup's own rendered rect is near the TRIGGER field, not pinned at
 *  the origin. Reuses t2453's own stackToWorkspace boot shape. */
async function probeFlyoutPosition(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws);
    const result = await page.evaluate(async () => {
        const { stackToWorkspace } = await import('/blocks/blockly/stackBridge.js');
        const ws = window.__blkws;
        ws.clear();
        stackToWorkspace([{ type: 'tool', params: { n: 1 } }], ws);
        ws.cleanUp();
        Blockly.svgResize(ws);
        const blk = ws.getAllBlocks(false).find((b) => b.type === 'tool');
        const field = blk.getField('N');
        const fieldRoot = field.getSvgRoot();
        const fr = fieldRoot.getBoundingClientRect();
        field.showEditor_();
        await new Promise((r) => setTimeout(r, 150));
        const popup = document.querySelector('.ddcs-field-popup');
        if (!popup || popup.hidden) return { fieldRect: fr, popupRect: null };
        const pr = popup.getBoundingClientRect();
        return { fieldRect: { left: fr.left, top: fr.top, bottom: fr.bottom }, popupRect: { left: pr.left, top: pr.top } };
    });
    if (!result.popupRect) return { ok: false, detail: 'popup never opened', result };
    // real/faithful: popup opens NEAR the field (below it, roughly the same X) — a wide, generous tolerance
    // since this is a POSITION-FAITHFULNESS check, not a pixel-exact layout spec.
    const dx = Math.abs(result.popupRect.left - result.fieldRect.left);
    const dy = result.popupRect.top - result.fieldRect.bottom;
    const near = dx < 150 && dy > -20 && dy < 150;
    return { ok: near, detail: `field@(${result.fieldRect.left.toFixed(0)},${result.fieldRect.bottom.toFixed(0)}) popup@(${result.popupRect.left.toFixed(0)},${result.popupRect.top.toFixed(0)}) dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}` };
}

/** The pane-sizing probe (entry 4) — reuses wizard-view-pane-container-width-2423.spec.js's own boot/measure
 *  shape verbatim: a wide window, the pane widened past 860px via the real splitter, and the layout must be
 *  the desktop two-pane row (not stacked) — that is the whole BACKLOG #58 claim. */
async function probePaneSizing(page) {
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const def = U.getUserDef('user_corner_data');
        window.ddcsLoadBlockStack([{ id: 'x1', type: 'op', opType: 'user_corner_data', label: def.label, params: {}, children: [] }]);
    });
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) break;
        last = n;
        await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);

    await page.evaluate(() => {
        const root = document.getElementById('blocks-app');
        const handle = root.querySelector('.blk-col-resize');
        const hr = handle.getBoundingClientRect();
        const startX = hr.left + hr.width / 2, y = hr.top + hr.height / 2;
        handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: y, bubbles: true, pointerId: 1 }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 600, clientY: y, bubbles: true, pointerId: 1 }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX - 600, clientY: y, bubbles: true, pointerId: 1 }));
    });
    await page.waitForTimeout(200);

    const r = await page.evaluate(() => {
        const pane = document.getElementById('blk-formpane');
        const twoPane = document.querySelector('#blk_wiz_user .wiz-2pane');
        return { paneWidth: pane.getBoundingClientRect().width, flexDirection: twoPane ? getComputedStyle(twoPane).flexDirection : null };
    });
    if (r.paneWidth < 860) return { ok: false, detail: `splitter never widened the pane past 860px (got ${r.paneWidth.toFixed(0)}) — boot/drag issue, not the mutation under test`, r };
    return { ok: r.flexDirection === 'row', detail: `paneWidth=${r.paneWidth.toFixed(0)} flexDirection=${r.flexDirection}`, r };
}

const PROBES = {
    pocket: (page, seed) => probeDrag(page, bootPocketRect, 'pk_size', { dx: seed.dx, dy: seed.dy, steps: seed.steps, settleMs: seed.settleMs }),
    surfacing: (page, seed) => probeDrag(page, bootSurfacing, 'sf_pos', { dx: seed.dx, dy: seed.dy, steps: seed.steps, settleMs: seed.settleMs }),
    'tool-picker-popup': (page) => probeFlyoutPosition(page),
    'wizard-view-pane': (page) => probePaneSizing(page),
};

test.use({ viewport: { width: 1400, height: 1000 } });

for (const entry of PREVIEW_MUTATIONS) {
    test(`t2463 manifest [${entry.id}]: RED under the mutation, GREEN once removed — ${entry.defect}`, async ({ page }) => {
        // ── phase 1: mutated — the gate must go RED ──────────────────────────────────────────────────
        await applyMutations(page, entry.files);
        const probe = PROBES[entry.op];
        const mutated = await probe(page, entry.seed);
        console.log(`[t2463 ${entry.id}] MUTATED: ok=${mutated.ok} ${mutated.detail || ''}`);

        // ── phase 2: clean — the gate must go GREEN, same page context, route removed ────────────────
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const clean = await probe(page, entry.seed);
        console.log(`[t2463 ${entry.id}] CLEAN:   ok=${clean.ok} ${clean.detail || ''}`);

        expect(clean.ok, `${entry.id}: the gate must be GREEN once the mutation is removed (a mutation that stays red after removal is broken, not a caught defect)`).toBe(true);

        if (entry.id === 'sf-pos-snapback') {
            // t2463's own real question — do NOT assert a predetermined answer; REPORT which it was.
            console.log(`[t2463 sf-pos-snapback] RESULT: ${mutated.ok ? 'did NOT reproduce under mutation (matches t2461\'s own finding)' : 'DID reproduce — differs from t2461\'s disk-revert result'}`);
        } else {
            expect(mutated.ok, `${entry.id}: the gate must go RED under the mutation (${mutated.detail || 'no detail'})`).toBe(false);
        }
    });
}

test('t2463: no mutation ever reached disk — every source file the manifest names is clean in git', async () => {
    const { execSync } = await import('node:child_process');
    const files = [...new Set(PREVIEW_MUTATIONS.flatMap((e) => e.files.map((f) => f.path)))];
    const status = execSync('git status --porcelain', { cwd: process.cwd() }).toString();
    for (const f of files) {
        const rel = f.replace(/^\//, 'web/');
        expect(status.includes(rel), `${rel}: must be absent from git status (a mutation reaching disk means the design failed)`).toBe(false);
    }
});
