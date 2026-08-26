/**
 * blocks/blockly/disableGuard.js — REFUSE disabling a CHILD block inside a parametric op (t2307, BACKLOG #23,
 * the refusal half the owner's ruling asked built first: "the toggles add a capability; the refusal removes
 * the danger").
 *
 * THE HAZARD (BACKLOG #23's own STILL REAL IF): a block disabled INSIDE a parametric op does not survive an
 * export/reimport, because `opFromMarker` (programModel.js) regenerates an op's children from its own PARAMS
 * — the generator makes every child fresh, always enabled, with no memory of what a human turned off. Worse,
 * confirmed by direct reproduction (not assumed from the entry alone): `serializeWithMarkers()` never even
 * WRITES a child's disabled state into the exported marker in the first place (only `op.disabled` — the
 * WHOLE-OP flag — rides the marker; see `markerLine(op.opType, op.params, …, op.disabled, …)`,
 * programModel.js). So the state is lost at EXPORT, not merely at reimport — disabling a child inside a
 * parametric op creates a state that was NEVER GOING TO PERSIST, from the moment it happens.
 *
 * ⚠ REFUSE, don't silently accept (the owner's own ⛔): "silently accepting a disable it cannot keep is the
 * worst of the three options, and it is what ships today." A visible-but-session-only marking was considered
 * and rejected — it would still let the state form, still vanish invisibly the moment the block is exported
 * and reimported (a FRESH block from the generator carries no memory of any marking either), and the user
 * would have no signal AFTER that point that anything changed. Refusing at the gesture means the doomed state
 * never exists at all, on any surface, at any time — the stronger of the two guarantees the entry offered.
 *
 * SCOPE, established by reading `opFromMarker`/`builderOf` directly, not assumed: "parametric" here means
 * exactly "this op's type resolves through `builderOf` — either a built-in wizard's own hand-coded
 * `<name>Stack` generator, or a data-op twin's `instantiate()` (both register through the SAME
 * `registerUserBuilder`, confirmed in userOps.js) — so this guard applies uniformly to every built-in AND
 * every registered data-op twin, not a hand-picked list. A block being disabled that IS the `op` container
 * itself is explicitly OUT of scope (BACKLOG #23: "a whole-op disable round-trips correctly") — only a CHILD
 * found by walking up the `op` ancestor chain triggers the refusal, mirroring blocksApp.js's own existing
 * "find the enclosing op" walk (its `e.element === 'field'` handler) rather than a second implementation of
 * the same walk.
 */
import { getBlockly } from './bridge.js';
import { builderOf } from '../opBuilders.js';
import { toast } from '../../ui/gateway/util.js';
import { sfx } from '../../ui/sound.js';

// t2277's own helper (stackBridge.js) is module-private; this is the same one-line lookup, not a second
// definition drifting from it — Blockly's MANUALLY_DISABLED constant, with the same string fallback.
const manuallyDisabledReason = () => { try { return getBlockly().constants.MANUALLY_DISABLED; } catch (_) { return 'MANUALLY_DISABLED'; } };

/** Walk up from `blk` to the enclosing `op` container (mirrors blocksApp.js's own field-edit walk). Returns
 *  null if `blk` is not nested inside one (a loose atom, or `blk` itself IS the op). */
function enclosingOp(blk) {
    let p = blk && blk.getSurroundParent && blk.getSurroundParent();
    while (p && p.type !== 'op') p = p.getSurroundParent && p.getSurroundParent();
    return p || null;
}

/** Install the REFUSE guard on a Blocks workspace: the moment a block is manually disabled, if it is a CHILD
 *  (not the container itself) inside an op whose type resolves through builderOf (a generator-reconstructed
 *  op — built-in or data-twin), revert the disable and say why. Idempotent (safe to call once per ws),
 *  mirroring tokenGuard.js's own installTokenGuard shape exactly. */
export function installDisableGuard(ws) {
    if (!ws || ws.__disableGuardInstalled) return;
    ws.__disableGuardInstalled = true;
    const B = getBlockly();
    ws.addChangeListener((e) => {
        if (e.type !== B.Events.BLOCK_CHANGE || e.element !== 'disabled' || !e.newValue || !e.blockId) return;
        const blk = ws.getBlockById(e.blockId);
        if (!blk || blk.type === 'op') return;   // the op container itself — whole-op disable round-trips fine, out of scope
        const opBlk = enclosingOp(blk);
        if (!opBlk) return;   // not nested inside any op (a loose atom — a different, already-shipped concern)
        let meta = {}; try { meta = JSON.parse(opBlk.data || '{}'); } catch (_) { /* keep {} */ }
        if (!meta.opType || !builderOf(meta.opType)) return;   // a hand-built/non-generator op — disabling a child there round-trips as literal content, not this hazard
        try { blk.setDisabledReason(false, manuallyDisabledReason()); } catch (_) { /* older Blockly — nothing to revert */ }
        toast('A block disabled inside this op won’t survive export/reimport — the op rebuilds its own children from its parameters every time. Disable the whole op instead, or ask for a declared toggle on this field.', true);
        sfx('error');
        if (opBlk.setHighlighted) {
            opBlk.setHighlighted(true);
            setTimeout(() => { try { opBlk.setHighlighted(false); } catch (_) { /* block may be gone by then */ } }, 1400);
        }
    });
}
