import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * preview-spec-gate-1688 — THE PREVIEW GATE (browser-free tier).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
 * Measured at t1688: the EMIT is 32/32 declared and gated byte-for-byte (fork-parity-1593). The FORM is 32/32
 * declared and gated (twin-form-completeness-1581). The PREVIEW was 0/32 gated — ~2450 e2e tests assert emitted text
 * and data structures and essentially none render anything, so a preview defect could not turn a test red. On one
 * day that cost four production defects (t1672/t1686 the frame split, t1684 emits/teal, t1680 onEdit, t1674 noSnap),
 * one of them shipped by an approved fix. All four are the same shape: information declared upstream and silently
 * lost on the way to a renderer. This file makes that shape fail loud.
 *
 * ── WHAT IS GATED, AND WHY IN THIS TIER ──────────────────────────────────────────────────────────────────────────
 * `layoutSpecFromOp` (wizards/ops/panelTypes.js) returns a PLAIN OBJECT and needs only `window.ddcsGetSettings`;
 * `partZeroShift` (viz/sceneFrame.js), `buildCanvasWidgets` (viz/canvasWidgets.js), `latheLayoutSpec`
 * (viz/latheProfileCanvas.js) and `FeatureCanvas`'s constructor + `_fit`/`_S`/`_disp`/`getTransform` are all pure
 * arithmetic. So the whole DECLARATION → SPEC → FRAME half of the preview is computable with no browser, in
 * milliseconds. What is NOT computable here — SVG/canvas pixels, gestures, ResizeObserver, WebGL — stays in the
 * browser tier and is named in the FINDINGS block at the bottom of this file. Per support/register.mjs's own rule, a
 * module that needs a real DOM is a FINDING, not something to shim around.
 *
 * ── THE SIX PARTS ────────────────────────────────────────────────────────────────────────────────────────────────
 *   0. REGISTRY PARITY    — the twins are DISCOVERED (blocks/dataOps/*Data.js → every /DataDef$/ export) and
 *                           cross-checked against app.js's own SEED_BUILDERS. Never a hand-typed list (t1678/t1682).
 *   1. SPEC SNAPSHOT      — every twin × {defaults, off-defaults}, the WHOLE returned spec captured recursively
 *                           (no hand-picked field list — a hand-picked field list is literally the t1674/t1680
 *                           defect), diffed against a checked-in text fixture. This is the drift net. specFor now
 *                           threads a REAL simStart/sources/simMarkers (t1692's simInputsFor, pure — opSimStarts
 *                           alone), so a twin's __simstart handles are finally IN this snapshot, not invisible.
 *   2. FRAME INVARIANT    — spec.placement == partZeroShift(...), and the SVG layer and the overlay raster resolve a
 *                           world point to the SAME pixel through the app's own functions. (t1672 / t1686)
 *   3. GESTURE FORWARD    — every gesture in CANVAS_GESTURES forwards every generic decl property into its built
 *                           handle. (t1674 noSnap / t1684 emits / t1688 manual)
 *   4. DECL→SPEC SURVIVAL — onEdit reaches every twin's spec; a declared noSnap survives decl→spec; the emit-driving
 *                           signal has ONE declared name. (t1680 / t1674 / t1684)
 *   5. GLYPH RESOLVER      — resolveStartGlyph's (manual, emits) truth table, by value, in ISOLATION (P5a); every
 *                           renderer still imports the ONE resolver (P5b); and now the loop closes onto REAL
 *                           gate-visible handles (P5c, t1692) — corner's + alignment's actual (manual, emits) pairs
 *                           resolved to a hand-chosen expected glyph, not the resolver checked against itself.
 *
 * Parts 2-4 are NAMED assertions on top of the snapshot on purpose: a snapshot diff tells you a line moved, an
 * invariant tells you which contract broke. The snapshot catches what nobody thought to name.
 *
 * ── SNAPSHOT REGENERATION (deliberate, never accidental) ─────────────────────────────────────────────────────────
 *   compare (CI + default):   cd DDCS-Studio && npm run test:node
 *   regenerate:               UPDATE_PREVIEW_SNAPSHOT=1 npm run test:node   (PowerShell: $env:UPDATE_PREVIEW_SNAPSHOT=1)
 * Regeneration REWRITES the fixture AND FAILS the run, so the flag can never be left on in CI and the author is
 * forced to read `git diff tests/node/__snapshots__/` before the suite can go green again.
 *
 * ── STABILITY (a gate that flickers is worse than none) ──────────────────────────────────────────────────────────
 *   · Settings are PINNED before every test and restored after it. The pin is load-bearing, not decoration:
 *     partZeroShift returns {0,0,0} unless a machine envelope is shown, so at default settings spec.placement is
 *     {0,0} and t1672/t1686 are INVISIBLE. Part 2 asserts the pin is non-zero, and that it moves a real number of
 *     screen pixels, BEFORE it asserts anything about it — so the invariant cannot pass vacuously.
 *   · Floats: every captured number quantized to 1e-4 with -0 normalized to 0. Frame pixels compare at 1e-6 px (the
 *     real defect was 275 px). Nothing on this path uses Date, Math.random or locale formatting (grepped).
 *   · Key order: the serializer sorts keys recursively — layoutSpecFromOp's returns spread `...machSpread,
 *     ...cornerPick, ...edgePick` conditionally, so raw insertion order legitimately varies per op.
 *   · undefined vs absent: a present-but-undefined value serializes to "<undefined>", never dropped. That is exactly
 *     how `emits: d.emits` hides — a plain JSON.stringify capture would have been blind to t1684.
 *   · Functions: "<fn/arity>". Without this, onEdit is invisible — t1680 exactly.
 *   · Module state: setPreviewOnlyWriteHandler(null) + clearPreviewOnlyParams() before every case. layoutSpecFromOp
 *     WRITES during derivation (panelTypes.js:383-384) and with no DOM field those writes land in the module-level
 *     previewOnlyParams, so case n would contaminate case n+1. renderLayout2D is never called (it memoizes a
 *     FeatureCanvas in module scope).
 *   · Registration happens ONCE per process: a second registerUserOp throws for several twins (see
 *     twin-form-completeness-1581's header).
 *   · NOT flicker, but honest drift: the fixture is a clone of the shipped SETTINGS defaults with stock/machine
 *     overridden, so changing a shipped default the preview reads moves snapshot lines. That IS a preview change and
 *     deserves the review the regeneration flag forces — it is deterministic, not intermittent. (Verified: three
 *     consecutive regenerations produced byte-identical fixtures.)
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const WEB = path.join(ROOT, 'web');
const SNAP = path.join(ROOT, 'tests', 'node', '__snapshots__', 'preview-spec-1688.txt');

/**
 * Playwright's `expect(value, description)` second argument is surfaced by the PLAYWRIGHT REPORTER. This tier runs
 * under node:test, which drops it — a red gate would print a bare value diff and no contract. `must()` prepends the
 * sentence to the thrown error, because the sentence IS the deliverable: a diff says a number moved, the sentence
 * says which declared contract stopped holding and where to fix it.
 */
function must(message, fn) {
    try { fn(); } catch (err) { err.message = `\n  GATE: ${message}\n\n${err.message}`; throw err; }
}

// ── THE PINNED FIXTURE ───────────────────────────────────────────────────────────────────────────────────────────
// A WCS pin with a shown envelope — the t1686 repro recipe, as data. g55 = table[1] = {300,200} → partZeroShift
// {x:300,y:200}. Deliberately asymmetric (300 ≠ 200) so an x/y swap cannot hide.
const PIN = {
    stock: { show: true, x: 200, y: 150, z: 25, datum: 'nnp', pin: 'g55', shape: 'box' },
    machine: { show: true, x: 800, y: 600, z: -120, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }, { x: 0, y: 0, z: 0 }] } },
};
const EXPECTED_PIN = { x: 300, y: 200 };

