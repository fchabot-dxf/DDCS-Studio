/**
 * probeSrcGlyph.js — the per-field "controller source" dot (PROBE-CONFIG-SOURCE.md).
 *
 * Each controller-backed wizard input gets a small radio-style dot NEXT TO the field:
 *   hollow ring = Studio value (editable literal, current behaviour)
 *   filled dot  = read from controller: input goes read-only and shows the runtime
 *                 var (#632…), and the generator emits that var instead of a literal.
 *
 * Views declare which of their inputs map to which probe-config field:
 *   probeSrcFields: { p_feed_fast: 'fastFeed', p_retract: 'retract', ... }
 * wizardManager calls decorateProbeSrc(view) on open. Fields the active controller
 * profile has no native var for get no dot at all — the UI is the documentation
 * of what's controller-resident. State persists globally per FIELD (not per wizard)
 * via settings probes.sources, so flipping fast-feed once follows into every wizard.
 */
import { el } from './uiUtils.js';
import { probeSrc, probeSrcAvailable, setProbeSrc } from './settingsPanel.js';

// Radio-style dot: outer ring always; inner dot filled only when lit (CSS .psrc-lit drives it).
const GLYPH_SVG =
    '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">' +
    '<circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    '<circle class="psrc-dot" cx="5" cy="5" r="2" fill="currentColor"/>' +
    '</svg>';

function applyState(input, btn, field, gate) {
    const src = probeSrc(field);   // {ctrl,pr,label} when lit, else null
    const isSelect = input.tagName === 'SELECT';
    if (src) {
        if (isSelect) {
            input.disabled = true;     // selects can't display the var; glyph + tooltip carry it
        } else {
            if (input.dataset.psrcStudio === undefined) input.dataset.psrcStudio = input.value;
            if (input.dataset.psrcType === undefined) input.dataset.psrcType = input.type;
            input.type = 'text';           // a number input can't display "#1078" — show the runtime var as text
            input.value = src.ctrl;
            input.readOnly = true;
        }
        if (gate) input.setAttribute('data-op-gated', '');   // declared lock: postGating re-enables .disabled controls; readOnly + this survive it (t253 contract)
        input.classList.add('psrc-ctrl');
        btn.classList.add('psrc-lit');
        btn.title = `${src.label}: reads ${src.pr} (${src.ctrl}) on the controller at runtime — click to override with a Studio value`;
    } else {
        if (isSelect) {
            input.disabled = false;
        } else {
            if (input.dataset.psrcType !== undefined) {
                input.type = input.dataset.psrcType;   // restore the original input type (e.g. number)
                delete input.dataset.psrcType;
            }
            if (input.dataset.psrcStudio !== undefined) {
                input.value = input.dataset.psrcStudio;
                delete input.dataset.psrcStudio;
            }
            input.readOnly = false;
        }
        if (gate) input.removeAttribute('data-op-gated');
        input.classList.remove('psrc-ctrl');
        btn.classList.remove('psrc-lit');
        btn.title = 'Studio value — click to read this from the controller’s parameter page at runtime';
    }
}

/** Decorate one input ELEMENT (idempotent). No-op when the active profile has no var for the field. `opts.gate`
 *  also stamps `data-op-gated` on the locked field so postGating (which re-enables `.disabled` controls) leaves the
 *  lock alone — the DATA-OP form passes it; the built-in inputs lock via `readOnly`, which postGating never touches. */
export function decorateInputEl(input, field, opts) {
    if (!input || !probeSrcAvailable(field)) return;
    const gate = !!(opts && opts.gate);
    let wrap = (input.parentElement && input.parentElement.classList.contains('psrc-wrap')) ? input.parentElement : null;
    let btn = wrap ? wrap.querySelector('.psrc-glyph') : null;
    if (!btn) {
        wrap = document.createElement('span');
        wrap.className = 'psrc-wrap';
        input.parentNode.insertBefore(wrap, input);
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'psrc-glyph';
        btn.innerHTML = GLYPH_SVG;
        // t1239 (user) — the toggle sits to the LEFT of its field. On the right it collided with the field's own
        // right edge (and with a select's chevron), and it read as part of the value rather than a control over it.
        wrap.appendChild(btn);
        wrap.appendChild(input);
        btn.addEventListener('click', () => {
            setProbeSrc(field, probeSrc(field) ? 'studio' : 'ctrl');  // saveSettings broadcasts → wizard re-renders
            applyState(input, btn, field, gate);
        });
    }
    applyState(input, btn, field, gate);
}

/** Decorate by input ID (the built-in forms' entry — id-addressable inputs; no gate → locks via readOnly only). */
export function decorateInput(inputId, field) {
    decorateInputEl(el(inputId), field);
}

/** Decorate all of a view's declared probe-config inputs. Called by wizardManager on open. */
export function decorateProbeSrc(view) {
    const map = view && view.probeSrcFields;
    if (!map) return;
    for (const [inputId, field] of Object.entries(map)) decorateInput(inputId, field);
}
