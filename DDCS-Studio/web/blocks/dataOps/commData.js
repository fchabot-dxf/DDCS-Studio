/**
 * blocks/dataOps/commData.js — the Communication/MDI built-in as a pure DATA definition (the Setup/IO port, t518 1b-ii).
 *
 * Comm is a STRUCTURAL-BRANCH op: commStack branches on type(popup/status/input/beep/dwell) × the HMI cap × popupMode ×
 * conditional slots/color/status-dwell/dest/cyc. The E0 superset (t516, 388b4c8) carries all those arms GUARDED; this def
 * instantiates it: `deriveGuards` injects the derived keys so pruneGuards collapses to the concrete shape, then the value
 * bindings (#var identity) + a postInstantiate `applyCommRecompose` re-inject the VALUE-BEARING bits the guards don't carry —
 * the operator MESSAGE (baked into post-specific RAW / #1503 / #2070 / the `message` atom), the computed useId, the composite
 * #1503, the persistent/update status comment, the pulsed-beep comment, and the dest var. BYTE-IDENTICAL to commStack.
 *
 * The MESSAGE is the value-bearing FRONTIER (the atc_warmup doc: "a VALUE-BEARING message an operator reads before acting").
 * It rides a SENTINEL: the superset bakes SENTINEL_MSG (etc.); the recompose global-replaces the sentinel with the resolved,
 * dialect-formatted text — so a single swap covers all ~6 embeddings, and the twin is byte-identical to the concrete bake.
 */
import { commStack, fmtCtrl, fmtLine, STATUS_PERSISTENT, beepPulseCount } from '../../wizards/stacks/communicationWizard.js';   // t2030 — REUSED, not reimplemented: the SAME message-format functions commStack's own real emit calls; t2051 — same for the persistent-status constant + beep pulse-count formula
export { fmtCtrl, fmtLine, STATUS_PERSISTENT, beepPulseCount };   // re-exported so a reference-identity check (not just a value-equality one) can prove this stayed the SAME function, not a re-typed copy
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
// t632 — the twin no longer reads the active post (the _hmi guard is gone; the atoms fold per-post at emit time = the un-freeze).

// ── SENTINELS — the superset bakes these; applyCommRecompose swaps them for the resolved values (clean tokens: no chars
//    fmtCtrl/fmtLine transform, so they survive the format verbatim; a distinctive id/dest so the computed useId + var swap). ──
const SENT = { msg: 'COMMMSG', slot1: 'CS1', slot2: 'CS2', slot3: 'CS3', slot4: 'CS4', id: '#479', dest: 'CDEST' };
const SENT_DWELL = 444444, SENT_VAL = 222222;   // numeric values baked verbatim into RAW G-code (status-dwell + dwell); recompose string-swaps them
const SENT_USEID = 479;   // Number(SENT.id.replace('#','')) — in [50,499] so commStack keeps it as useId

/** Author defaults — mirror the FORM field defaults (the twin-default rule), NOT the stack num() fallbacks. */
export const COMM_DEFAULTS = {
    type: 'popup', popupMode: -5000, statusMode: 1, statusColor: -1, statusDwell: '', msg: '', slot1: '', slot2: '', slot3: '', slot4: '',
    id: '100', dest: '', val: 500, cycle: '',
};

// The SUPERSET is built with SENTINEL value-bearing params (so the recompose can find + swap them) but the DEFAULT structure
// (type popup / all arms present, guarded). Scalars that ARE clean #var sockets ride bindings; the rest ride the recompose.
const SUPERSET_PARAMS = { ...COMM_DEFAULTS, msg: SENT.msg, slot1: SENT.slot1, slot2: SENT.slot2, slot3: SENT.slot3, slot4: SENT.slot4, id: SENT.id, dest: SENT.dest, statusColor: 111111, statusDwell: SENT_DWELL, val: SENT_VAL, cycle: 333333 };

export const COMM_DATA_OPTYPE = 'user_comm_data';

