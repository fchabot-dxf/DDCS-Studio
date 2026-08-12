/**
 * blocks/opBuilders.js — the BUILDERS leaf: construct an op's block stack from its declared params.
 *
 * Each rewritten wizard exports a <name>Stack(params) builder (its single source of truth). This registry picks
 * the builder for an op type; makeOp wraps the result in a { type:'op', … } container so a loaded program keeps
 * the op RECORD and emit can gate it per post (capable → children; incapable → marker; blocks/blockEmitter.js).
 *
 * This is the LEAF of the op modules: it imports the 20 wizards; opSession / opGlow / programModel import FROM
 * it (BUILDERS, makeOp, _framed, _builderAtoms) — nothing imports back, so there's no cycle.
 */
import { surfacingStack } from '../wizards/surfacingWizard.js';
import { pocketStack } from '../wizards/pocketWizard.js';
import { contourStack } from '../wizards/contourWizard.js';
import { slotStack } from '../wizards/slotWizard.js';
import { drillStack } from '../wizards/drillWizard.js';
import { wcsStack } from '../wizards/wcsWizard.js';
import { edgeStack } from '../wizards/edgeWizard.js';
import { commStack } from '../wizards/communicationWizard.js';
import { middleStack } from '../wizards/middleWizard.js';
import { cornerStack } from '../wizards/cornerWizard.js';
import { alignmentStack } from '../wizards/alignmentWizard.js';
import { atcLengthStack } from '../wizards/atcLengthWizard.js';
import { atcToolCheckStack } from '../wizards/atcToolCheckWizard.js';
import { atcWarmupStack } from '../wizards/atcWarmupWizard.js';
import { atcChangeStack } from '../wizards/atcChangeWizard.js';
import { atcTestStack } from '../wizards/atcTestWizard.js';
import { atcTableStack } from '../wizards/atcTableWizard.js';
import { rotaryClockStack } from '../wizards/rotaryClockWizard.js';
import { rotaryCenterStack } from '../wizards/rotaryCenterWizard.js';
import { textStack } from '../wizards/textWizard.js';
import { homingStack } from '../wizards/homingWizard.js';

export const BUILDERS = {
    surfacing: surfacingStack, pocket: pocketStack, contour: contourStack, slot: slotStack, drill: drillStack,
    wcs: wcsStack, edge: edgeStack, comm: commStack, middle: middleStack, corner: cornerStack, alignment: alignmentStack,
    atc_length: atcLengthStack, atc_check: atcToolCheckStack, atc_warmup: atcWarmupStack, atc_change: atcChangeStack, atc_test: atcTestStack, atc_table: atcTableStack,
    rotary_clock: rotaryClockStack, rotary_center: rotaryCenterStack, text: textStack,
    homing: homingStack,
};
// (No bare flag — framing is now Program Start/End BLOCKS in the stack; a snippet just omits them.)

// ── the FEDERATED user layer (MID #6) ───────────────────────────────────────────────────────────────────────
// BUILDERS above is the PRISTINE built-in layer. USER-authored ops register their builder into USER_BUILDERS, a
// SEPARATE object, so the built-ins stay forkable/resettable (Stage-6 reset-to-factory = clear the user layer) and
// a distribution-install can be validated against an isolated layer. Resolve BOTH layers through builderOf();
// every membership gate (opSession build/commit/replace/duplicate/merge, programModel marker-import, userOpView)
// and _framed below read it. Precedence is BUILT-IN-FIRST — user opTypes are `user_`-prefixed so the key spaces are
// disjoint. Pairs with opSchema.js specOf / the USER_SCHEMA layer (the two layers must stay in lockstep per op).
const USER_BUILDERS = Object.create(null);

/** Resolve an op's stack-builder across the federated layers (built-in pristine layer, then the user layer). */
export function builderOf(opType) { return BUILDERS[opType] || USER_BUILDERS[opType] || null; }

/** Install a USER op's builder into the user layer (the wizard-maker calls this — see blocks/userOps.js). */
export function registerUserBuilder(opType, fn) { USER_BUILDERS[opType] = fn; }
/** t720 P1 (e) — enumerate the registered user-layer op types (the built-in data-op twins + any authored ops), so the
 *  form-integrity guard can sweep EVERY twin dynamically (a new twin is covered the moment it registers). */
export function userBuilderTypes() { return Object.keys(USER_BUILDERS); }
/** Remove a USER op's builder from the user layer. */
export function unregisterUserBuilder(opType) { delete USER_BUILDERS[opType]; }

