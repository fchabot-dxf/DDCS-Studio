/** views/alignmentView.js — Alignment wizard view (DOM glue + SVG animator). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { AlignmentWizard } from '../alignmentWizard.js';

const wizard = new AlignmentWizard();

export function startAlignmentAnim() {
    const animate = el('al_animate')?.checked !== false;
    const checkAxis = el('al_check_axis')?.value || 'X';
    const probeDir = el('al_probe_dir')?.value || 'pos';

    if (window.__alignAnimStartTimer) { clearTimeout(window.__alignAnimStartTimer); window.__alignAnimStartTimer = null; }
    if (window.__alignAnimator) { try { window.__alignAnimator.stop(); } catch (e) {} }
    if (!animate) return;

    if (!window.__alignAnimator && window.AlignVizAnimator) {
        window.__alignAnimator = new window.AlignVizAnimator();
    }

    if (window.__alignAnimator) {
        window.__alignAnimStartTimer = setTimeout(() => {
            window.__alignAnimStartTimer = null;
            try { window.__alignAnimator.play(checkAxis, probeDir); } catch (e) { /* noop */ }
        }, 80);
    }
}

export const alignmentView = {
    type: 'alignment',
    panelId: 'wiz_alignment',
    codeElId: 'wiz_alignment_code',
    large: true,
    twoPane: true,
    inputIds: [
        'al_check_axis', 'al_probe_dir',
        'al_tolerance', 'al_dist', 'al_retract', 'al_safe_z',
        'al_feed_fast', 'al_feed_slow', 'al_port', 'al_level', 'al_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { al_port: 'port', al_level: 'level', al_feed_fast: 'fastFeed', al_retract: 'retract' },
    startAnim: startAlignmentAnim,

    onOpen(ctx) {
        setTimeout(() => {
            ctx.update();
            setTimeout(() => { startAlignmentAnim(); }, 60);
        }, 50);
    },

    update(ctx) {
        const params = {
            checkAxis:  el('al_check_axis')?.value  || 'X',
            probeDir:   el('al_probe_dir')?.value    || 'pos',
            tolerance:  el('al_tolerance')?.value    || '0.2',
            dist:       el('al_dist')?.value         || '20',
            retract:    el('al_retract')?.value      || '2',
            safeZ:      el('al_safe_z')?.value       || '10',
            f_fast:     el('al_feed_fast')?.value    || '200',
            f_slow:     el('al_feed_slow')?.value    || '50',
            qStop:      el('al_q')?.value            || '1',
            port:       window.ddcsGetSettings().probes.probePin,
            level:      window.ddcsGetSettings().probes.probeLevel,
            sources:    window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        const gcode = wizard.generate(params);
        el('wiz_alignment_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'alignmentVizContainer');

        const probeAxis = params.checkAxis === 'X' ? 'Y' : 'X';
        const status = el('alignmentVizStatus');
        if (status) {
            status.textContent = `Alignment | Check: ${params.checkAxis} | Probe: ${probeAxis}`;
        }

        startAlignmentAnim();
    },
};