/** STRUCTURAL toggles (drive the guard prune, NO value socket) + the value-swap knobs that ride the recompose.
 *  t2401 — RESECTIONED + REORDERED to the shell's own 3 sections in the shell's own DOM order (index.html:
 *  1100-1213): FEATURE CONTEXT (type, mode) → GEOMETRY (val, cycle, msg) → ADVANCED (id, dest, statusColor,
 *  statusDwell, slot1-4). Was 'TYPE'/'GEOMETRY' (2 invented sections, GEOMETRY absorbing the shell's own
 *  GEOMETRY+ADVANCED) — see comm-form-reproduction-2399.spec.js's own header for the full t2399 account of
 *  the mismatch this fixes, and formWidgets.js's own SECTION_RANK comment for why 'FEATURE CONTEXT' needed a
 *  registry-wide rank addition before this reorder could actually render in the shell's own order (GEOMETRY's
 *  canonical rank otherwise sorts it first regardless of array position). Array order here now IS the shell's
 *  own field order — reordering carries no emit risk (commDataStack()/applyCommRecompose never read binding
 *  array order, only `bindingSpecs` matched by #var/atom identity over the pruned stack). */
export const COMM_STRUCT_BINDINGS = [
    { param: 'type', type: 'enum', default: COMM_DEFAULTS.type, label: 'Type', help: 'popup / status / numeric input / beep / dwell.', section: 'FEATURE CONTEXT', widgetConfig: { options: [['Popup', 'popup'], ['Status', 'status'], ['Input', 'input'], ['Beep', 'beep'], ['Dwell', 'dwell']] } },
    { param: 'popupMode', type: 'enum', default: COMM_DEFAULTS.popupMode, label: 'Popup Mode', help: 'Toast (-5000) / OK-Cancel (1) / Binary (3).', section: 'FEATURE CONTEXT', when: { param: 'type', is: 'popup' }, widgetConfig: { options: [['Toast', -5000], ['OK/Cancel', 1], ['Binary', 3]] } },
    { param: 'statusMode', type: 'enum', default: COMM_DEFAULTS.statusMode, label: 'Status Mode', help: 'Standard (1) / Persistent (-3000).', section: 'FEATURE CONTEXT', when: { param: 'type', is: 'status' }, widgetConfig: { options: [['Standard', 1], ['Persistent', -3000]] } },
];
export const COMM_VALUESWAP_BINDINGS = [
    { param: 'val', type: 'number', default: COMM_DEFAULTS.val, label: 'Value', help: 'Beep duration / dwell ms.', section: 'GEOMETRY' },
    { param: 'cycle', type: 'number', default: COMM_DEFAULTS.cycle, label: 'Cycle (ms)', help: 'Beep pulse width (0 = single beep).', section: 'GEOMETRY', when: { param: 'type', is: 'beep' } },
    { param: 'msg', type: 'string', default: COMM_DEFAULTS.msg, label: 'Message', help: 'The text shown to the operator (popup / status / input prompt).', section: 'GEOMETRY' },
    { param: 'id', type: 'string', default: COMM_DEFAULTS.id, label: 'Target #', help: 'The variable the numeric input writes (50-499).', section: 'ADVANCED', when: { param: 'type', is: 'input' } },
    { param: 'dest', type: 'string', default: COMM_DEFAULTS.dest, label: 'Dest var', help: 'Optional: copy the entered value to a persistent var.', section: 'ADVANCED', when: { param: 'type', is: 'input' } },
    { param: 'statusColor', type: 'number', default: COMM_DEFAULTS.statusColor, label: 'Status Color (BGR)', help: 'Status-bar colour (-1 = default green).', section: 'ADVANCED', when: { param: 'type', is: 'status' } },
    { param: 'statusDwell', type: 'number', default: COMM_DEFAULTS.statusDwell, label: 'Status Dwell (ms)', help: 'Keep the status message visible this long (0 = none).', section: 'ADVANCED', when: { param: 'type', is: 'status' } },
    // the binary-popup button labels (mode 3) — clean #1510-1513 sockets (bound via COMM_BINDING_SPECS); these are their form fields
    { param: 'slot1', type: 'string', default: COMM_DEFAULTS.slot1, label: 'Button 1', help: 'Binary-popup button label.', section: 'ADVANCED', when: { param: 'popupMode', is: 3 } },
    { param: 'slot2', type: 'string', default: COMM_DEFAULTS.slot2, label: 'Button 2', help: 'Binary-popup button label.', section: 'ADVANCED', when: { param: 'popupMode', is: 3 } },
    { param: 'slot3', type: 'string', default: COMM_DEFAULTS.slot3, label: 'Button 3', help: 'Binary-popup button label.', section: 'ADVANCED', when: { param: 'popupMode', is: 3 } },
    { param: 'slot4', type: 'string', default: COMM_DEFAULTS.slot4, label: 'Button 4', help: 'Binary-popup button label.', section: 'ADVANCED', when: { param: 'popupMode', is: 3 } },
];

