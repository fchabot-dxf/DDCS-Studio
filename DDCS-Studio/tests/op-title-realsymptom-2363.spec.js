import { test, expect } from '@playwright/test';

/**
 * t2363 — THE REAL SYMPTOM (owner-reported): "if i have multiple ops the second ones don't have a comment
 * title at beginning", sharpened to "some wiz are not inserting titles" (contour, named). This drives the
 * actual live app: a real TWO-OP program (contour then pocket — the owner's own named repro pair), built via
 * the SAME window hooks the UI's Insert/Add-as-2nd-operation gesture calls (commitActiveOp/addActiveOp,
 * blocks/opSession.js), exported, and read back — both ops visibly named, no duplicate title on either, no
 * lie about which op it is, and the .nc round-trips back to the same two ops on reimport.
 */

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsGetBlockProgram && window.ddcsAddOperation, null, { timeout: 20000 });
}

/** Build a two-op program (contour then pocket) the SAME way the live Insert/"Add as a 2nd operation" gesture
 *  does (commitActiveOp then addActiveOp's own shape) — a real op container each, real program framing. */
async function buildTwoOpProgram(page) {
    return page.evaluate(async () => {
        const { builderOf, makeOp } = await import('/blocks/opBuilders.js');
        const frame = (opType, params) => {
            const framed = builderOf(opType)(params || {});
            const start = framed.find((b) => b && b.type === 'progstart');
            const end = framed.find((b) => b && b.type === 'progend');
            const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
            return { start, end, opC: makeOp(opType, params || {}, bare) };
        };
        const c1 = frame('contour', {});
        window.ddcsLoadBlockStack((c1.start && c1.end) ? [c1.start, c1.opC, c1.end] : [c1.opC]);
        const c2 = frame('pocket', { w: 40, h: 30, toolDia: 6, depth: 2 });
        const cur = window.ddcsGetBlockProgram() || [];
        const added = window.ddcsAddOperation(cur, c2.opC);
        window.ddcsLoadBlockStack(added);
        return { contourId: c1.opC.id, pocketId: c2.opC.id };
    });
}

// The line RIGHT AFTER each DDCS marker — the precise, real definition of "this op's own title line"
// (blockEmitter's op-container branch always makes it the op's first projected line, and serializeWithMarkers
// always inserts the marker immediately before that first line). Deliberately NOT "any bare-comment line
// anywhere" — contour/pocket both carry their OWN unrelated internal comments further down (per-level "Step
// Down z=…", the pocket Mechanism-B banner) that must not be mistaken for a title.
function titlesAfterMarkers(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    lines.forEach((l, i) => { if (/^\(\s*@DDCS:\d+\s/.test(l)) out.push({ marker: l, title: lines[i + 1] }); });
    return out;
}

test('a real two-op program (contour then pocket): both visibly named, no duplicate, no lie', async ({ page }) => {
    await boot(page);
    await buildTwoOpProgram(page);

    const nc = await page.evaluate(() => window.ddcsSerializeWithMarkers());
    const titled = titlesAfterMarkers(nc);

    expect(titled.length, 'exactly two ops, each carrying its own marker').toBe(2);
    expect(titled.map((t) => t.title), 'contour, then pocket, each named once, in program order').toEqual(['( Contour )', '( Pocket )']);
    // No lie: the marker immediately above each title names the SAME op the title itself claims to be.
    expect(titled[0].marker).toMatch(/"op":"contour"/);
    expect(titled[1].marker).toMatch(/"op":"pocket"/);

    // No doubling: each title text appears exactly once in the whole file (not just once per-marker-slot).
    expect(nc.match(/\( Contour \)/g)?.length, 'Contour title appears exactly once').toBe(1);
    expect(nc.match(/\( Pocket \)/g)?.length, 'Pocket title appears exactly once').toBe(1);

    // Mechanism B is untouched: pocket's own (mistitled) internal banner is STILL there, just no longer alone —
    // the generic label now sits above it rather than replacing or hiding it.
    expect(nc, 'pocket\'s own borrowed banner still exists, now correctly preceded by ( Pocket )').toMatch(/DRILL|AREA CLEARING/);
});

test('THE .nc ROUND-TRIP: reimporting the exported two-op file reconstructs the same two ops, titles intact', async ({ page }) => {
    await boot(page);
    await buildTwoOpProgram(page);
    const nc = await page.evaluate(() => window.ddcsSerializeWithMarkers());

    // importMarkedNc — the SAME reconstruction the real "open a .nc file" gesture uses (ui/commandDeck.js), which
    // finds each op's own boundary by MARGINAL LINE-COUNT MATCHING against the source text (programModel.js:498-
    // 512, "t1920 — VERIFIED, not assumed"). A new leading title line only stays invisible to that heuristic if
    // the RECONSTRUCTED op (opFromMarker -> makeOp) emits the SAME extra line the SOURCE text carries — which it
    // does, since both sides run through the SAME blockEmitter fix. This is the load-bearing proof, not an
    // assumption: if the line-count math ever drifted, this load would silently reconstruct the wrong op or throw.
    const loadedTypes = await page.evaluate(async (text) => {
        const { importMarkedNc } = await import('/blocks/programModel.js');
        const items = importMarkedNc(text);
        window.ddcsLoadBlockStack(items);
        const prog = window.ddcsGetBlockProgram() || [];
        const top = prog.find((b) => b && b.type === 'op');
        if (top && top.opType === 'multi_step') return (top.children || []).filter((b) => b.type === 'op').map((b) => b.opType);
        return prog.filter((b) => b && b.type === 'op').map((b) => b.opType);
    }, nc);
    expect(loadedTypes, 'the reimported program holds the SAME two ops, same order').toEqual(['contour', 'pocket']);

    // And re-exporting the reimported program still names both correctly — the extra title line didn't shift
    // what the marker-boundary parser anchors on, and the (silenced) multi_step wrapper contributed no title
    // of its own (t2363's own follow-on fix — see the node-tier op-title-2363.test.mjs for that case directly).
    const reExported = await page.evaluate(() => window.ddcsSerializeWithMarkers());
    const titled2 = titlesAfterMarkers(reExported);
    expect(titled2.map((t) => t.title)).toEqual(['( Contour )', '( Pocket )']);
});
