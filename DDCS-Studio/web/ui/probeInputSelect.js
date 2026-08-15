/**
 * ui/probeInputSelect.js — wizard "Probe input" picker, REVIVED (t1884 census → t1886 stop → t1888 shape).
 *
 * Each probe wizard (corner / middle / edge / alignment) used to ask the user to re-type the probe INPUT PORT
 * (P). Settings → Hardware → Input is the single source of truth now: this module injects a "Probe input"
 * dropdown listing the configured probe-type inputs; picking one writes its pin → the wizard's own Port field.
 * This is a RESTORATION of that original intent, not a new affordance — the wizards-as-data migration retired
 * every legacy wizard panel this code targeted (t1884's own census), so the raw `document.getElementById
 * ('c_port')`-style lookups always returned null and the feature silently rendered nothing, for every probe
 * wizard, for as long as the migration has existed.
 *
 * WHAT CHANGED TO MAKE IT WORK AGAIN (mechanics only — the user-facing intent is unchanged):
 *   - Field lookup is `[data-param="port"]` inside `#wiz_user_form` (the twin form), not a legacy static id.
 *   - Op detection is `getLastOp().type` (`blocks/opRecord.js`) — verified to update immediately and reliably
 *     the instant a wizard opens — gated to the ORIGINAL 4-op scope. `rotaryCenter`/`rotaryClock` also carry a
 *     `port` field since t1880's own dialect gate, but were never this feature's own scope and stay out.
 *   - The LEVEL half of the original design is DROPPED, not merely deferred: `level` is not a declared,
 *     editable param in ANY twin form anymore (t1878) — baked at a fixed value by an independent,
 *     already-ratified decision (`cornerData.js`'s own "BAKED FRONTIER" note) that predates and has nothing to
 *     do with this revival.
 *   - Writing the picked pin now also dispatches a bubbling `input` event (`formWidgets.js`'s own convention)
 *     so the live preview updates immediately. The emitted G-code was already correct without it — every
 *     widget's own `.read()` re-reads `.value` fresh — this is purely for the live preview, not correctness.
 *
 * SHAPE B (t1888's own ruling): COMPOSE, don't hide. The original hid the raw Port field and replaced it with
 * the dropdown; reviving that strategy verbatim would have silently deleted a WORKING, unrelated feature
 * (`probeSrcGlyph.js`'s own controller-register source toggle, live on `port` for corner/edge/alignment via
 * `sourceField` — see `cornerData.js`/`edgeData.js`/`alignmentData.js`'s own `SRC_BY_PARAM`) to restore a dead
 * one. Today's version adds the dropdown ALONGSIDE the raw field. Nothing that works today gets hidden.
 *
 * TWO INTERACTIONS, DERIVED FROM WHAT EACH MECHANISM MEANS — not chosen for convenience; check the reasoning
 * against the behaviour, not just the behaviour itself:
 *   1. The SOURCE TOGGLE (`probeSrcGlyph.js`) picks WHERE the value comes from — a controller register vs a
 *      literal. The DROPDOWN picks WHICH literal. When the source is a register, the dropdown has nothing to
 *      say: showing it, even disabled, would still display one specific literal that is NOT the value actually
 *      in use (the register is) — exactly the "a literal that isn't used" the ruling forbids. So: the dropdown
 *      is ABSENT (not merely inert) whenever `probeSrc('port')` is truthy.
 *   2. The DIALECT GATE (`_probePortOk`, t1880) says the active post's own probe form never reads a port
 *      number at all. A live picker choosing a value nothing reads is the identical hazard `_probePortOk`
 *      itself exists to prevent. So the dropdown GREYS WITH the field — one control, one enabled-state, never
 *      a live picker beside a dead input. Read directly off `port.disabled` (the field's own gate state is the
 *      one declared source for this — no second, parallel computation of `_probePortOk`).
 *
 * Re-runs on `ddcs:settings-changed` (a probe input added/edited in Settings) and on any mutation of
 * `#wiz_user_form` (an op switch, or a dialect change flipping the gate) — both catch the cases the original's
 * own single `ddcs:settings-changed` listener didn't need to, because the field it targets didn't move or
 * change enabled-state under it before.
 */