// VALUE bindings by identity over the pruned stack — the clean scalar sockets. Slots stay #1510-1513 assigns; the status
// colour/dwell + beep dur/cyc now ride the dialect-aware ATOMS (hmistatus/hmibeep) instead of leaky #2039/#2042/#2043 assigns.
// OPTIONAL: each is prune-gated (present only in its type/conditional arm) → deriveBindings SKIPs it when absent. EXPLICIT
// defaults (not socketHeld): the colour/dwell/cyc emit-by-value now lives in the atom (no _useColor/_hasStatusDwell prune), so
// the binding must ALWAYS set the resolved value — incl. the "off" default (-1 / '' / 0) — not keep the superset's baked sentinel.
export const COMM_BINDING_SPECS = [
    { param: 'slot1', type: 'string', match: { type: 'assign', var: '#1510' }, key: 'value', optional: true },
    { param: 'slot2', type: 'string', match: { type: 'assign', var: '#1511' }, key: 'value', optional: true },
    { param: 'slot3', type: 'string', match: { type: 'assign', var: '#1512' }, key: 'value', optional: true },
    { param: 'slot4', type: 'string', match: { type: 'assign', var: '#1513' }, key: 'value', optional: true },
    { param: 'statusColor', type: 'number', default: COMM_DEFAULTS.statusColor, match: { type: 'hmistatus' }, key: 'color', optional: true },
    { param: 'statusDwell', type: 'number', default: COMM_DEFAULTS.statusDwell, match: { type: 'hmistatus' }, key: 'dwell', optional: true },
    { param: 'val', type: 'number', default: COMM_DEFAULTS.val, match: { type: 'hmibeep' }, key: 'dur', optional: true },   // beep total duration = val
    { param: 'cycle', type: 'number', default: COMM_DEFAULTS.cycle, match: { type: 'hmibeep' }, key: 'cyc', optional: true },  // beep pulse width = cycle
];

// t2605 (BACKLOG #71/#72 small item) — `commDataStack()` (the old flat-render `user_root` wrapper) is REMOVED
// here — `commDataDef()` below now builds its own tree-shaped stack inline, and grepping the whole repo found
// no other caller (product code or test) invoking this function by name.

// ── the DERIVED guard keys — pruneGuards uses these to collapse the value-typed forks. ──
// t632 — the HMI-vs-degrade fork (_hmi) is GONE: each atom carries it at emit time (the un-freeze), so the twin folds per-post.
// _useColor / _hasStatusDwell are gone too: the hmistatus atom owns the #2039/G4 emit-by-value (colour!=-1, dwell>0), so those
// bits ride the atom's bound colour/dwell params (COMM_BINDING_SPECS) instead of pruned blocks. _hasCyc stays (the pulsed vs
// plain COMMENT genuinely differs).
export function commDeriveGuards(p) {
    return {
        _popupMode: Number(p.popupMode),
        _popupToast: !(Number(p.popupMode) === 1 || Number(p.popupMode) === 3),
        _hasDest: !!(p.dest && String(p.dest).trim() !== ''),
        _hasCyc: (p.cycle != null && p.cycle !== '') ? Number(p.cycle) > 0 : false,
    };
}

