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
import { deriveBindingsFor } from './deriveBindings.js';

export const PAUSE_CONFIRM_OPTYPE = 'user_pause_confirm';
const DEFAULT_MSG = PAUSE_DEFAULT_MSG;

/** The wrapped user_root template: one pauseconfirm exec child. */
export function pauseConfirmStack() {
    return [{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'param_group', params: { group: 'Pause / Confirm' }, children: [] }],
        children: [{ type: 'pauseconfirm', params: { msg: DEFAULT_MSG } }],
    }];
}

// t2605 (BACKLOG #71/#72 conversion tier) — CONVERTED from a hand-counted `blockIndex: 2` (the flatten order
// user_root(0) → param_group(1) → pauseconfirm exec child(2), the exact "corner defect #1" class
// deriveBindings.js's own header names) to identity-based `match: {type: 'pauseconfirm'}` — the ONE
// `pauseconfirm` block in the whole stack, unambiguous by type alone. This is the cheapest of the six
// positional-binding ops (1 binding) — a pure rename, no structural ambiguity to resolve.
const PAUSE_CONFIRM_BINDING_SPECS = [
    { param: 'msg', match: { type: 'pauseconfirm' }, key: 'msg', type: 'string', default: DEFAULT_MSG, label: 'Message',
      help: 'Shown to the operator (Expert #1505 banner; a ( MSG ) comment on other posts) then an M0 program stop — the machine halts, resume on Cycle Start. A MACHINE pause, not visible in the sim.' },
];

/** Build the Pause/Confirm data-op def — a single pauseConfirm atom, form-only panel. */
export function pauseConfirmDataDef() {
    // t2605 (Phase 1 step 1) — no derive complexity (1 binding, no guards/superset) but STILL re-derived fresh
    // against the final tree-shaped stack (t2595's own finding: match:{type} bakes a concrete blockIndex at
    // DERIVE time and never re-resolves — a stale module-level constant would break identically to the
    // hand-counted blockIndex this conversion just removed).
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2605 — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes this twin onto
            // renderUiTree. panel='form' (viz:false, per panelTypes.js:45) — the SAME no-viz shape io_step
            // already proved (t2601): no viz-mounting code runs for this panel kind in either render path, so
            // the RIGHT pane is declared empty. No classic shell to reproduce (opened in-place from the
            // built-in Pause/Confirm setup entry, per this file's own header).
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Pause / Confirm' },
                    children: [
                        { type: 'usage_text', params: { text: 'Shows the operator a message, then stops the program (M0) — resume on Cycle Start. A machine pause, not visible in the simulation.' } },
                        { type: 'group_box', params: { title: 'PAUSE / CONFIRM' }, children: [{ type: 'field_ref', params: { param: 'msg' } }] },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                RIGHT: [],
            },
        }],
        children: [{ type: 'pauseconfirm', params: { msg: DEFAULT_MSG } }],
    }];
    const bindings = deriveBindingsFor(stack, PAUSE_CONFIRM_BINDING_SPECS);
    return userOpFromStack('pause_confirm', 'Pause / Confirm', stack, bindings, 'form', undefined, undefined);
}