// ── THE CANONICAL SERIALIZER ─────────────────────────────────────────────────────────────────────────────────────
const q4 = (n) => { const v = Math.round(n * 1e4) / 1e4; return Object.is(v, -0) ? 0 : v; };
function canon(v, seen = new Set()) {
    if (v === undefined) return '<undefined>';
    if (v === null) return null;
    const t = typeof v;
    if (t === 'function') return '<fn/' + v.length + '>';
    if (t === 'number') return Number.isNaN(v) ? '<NaN>' : (v === Infinity ? '<+Inf>' : (v === -Infinity ? '<-Inf>' : q4(v)));
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'bigint' || t === 'symbol') return '<' + t + '>';
    if (seen.has(v)) throw new Error('preview-spec-gate-1688: a cycle in the captured spec — the capture must stay a pure data tree');
    seen.add(v);
    const out = Array.isArray(v) ? v.map((e) => canon(e, seen))
        : Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k], seen); return o; }, {});
    seen.delete(v);
    return out;
}
const J = (v) => JSON.stringify(canon(v));

// ── SETUP (memoized: one registration pass per process) ──────────────────────────────────────────────────────────
let _booted = null;
function boot() { return (_booted = _booted || _boot()); }
async function _boot() {
    const settingsPanel = await import('/ui/settingsPanel.js');
    const shipped = settingsPanel.getSettings();
    const fixture = JSON.parse(JSON.stringify(shipped));
    fixture.stock = { ...(fixture.stock || {}), ...PIN.stock };
    fixture.machine = { ...(fixture.machine || {}), ...PIN.machine };
    Object.freeze(fixture);
    const realGetSettings = window.ddcsGetSettings;
    window.ddcsGetSettings = () => fixture;

    const userOps = await import('/blocks/userOps.js');
    const panelTypes = await import('/wizards/ops/panelTypes.js');
    const sceneFrame = await import('/viz/sceneFrame.js');
    const canvasWidgets = await import('/viz/canvasWidgets.js');
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');   // t1692 — pure (params, stock) => per-pass rows; the ONE source specFor's simStart/simMarkers derivation reads (see simInputsFor)
    // t1688 — _pinFromTf is the PRODUCTION overlay pin. It is a pure one-liner that lived unexported inside a DOM
    // module; exporting it (the ONLY change this gate makes to web/ — an `export` keyword, no behaviour change) is
    // what makes the frame seam that split TWICE reachable by a gate at all.
    const { _pinFromTf } = await import('/wizards/views/userOpView.js');

    // ── ENUMERATION, FROM THE REGISTRY ────────────────────────────────────────────────────────────────────────────
    // app.js IS the registry of record (SEED_BUILDERS) but is not importable in this tier — it calls finishBoot() at
    // module scope and dies on `Audio is not defined`. So the twins are DISCOVERED from the dataOps directory and
    // cross-checked against app.js's declared seed list textually (Part 0): two independent derivations that must
    // agree, neither of them a hand-typed list. (The clean fix, reported not taken because it is a web/ change
    // outside this gate's remit: lift SEED_BUILDERS into its own leaf module both app.js and this tier import.)
    const dir = path.join(WEB, 'blocks', 'dataOps');
    const files = fs.readdirSync(dir).filter((f) => /Data\.js$/.test(f)).sort();
    const twins = [];
    for (const f of files) {
        const mod = await import('/blocks/dataOps/' + f);
        for (const key of Object.keys(mod).filter((k) => /DataDef$/.test(k))) {
            const def = mod[key]();
            userOps.registerUserOp(def);   // ONCE per process — sets def.panel/def.layout + the preview-geometry registry
            twins.push({ file: f, builder: key, def });
        }
    }
    twins.sort((a, b) => (a.def.opType < b.def.opType ? -1 : a.def.opType > b.def.opType ? 1 : 0));

    return { fixture, realGetSettings, userOps, panelTypes, sceneFrame, canvasWidgets, FeatureCanvas, opSimStarts, _pinFromTf, files, twins };
}

