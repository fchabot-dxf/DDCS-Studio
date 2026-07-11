/** views/rotaryClockView.js — Rotary clock (A0 to a feature) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { safeZFrameValue } from '../../ui/safeZFrameToggle.js';   // SPATIAL-MODEL 1c: shared safe-Z frame read
import { RotaryClockWizard } from '../rotaryClockWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';
import { applyPreviewIntent } from './atcViews.js';   // t714 — the ONE declared-intent apply (rig + envelope), single-sourced with the twin

const wizard = new RotaryClockWizard();

export const rotaryClockView = {
    type: 'rotary_clock',
    panelId: 'wiz_rotary_clock',
    codeElId: 'wiz_rotary_clock_code',
    large: true,
    twoPane: true,
    inputIds: [
        'rcl_action', 'rcl_reference', 'rcl_span', 'rcl_wcs',
        'rcl_dist', 'rcl_retract', 'rcl_safe_z', 'rcl_feed_fast', 'rcl_feed_slow', 'rcl_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { rcl_feed_fast: 'fastFeed', rcl_retract: 'retract' },

    onOpen(ctx) {
        restoreBoxStock();                 // clocks a FLAT → default to rectangular stock (revert a prior rotary round bar)
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
        const action = el('rcl_action')?.value || 'set';
        const params = {
            action,
            reference: el('rcl_reference')?.value || 'top',
            span: el('rcl_span')?.value || '20',
            wcs: el('rcl_wcs')?.value || 'active',
            dist: el('rcl_dist')?.value || '30',
            retract: el('rcl_retract')?.value || '2',
            safeZ: el('rcl_safe_z')?.value || '10',
            safeZFrame: safeZFrameValue('rcl_safe_z'),   // SPATIAL-MODEL 1c: final-park frame (relative | machine G53)
            f_fast: el('rcl_feed_fast')?.value || '200',
            f_slow: el('rcl_feed_slow')?.value || '50',
            qStop: el('rcl_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        const desc = el('rcl_desc');
        if (desc) {
            const actTxt = action === 'report'
                ? 'measures the flat’s tilt and reports it — it does NOT touch the A offset.'
                : action === 'rotate'
                    ? 'measures the tilt then <b>rotates the part</b> to the reference and zeros A there.'
                    : 'measures the tilt and sets the A work offset so the reference reads A0 — without rotating the part.';
            desc.innerHTML = `<b>Clock to a flat:</b> probe the flat at two points across it (span apart in Y); tilt = atan(ΔZ / span). This ${actTxt} No centreline needed. <b>Verify the A direction on your machine</b> — flip the span sign if it datums the wrong way.`;
        }

        const gcode = wizard.generate(params);
        el('wiz_rotary_clock_code').innerHTML = UIUtils.formatGCode(gcode);
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        // t714 (R-A #4) — pass BOTH declared pass markers (A + the span B, from wizard.inferStarts = opSimStarts('rotary_clock'),
        // the SAME source the twin reads) so the built-in shows/animates both touch points, not just A (the dropped-B-marker bug).
        ctx.preview3D(gcode, 'rotaryClockVizContainer', wizard.inferStart(params, stock), wizard.inferStarts(params, stock));
        applyPreviewIntent(ctx, 'rotaryClockVizContainer', 'rotary_clock');   // t714 — rig + envelope, single-sourced

        const status = el('rotaryClockVizStatus');
        if (status) status.textContent = `Rotary clock: ${action} | ref ${params.reference} | ${params.wcs}`;
    },
};
