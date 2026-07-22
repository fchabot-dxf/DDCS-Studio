/**
 * data/subStackToSlot.js — Sub-stack CAM (S1): compose a custom op's PARTS into one CAM slot, keeping STANDARD sub-units
 * LIVE. This is the PREMIUM over pure-universal: a custom op = declared standard sub-unit(s) (→ their PARAMETRIC generator,
 * geometry stays a LIVE #2600 loop, NOT unrolled) + custom atoms (→ stackToSlot, value params exposed).
 *
 * walkParts(user_root.children) → ordered parts:
 *   - an `opunit` (a DECLARED sub-unit boundary, wizards/ops/userRoot.js) → { kind:'standard' }. Its opType is a READ of
 *     opunit.params.opType (declare, never infer); its params are RE-DERIVED from the sub-stack sockets via the standard
 *     def's bindings (the inverse of instantiate — one-source, not a snapshot). Routed to its generator (the LIVE loop).
 *   - a maximal run of loose atoms → { kind:'custom' }. Routed to stackToSlot (value params exposed as #2600, geometry baked).
 * Compose IN ORDER via the same allocation contract buildSlotFromOps uses (#11xx around siblings via `used`, local #var =
 * varOffset+i+1, tag f._op). Returns { name, fields, body } — the generator shape slotPack consumes unchanged.
 *
 * S1 is ENGINE-ONLY (a harness, no fork-UX/modal). NB (flagged): CAM_GEN + the value re-sync below MIRROR macrosApp's
 * generateOp / applyOverridesToBody — S2/S4 should extract ONE shared composer so they can't drift; and the generators emit
 * self-contained framing (progstart…M30), so concatenated parts are not yet a single EXECUTABLE program (framing-normalization
 * is a later slice — same limit the existing multi-op buildSlotFromOps has).
 */
import { flattenBlocks, getUserDef } from '../blocks/userOps.js';
import { camTypeOf, seedFromOp } from './opCamMap.js';
import { stackToSlot } from './stackToSlot.js';
import { readLine } from './probeToSlot.js';   // the SAME read-line fn the generators emit → the value re-sync stays format-identical
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from './probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from './millToSlot.js';
import { slotFromOp } from './opToSlot.js';

// The standard-route generators (the SAME dispatch as macrosApp generateOp — the premium live-parametric path).
const CAM_GEN = { corner: cornerSlot, edge: edgeSlot, zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot, pocket: pocketSlot, cpocket: circlePocketSlot, surface: surfacingSlot };
function generatePart(camType, variant, used, off, decl) {
    if (CAM_GEN[camType]) return CAM_GEN[camType](used, off, variant, decl);
    if (camType === 'slot' || camType === 'drill' || camType === 'bore') return slotFromOp(camType, variant || 'circle', used, off, decl);
    return null;
}

// Re-derive a standard sub-unit's params from its opunit children via the standard def's bindings (the inverse of
// instantiate: userOps.js writes flat[blockIndex].params[key]=p[param]; this reads it back). Surfacing-class twins are plain
// frozen bindings with no guards → flat indices are stable (no prune). The opunit's children stand in for the def's exec
// children; the fixed wrapper prefix (user_root+panel+sim+param_group) keeps binding.blockIndex aligned. A sub-unit whose
// atom STRUCTURE was hand-edited would misalign (declare it OPAQUE, FORK 2); S1's target wraps the def's own exec atoms.
export function deriveStandardParams(stdDef, opunitChildren) {
    const clone = JSON.parse(JSON.stringify(stdDef.template || []));
    if (!clone.length || !clone[0]) return {};
    clone[0].children = JSON.parse(JSON.stringify(opunitChildren || []));
    const flat = flattenBlocks(clone);
    const params = {};
    (stdDef.bindings || []).forEach((b) => {
        if (!b || b.blockIndex == null) return;                       // structural bindings (guards) have no socket
        const blk = flat[b.blockIndex];
        if (blk && blk.params && (b.key in blk.params)) params[b.param] = blk.params[b.key];
    });
    return params;
}

// Walk user_root.children → ordered parts (opunit → standard; a maximal run of loose atoms → custom).
export function walkParts(rootChildren) {
    const parts = [];
    let run = null;
    for (const b of (rootChildren || [])) {
        if (!b) continue;
        if (b.type === 'opunit') {
            if (run) { parts.push({ kind: 'custom', run }); run = null; }
            parts.push({ kind: 'standard', opunit: b });
        } else { (run = run || []).push(b); }
    }
    if (run) parts.push({ kind: 'custom', run });
    return parts;
}

