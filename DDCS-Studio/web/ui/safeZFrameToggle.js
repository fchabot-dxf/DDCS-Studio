/**
 * ui/safeZFrameToggle.js — the SHARED safe-Z FRAME toggle widget (SPATIAL-MODEL 1c; the shared UI control 1a deferred).
 *
 * The `rel | mach` mode toggle is DECLARED ONCE here and INJECTED next to each adopting wizard's safe-Z field, so the control
 * is uniform across wizards while each wizard keeps its OWN safe-Z var/value/default. Mounted (idempotently) from
 * wizardManager when a wizard opens — the same hook the probe-source chips use. Read with safeZFrameValue(fieldId).
 *
 *   relative (default) — a clearance ABOVE the surface (incremental lift). machine — an absolute machine Z (G53 park).
 * The EMIT side is the shared safeZParkBlock(frame, var) primitive (wizards/ops/safeZframe.js); this is just the matching UI.
 */
const ADOPTING_FIELDS = ['rc_safe_z', 'rcl_safe_z', 'al_safe_z'];   // safe-Z inputs that get the frame toggle (add as wizards adopt). t921 — middle (m_safe_z) RETIRED: its Safe-Z field is replaced by the CLEARANCE dropdown (park always Max), so no rel|mach toggle.
const TOGGLE_TITLE = 'Safe-Z frame for the final park\nrel: a clearance ABOVE the surface (the value is a height; incremental lift — the default)\nmach: an ABSOLUTE machine Z (G53 park clear of clamps/tall fixtures — the value IS the machine Z)';

/** The declared frame for a safe-Z field (default `relative`; the toggle absent/unknown → relative = the status quo). */
export function safeZFrameValue(fieldId) {
    const t = document.getElementById(fieldId + '_frame');
    return t && t.value === 'machine' ? 'machine' : 'relative';
}

/** Inject the rel|mach toggle next to each adopting safe-Z field (idempotent — skips a missing field or an already-mounted one).
 *  `onChange` (the active wizard's update) is wired to each toggle, since the per-field change listeners are bound from
 *  inputIds at init — before this runs on wizard-open — so the toggle would otherwise not refresh the preview/emit. */
export function mountSafeZFrameToggles(onChange) {
    if (typeof document === 'undefined') return;
    for (const id of ADOPTING_FIELDS) {
        const input = document.getElementById(id);
        if (!input || document.getElementById(id + '_frame')) continue;
        const sel = document.createElement('select');
        sel.id = id + '_frame'; sel.className = 'frame-toggle'; sel.title = TOGGLE_TITLE;
        sel.innerHTML = '<option value="relative">rel</option><option value="machine">mach</option>';
        if (typeof onChange === 'function') sel.addEventListener('change', onChange);
        input.insertAdjacentElement('afterend', sel);
    }
}