// ── RECOMPOSE the VALUE-BEARING bits the guards don't carry (the superset baked SENTINELS / default numbers). ──
function applyCommRecompose(stack, resolved) {
    const p = resolved || {};
    const type = p.type;
    const flat = flattenBlocks(stack);
    const msgFmt = type === 'status' ? fmtLine(p.msg) : fmtCtrl(p.msg);
    const idNum = Number(String(p.id).replace('#', ''));
    const useId = (Number.isFinite(idNum) && idNum >= 50 && idNum <= 499) ? idNum : 100;
    const sm = (p.statusMode != null && p.statusMode !== '') ? Number(p.statusMode) : 1;
    const swap = (s) => String(s == null ? '' : s)
        .split(SENT.msg).join(msgFmt)
        .split(SENT.dest).join(String(p.dest || ''))
        .split(SENT.slot1).join(String(p.slot1 || '')).split(SENT.slot2).join(String(p.slot2 || ''))
        .split(SENT.slot3).join(String(p.slot3 || '')).split(SENT.slot4).join(String(p.slot4 || ''))
        .split('#' + SENT_USEID).join('#' + useId).split(String(SENT_USEID)).join(String(useId));
    for (const b of flat) {
        if (!b || !b.params) continue;
        // t632 — the value-bearing MESSAGE now rides the dialect-aware atoms (the toast message, the confirm prompt, the input
        // asknumber, the status line) instead of baked RAW; swap the sentinel in each. The status #1503 mode+line and the dwell
        // seconds are COMPOSITES rebuilt from resolved params (not scalar sockets); colour/dwell/dur/cyc are bound (BINDING_SPECS).
        if (b.type === 'raw' && b.params.text != null) b.params.text = swap(b.params.text);
        else if (b.type === 'message' && b.params.text != null) b.params.text = swap(b.params.text);
        else if (b.type === 'confirm' && b.params.msg != null) b.params.msg = swap(b.params.msg);   // popup OK/Cancel + binary prompt
        else if (b.type === 'asknumber') {                                                          // numeric-input prompt + target #var
            if (b.params.prompt != null) b.params.prompt = swap(b.params.prompt);
            if (b.params.var != null) b.params.var = swap(b.params.var);
        }
        else if (b.type === 'hmistatus') { b.params.line = fmtLine(p.msg); b.params.mode = sm; }     // composite mode+line
        else if (b.type === 'dwell') { b.params.sec = (Number(p.val) || 0) / 1000; }                 // ms → seconds (dialect.dwell handles the P units per post)
        else if (b.type === 'comment' && b.params.text != null) b.params.text = swap(b.params.text);
        else if (b.type === 'assign') {
            // STRING values carry sentinels (e.g. the dest-copy `#${useId}`); NUMBER values are bound sockets — leave them typed
            if (typeof b.params.value === 'string') b.params.value = swap(b.params.value);
            // the dest assign — its VAR is the sentinel dest → the resolved dest var
            if (b.params.var === SENT.dest) b.params.var = String(p.dest || '');
        }
    }
    // the persistent/update status comment + the pulsed-beep comment are computed → rebuild from resolved (the superset baked defaults)
    for (const b of flat) {
        if (!b || b.type !== 'comment' || !b.params) continue;
        if (b.params.text === 'Persistent Status Bar' || b.params.text === 'Status Bar Update') b.params.text = (sm === STATUS_PERSISTENT ? 'Persistent Status Bar' : 'Status Bar Update');
        if (/^System Beep - .* pulses of .*ms$/.test(b.params.text)) { const cyc = Number(p.cycle); const dur = (p.val != null && p.val !== '') ? p.val : 500; b.params.text = `System Beep - ${beepPulseCount(dur, cyc)} pulses of ${cyc}ms`; }
    }
    return stack;
}

/** Build the Communication-as-data def — bindingSpecs (re-derive by #var identity over the pruned stack) + deriveGuards +
 *  the value-bearing recompose in postInstantiate. Byte-identical to commStack across the type sweep × HMI + non-HMI. */
