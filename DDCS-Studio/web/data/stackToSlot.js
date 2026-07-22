/**
 * data/stackToSlot.js — Universal CAM U0: turn ANY user-op block stack into a CAM slot (parametric macro), reusing the
 * existing emit path. The crux (~90% pre-built): wizards/ops/util.js `val()` passes a `#var` / `[expr]` string THROUGH to
 * G-code verbatim (a literal is coerced numeric). So the mechanism is BIND-TO-LOCATE + val()-TO-SURVIVE — no emitter rewrite:
 *
 *   1. per EXPOSED binding: allocate a #11xx param + #2600 mirror + a field (same allocation contract as allocFieldsWith,
 *      so multi-op used/varOffset composition is unchanged), and set the op param to its assigned LOCAL #var string.
 *   2. per BAKED binding: set the op param to its literal. Others → the binding default.
 *   3. instantiate(def, tokenParams) lands each token at its bound socket (userOps.js:445).
 *   4. emitMapped(stack) — the injected #var rides through val() verbatim to F#n / X#n / Z#n.
 *   5. PREPEND one canonical readLine per field (`#n=#26xx ;label…`, generator parity so Refresh-fields re-derives them),
 *      NOT the raw #2600 mirror at the socket — the LOCAL #var reads the mirror, exactly like every generator's `v[key]`.
 *
 * Returns { name, fields, body } — the SAME shape every CAM generator returns, so it plugs straight into slotPack /
 * buildSlotFromOps. U0 takes a MANUAL `decl` ({ param: { exposed:true } | { exposed:false, value } }); auto-classifying
 * which params are exposable (DECLARE not infer) is U1.
 */
import { nextParam } from './slotPack.js';
import { readLine } from './probeToSlot.js';           // the canonical read-line (`#var=#idx+1500 ;label [units] =def [min~max]`)
import { instantiate } from '../blocks/userOps.js';    // fill each binding's socket from tokenParams (no registration side effect)
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from '../wizards/previewEmit.js';

/**
 * @param {object} def   a user-op def (from userOpFromStack): { opType, label, template, bindings }
 * @param {object} decl  { [param]: { exposed:true } | { exposed:false, value } }  (manual for U0; absent → the binding default)
 * @param {Set<number>} used  #11xx already taken across the pack (collision-free allocation, like allocFieldsWith)
 * @param {number} varOffset  local #-var offset so vars continue across composed ops
 */
export function stackToSlot(def, decl = {}, used = new Set(), varOffset = 0) {
    const taken = new Set(used);
    const fields = [];
    const tokenParams = {};
    // Only VALUE bindings (a real socket, blockIndex != null) can carry a #var; structural bindings drive guards, not emit.
    (def.bindings || []).filter((b) => b && b.blockIndex != null).forEach((b, i) => {
        const d = decl[b.param];
        if (d && d.exposed === true) {                                   // EXPOSED — a #11xx param + #2600 mirror + a LOCAL #var
            const idx = nextParam(taken); if (idx != null) taken.add(idx);
            const varStr = '#' + (varOffset + i + 1);
            fields.push({ key: b.param, idx, var: varStr, label: b.label || b.param, units: b.units || '', def: b.default, min: (b.min != null ? b.min : 0), max: (b.max != null ? b.max : 0), type: (b.type === 'int') ? 0 : 1 });
            tokenParams[b.param] = varStr;                              // the LOCAL var lands in the socket; val() rides it through
        } else if (d && d.exposed === false) {                          // BAKED — the literal
            tokenParams[b.param] = String(d.value);
        }
        // else — leave unset → instantiate uses the binding default
    });
    const stack = instantiate(def, tokenParams);                        // tokens land at their sockets (userOps.js:442-447)
    const body = emitMapped(stack, activeDialectOpts()).text;           // #var → F#n / Z#n verbatim (util.js val)
    const reads = fields.map(readLine);                                 // canonical reads, prepended (generator parity)
    return { name: def.label || def.opType, fields, body: reads.length ? reads.join('\n') + '\n\n' + body : body };
}
