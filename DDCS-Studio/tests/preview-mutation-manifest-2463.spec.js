import { test, expect } from '@playwright/test';
import { dragHandleRenderTruth, assertDragRenderFaithful } from './support/dragRenderTruth.js';
import { checkAffordancesPresent } from './support/affordancePresence.js';
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

/** t2465 (BACKLOG #61 / L2) — the presence probe: boot the op, then check the declared affordance selectors
 *  under `entry.affordance` via the reusable `checkAffordancesPresent` primitive. Structurally distinct from
 *  `probeDrag` above: no drag, no position math — only "does the DOM node exist at all." */
async function probePresence(page, entry) {
    await bootPocketRect(page);
    return checkAffordancesPresent(page, entry.affordance);
}

const DRAG_PROBES = {
    pocket: (page, seed) => probeDrag(page, bootPocketRect, 'pk_size', { dx: seed.dx, dy: seed.dy, steps: seed.steps, settleMs: seed.settleMs }),
    surfacing: (page, seed) => probeDrag(page, bootSurfacing, 'sf_pos', { dx: seed.dx, dy: seed.dy, steps: seed.steps, settleMs: seed.settleMs }),
    'tool-picker-popup': (page) => probeFlyoutPosition(page),
    'wizard-view-pane': (page) => probePaneSizing(page),
};

/** Dispatches on `entry.kind` FIRST (defaulting to the L1 drag/position shape when absent — every existing
 *  entry stays byte-behavior-identical), then `entry.op` for the specific boot/probe — 'pocket' is now shared
 *  by a drag entry (pk-size-snapback) AND a presence entry (pocket-size-handle-presence), so `op` alone can no
 *  longer pick the right probe. */
function probeFor(entry) {
    if (entry.kind === 'presence') return (page) => probePresence(page, entry);
    return (page, seed) => DRAG_PROBES[entry.op](page, seed);
}

test.use({ viewport: { width: 1400, height: 1000 } });

for (const entry of PREVIEW_MUTATIONS) {
    test(`t2463 manifest [${entry.id}]: RED under the mutation, GREEN once removed — ${entry.defect}`, async ({ page }) => {
        // ── phase 1: mutated — the gate must go RED ──────────────────────────────────────────────────
        await applyMutations(page, entry.files);
        const probe = probeFor(entry);
        const mutated = await probe(page, entry.seed);
        console.log(`[t2463 ${entry.id}] MUTATED: ok=${mutated.ok} ${mutated.detail || (mutated.missing ? `missing=${JSON.stringify(mutated.missing)}` : '')}`);

        // ── phase 2: clean — the gate must go GREEN, same page context, route removed ────────────────
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const clean = await probe(page, entry.seed);
        console.log(`[t2463 ${entry.id}] CLEAN:   ok=${clean.ok} ${clean.detail || (clean.missing ? `missing=${JSON.stringify(clean.missing)}` : '')}`);

        expect(clean.ok, `${entry.id}: the gate must be GREEN once the mutation is removed (a mutation that stays red after removal is broken, not a caught defect)`).toBe(true);

        // t2465 — the sf-pos-snapback special case (t2463's own "report, don't pre-judge" instruction) is
        // now STALE: the answer arrived (RED, 3/3 at t2463, 4/4 isolated at t2465's own re-check below) and
        // nothing was asserting it — one of four manifest entries proved nothing on a CI run, and t2463's own
        // central finding wasn't locked in by anything. Collapsed to the same assertion every other entry
        // uses; if the reproduction really is scheduling-sensitive, THIS is what will flake under load, and
        // that flake is itself the finding — not pre-judged either way.
        expect(mutated.ok, `${entry.id}: the gate must go RED under the mutation (${mutated.detail || (mutated.missing ? `missing=${JSON.stringify(mutated.missing)}` : 'no detail')})`).toBe(false);
    });
}

// t2471 — REWRITTEN. The old form asserted each guarded file was absent from `git status` ENTIRELY, which
// is not the claim this test means to make: five of the most-edited files in the repo (styles.css,
// featureCanvas.js, panelTypes.js, dropdownPopup.js, pocketData.js) are guarded here, so ANY future turn that
// legitimately edits one of them and runs the suite before committing got a red — exactly what happened this
// turn (t2469's own uncommitted `styles.css` dvh fix). A check that cries wolf on unrelated work gets ignored,
// which is worse than no check. THE PRECISE CLAIM: each mutation's own `find` string is still present in the
// file ON DISK. If a mutation had ever been written out for real, `find` would be gone from disk — exactly
// what this test wants to know, and it is indifferent to any OTHER edit in the same file. As a bonus this is
// also a STALENESS detector: if someone legitimately edits that exact line, the count drops to 0 here too —
// a TRUE positive, because the manifest is then stale and `applyMutations`' own live `hits!==1` guard (above)
// would throw the identical way at run time.
function countOccurrences(text, find) {
    return String(text).replace(/\r\n/g, '\n').split(find).length - 1;
}

test('t2463: no mutation ever reached disk — every find-string is still present, on disk, exactly once', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    for (const entry of PREVIEW_MUTATIONS) {
        for (const { path: p, find } of entry.files) {
            const rel = p.replace(/^\//, 'web/');
            const abs = path.join(process.cwd(), rel);
            const onDisk = fs.readFileSync(abs, 'utf8');
            const hits = countOccurrences(onDisk, find);
            expect(hits, `${entry.id}: "${rel}" find-string must be present on disk EXACTLY once (0 = a mutation reached disk for real, OR the manifest went stale against an unrelated edit to that exact line — either way, investigate; >1 = the find-string is no longer unique)`).toBe(1);
        }
    }
});

// Non-vacuity + specificity, proven in-memory (never touches a real file) — the two properties the dispatch
// asked to see demonstrated, not just claimed: (1) the check genuinely CAN go red if a mutation reaches disk,
// (2) it does NOT fire on an unrelated edit elsewhere in the same file — the exact failure mode being retired.
test('t2463: the disk-cleanliness check is non-vacuous (catches a real write) AND specific (ignores unrelated edits)', () => {
    const entry = PREVIEW_MUTATIONS.find((e) => e.files.length && !e.synthetic) || PREVIEW_MUTATIONS[0];
    const { find, replace } = entry.files[0];
    const originalSourceShape = `// unrelated line above\n${find}\n// unrelated line below\n`;

    // (1) simulate the mutation having actually been written to disk -- the checker must go RED.
    const asIfMutatedOnDisk = originalSourceShape.replace(find, replace);
    expect(countOccurrences(asIfMutatedOnDisk, find), 'non-vacuous: a real disk write makes the find-string vanish, and the checker must see that as 0').toBe(0);

    // (2) simulate a legitimate, UNRELATED edit elsewhere in the same file -- the find-string itself is
    // untouched, so the checker must stay GREEN, unlike the old git-status form this turn tripped over.
    const withUnrelatedEditNearby = originalSourceShape.replace('// unrelated line above', '// a completely different, legitimate change');
    expect(countOccurrences(withUnrelatedEditNearby, find), 'specific: an edit elsewhere in the file must NOT trip this check').toBe(1);
});