/**
 * OFF-DEFAULTS — fork-parity-1593's own sweep rule (tests/fork-parity-1593.spec.js:146-172), with its
 * `blockIndex == null` filter REMOVED on purpose: there, structural bindings are held still because they choose the
 * emit ARM; here they choose the PREVIEW'S SHAPE, which is the whole point (it is what puts zMode='skim' on
 * surfacing and lights up noSnap). Its throw-on-unrecognized-type half is kept verbatim: a future 5th binding type
 * must be HANDLED here, not silently swept as nothing.
 */
function offDefaults(def, base) {
    const P = { ...base };
    for (const b of (def.bindings || [])) {
        if (b.type === 'number' || b.type === 'int') P[b.param] = Number(b.default || 0) + 7;
        else if (b.type === 'bool') P[b.param] = !b.default;
        else if (b.type === 'enum') {
            const opts = (b.widgetConfig && b.widgetConfig.options) || [];
            const alt = opts.map(([, v]) => v).find((v) => v !== b.default);
            if (alt !== undefined) P[b.param] = alt;   // a single-option enum has no alternative — the ONE declared skip
        } else if (b.type === 'string') P[b.param] = String(b.default || '') + ' [t1688 off-default]';
        else throw new Error(`preview-spec-gate-1688: binding "${b.param}" on ${def.opType} has an unrecognized type "${b.type}" — add a branch above rather than letting it sweep nothing`);
    }
    return P;
}

/**
 * t1692 THE GATE GAP — layoutSpecFromOp's simStart/sources/simMarkers arguments were hardcoded null here, so the
 * __simstart handles (corner's own sim-only Start + reposition markers, the exact glyphs t1688 unified) were
 * invisible to this gate — the resolver could grow a fourth divergent rule and nothing here would go red.
 *
 * Reproduces the TWO construction branches userOpView.js reaches WITHOUT a live `panel` object (opSimStarts itself
 * is pure — no DOM, no WebGL): the plain simStart for an op with no def.simStartParams (corner), and the
 * spb-driven simMarkers for one that declares it (alignment, rotary_clock — same seam, not a second mechanism:
 * both read opSimStarts' output, userOpView.js:570-574's own spb.map(...) is copied verbatim here). VERIFIED
 * byte-identical against a live-app probe of the REAL panel.getPassStarts()/getPassSources() for an undragged
 * default state, corner AND alignment, before writing this (see WORK-LOG t1692) — not assumed from reading alone.
 *
 * NOT reachable here, named rather than faked: userOpView.js's `manualMarkers` (a corner pass with
 * travelApproach:'manual') and `entryMarkers` (def.entryPoint) BOTH require `typeof panel.onStartDrag ===
 * 'function'` — a live panel this tier genuinely cannot construct. An op/param-state that would hit those branches
 * in the real browser still snapshots via the plain-simStart fallback here, which is the WRONG marker set for that
 * state — a real, remaining gap, not a defect in what this DOES cover. See FINDING F5.
 */
function simInputsFor(env, def, params) {
    const starts = env.opSimStarts(def.opType, params, env.fixture.stock);
    if (!Array.isArray(starts) || !starts.length) return { simStart: null, sources: null, simMarkers: null };
    const sources = starts.map((s) => s.source || 'auto');   // getPassSources() defaults an undeclared source to 'auto' — matched, not assumed (probed)
    const spb = def.simStartParams;
    if (spb) {
        const simMarkers = spb.map((_m, i) => (starts[i] && Number.isFinite(+starts[i].x)) ? { pos: starts[i], label: String.fromCharCode(65 + i) } : null).filter(Boolean);
        return { simStart: null, sources, simMarkers };
    }
    const pos0 = starts[0] || null;
    return { simStart: pos0 ? { pos: pos0, emits: pos0.emits } : null, sources, simMarkers: null };
}

/** The op's 2D spec for a param state, with the module-level preview side-store cleared first. */
function specFor(env, def, params) {
    env.panelTypes.setPreviewOnlyWriteHandler(null);
    env.panelTypes.clearPreviewOnlyParams();
    const { simStart, sources, simMarkers } = simInputsFor(env, def, params);
    return env.panelTypes.layoutSpecFromOp(def, params, simStart, sources, null, null, null, null, simMarkers);
}

function casesFor(env, def) {
    const base = env.userOps.defaultParams(def);
    return [['defaults', base], ['offdefaults', offDefaults(def, base)]];
}

/** Every handle of every twin in every case — the shared read behind Part 4's contracts. */
function allHandles(env) {
    const out = [];
    for (const { def } of env.twins) {
        for (const [caseName, params] of casesFor(env, def)) {
            const spec = specFor(env, def, params);
            (spec.handles || []).forEach((h, i) => out.push({ opType: def.opType, caseName, i, h }));
        }
    }
    return out;
}

/**
 * One decl per gesture, carrying EVERY generic (gesture-independent) property plus a numeric context bag wide enough
 * for any gesture's place(). Deliberately over-supplied: a gesture reads what it needs, and the generics must survive
 * regardless of which. Driven by Object.keys(CANVAS_GESTURES), so a NEW gesture is covered the day it is registered.
 */
