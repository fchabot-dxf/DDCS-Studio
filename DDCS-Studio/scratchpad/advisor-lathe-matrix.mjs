// CONFIG-MATRIX PROBE vs pinned V2026.07.28.5 (:3297). ~50 configs across all 5 lathe wizards.
// Every truth is derived IN THIS SCRIPT (pass lists, anchoring, walls, peck floors, polygon corner math) —
// never read back from the app. The app only supplies emit -> trace -> carve results.
import { createRequire } from 'module';
const req = createRequire('c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/package.json');
const { chromium } = req('@playwright/test');
const BASE = 'http://localhost:3297';
const EPS = 0.13;   // half a profile step
const near = (a, b, e = EPS) => Math.abs(a - b) <= e;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE);
await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
await page.evaluate(async () => {
    const M = await import('/data/workspaceMachine.js');
    M.setMachine({ name: 'Rig', kind: 'lathe', chuck: 'axis' }, false);
});

// one shot: emit+trace+carve an op; return cut segs + profile samples + stats
const run = async (type, extra, zs) => page.evaluate(async ({ t, x, zs }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const P = await import('/data/latheProfile.js');
    const S = await import('/viz/latheScene.js');
    const def = uo.listUserOps().find((d) => d.opType === t);
    const params = { ...uo.defaultParams(def), ...(x || {}) };
    const nc = String(emitProgram(builderOf(t)(params)));
    const prof = P.profileFromBar(S.latheBarFrom(params, {}));
    const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe)
        .map((s) => ({ x1: +s.x1.toFixed(4), z1: +s.z1.toFixed(4), x2: +s.x2.toFixed(4), z2: +s.z2.toFixed(4) }));
    for (const s of segs) {
        const onCentre = Math.abs(s.x1) < 0.001 && Math.abs(s.x2) < 0.001;
        if (onCentre && t === 'user_lathe_centerdrill') P.carveBore(prof, 1.5, Math.min(s.z1, s.z2));
        else P.carveSegment(prof, s, Number(params.width) || 0);
    }
    const at = (z) => { const i = Math.max(0, Math.min(prof.n - 1, Math.round((z - prof.z0) / prof.step))); return { o: +prof.rOut[i].toFixed(4), i: +prof.rIn[i].toFixed(4) }; };
    return { segs, stats: P.profileStats(prof), s: Object.fromEntries((zs || []).map((z) => [z, at(z)])), nc };
}, { t: type, x: extra, zs });

const R = { pass: 0, fail: 0, lines: [] };
const ck = (name, cond, detail) => { R[cond ? 'pass' : 'fail']++; if (!cond) R.lines.push(`FAIL  ${name}  ${detail}`); };

// ── FACING MATRIX: derived pass list (light-first) must equal the traced X0-pass Zs ────────────
const facingPasses = (A, D) => {   // outermost first: largest k*D < A, down to 0 (the face)
    if (D <= 0) return null;
    let v = 0; while (v < A - 1e-9) v += D; v -= D;   // the emit's count-up-step-back
    const out = []; for (let p = v; p > 1e-9; p -= D) out.push(+p.toFixed(6)); out.push(0);
    return out;
};
for (const A of [0.5, 1, 3, 7.9, 8, 12]) for (const D of [0.5, 1, 2.5]) {
    const r = await run('user_lathe_facing', { allowance: A, doc: D }, [-0.3, -59.7]);
    const want = facingPasses(A, D);
    const got = r.segs.filter((s) => near(s.x2, 0, 0.01) && near(s.z1, s.z2, 0.01)).map((s) => +s.z1.toFixed(6));
    ck(`facing A=${A} D=${D}: pass Zs light-first`, JSON.stringify(got) === JSON.stringify(want), `want=${JSON.stringify(want)} got=${JSON.stringify(got)}`);
    ck(`facing A=${A} D=${D}: face at Z0`, near(r.stats.zEnd, 0), `zEnd=${r.stats.zEnd}`);
    ck(`facing A=${A} D=${D}: grip intact`, near(r.s['-59.7'].o, 10), `r=${r.s['-59.7'].o}`);
}

// ── OD MATRIX: derived roughing X list + finish; shoulder wall; light-first ────────────────────
const odPasses = (barR, floor, D) => {   // count out from floor by D to < barR, outermost first, down to floor
    if (D <= 0) return [];
    let v = floor; while (v < barR - 1e-9) v += D; v -= D;
    const out = []; for (let p = v; p > floor + 1e-9; p -= D) out.push(+p.toFixed(6)); out.push(+floor.toFixed(6));
    return out;
};
for (const [tgt, len] of [[14, 25], [10, 40], [6, 50], [18, 10]]) for (const D of [1, 2]) {
    const F = 0.5, floor = tgt / 2 + F;
    const r = await run('user_lathe_odturn', { targetDiameter: tgt, depth: len, doc: D, finish: F }, [-len / 2, -(len - 0.3), -(len + 0.4)]);
    const rough = r.segs.filter((s) => near(s.x1, s.x2, 0.001) && near(s.z2, -len, 0.01)).map((s) => +s.x1.toFixed(6));
    const want = odPasses(10, floor, D);
    ck(`OD t${tgt} l${len} D${D}: roughing Xs outermost-first`, JSON.stringify(rough) === JSON.stringify(want), `want=${JSON.stringify(want)} got=${JSON.stringify(rough)}`);
    ck(`OD t${tgt} l${len} D${D}: turned mid at target r`, near(r.s[String(-len / 2)].o, tgt / 2), `r=${r.s[String(-len / 2)].o}`);
    ck(`OD t${tgt} l${len} D${D}: shoulder wall exact`, near(r.s[String(-(len - 0.3))].o, tgt / 2) && near(r.s[String(-(len + 0.4))].o, 10),
        `in=${r.s[String(-(len - 0.3))].o} out=${r.s[String(-(len + 0.4))].o}`);
}