import { getInputs, probeSrc } from './settingsPanel.js';
import { getLastOp } from '../blocks/opRecord.js';

const TARGET_OPS = new Set(['user_corner_data', 'user_middle_data', 'user_edge_data', 'user_alignment_data']);
const PROBE_TYPES = ['probe', 'touch', 'setter'];
const SEL_ID = 'wiz_user_probe_input';
const LIVE_TITLE = 'Which configured probe input to use — its own pin becomes the Port value above. From Settings → Hardware → Input.';

function fill(sel, port) {
    const probes = getInputs().filter((i) => PROBE_TYPES.includes(i.type) && i.pin !== '' && i.pin != null);
    const prev = sel.value;
    sel.innerHTML = probes.length
        ? probes.map((i) => `<option value="${i.pin}">${i.label || i.type} (pin ${i.pin})</option>`).join('')
        : '<option value="">— add a probe input in Settings —</option>';
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    sel.onchange = () => {
        const opt = sel.selectedOptions[0];
        if (!opt || opt.value === '') return;
        port.value = opt.value;
        port.dispatchEvent(new Event('input', { bubbles: true }));
    };
}

const MO_OPTS = { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] };
let mo = null;   // the observer instance sync() itself disconnects/reconnects around its own edits (see below)

/** One pass: figure out whether the dropdown should exist right now, and in what state, then make the DOM
 *  match exactly — idempotent, safe to call on every relevant mutation.
 *
 *  sync()'s OWN edits (the dropdown's innerHTML, inserting/removing its row) land inside `#wiz_user_form`'s
 *  own observed subtree — a MutationObserver callback fires ASYNCHRONOUSLY (a queued microtask), so a plain
 *  synchronous re-entrancy flag does nothing: by the time the queued callback runs, the flag is already back
 *  to false. Disconnecting the observer BEFORE mutating and reconnecting AFTER is the only way that actually
 *  works — mutations made while disconnected are never queued at all, not merely ignored later. */
function sync() {
    if (mo) mo.disconnect();
    try {
        const host = document.getElementById('wiz_user_form');
        let sel = document.getElementById(SEL_ID);
        const row = sel ? sel.closest('div[id]') : null;
        const remove = () => { if (row) row.remove(); };

        const rec = getLastOp();
        if (!host || !rec || !TARGET_OPS.has(rec.type)) { remove(); return; }

        const port = host.querySelector('[data-param="port"]');
        if (!port) { remove(); return; }

        // Interaction 1 — the source toggle owns WHERE the value comes from; a register source leaves the
        // dropdown nothing correct to say. Absent, not merely disabled (see the header note).
        if (probeSrc('port')) { remove(); return; }

        if (!sel) {
            const wrap = document.createElement('div');
            wrap.id = SEL_ID + '_row';
            wrap.innerHTML = '<span class="label">Probe Input</span>';
            sel = document.createElement('select');
            sel.id = SEL_ID;
            wrap.appendChild(sel);
            const portRow = port.closest('div');
            if (portRow && portRow.parentNode) portRow.parentNode.insertBefore(wrap, portRow);
            else return;   // no stable anchor this pass — try again on the next mutation rather than orphan a row
        }

        fill(sel, port);
        // Interaction 2 — the dialect gate owns WHETHER the port is read at all; the dropdown mirrors the SAME
        // field's own gate state directly (one declared source, `port.disabled`), never a second computation.
        sel.disabled = port.disabled;
        sel.title = port.disabled ? port.title : LIVE_TITLE;
    } finally {
        const host = document.getElementById('wiz_user_form');
        if (host) { if (!mo) mo = new MutationObserver(sync); mo.observe(host, MO_OPTS); }
    }
}

export function initProbeInputSelects() {
    sync();
    window.addEventListener('ddcs:settings-changed', sync);
}
