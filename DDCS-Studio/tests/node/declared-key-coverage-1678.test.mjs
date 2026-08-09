// t1678 — THE DURABLE GUARD for the "declared, never read" class. Four instances surfaced by accident across four
// consecutive acts before this one: a block's own mouth (t1638), a durable record field `modalPre` (t1654), the
// `emits`→solid/hollow marker contract (t1670, corner-only), and `noSnap` on a canvas handle decl (t1674). All four
// share a shape: a property is SET on a plain declaration object somewhere, but the function that's supposed to
// consume it was never told about it — usually because that consumer does an explicit `{a,b,c} = decl` destructure
// or a hand-picked spread instead of reading the object generically.
//
// t1638 and t1654 each solved THEIR instance with a runtime throw at a serialization round-trip boundary (an
// allow-list of known fields; write a field outside it, get a loud exception). That mechanism does not generalize
// here: most of the shapes below are not serialized anywhere — they are plain object literals passed straight into
// a function call (a handle decl into `buildCanvasWidgets`, a spec into `FeatureCanvas.render`), so there is no
// natural "write boundary" moment to hook a throw into. What DOES generalize is the underlying move: declare the
// CANONICAL key-set for a shape once (as data, matching this project's own north star), and fail loud if reality
// stops matching the declaration. For a "does the reader consume this" question, the practical, cheap version of
// that check is textual: does the key's bare name appear anywhere in its designated consumer file(s)?
//
// This is a HEURISTIC, not a real static analyzer — say so plainly rather than oversell it. A key read only through
// a fully dynamic access (`obj[computedName]`) would false-negative (flagged as missing when it isn't); a key name
// that coincidentally appears in an unrelated comment or identifier would false-positive (passes when it shouldn't).
// Both risks are accepted deliberately: this is a cheap, loud tripwire for a class that has recurred five times in
// this codebase's history, not a proof. Keys short/common enough to make that risk severe (x, y, id, value, label,
// color, kind) are deliberately left OUT of the checked lists below — real members of each shape's contract, just
// not ones a substring search can say anything reliable about.
import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const web = (p) => path.join(ROOT, 'web', p);

/** Every key with NO word-boundary match anywhere in `text`. */
function missingIn(keys, text) {
    return keys.filter((k) => !new RegExp(`\\b${k}\\b`).test(text));
}
/** Every key that has NO textual reader anywhere in `consumerPaths`. Word-boundary match, whole-file, case-sensitive. */
function missingReaders(keys, consumerPaths) {
    return missingIn(keys, consumerPaths.map((p) => fs.readFileSync(p, 'utf8')).join('\n'));
}
/** Just the text of one `export const NAME = [...]` array literal — sharper than a whole-file search when the
 *  question is "is this name in THIS list," not "does this file mention it anywhere for any reason." Needed for
 *  OP_CODE_HOOKS below: `simStock` has a real, unrelated generic reader elsewhere in userOps.js (a different
 *  mechanism, a different line), which would otherwise mask its absence from THIS specific allow-list. */
function arrayLiteralText(filePath, constName) {
    const text = fs.readFileSync(filePath, 'utf8');
    const m = text.match(new RegExp(`${constName}\\s*=\\s*\\[[^\\]]*\\]`));
    if (!m) throw new Error(`arrayLiteralText: no "${constName} = [...]" found in ${filePath}`);
    return m[0];
}

// ── PART 1 — shapes whose CURRENT contract is clean. These exist to catch a FUTURE regression: a new key added to
// one of these declaration shapes without also updating (or at least mentioning intent in) its consumer file. ──

const CLEAN_SHAPES = [
    {
        name: 'canvas handle — gesture-independent properties read by FeatureCanvas',
        // buildCanvasWidgets's own generic spread (id/color/noSnap) + properties set by hand-rolled bypass specs
        // (panelTypes.js's simMarkers/markerHandles, ui/stockEditor.js) that a gesture's place() never returns.
        keys: ['noSnap', 'labelDir', 'displayVals', 'simOnly', 'yieldCoincident'],
        consumers: [web('viz/featureCanvas.js')],
    },
    {
        name: 'layoutSpecFromOp — keys it forwards into its own returned spec',
        // Checked against panelTypes.js's OWN text (the producer), not featureCanvas.js: the question here is
        // "does this middle-layer function re-expose what it received," not "does the final renderer read it."
        // onEdit MOVED HERE at t1680 — it was the KNOWN GAP tripwire below until the fix landed (buildCanvasWidgets's
        // onEdit is now destructured and threaded into all 3 of layoutSpecFromOp's returns); the tripwire is gone,
        // per this file's own design ("closing a gap requires deliberately updating its tripwire").
        // pathDatum/stockDatum/stockAttach/onPathDatum/onStockAttach are NOT part of this shape at all — confirmed
        // by running this very checker against a first draft that wrongly included them (panelTypes.js never sets
        // them; they belong to placementSpec()'s OWN shape, spread directly by the 6 legacy per-wizard views).
        keys: ['onDrag', 'onEdit', 'placement', 'onCornerPick', 'onEdgePick'],
        consumers: [web('wizards/ops/panelTypes.js')],
    },
];

for (const shape of CLEAN_SHAPES) {
    test(`declared-key-coverage: ${shape.name}`, async () => {
        const missing = missingReaders(shape.keys, shape.consumers);
        expect(missing, `declared but no textual reader in ${shape.consumers.map((p) => path.relative(ROOT, p)).join(', ')}`).toEqual([]);
    });
}

// ── PART 2 — KNOWN GAPS. The t1678 census found three live, evidence-backed findings and reported them for their
// own future fix-dispatch WITHOUT fixing them in that census turn. Each test below asserts the CURRENT, broken
// state on purpose — it starts FAILING the moment someone fixes the underlying gap without also touching this
// file, which is the point: closing a gap here requires deliberately updating its tripwire (move the key up into
// CLEAN_SHAPES), not letting the fix silently rot the record of what changed. t1680 closed the first of the three
// (onEdit, moved above) exactly this way — two remain. ──

test('KNOWN GAP (t1678): lathe handles declare teal:true (the documented "drives the emit" convention) but FeatureCanvas never reads .teal — every lathe dimension handle renders the plain gold default instead. See WORK-LOG t1678.', async () => {
    const missing = missingReaders(['teal'], [web('viz/featureCanvas.js')]);
    expect(missing, 'expected teal to STILL be unread by featureCanvas.js — if this fails, the gap was fixed: remove this test').toEqual(['teal']);
});

test('KNOWN GAP (t1678): OP_CODE_HOOKS (the fork/persistence-carry allow-list in userOps.js) is stale — 7 real def.* hooks silently drop when a wizard is forked via the Blocks-tab Customize path. See WORK-LOG t1678.', async () => {
    // Checked against the OP_CODE_HOOKS array literal specifically, not the whole file: simStock has a real,
    // unrelated generic reader elsewhere in userOps.js (a different mechanism entirely), which a whole-file search
    // would wrongly count as "found" — this narrower check is what a first draft's whole-file version got wrong.
    const hooksList = arrayLiteralText(web('blocks/userOps.js'), 'OP_CODE_HOOKS');
    const missing = missingIn(['zRuler', 'entryPoint', 'simStartParams', 'armGap', 'simStock', 'latheTool', 'latheProbeAxis'], hooksList);
    expect(missing, 'expected all 7 to STILL be absent from OP_CODE_HOOKS — if any is now present, the list was likely updated: re-check and shrink this list').toEqual(['zRuler', 'entryPoint', 'simStartParams', 'armGap', 'simStock', 'latheTool', 'latheProbeAxis']);
});