// ── op CONTAINERS ───────────────────────────────────────────────────────────────────────────────────────
// Each accumulated op is wrapped in a { type:'op', opType, label, requires, params, children } container so a
// loaded program keeps the op RECORD and emit can gate it per post (capable → children; incapable → marker;
// blocks/blockEmitter.js). `requires` is derived from the atoms the op uses: #var atoms → 'vars', flow atoms →
// 'flow' (both absent on grbl). params ride along for op-form editing. See REMINDERS "Op-containers".
const OP_LABELS = {
    surfacing: 'Surfacing', pocket: 'Pocket', contour: 'Contour', slot: 'Slot', drill: 'Drill', text: 'Text',
    wcs: 'WCS', edge: 'Edge Probe', middle: 'Middle Probe', corner: 'Corner Probe', alignment: 'Alignment',
    rotary_clock: 'Rotary Clock', rotary_center: 'Rotary Centre', comm: 'Communication',
    atc_length: 'Tool Length', atc_check: 'Tool Check', atc_warmup: 'Spindle Warmup', atc_change: 'Tool Change', atc_test: 'ATC Test',
    homing: 'Homing',
};
// USER-op labels live in their OWN layer (MID #6) so the built-in OP_LABELS table stays PRISTINE — removeOpLabel can
// never drop a built-in label, and the other three user tables (USER_BUILDERS/USER_SCHEMA/USER_INTENT) are likewise
// isolated. makeOp resolves built-in-first, then the user layer. (Same federation shape as builderOf/specOf.)
const USER_LABELS = Object.create(null);
const VAR_ATOMS = new Set(['assign', 'probe', 'proberead', 'readmachine', 'setworkoffset', 'tooloffset', 'machinemove']);
const FLOW_ATOMS = new Set(['ifgoto', 'goto', 'label']);
function scanAtoms(blocks, set) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        if (set.has(b.type)) return true;
        if (b.children && scanAtoms(b.children, set)) return true;
    }
    return false;
}
function opRequires(children) {
    const r = [];
    if (scanAtoms(children, VAR_ATOMS)) r.push('vars');
    if (scanAtoms(children, FLOW_ATOMS)) r.push('flow');
    return r;
}
let _opSeq = 0;
export function makeOp(opType, params, children) {
    return {
        id: `op${++_opSeq}`, type: 'op', opType, label: OP_LABELS[opType] || USER_LABELS[opType] || opType,
        requires: opRequires(children), params: params ? JSON.parse(JSON.stringify(params)) : {}, children,
    };
}

/** Register a friendly label for a RUNTIME op (a user-defined op) so makeOp shows it instead of the raw opType.
 *  Writes the USER label layer only; the built-in OP_LABELS literal is untouched. The wizard-maker calls this on register. */
export function registerOpLabel(opType, label) { if (opType && label) USER_LABELS[opType] = label; }

/** The friendly label for an opType (built-in OP_LABELS, then the USER layer, then the raw opType) — the same
 *  resolution makeOp uses inline, exported so views (e.g. the def-change notice) name an op consistently. */
export function opLabelOf(opType) { return OP_LABELS[opType] || USER_LABELS[opType] || opType; }

/** Remove a runtime op label (paired with registerOpLabel; deleteUserOp calls it so a deleted user op leaves no stale
 *  label). Touches the USER layer only — a built-in label can never be dropped, even if called with a built-in opType. */
export function removeOpLabel(opType) { if (opType) delete USER_LABELS[opType]; }

// Build an op's stack, UNWRAPPING a builder that returns its OWN op container (only homing today) → the bare
// blocks. Every consumer (wizard commit, marker import, glow/edit rebuild) must agree on the shape: without this,
// makeOp would wrap homing's container AGAIN (op.children = [{op:homing}]) while the glow/edit checks rebuild the
// unwrapped atoms — so a fresh homing op would false-glow + falsely read as block-edited.
export function _framed(opType, params) {
    let f = builderOf(opType)(params || {}) || [];
    if (f.length === 1 && f[0] && f[0].type === 'op') f = f[0].children || [];
    return f;
}

// Builder atoms at the SAME granularity as op.children — unwrap a builder that returns its own op container
// (only homing does today) and drop program framing, so base ↔ children align.
export function _builderAtoms(opType, params) {
    return _framed(opType, params).filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
}
