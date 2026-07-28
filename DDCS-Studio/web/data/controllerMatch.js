/**
 * data/controllerMatch.js — DOES THE MACHINE IN FRONT OF US MATCH THE ONE THIS WORKSPACE IS FOR? (t1229, A2)
 *
 * The workspace's machine record names the controller it targets ([[one-workspace-one-machine]]). The gateway can say
 * what is actually CONNECTED, and a USB dump can say what it was probably DUMPED FROM. When those disagree, two very
 * different things must happen, and they must say the SAME sentence — so the comparison and the sentence live here,
 * once, rather than being written out at each surface where they would drift:
 *
 *   PULL (a read) — always allowed. Detection is how you find out what you are looking at. Only APPLYING is gated, and
 *   the offer is to DUPLICATE: a pull never retargets the workspace you are in (user ruling).
 *   PUSH (a write) — HARD BLOCK, no override. If the controller is not the one this program was made for, everything
 *   else about the program is suspect too: its envelope, its WCS, its tool table, its macros.
 *
 * UNKNOWN IS NOT A MISMATCH. If nothing identified the controller we cannot claim it is wrong, so `match` is true and
 * the surface behaves as it did before. Blocking on an absence would be a guess wearing a safety hat.
 */
import { getMachine } from './workspaceMachine.js';
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';

/** The human name of a controller id (falls back to the raw id — never an empty label). */
export function controllerName(id) {
    if (!id) return 'unknown controller';
    return (CONTROLLER_PROFILES[id] || {}).name || String(id);
}

/** The controller THIS WORKSPACE is for, from its one machine record. */
export function workspaceController() {
    const m = getMachine() || {};
    return { id: m.controllerId || '', name: controllerName(m.controllerId) };
}

/**
 * Compare a detected/assumed controller against this workspace's.
 * @returns {{match:boolean, known:boolean, workspace:{id,name}, detected:{id,name}}}
 */
export function compareController(detectedId) {
    const workspace = workspaceController();
    const detected = { id: detectedId || '', name: controllerName(detectedId) };
    const known = !!detected.id && !!workspace.id;
    return { match: !known || detected.id === workspace.id, known, workspace, detected };
}

/** THE sentence — one wording for both surfaces, so the pull and the push cannot describe the same fact differently. */
export function mismatchStatement(cmp) {
    return `This controller is a ${cmp.detected.name} — this workspace targets a ${cmp.workspace.name}.`;
}

/**
 * THE MACHINE KIND AND THIS GATE (t1267) — and the honest answer is that the gate CANNOT compare kinds.
 *
 * A pull reads controller parameters: envelope, WCS table, motors, homing, feeds. None of them says "I am wired to a
 * lathe" — a DDCS has no lathe mode, and the same parameter set describes a mill and a lathe equally well (user,
 * definitive: "it doesn't"). So there is nothing to detect, and this gate DOES NOT INVENT IT: no heuristic on axis
 * counts, no guessing from travels. A kind mismatch is not a thing the app can know.
 *
 * What it CAN do is state the workspace's own declaration as context when it is already speaking — a person told
 * that this workspace is a LATHE workspace can judge for themselves whether the controller in front of them is the
 * right one. That is a fact we hold, not a comparison we fabricated.
 * @returns {string} '' for a mill workspace — nothing to add — or one clause naming the kind
 */
export function kindContext(kind) {
    return kind === 'lathe' ? 'This is a lathe workspace (the controller cannot report which kind of machine it drives).' : '';
}