// ── PARTING MATRIX: walls one-sided [face-kerf, face]; floor radius; peck advance count ────────
for (const [face, W, floorDia, peck] of [[-10, 3, 12, 0], [-10, 6, 12, 0], [-20, 3, 0, 0], [-15, 4, 8, 2], [-30, 3, 0, 3]]) {
    const zs = [face + 0.5, face - W + 0.5, face - W - 0.6, face + 1.2];
    const r = await run('user_lathe_parting', { zFace: face, width: W, floorDiameter: floorDia, peck }, zs.map(String));
    const fr = floorDia / 2, through = fr < 0.01;
    if (!through) {
        ck(`part f${face} w${W} fl${floorDia} p${peck}: slot floor`, near(r.s[String(face - W + 0.5)].o, fr), `r=${r.s[String(face - W + 0.5)].o} want=${fr}`);
        ck(`part f${face} w${W}: ahead-of-face uncut`, near(r.s[String(face + 1.2)].o, 10), `r=${r.s[String(face + 1.2)].o}`);
        ck(`part f${face} w${W}: behind far wall uncut`, near(r.s[String(face - W - 0.6)].o, 10), `r=${r.s[String(face - W - 0.6)].o}`);
    } else {
        ck(`part-off f${face} w${W} p${peck}: stub ends at face-kerf`, near(r.stats.zEnd, face - W, 0.3), `zEnd=${r.stats.zEnd} want=${face - W}`);
    }
    if (peck > 0) {
        const plunges = r.segs.filter((s) => near(s.z1, face - W, 0.01) && s.x2 < s.x1 - 1e-6);
        const wantN = Math.ceil((10 - fr) / peck);
        ck(`part f${face} peck${peck}: advance count`, plunges.length === wantN, `got=${plunges.length} want=${wantN}`);
    }
}

// ── DRILL MATRIX: peck floors -k*peck clamped to depth; bore walls; OD untouched ───────────────
for (const [depth, peck] of [[15, 5], [30, 4], [40, 6], [12, 0], [7, 10]]) {
    const r = await run('user_lathe_centerdrill', { depth, peck, kind: peck > 0 ? 'peck' : 'straight' }, [-(depth - 0.3), -(depth + 0.4), -depth / 2]);
    const bottoms = r.segs.filter((s) => s.z2 < s.z1 - 1e-6 && near(s.x1, 0, 0.01)).map((s) => +s.z2.toFixed(4));
    let want = [];
    if (peck > 0) { for (let d = peck; d < depth - 1e-9; d += peck) want.push(+(-d).toFixed(4)); want.push(-depth); }
    else want = [-depth];
    ck(`drill d${depth} p${peck}: peck floors`, JSON.stringify(bottoms) === JSON.stringify(want), `want=${JSON.stringify(want)} got=${JSON.stringify(bottoms)}`);
    ck(`drill d${depth} p${peck}: bore wall`, r.s[String(-(depth - 0.3))].i > 0.5 && r.s[String(-(depth + 0.4))].i === 0,
        `in=${r.s[String(-(depth - 0.3))].i} below=${r.s[String(-(depth + 0.4))].i}`);
    ck(`drill d${depth} p${peck}: OD untouched`, near(r.s[String(-depth / 2)].o, 10), `r=${r.s[String(-depth / 2)].o}`);
}

// ── POLYGON MATRIX: emitted sweep X range = [apothem, corner] per sides/across; A always with X ─
for (const [sides, across] of [[4, 20], [6, 17], [6, 24], [8, 20]]) {
    const r = await page.evaluate(async ({ sides, across }) => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_polygon');
        const nc = String(emitProgram(builderOf('user_lathe_polygon')({ ...uo.defaultParams(def), sides, acrossFlats: across })));
        const xs = []; let aNoX = 0;
        for (const L of nc.split('\n')) {
            if (!/^G1/.test(L)) continue;
            const mX = L.match(/\bX(-?\d+(?:\.\d+)?)/), hasA = /\bA-?\d/.test(L);
            if (hasA && !mX) aNoX++;
            if (mX) xs.push(Math.abs(parseFloat(mX[1])));
        }
        return { min: Math.min(...xs), max: Math.max(...xs), aNoX };
    }, { sides, across });
    const apo = across / 2, corner = apo / Math.cos(Math.PI / sides);
    ck(`poly n${sides} a${across}: min=apothem`, near(r.min, apo, 0.05), `min=${r.min} want=${apo}`);
    ck(`poly n${sides} a${across}: max=corner`, near(r.max, corner, 0.25), `max=${r.max} want=${corner.toFixed(3)}`);
    ck(`poly n${sides} a${across}: no A without X`, r.aNoX === 0, `aNoX=${r.aNoX}`);
}

await browser.close();
console.log(`MATRIX: ${R.pass} pass / ${R.fail} fail`);
console.log(R.lines.join('\n') || '(no failures)');
