/** views/rotaryClockView.js — Rotary clock (A0 to a feature) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { RotaryClockWizard } from '../rotaryClockWizard.js';

const wizard = new RotaryClockWizard();

export const rotaryClockView = {
    type: 'rotary_clock',
    panelId: 'wiz_rotary_clock',
    codeElId: 'wiz_rotary_clock_code',
    large: true,
    inputIds: [
        'rcl_action', 'rcl_reference', 'rcl_span', 'rcl_wcs',
        'rcl_dist', 'rcl_retract', 'rcl_safe_z', 'rcl_feed_fast', 'rcl_feed_slow', 'rcl_q',
    ],

    onOpen(ctx) {
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
            f_fast: el('rcl_feed_fast')?.value || '200',
            f_slow: el('rcl_feed_slow')?.value || '50',
            qStop: el('rcl_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
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
        ctx.preview3D(gcode, 'rotaryClockVizContainer', wizard.inferStart(params, stock));

        const status = el('rotaryClockVizStatus');
        if (status) status.textContent = `Rotary clock: ${action} | ref ${params.reference} | ${params.wcs}`;
    },
};