const GENERIC_PROPS = { id: 'probe', color: '#abcdef', noSnap: true, emits: false, manual: true };   // t1688 — manual joins noSnap/emits: the same generic-forward defect (t1674/t1684), a third time
function gestureProbe(type) {
    return {
        type, ...GENERIC_PROPS, label: 'L',
        fx: 'fx', fy: 'fy', field: 'f', fieldH: 'fh', fieldA: 'fa', fieldAxis: 'fax', fieldDir: 'fdir',
        fieldTravel: 'ftrav', fieldPrimary: 'fprim',
        x: 3, y: 5, ax: 1, ay: 2, cx: 4, cy: 6, ex: 7, ey: 8, sx: 1, sy: 1, edgeX: 9, h: 10,
        axis: 'x', dir: 'pos', value: 11, r: 12, a: 0.5, rScale: 1, nx: 1, ny: 0, off: 13, scale: 1, dist: 14,
        centreSec: 15, sign: 1, travel: 16, prim: 17, primaryX: true, wallFace: 18, cross: 19, lineAt: 20, axisX: true,
        xs: [['x1', 1]], ys: [['y1', 2]],
    };
}

// The pin is (re)installed before EVERY test and removed after it — never left dangling for a later test to inherit,
// and never restored mid-file (boot() is memoized, so a one-shot pin inside it would only cover test #1).
test.beforeEach(async () => { const env = await boot(); window.ddcsGetSettings = () => env.fixture; });
test.afterEach(async () => { const env = await boot(); window.ddcsGetSettings = env.realGetSettings; });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 0 — THE REGISTRY IS DISCOVERED, AND THE TWO DERIVATIONS AGREE
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('preview gate P0: the twin set is discovered from dataOps/ and matches app.js SEED_BUILDERS', async () => {
    const env = await boot();
    const appSrc = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
    const block = appSrc.match(/export const SEED_BUILDERS = \[([\s\S]*?)\];/);
    must('app.js no longer declares `export const SEED_BUILDERS = [...]` — the registry of record moved; point this gate at its new home rather than letting the cross-check silently stop cross-checking',
        () => expect(!!block).toBe(true));
    const seeded = [...new Set(block[1].match(/\b\w+DataDef\b/g) || [])].sort();
    const discovered = [...new Set(env.twins.map((t) => t.builder))].sort();
    must('the two derivations of the twin registry disagree: a blocks/dataOps/*Data.js builder exists that app.js never seeds, or app.js seeds a builder no dataOps file exports',
        () => expect(discovered).toEqual(seeded));
    const opTypes = env.twins.map((t) => t.def.opType);
    must('two twins claim the same opType — the later registration silently replaces the earlier one',
        () => expect(new Set(opTypes).size).toBe(opTypes.length));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 1 — THE SPEC SNAPSHOT (the drift net)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('preview gate P1: every twin\'s declared 2D spec matches the checked-in snapshot', async () => {
    const env = await boot();
    const G = env.canvasWidgets.CANVAS_GESTURES;
    const lines = [];
    lines.push(`# preview-spec gate 1688 — ${env.twins.length} twins × 2 param states · ${Object.keys(G).length} gestures`);
    lines.push(`# fixture: stock ${PIN.stock.x}×${PIN.stock.y} pin=${PIN.stock.pin} · machine ${PIN.machine.x}×${PIN.machine.y}×${PIN.machine.z} · partZeroShift → ${J(EXPECTED_PIN)}`);
    lines.push('# encoding: keys sorted recursively · numbers rounded to 1e-4 (-0→0) · present-but-undefined → "<undefined>" (NEVER dropped) · function → "<fn/arity>"');
    lines.push('#');

    for (const { def } of env.twins) {
        for (const [caseName, params] of casesFor(env, def)) {
            const spec = specFor(env, def, params);
            const tag = `${def.opType} @${caseName}`;
            lines.push(`${tag} .panel ${J({ panel: def.panel, layout: def.layout, keys: Object.keys(spec).sort() })}`);
            for (const key of Object.keys(spec).sort()) {
                const v = spec[key];
                if (Array.isArray(v)) {
                    lines.push(`${tag} .${key} <${v.length} entries>`);
                    v.forEach((e, i) => lines.push(`${tag} .${key}[${i}] ${J(e)}`));
                } else {
                    lines.push(`${tag} .${key} ${J(v)}`);
                }
            }
        }
    }

    // Part 3's rows live in the same fixture: a NEW gesture appears as a new line a human must accept.
    for (const type of Object.keys(G).sort()) {
        const built = env.canvasWidgets.buildCanvasWidgets([gestureProbe(type)], () => { });
        lines.push(`gesture ${type} ${J(built.handles[0])}`);
    }

    const OUT = lines.join('\n') + '\n';
    if (process.env.UPDATE_PREVIEW_SNAPSHOT) {
        fs.mkdirSync(path.dirname(SNAP), { recursive: true });
        fs.writeFileSync(SNAP, OUT);
        throw new Error(`preview snapshot REGENERATED at ${path.relative(ROOT, SNAP)} — read \`git diff\` on it, then re-run WITHOUT UPDATE_PREVIEW_SNAPSHOT`);
    }
    must(`missing snapshot fixture ${path.relative(ROOT, SNAP)} — create it with UPDATE_PREVIEW_SNAPSHOT=1 npm run test:node`,
        () => expect(fs.existsSync(SNAP)).toBe(true));
    // LINE ENDINGS: this repo runs core.autocrlf=true, so the checked-out fixture is CRLF on Windows and LF on a
    // Linux CI runner while the freshly-rendered OUT is always LF. Splitting on /\r?\n/ makes the comparison a
    // comparison of CONTENT — otherwise the gate would go red on every fresh clone, which is the flicker a gate
    // exists to not have.
    const lineSplit = (s) => s.split(/\r?\n/);
    must('the declared preview spec CHANGED. Read the diff line by line: a KEY that disappeared is a declaration a renderer stopped receiving (t1674 noSnap / t1680 onEdit / t1684 emits); a NUMBER that moved is geometry. If the change is intended, regenerate with UPDATE_PREVIEW_SNAPSHOT=1 and review the fixture diff.',
        () => expect(lineSplit(OUT)).toEqual(lineSplit(fs.readFileSync(SNAP, 'utf8'))));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 2 — THE FRAME INVARIANT (t1672 the read, t1686 the accessor)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('preview gate P2a: every twin\'s spec.placement IS partZeroShift — the ONE declared scene transform', async () => {
    const env = await boot();
    const truth = env.sceneFrame.partZeroShift(env.fixture.machine, env.fixture.stock, null);
    must('the pinned fixture no longer produces a non-zero shift — every claim below this line would pass vacuously',
        () => expect({ x: truth.x, y: truth.y }).toEqual(EXPECTED_PIN));

    const missing = [], wrong = [];
    for (const { def } of env.twins) {
        if (def.layout && def.layout.kind === 'lathe_profile') continue;   // the lathe half-profile is its own frame — see FINDING F4
        const spec = specFor(env, def, env.userOps.defaultParams(def));
        if (!spec.placement) { missing.push(def.opType); continue; }
        if (spec.placement.x !== truth.x || spec.placement.y !== truth.y) wrong.push(`${def.opType} → ${J(spec.placement)} (partZeroShift says ${J({ x: truth.x, y: truth.y })})`);
    }
    must('a twin\'s 2D spec carries NO placement key at all — its Layout pane cannot ride the WCS pin the 3D pane always rides (t1672)',
        () => expect(missing).toEqual([]));
    must('a twin\'s spec.placement disagrees with partZeroShift, THE one declared scene transform — the Layout pane and the 3D pane are drawing in different frames (t1672: the read was gated behind toolMachineFrame, so every non-machine-frame op sat unshifted whenever a WCS pin was active)',
        () => expect(wrong).toEqual([]));
});

test('preview gate P2b: the SVG layer and the overlay raster resolve a world point to the SAME pixel (t1686)', async () => {
    const env = await boot();
    const px6 = (p) => ({ x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 });

    // A real twin, a real pinned spec, the app's OWN fit — no invented transform anywhere.
    const def = env.twins.find((t) => t.def.opType === 'user_surfacing_data').def;
    const spec = specFor(env, def, env.userOps.defaultParams(def));
    must('the fixture stopped producing a pin — P2b would pass vacuously (the missing term was always zero, which is exactly why t1686 shipped unnoticed)',
        () => expect(spec.placement).toEqual(EXPECTED_PIN));

    const VW = 800, VH = 354;
    const fc = new env.FeatureCanvas();
    fc._vw = VW; fc._vh = VH;
    fc._tf = fc._fit(spec, VW, VH);      // _fit is pure (featureCanvas.js) — the PRODUCTION fit, not a stand-in
    fc._placement = spec.placement;      // exactly what _draw assigns from spec.placement

    const P = spec.handles[0];           // a real handle world position the SVG actually draws
    const svgPx = px6(fc._disp(P.x, P.y));   // where the SVG layer puts it — the app's own accessor

    // NON-VACUITY FIRST: the pin must actually move a visible number of pixels, or every equality below is two names
    // for zero. (t1686's own log records a first-draft check that was itself vacuous.)
    const unpinned = new env.FeatureCanvas();
    unpinned._vw = VW; unpinned._vh = VH; unpinned._tf = fc._tf; unpinned._placement = { x: 0, y: 0 };
    const shiftPx = Math.abs(unpinned._disp(P.x, P.y).x - svgPx.x);
    must('the placement shift resolves to ~0 screen px — this test can no longer distinguish a folded frame from an unfolded one',
        () => expect(shiftPx > 1).toBe(true));

    // (a) getTransform()'s OWN documented contract: "the returned transform IS _disp". A second canvas handed that
    //     transform as its raw _tf must therefore place P identically. Zero re-derived math on either side.
    const relay = new env.FeatureCanvas();
    relay._tf = fc.getTransform();
    must('FeatureCanvas.getTransform() is not folding _placement — anything painting under/over the SVG (the toolpath2d animation overlay, via userOpView.wireAnimOverlay) draws in a DIFFERENT frame than the SVG it sits under. On screen the split equals the WCS-pin offset exactly (t1686).',
        () => expect(px6(relay._S(P.x, P.y))).toEqual(svgPx));

    // (b) the PRODUCTION pin function, through the overlay's own documented map (toolpath2d.js:82-83 and :364 —
    //     "sx = ox + x*scale, sy = oy - y*scale"). These are the two lines the raster actually paints with.
    const pin = env._pinFromTf(fc.getTransform());
    const rasterPx = px6({ x: pin.ox + P.x * pin.scale, y: pin.oy - P.y * pin.scale });
    must('userOpView\'s _pinFromTf(fc.getTransform()) lands a world point away from where FeatureCanvas._disp puts it — the 2D Layout pane is SPLIT: SVG stock/handles at the pinned position, animated toolpath raster at the pre-pin position (t1672/t1686)',
        () => expect(rasterPx).toEqual(svgPx));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 3 — THE GESTURE FORWARD CONTRACT (t1674 noSnap, t1684 emits)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('preview gate P3: every gesture forwards every generic decl property into its built handle', async () => {
    const env = await boot();
    const G = env.canvasWidgets.CANVAS_GESTURES;
    const types = Object.keys(G).sort();
    must('the gesture registry is empty — nothing is being checked', () => expect(types.length > 0).toBe(true));

    const dropped = [];
    for (const type of types) {
        const built = env.canvasWidgets.buildCanvasWidgets([gestureProbe(type)], () => { });
        must(`gesture "${type}" built no handle from a fully-supplied decl`, () => expect(built.handles.length).toBe(1));
        must('buildCanvasWidgets stopped returning onEdit — every consumer loses on-canvas click-to-edit (t1680)',
            () => expect(typeof built.onEdit).toBe('function'));
        const h = built.handles[0];
        for (const k of Object.keys(GENERIC_PROPS)) {
            // A gesture's own place() may legitimately OVERRIDE a generic (kind/label); it may never SWALLOW one.
            if (!(k in h)) dropped.push(`${type}.${k} — key ABSENT from the built handle`);
            else if (h[k] !== GENERIC_PROPS[k]) dropped.push(`${type}.${k} = ${J(h[k])} (the decl declared ${J(GENERIC_PROPS[k])})`);
        }
    }
    must('buildCanvasWidgets silently DROPPED a declared, gesture-independent handle property. This is exactly the t1674 (noSnap) and t1684 (emits) defect: a hand-picked spread at viz/canvasWidgets.js instead of a generic forward. Every renderer downstream stops receiving a signal the declaration still sets.',
        () => expect(dropped).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 4 — DECLARATION → SPEC SURVIVAL (t1680 onEdit, t1674 noSnap end-to-end, t1684 one vocabulary)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('preview gate P4a: onEdit reaches EVERY twin\'s 2D spec — click-to-edit + the live value readout (t1680)', async () => {
    const env = await boot();
    const broken = [];
    for (const { def } of env.twins) {
        for (const [caseName, params] of casesFor(env, def)) {
            const spec = specFor(env, def, params);
            if (typeof spec.onEdit !== 'function') broken.push(`${def.opType} @${caseName} → onEdit is ${J(spec.onEdit)}`);
        }
    }
    must('layoutSpecFromOp (or a lathe spec builder) is not forwarding buildCanvasWidgets\'s onEdit into its returned spec — every twin listed loses on-canvas click-to-edit AND its live value readout. buildCanvasWidgets returns {handles, onDrag, onEdit}; destructuring only two of the three is t1680.',
        () => expect(broken).toEqual([]));
});

test('preview gate P4b: a DECLARED handle property survives decl → spec (t1674 noSnap, end to end)', async () => {
    const env = await boot();
    const def = env.twins.find((t) => t.def.opType === 'user_surfacing_data').def;
    // surfacingData.js:183 declares `noSnap: p.zMode === 'skim'` on sf_pos — a free jog target with no corner
    // semantics. BOTH states are asserted, so this cannot pass by the property having become a constant.
    const skim = specFor(env, def, { ...env.userOps.defaultParams(def), zMode: 'skim' });
    const normal = specFor(env, def, { ...env.userOps.defaultParams(def), zMode: 'normal' });
    const posOf = (s) => (s.handles || []).find((h) => h.id === 'sf_pos');
    must('surfacing lost its sf_pos handle entirely — the decl→spec path this test measures is gone', () => expect(!!posOf(skim)).toBe(true));
    must('the DECLARED noSnap on surfacing\'s Skim jog marker did not survive into the built handle — the itemsBBox stock-anchor magnetism it opts out of is back, and the marker snaps to a virtual net spanning the whole W×H rect (t1674)',
        () => expect(posOf(skim).noSnap).toBe(true));
    must('noSnap is stuck true in BOTH zModes — the declaration is not being read, it is being invented',
        () => expect(posOf(normal).noSnap).toBe(false));
});

test('preview gate P4c: the emit-driving handle signal has ONE declared name across every twin (t1684)', async () => {
    const env = await boot();
    const handles = allHandles(env);
    must('no twin produced a handle — P4c would pass vacuously', () => expect(handles.length > 20).toBe(true));

    // t1684 reconciled lathe's `teal` and corner's `emits` to ONE name. A second vocabulary reappearing IS the defect
    // returning: a signal every renderer was taught to read under one name, declared under another → read by nobody.
    const RETIRED = ['teal'];
    const rogue = handles.filter(({ h }) => RETIRED.some((k) => k in h)).map(({ opType, caseName, i, h }) => `${opType} @${caseName} handles[${i}] declares {${RETIRED.filter((k) => k in h).join(',')}} instead of emits`);
    must(`a handle declares a RETIRED emit-signal name (${RETIRED.join('/')}) instead of the ONE declared name \`emits\`. No renderer reads the retired name, so the signal is declared and dead — the exact census finding-2 shape (t1684): lathe's teal and corner's emits were the same "does dragging this drive the emitted G-code" signal under two vocabularies.`,
        () => expect(rogue).toEqual([]));

    // …and the declarers still declare it. The lathe half-profile builders are the population carrying emits:true.
    const lathe = handles.filter(({ opType }) => opType.startsWith('user_lathe_'));
    must('no lathe handles were produced — the emits declarers vanished, so the check above is vacuous', () => expect(lathe.length > 5).toBe(true));
    const undeclared = lathe.filter(({ h }) => h.emits !== true).map(({ opType, caseName, i, h }) => `${opType} @${caseName} handles[${i}] → emits=${J(h.emits)}`);
    must('a lathe dimension handle stopped declaring emits:true — featureCanvas.js tints a handle teal off that flag, so it silently loses its "dragging me changes the program" signal (t1684)',
        () => expect(undeclared).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 5 — THE GLYPH RESOLVER (t1688): one declared rule, no third copy
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// t1684 left THREE renderer-local rules for a start/reposition marker's shape+fill+colour that could (and did)
// disagree: featureCanvas.js kept shape=manual/hollow=(emits===false) for ANY pass; toolpath2d.js matched but
// hard-forced pass 0 to never render hollow; gcodeViz3d.js picked SHAPE from emits and used manual only as a
// fallback when emits was undeclared — a structurally different axis. t1688 replaces all three with viz/startGlyph.js,
// called by every renderer. Part 5a proves the pure function's truth table; 5b proves nobody stopped calling it.
test('preview gate P5a: resolveStartGlyph is a pure function of (manual, emits) — the declared truth table, by value', async () => {
    const env = await boot();
    const { isManualStart, resolveStartGlyph } = await import('/viz/startGlyph.js');

    must('isManualStart(source, 0) must be true regardless of source — the FIRST surviving pass is always the operator\'s own jog (t293), even when its internal reposition source says otherwise (corner forces source:\'auto\' at index 0)',
        () => { expect(isManualStart('auto', 0)).toBe(true); expect(isManualStart('manual', 0)).toBe(true); expect(isManualStart(undefined, 0)).toBe(true); });
    must('isManualStart(source, p>0) must follow the declared source alone',
        () => { expect(isManualStart('auto', 1)).toBe(false); expect(isManualStart('manual', 1)).toBe(true); });

    // shape follows manual ONLY; fill follows emits ONLY (emits!==false); the two axes are independent. The
    // manual+emits:true row is the combo that was structurally UNREACHABLE before t1688 (gcodeViz3d's old
    // single-argument `_startGlyphTex(emits)` made emits pick shape too, so a manual pass could never render a
    // filled CIRCLE — only ever a filled square).
    const cases = [
        { manual: false, emits: true, want: { shape: 'square', fill: true, colour: '#22d3ee' } },
        { manual: false, emits: false, want: { shape: 'square', fill: false, colour: '#22d3ee' } },
        { manual: false, emits: undefined, want: { shape: 'square', fill: true, colour: '#22d3ee' } },
        { manual: true, emits: true, want: { shape: 'circle', fill: true, colour: '#ffb300' } },
        { manual: true, emits: false, want: { shape: 'circle', fill: false, colour: '#ffb300' } },
        { manual: true, emits: undefined, want: { shape: 'circle', fill: true, colour: '#ffb300' } },
    ];
    const wrong = cases.filter((c) => {
        const g = resolveStartGlyph(c.manual, c.emits);
        return g.shape !== c.want.shape || g.fill !== c.want.fill || g.colour !== c.want.colour;
    }).map((c) => `resolveStartGlyph(${c.manual}, ${J(c.emits)}) → got ${J(resolveStartGlyph(c.manual, c.emits))}, wanted ${J(c.want)}`);
    must('resolveStartGlyph disagrees with the declared truth table for at least one (manual, emits) combo — shape must track manual ONLY and fill must track emits ONLY, independently of each other',
        () => expect(wrong).toEqual([]));
});

test('preview gate P5b: every renderer that draws a start/reposition glyph imports the ONE resolver — no third local copy', async () => {
    const rendererFiles = ['viz/featureCanvas.js', 'viz/toolpath2d.js', 'viz/gcodeViz3d.js'];
    const missing = rendererFiles.filter((f) => !/from ['"]\.\/startGlyph\.js['"]/.test(fs.readFileSync(path.join(WEB, f), 'utf8')));
    must(`a renderer stopped importing viz/startGlyph.js and is free to re-decide the shape/fill/colour rule locally again — the exact disease t1688 fixed (three independently-maintained rules that agreed only until they didn't). Missing import in: ${missing.join(', ') || '(none)'}`,
        () => expect(missing).toEqual([]));
});

// t1692 — P5a pins resolveStartGlyph in ISOLATION (its own inputs, made up). This closes the loop onto the
// GATE-VISIBLE handles specFor's simInputsFor now produces (F2's threading) — real (manual, emits) pairs this gate
// captures, resolved to a HAND-CHOSEN independent expectation (never resolveStartGlyph compared to itself, which
// would be tautological). Covers a declared-emits op (corner: the sim-only Start, the always-emitting wall-2
// reposition, and wall-2 again under manual travel — the offDefaults() sweep flips corner's travelApproach, and
// F2 above says why that combination doesn't correspond to one real browser state, but the PER-HANDLE resolve is
// still independently correct) and an undeclared-emits op (alignment — undefined must read as filled, per t1684's
// backward-compat guarantee).
test('preview gate P5c: real gate-visible handles (corner + alignment) resolve to the CORRECT glyph facts', async () => {
    const env = await boot();
    const { resolveStartGlyph } = await import('/viz/startGlyph.js');
    const cases = [
        { opType: 'user_corner_data', caseName: 'defaults', id: '__simstart0', want: { shape: 'circle', fill: false, colour: '#ffb300' } },
        { opType: 'user_corner_data', caseName: 'defaults', id: 'reposition_pos', want: { shape: 'square', fill: true, colour: '#22d3ee' } },
        { opType: 'user_corner_data', caseName: 'offdefaults', id: 'reposition_pos', want: { shape: 'circle', fill: true, colour: '#ffb300' } },
        { opType: 'user_alignment_data', caseName: 'defaults', id: '__simstart0', want: { shape: 'square', fill: true, colour: '#22d3ee' } },
    ];
    const handles = allHandles(env);
    const wrong = [];
    for (const c of cases) {
        const row = handles.find(({ opType, caseName, h }) => opType === c.opType && caseName === c.caseName && h.id === c.id);
        if (!row) { wrong.push(`${c.opType} @${c.caseName} handle "${c.id}" not found — the case list drifted from the real spec`); continue; }
        const g = resolveStartGlyph(!!row.h.manual, row.h.emits);
        if (g.shape !== c.want.shape || g.fill !== c.want.fill || g.colour !== c.want.colour) {
            wrong.push(`${c.opType} @${c.caseName} "${c.id}" (manual=${J(row.h.manual)}, emits=${J(row.h.emits)}) → resolved ${J(g)}, wanted ${J(c.want)}`);
        }
    }
    must('a real, gate-visible start/reposition handle resolves to the WRONG glyph — either startGlyph.js regressed, or the declared manual/emits this gate derives from opSimStarts no longer matches what the app actually computes',
        () => expect(wrong).toEqual([]));
});

/**
 * ── FINDINGS — what this tier CANNOT gate, reported rather than shimmed ──────────────────────────────────────────
 *
 * F1. ✅ RESOLVED (t1690). `_writable` declared from formWidgets.js's own MULTI_WIDGETS registry instead of a DOM
 *     query. MEASURED, not assumed from the fix's shape: only 2 of the originally-named 17 twins (corner, middle)
 *     were actually blocked by this — the other 15 either declare zero role/group canvas bindings at all (13; no
 *     spatial handle exists to gain, confirmed by grepping every file) or use the separate simStartParams/
 *     simMarkers mechanism this finding's OWN F2 covers (alignment, rotary_clock — 2). The original dispatch's "17"
 *     estimate came from the gate-builder report, relayed without independently checking it; corrected here.
 *
 * F2. ✅ PARTIALLY ADDRESSED (t1692). `computePassStarts` still lives INSIDE createPreviewPanel.js:769 (a factory
 *     that does container.insertAdjacentHTML and imports GcodeViz3D) — NOT extracted, per this finding's original
 *     suggestion. Instead, `specFor`'s new `simInputsFor` helper reproduces the TWO branches of userOpView.js's own
 *     simStart/simMarkers construction that are ALREADY pure (both read only `opSimStarts(opType, params, stock)` —
 *     no live `panel` needed): the plain simStart for a non-simStartParams op (corner, edge, homing, rotary_center,
 *     middle's Start marker), and the spb-driven simMarkers for a simStartParams op (alignment, rotary_clock — the
 *     SAME seam, not a second mechanism, verified by reading userOpView.js:570-574 and copying its exact logic).
 *     VERIFIED byte-identical against a live-app probe of the REAL panel's getPassStarts()/getPassSources() for an
 *     undragged default state (corner + alignment, exact match on every field) before writing the gate code.
 *     ⚠ REMAINING GAP, found while building this: userOpView.js's `manualMarkers` branch (built when ANY pass's
 *     travelApproach source is 'manual') REPLACES the plain-simStart/byRole markers entirely with a different set
 *     (mkManual's own `__simstart`-prefixed ids) — and requires a live `panel.onStartDrag`, which this tier cannot
 *     construct. `offDefaults()` (Part 1's own off-default sweep) DOES flip corner's `travelApproach` to 'manual' —
 *     so `user_corner_data @offdefaults`'s snapshot combination (byRole `reposition_pos`/`start_pos` handles
 *     existing ALONGSIDE the plain-simStart `__simstart0`) is a combination the REAL browser would never actually
 *     render for that exact param state — the real browser replaces it with manualMarkers' own set instead. The
 *     per-handle glyph facts this gate asserts (P5c) are still independently true (resolveStartGlyph is a pure
 *     function of whatever manual/emits IT is given, correct regardless of which marker SET surrounds it) — but the
 *     SNAPSHOT's off-defaults handle SET for corner should not be read as "what the browser shows when travel is
 *     manual." Not fixed here: replicating manualMarkers' panel-dependent construction is a second, separate
 *     mechanism (this finding's own "don't build a second path" standard), not a threading gap like the other two.
 *
 * F3. Genuinely render-tier, no fix implied, the browser specs stay:
 *       · FeatureCanvas.render/_mount/_draw/_fit-against-a-real-box — ResizeObserver, createElementNS, a measured
 *         pane size. In particular the SECOND half of t1686 (the part-zero crosshair drawn through `_S` instead of
 *         `_disp`, featureCanvas.js:435) is a _draw line: covered by tests/layout-overlay-frame-1686.spec.js.
 *       · The overlay RASTER itself (viz/toolpath2d.js, getContext('2d')) — tests/corner-anim-overlay.spec.js.
 *       · Anything READING emits/noSnap into paint — solid-vs-hollow, the teal tint, _snapOffsets suppression:
 *         tests/census-finding2-emits-teal-1684.spec.js, tests/corner-data-sim-marker-emits.spec.js. The
 *         "declared but read by NO renderer" half of t1684 is already gated textually by the existing
 *         tests/node/declared-key-coverage-1678.test.mjs (CLEAN_SHAPES → featureCanvas.js) and is deliberately NOT
 *         duplicated here.
 *       · The 3D pane (gcodeViz3d, THREE/WebGL).
 *
 * F4. The 7 lathe twins' specs carry NO `placement` key at all — latheLayoutSpec returns before panelTypes computes
 *     the shift. Coherent (the half-profile is a Z-across / radius-up frame, not a pinned XY footprint), and so
 *     excluded from P2a by an explicit declared branch rather than silently — but it does mean a lathe Layout pane
 *     can never ride a WCS pin. Recorded here as a question for a human; the snapshot is what makes it a question.
 */
