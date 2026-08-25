// t2265 — THE GUARD for the dual-vocabulary defect t2263 found the hard way: declaring `code_preview` for
// formWidgets.js's traverse() alone, without a matching wizards/ops/*.js Blockly block, threw "Invalid block
// definition" the moment a real twin's Customize view tried to render it — and that exception aborted the
// WHOLE render pass, breaking an unrelated field-gating test by pure sequencing. The failure was found through
// a Blockly exception surfacing in two unrelated browser-tier specs; this test exists so the NEXT missing half
// is found here instead, by name, at the node tier, in milliseconds — not by chasing a stack trace through an
// unrelated test's own failure.
//
// PURE LIST-VERSUS-LIST, per the dispatch's own instruction — no Blockly boot, no DOM:
//   - the RENDERER side: every `node.type === '...'` string literal formWidgets.js's traverse() branches on,
//     extracted textually (the same heuristic declared-key-coverage-1678.test.mjs already established for this
//     codebase — a tripwire, not a real static analyzer: a type read through fully dynamic access would
//     false-negative, a string that coincidentally matches elsewhere would false-positive; accepted here for
//     the same reason it was accepted there).
//   - the BLOCKLY side: wizards/ops/index.js's own `BLOCKS` registry (Object.fromEntries(PALETTE.map(d =>
//     [d.type, d]))) — the SAME object blockEmitter.js reads for emit, imported directly (plain data, no DOM,
//     confirmed importable at the node tier) rather than re-derived by a second regex pass.
//
// ONE DIRECTION ONLY, deliberately: every traverse()-known type must have a BLOCKS entry (the failure mode
// this guards). The reverse is NOT asserted — BLOCKS also holds ~128 real G-code-emitting atom types (comment,
// assign, spindle, …) that were never meant to appear in a uiChildren PRESENTATION tree at all; requiring
// every one of those to also have a traverse() branch would be asserting the wrong thing.
import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const web = (p) => path.join(ROOT, 'web', p);

test('uiChildren vocabulary pairing: every formWidgets.js traverse() node type has a wizards/ops/ Blockly twin', async () => {
    const source = fs.readFileSync(web('ui/formWidgets.js'), 'utf8');
    const rendererTypes = [...new Set([...source.matchAll(/\bnode\.type === '(\w+)'/g)].map((m) => m[1]))];
    // sanity: this list itself must not silently go empty (a refactor that stops using this exact literal
    // pattern would make every future run vacuously pass otherwise)
    expect(rendererTypes.length, 'sanity: traverse() must still branch on some literal node.type checks').toBeGreaterThan(5);

    const { BLOCKS } = await import(pathToFileURL(web('wizards/ops/index.js')));
    const missing = rendererTypes.filter((t) => !(t in BLOCKS));

    expect(missing, `traverse() knows these node types but wizards/ops/ has no matching Blockly block for them (declaring one without the other crashes the Customize view — see t2263): ${JSON.stringify(missing)}`).toEqual([]);
});
