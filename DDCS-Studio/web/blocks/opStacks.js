/**
 * blocks/opStacks.js — maps the last STUDIO op to its block stack for the Blocks tab's "open as blocks".
 *
 * Each rewritten wizard exports a <name>Stack(params) builder (its single source of truth). This registry
 * picks the builder for the active op and returns the stack the Blocks tab should render. `bare` flags the
 * snippet ops (no program header/footer). Imports the wizards (which import opRecord); nothing imports this
 * back, so there's no cycle.
 */
import { getLastOp } from './opRecord.js';
import { surfacingStack } from '../wizards/surfacingWizard.js';
import { pocketStack } from '../wizards/pocketWizard.js';
import { slotStack } from '../wizards/slotWizard.js';
import { drillStack } from '../wizards/drillWizard.js';
import { wcsStack } from '../wizards/wcsWizard.js';
import { edgeStack } from '../wizards/edgeWizard.js';

const BUILDERS = { surfacing: surfacingStack, pocket: pocketStack, slot: slotStack, drill: drillStack, wcs: wcsStack, edge: edgeStack };
const BARE = new Set(['wcs', 'edge']);   // snippet ops emit without the program header/footer

let loadedSig = null;
const sig = (op) => (op ? `${op.type}:${JSON.stringify(op.params)}` : null);

/** Does the active op have a block stack we can show? */
export function hasActiveOpStack() {
    const op = getLastOp();
    return !!(op && BUILDERS[op.type]);
}

/**
 * The active op as { blocks, bare }, or null when there's nothing NEW to show — no op, an op with no
 * stack builder yet (probe family still in progress), or the same op already loaded (so re-opening the
 * Blocks tab doesn't clobber block-side edits). Loading a changed op refreshes the view.
 */
export function buildActiveOpStack() {
    const op = getLastOp(), s = sig(op);
    if (!op || !BUILDERS[op.type] || s === loadedSig) return null;
    loadedSig = s;
    return { blocks: BUILDERS[op.type](op.params), bare: BARE.has(op.type) };
}
