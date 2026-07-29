import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * t1361 — THE BOTH-PATHS GUARD: the parametric raster is the ONLY path a surfacing op can take, and the literal
 * emitter it replaced is REACHABLE ONLY FROM TESTS.
 *
 * Why both halves, and why they are one spec. `surfacingLiteralStack` is deliberately kept alive (see the comment on
 * it in surfacingWizard.js): the equivalence bridges compare the parametric emit AGAINST it, and if it were deleted
 * they would silently start comparing the new emitter to itself and pass while proving nothing. That safety argument
 * only holds while the function is BOTH still present AND unreachable from the shipping app — a second live emitter
 * for the same op is exactly the split t1347 refused to create. So:
 *
 *   (a) nothing under web/ may import or name it — checked against the source tree, not asked, and
 *   (b) every route that builds a surfacing op — the built-in stack, the data twin, and the wizard the STUDIO form
 *       actually calls — must come out carrying `surfaceraster` and carrying neither `stepdown` nor `surfacefill`.
 *
 * The t1359 work log recorded this assert as landed; it was not (measured at t1361 — the identifier appeared in no
 * spec, and the claim in surfacingWizard.js's own comment had nothing behind it). It exists now.
 */

// comments/strings stripped so a MENTION in prose is not a reference — the same idiom dialog-grep-guard uses.
function stripCommentsAndStrings(src) {
    let out = '', i = 0; const n = src.length;
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') { const q = c; out += ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
        out += c; i++;
    }
    return out;
}

function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...jsFiles(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

test('(a) the literal emitter is TEST-ONLY — nothing under web/ imports or names it', () => {
    const root = join(process.cwd(), 'web');
    const DEFINES_IT = join('wizards', 'surfacingWizard.js');   // the one file allowed to say the name: it declares it
    const offenders = [];
    for (const file of jsFiles(root)) {
        const rel = relative(root, file);
        if (rel === DEFINES_IT) continue;
        const code = stripCommentsAndStrings(readFileSync(file, 'utf8'));
        if (/\bsurfacingLiteralStack\b/.test(code)) offenders.push(rel.split(sep).join('/'));
    }
    expect(offenders, `web/ files reaching the retired literal emitter: ${offenders.join(', ')}`).toEqual([]);

    // …and the definition really is still there, because the bridges' whole value is that it is.
    const owner = stripCommentsAndStrings(readFileSync(join(root, DEFINES_IT), 'utf8'));
    expect(owner, 'the literal emitter is still exported for the bridges to compare against').toMatch(/export function surfacingLiteralStack/);
});

test('(b) every route that builds a surfacing op comes out parametric — no stepdown, no surfacefill', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingStack, SurfacingWizard, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { surfacingDataDef, SURFACING_DEFAULTS, SURFACING_DATA_OPTYPE } = await import('/blocks/dataOps/surfacingData.js');
        const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        registerUserOp(surfacingDataDef());
        const twin = builderOf(SURFACING_DATA_OPTYPE);
        const base = { ...SURFACING_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
        const types = (stack) => flattenBlocks(stack).map((b) => b && b.type).filter(Boolean);
        return {
            builtinNormal: types(surfacingStack(base)),
            builtinSkim: types(surfacingStack({ ...base, zMode: 'skim' })),
            builtinPlaced: types(surfacingStack({ ...base, stockAttach: 'cc', stockW: 200, stockH: 150 })),
            twinNormal: types(twin(base)),
            twinSkim: types(twin({ ...base, zMode: 'skim' })),
            // the route the STUDIO form actually takes when the operator presses Insert
            wizardText: new SurfacingWizard().generate(base),
            // the literal is still importable FROM A TEST — that is what keeps the bridges honest
            literalStillThere: typeof surfacingLiteralStack === 'function',
            literalTypes: types(surfacingLiteralStack(base)),
        };
    });

    for (const [name, types] of Object.entries({
        builtinNormal: r.builtinNormal, builtinSkim: r.builtinSkim, builtinPlaced: r.builtinPlaced,
        twinNormal: r.twinNormal, twinSkim: r.twinSkim,
    })) {
        expect(types, `${name} builds the parametric atom`).toContain('surfaceraster');
        expect(types, `${name} carries no retired depth wrapper`).not.toContain('stepdown');
        expect(types, `${name} carries no retired fill atom`).not.toContain('surfacefill');
    }

    // THE SHIPPING FORM PATH — not a stack shape but the text an operator would get: the parametric header, and none
    // of the unrolled literal raster's give-away (a row of absolute G1 X/Y numbers).
    expect(r.wizardText, 'the wizard emits the parametric header').toContain('( ---- SURFACING, parametric.');
    expect(r.wizardText, 'and counts its rows in the program rather than in JavaScript').toMatch(/WHILE \[#48 < #45\] DO2/);

    // THE REFERENCE IS INTACT — and it is the OLD shape, which is the whole reason the bridges mean something.
    expect(r.literalStillThere, 'the literal emitter is still reachable from a test').toBe(true);
    expect(r.literalTypes, 'and it is genuinely the retired shape, not an alias of the new one').toContain('surfacefill');
    expect(r.literalTypes, 'with its depth wrapper').toContain('stepdown');
    expect(r.literalTypes, 'and no parametric atom in it').not.toContain('surfaceraster');
});