export function commDataDef() {
    // t2605 (BACKLOG #71/#72 small item) — the LAST unverified panel kind, resolved: panel='commscreen'
    // routes (userOpView.js:874-885) to `vel('userVizContainer')` (SAME resolver, same base every other panel
    // kind uses) and injects `_commWizard.generateScreenPreview(...)` HTML into it directly — no FeatureCanvas/
    // SVG render at all, just a plain container to inject into. A STANDALONE `feature_canvas` node (no adjacent
    // `preview3d`) already builds EXACTLY that target id (`formWidgets.js`'s own dedicated "FEATURE CANVAS"
    // single-pane branch, :1648-1663, builds `userVizContainer_tree`) — the CONTAINER-ID mechanism BACKLOG #77
    // found broken was never in play here at all.
    // ⚠ A DIFFERENT, GENUINE gap was found instead, live, not assumed: the first attempt (a `feature_canvas`
    // node with empty `params`) registered successfully but silently lost its `'commscreen'` panel — the
    // in-place popup mock never rendered, and `userOpView.js` dispatched into the WRONG mode branch (mounting a
    // 3D toolpath preview for a Communication op). Root-caused by instrumenting `document.getElementById` to
    // trace every viz-lookup call: `registerUserOp`'s own self-heal (`userOps.js:1432`,
    // `def.panel = resolvePanelMeta(def)`) re-derives `.panel` from the template's own `feature_canvas` node
    // (`panelFromStack`, userOps.js:350-354) AFTER construction, overriding whatever string
    // `userOpFromStack`'s own positional `panel` argument set — every migrated op's own `feature_canvas` node
    // needs its OWN `params.panel`, this is not optional decoration. Fixed by adding it below; re-verified live
    // after the fix (the real popup mock renders inside the tree-mode container).
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const bySection = (name) => [...COMM_STRUCT_BINDINGS, ...COMM_VALUESWAP_BINDINGS].filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2605 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes
            // this twin onto renderUiTree. No classic-shell text to reproduce for THIS twin's own purposes
            // (`#wiz_comm`, index.html:1103, is a real, still-live classic shell this twin stays unlinked
            // from) — usage_text written fresh.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Communication' },
                    children: [
                        { type: 'usage_text', params: { text: 'Shows the operator a popup, a status-bar message, prompts for a numeric input, beeps, or dwells. The right pane previews exactly what the controller screen will show.' } },
                        { type: 'group_box', params: { title: 'FEATURE CONTEXT' }, children: fieldRefsOf(bySection('FEATURE CONTEXT')) },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(bySection('GEOMETRY')) },
                        { type: 'group_box', params: { title: 'ADVANCED' }, children: fieldRefsOf(bySection('ADVANCED')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2605 (Phase 1 step 2) — a STANDALONE feature_canvas (no adjacent preview3d — commscreen mode
                // has no 3D view at all): this is the mock controller-screen live preview, not a geometry canvas.
                // ⚠ ROOT-CAUSED LIVE, not assumed: `registerUserOp`'s own self-heal (`userOps.js:1432`,
                // `def.panel = resolvePanelMeta(def)`) re-derives `.panel` from the template AFTER construction
                // — `panelFromStack()` (userOps.js:350-354) finds the FIRST `feature_canvas` block and returns
                // its OWN `params.panel` (a STRING) or, if absent, `null` — overriding whatever string
                // `userOpFromStack`'s own positional `panel` arg set, NOT falling back to it. Every OTHER
                // migrated op's own `feature_canvas` node already carries `params.panel` (e.g. `'form3d+2d'`)
                // for exactly this reason; this node needs it too, or the def silently loses its `'commscreen'`
                // panel the instant it's registered (found live: `def.panel` read `null` post-registration,
                // dispatching `userOpView.js` into the WRONG mode branch — it was mounting a 3D toolpath
                // preview for a Communication op).
                RIGHT: [
                    { type: 'feature_canvas', params: { panel: 'commscreen' } },
                ],
            },
        }],
        children: commStack(SUPERSET_PARAMS, { superset: true }),
    }];
    const bindings = [...COMM_STRUCT_BINDINGS, ...COMM_VALUESWAP_BINDINGS];
    const def = userOpFromStack('comm_data', 'Communication (data)', stack, bindings, 'commscreen', {}, 'setup_datawiz');
    def.bindingSpecs = COMM_BINDING_SPECS;   // re-derive the clean scalar sockets BY IDENTITY over the PRUNED stack every build
    def.deriveGuards = commDeriveGuards;     // inject the derived keys → pruneGuards collapses the value-typed forks
    def.postInstantiate = (stack, resolved) => applyCommRecompose(stack, resolved);
    return def;
}
