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

function applyState(input, btn, field) {
    const src = probeSrc(field);   // {ctrl,pr,label} when lit, else null
    const isSelect = input.tagName === 'SELECT';
    if (src) {
        if (isSelect) {
            input.disabled = true;     // selects can't display the var; glyph + tooltip carry it
        } else {
            if (input.dataset.psrcStudio === undefined) input.dataset.psrcStudio = input.value;
            input.value = src.ctrl;
            input.readOnly = true;
        }
        input.classList.add('psrc-ctrl');
        btn.classList.add('psrc-lit');
        btn.title = `${src.label}: reads ${src.pr} (${src.ctrl}) on the controller at runtime — click to override with a Studio value`;
    } else {
        if (isSelect) {
            input.disabled = false;
        } else {
            if (input.dataset.psrcStudio !== undefined) {
                input.value = input.dataset.psrcStudio;
                delete input.dataset.psrcStudio;
            }
            input.readOnly = false;
        }
        input.classList.remove('psrc-ctrl');
        btn.classList.remove('psrc-lit');
        btn.title = 'Studio value — click to read this from the controller’s parameter page at runtime';
    }
}

/** Decorate one input (idempotent). No-op when the active profile has no var for the field. */
export function decorateInput(inputId, field) {
    const input = el(inputId);
    if (!input || !probeSrcAvailable(field)) return;
    let btn = input.parentElement?.querySelector?.(`.psrc-glyph[data-for="${inputId}"]`);
    if (!btn) {
        const wrap = document.createElement('span');
        wrap.className = 'psrc-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'psrc-glyph';
        btn.dataset.for = inputId;
        btn.innerHTML = GLYPH_SVG;
        wrap.appendChild(btn);
        btn.addEventListener('click', () => {
            setProbeSrc(field, probeSrc(field) ? 'studio' : 'ctrl');  // saveSettings broadcasts → wizard re-renders
            applyState(input, btn, field);
        });
    }
    applyState(input, btn, field);
}

/** Decorate all of a view's declared probe-config inputs. Called by wizardManager on open. */
export function decorateProbeSrc(view) {
    const map = view && view.probeSrcFields;
    if (!map) return;
    for (const [inputId, field] of Object.entries(map)) decorateInput(inputId, field);
}