// Re-sync a field's read line in the body to its (possibly re-seeded) def — mirrors macrosApp applyOverridesToBody, using
// the generator's OWN readLine so the format is byte-identical (no divergence in min/max/units). Idempotent when def is unchanged.
function applyFieldValues(body, fields) {
    let out = body;
    fields.forEach((f) => {
        const re = new RegExp('^[ \\t]*' + f.var.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=#' + (f.idx + 1500) + '\\b.*$', 'm');
        if (re.test(out)) out = out.replace(re, readLine(f));
    });
    return out;
}

/**
 * Compose a custom op's def (with opunit sub-units) into ONE CAM slot. Standard parts stay LIVE (their generator loop);
 * custom parts unroll+expose. Parts IN ORDER; #11xx/#var allocated around siblings (buildSlotFromOps contract).
 * @returns {{name:string, fields:object[], body:string}}
 */
export function subStackToSlot(def) {
    const template = (def && def.template) || [];
    const root = template.find((b) => b && b.type === 'user_root') || template[0];
    const fullFlat = flattenBlocks(template);
    const bindings = (def && def.bindings) || [];
    const parts = walkParts(root ? root.children : []);

    const used = new Set();
    let fields = [], bodies = [], names = [];
    parts.forEach((part, pi) => {
        let gen = null;
        if (part.kind === 'standard') {
            const opType = part.opunit.params && part.opunit.params.opType;
            const stdDef = getUserDef(opType);
            if (!stdDef) {
                // a stale/absent opType (deleted, or a pack shared to a machine lacking the op): fail SOFT (a named
                // placeholder), NOT a silent drop of the sub-unit (mirrors stackToSlot's missing-def behavior).
                gen = { name: '(missing op)', fields: [], body: `( sub-unit op def not found: ${opType || '?'} — deleted or not registered on this machine )` };
            } else {
                // one-source READ: reconstruct the op's params from the sub-stack sockets (reverse of instantiate). Route on the
                // REAL params so a VARIANT sub-unit resolves correctly (circle Pocket → cpocket, helical Drill → bore) — NOT on
                // empty params (which always defaulted pocket → rect). NB (FORK 2): a guarded/bindingSpecs std def (corner/pocket/
                // middle) has frozen blockIndex over a PRUNED stack, so this raw-template read is best-effort for those; a
                // prune-aware re-derivation (mirror instantiate) is the follow-on. Surfacing-class (plain frozen) is exact.
                const params = deriveStandardParams(stdDef, part.opunit.children);
                const ct = camTypeOf({ type: 'op', opType, params });
                if (ct.camType && ct.camType !== 'universal') {
                    gen = generatePart(ct.camType, undefined, used, fields.length, {});   // decl {} = all-exposed → the generator's LIVE loop knobs
                    const seed = seedFromOp({ type: 'op', opType, params });
                    if (gen && seed && !seed.unsupported) {
                        (gen.fields || []).forEach((f) => { const sv = (seed.fields || []).find((x) => x.key === f.key); if (sv && sv.value != null && sv.value !== '') f.def = sv.value; });
                        gen.body = applyFieldValues(gen.body, gen.fields);   // reflect the re-derived params on the pendant reads (loop still rides the #var → geometry stays LIVE)
                    }
                } else {
                    gen = stackToSlot(stdDef, {}, used, fields.length);   // an opunit wrapping a NON-generator op → unroll (not live, but never silently dropped)
                }
            }
        } else {
            // custom part: wrap the loose atoms, re-index the def's bindings that point into them (by IDENTITY → robust to nesting)
            const subStack = [{ type: 'user_root', params: {}, children: part.run }];
            const subFlat = flattenBlocks(subStack);
            const subBindings = bindings
                .filter((b) => b && b.blockIndex != null && subFlat.includes(fullFlat[b.blockIndex]))
                .map((b) => ({ ...b, blockIndex: subFlat.indexOf(fullFlat[b.blockIndex]) }));
            const subDef = { opType: ((def && def.opType) || 'user_sub') + '_p' + pi, template: subStack, bindings: subBindings };
            const decl = {};
            subBindings.forEach((b) => { decl[b.param] = { exposed: true }; });   // expose every custom value binding (stackToSlot force-bakes the non-exposable)
            gen = stackToSlot(subDef, decl, used, fields.length);
        }
        if (gen) {
            (gen.fields || []).forEach((f) => { used.add(f.idx); f._op = pi; });
            fields = fields.concat(gen.fields || []);
            bodies.push(gen.body || '');
            names.push(gen.name || '');
        }
    });
    return { name: names.filter(Boolean).join(' + '), fields, body: bodies.join('\n\n') };
}
