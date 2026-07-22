/**
 * blocks/dataOps/pauseConfirmData.js — the standalone Pause / Confirm op as a DATA twin (t1031).
 *
 * A reusable op the user drops anywhere: it emits ONE pauseConfirm atom — the operator MESSAGE (Expert #1505=-5000 banner
 * via hmiToast; a ( MSG: … ) comment on posts with no scripted HMI) + M00 (program stop; resume on Cycle Start). Opened
 * IN-PLACE from the built-in Pause/Confirm setup entry (opensAs), so its own menu entry is hidden. Emit is exactly the
 * pauseConfirm atom — no new logic. The Expert OK/Cancel BLOCKING confirm is the natural upgrade (see hmi.js pauseConfirmBlock).
 */
import { userOpFromStack } from '../userOps.js';
import { PAUSE_DEFAULT_MSG } from '../../wizards/ops/hmi.js';   // t1032 — one-source default msg (shared with the atom + the injection fallback)

export const PAUSE_CONFIRM_OPTYPE = 'user_pause_confirm';
const DEFAULT_MSG = PAUSE_DEFAULT_MSG;

/** The wrapped user_root template: one pauseconfirm exec child (blockIndex 0). */
export function pauseConfirmStack() {
    return [{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'param_group', params: { group: 'Pause / Confirm' }, children: [] }],
        children: [{ type: 'pauseconfirm', params: { msg: DEFAULT_MSG } }],
    }];
}

// blockIndex 2 = the flatten order user_root(0) → param_group(1) → pauseconfirm exec child(2).
const PAUSE_CONFIRM_BINDINGS = [
    { param: 'msg', blockIndex: 2, key: 'msg', type: 'string', default: DEFAULT_MSG, label: 'Message',
      help: 'Shown to the operator (Expert #1505 banner; a ( MSG ) comment on other posts) then an M0 program stop — the machine halts, resume on Cycle Start. A MACHINE pause, not visible in the sim.' },
];

/** Build the Pause/Confirm data-op def — a single pauseConfirm atom, form-only panel. */
export function pauseConfirmDataDef() {
    return userOpFromStack('pause_confirm', 'Pause / Confirm', pauseConfirmStack(), PAUSE_CONFIRM_BINDINGS, 'form', undefined, undefined);
}
