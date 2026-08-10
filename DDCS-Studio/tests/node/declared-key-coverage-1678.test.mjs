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
// ── PART 1 — shapes whose CURRENT contract is clean. These exist to catch a FUTURE regression: a new key added to
// one of these declaration shapes without also updating (or at least mentioning intent in) its consumer file. ──

const CLEAN_SHAPES = [
    {
        name: 'canvas handle — gesture-independent properties read by FeatureCanvas',
        // buildCanvasWidgets's own generic spread (id/color/noSnap/emits) + properties set by hand-rolled bypass specs
        // (panelTypes.js's simMarkers/markerHandles, ui/stockEditor.js) that a gesture's place() never returns.
        // emits ADDED at t1684 (finding 2, closing this file's last KNOWN GAP): does dragging this handle write a
        // value that reaches the emitted G-code — buildCanvasWidgets forwards it, FeatureCanvas reads it for shape
        // (move-kind: solid/hollow) and colour (size-kind: teal tint).
        keys: ['noSnap', 'labelDir', 'displayVals', 'simOnly', 'yieldCoincident', 'emits'],
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
// CLEAN_SHAPES), not letting the fix silently rot the record of what changed. ──
//
// All three t1678 findings are now closed — this section is empty by design (not deleted: the PART 2 discipline
// comment above still applies to whatever the NEXT census turns up).
//
// t1684 closed finding 2 (lathe teal / corner emits, the same declared safety signal under two vocabularies) — not
// by teaching featureCanvas.js to read `.teal`, but by RENAMING teal:true → emits:true at all 14 latheProfileCanvas.js
// sites (reconciled to `emits`: the pre-existing, semantic, cross-op name opSimStarts.js's makeProvider already
// computes generically, vs `teal`, a colour name — an implementation detail — and `source`, which t1670 found the
// renderers already key shape/colour off instead). `teal` is no longer a real property anywhere in web/ — confirmed
// by a repo grep — so there is no key left for a text-presence check to assert "still missing." The regression
// coverage is the `emits` entry now IN CLEAN_SHAPES above (buildCanvasWidgets forwards it, FeatureCanvas reads it)
// plus a BEHAVIORAL suite for the parts a textual check can't reach — the SHAPE axis (solid vs hollow) and the two
// OTHER renderers finding 2 also unified (gcodeViz3d.js, toolpath2d.js — outside this shape's featureCanvas.js-only
// scope): tests/census-finding2-emits-teal-1684.spec.js + two added tests in tests/corner-data-sim-marker-emits.spec.js.
// Same discipline as t1682's OP_CODE_HOOKS closure — a renamed/deleted key, not a newly-read one, gets behavioral
// coverage instead of a promoted textual entry.

// t1682 closed finding 3 (OP_CODE_HOOKS stale allow-list) — but not by moving a key into CLEAN_SHAPES above, because
// the fix did not add the 7 missing names to the list: it deleted the list. `reconcileCodeHooks` (userOps.js) now
// derives "is this a hook" from the def's actual shape (anything beyond userOpFromStack's own base properties + a
// small, stable lifecycle set) rather than checking membership in a hand-maintained array — confirmed: `OP_CODE_HOOKS`
// is no longer exported at all, so there is no list left for a text-presence check to inspect. The regression
// coverage for this finding is necessarily a BEHAVIORAL test, not a textual one — it lives in
// tests/hook-carry-1682.spec.js (a real fork through the actual Customize path, asserting the fork's own rendered
// UI, plus a direct-function sweep of every previously-missing hook shape). Same discipline as every tripwire here —
// a permanent test exists forever, so this cannot silently regress — different mechanism, because the fix itself
// changed the mechanism being guarded.
