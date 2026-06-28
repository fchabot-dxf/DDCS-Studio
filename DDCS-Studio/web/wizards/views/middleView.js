/** views/middleView.js — Middle (pocket/boss centre) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { MiddleWizard } from '../middleWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';

const wizard = new MiddleWizard();

export const middleView = {
    type: 'middle',
    panelId: 'wiz_middle',
    codeElId: 'wiz_middle_code',
    large: true,
    twoPane: true,
    inputIds: [
        'm_type', 'm_approach', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_circular', 'm_sync_a', 'm_wcs', 'm_slave',
        'm_dist', 'm_retract', 'm_safe_z', 'm_clear', 'm_crossX', 'm_crossY',
        'm_feed_fast', 'm_feed_slow', 'm_port', 'm_level', 'm_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { m_port: 'port', m_level: 'level', m_feed_fast: 'fastFeed', m_retract: 'retract' },

    onOpen(ctx) {
        restoreBoxStock();   // not a rotary op → revert a forced cylinder back to the box (no-op if already a box)
        setTimeout(() => { ctx.update(); }, 50);
    },

    async update(ctx) {
        const dir1val = el('m_dir')?.value || 'pos';
        const dir2val = el('m_dir2')?.value || (dir1val === 'pos' ? 'neg' : 'pos');

        const params = {
            featureType: el('m_type')?.value || 'pocket',
            approach: el('m_approach')?.value || 'auto',
            clearOver: el('m_clear')?.value || '15',
            crossX: el('m_crossX')?.value,   // boss-auto per-axis cross-over (string: a number or the [#1+#2] expression default)
            crossY: el('m_crossY')?.value,
            axis: el('m_axis')?.value || 'X',
            dir1: dir1val,
            dir2: dir2val,
            findBoth: el('m_both')?.checked || false,
            circular: el('m_circular')?.checked || false,
            syncA: el('m_sync_a')?.checked || false,
            slave: el('m_slave')?.value || '3',
            wcs: el('m_wcs')?.value || 'active',
            dist: el('m_dist')?.value || '20',
            retract: el('m_retract')?.value || '2',
            safeZ: el('m_safe_z')?.value || '10',
            clearance: '2',
            f_fast: el('m_feed_fast')?.value || '200',
            f_slow: el('m_feed_slow')?.value || '50',
            qStop: el('m_q')?.value || '1',
            port: window.ddcsGetSettings().probes.probePin,
            level: window.ddcsGetSettings().probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        // Manual jog is useless for a POCKET — both walls are reached from the centre, so there is nothing to
        // reposition. Force auto and hide the Probe-Mode control unless the feature is a boss.
        if (params.featureType !== 'boss') params.approach = 'auto';
        const approachBlock = el('m_approach_block');
        if (approachBlock) approachBlock.classList.toggle('hidden', params.featureType !== 'boss');

        const middleDesc = el('middle_desc');
        if (middleDesc) {
            const pocketDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it completes both edge touches on the selected axis, then repeats the same two-edge cycle on the perpendicular axis.'
                : 'With <b>Probe Both Axes</b> disabled, it still probes <b>two opposite edges on the selected axis</b> and calculates the midpoint on that axis.';
            const bossDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it performs the two-edge cycle on the selected axis, then repeats on the perpendicular axis (with reposition pauses where required).'
                : 'With <b>Probe Both Axes</b> disabled, it performs <b>two opposite-edge probes on the selected axis</b> and computes midpoint/offset from that axis only.';

            const circularDetail = params.circular
                ? ` <b>Circular</b> is on: the opposite-touch span is reported as the <b>diameter</b> (#58, plus the mean #60 in 2-axis)${params.findBoth ? ', and the tool re-centres to the found X centre before the Y probes so they cross the true diameter rather than a chord' : ''}.`
                : '';

            middleDesc.innerHTML = (params.featureType === 'boss'
                ? `<b>Boss (outside feature):</b> Start with the probe near one external wall of the boss at probe height. Keep approach clear so the stylus can move away for retract and return safely. ${bossDetail}`
                : `<b>Pocket (inside feature):</b> Start near the pocket center so there is travel room in both directions on the chosen axis. The macro performs internal wall touches and retract moves to establish center/offset safely. ${pocketDetail}`) + circularDetail;
        }

        // Show/hide secondary direction control when Find Both is enabled
        const dir2Block = el('m_dir2_block');
        const dir2El = el('m_dir2');
        if (dir2Block) dir2Block.classList.toggle('hidden', !params.findBoth);
        if (params.findBoth && dir2El) dir2El.value = dir2val;

        // Traverse-over clearance only applies to a BOSS probed in AUTO mode (it crosses over the part).
        const clearBlock = el('m_clear_block');
        if (clearBlock) clearBlock.classList.toggle('hidden', !(params.featureType === 'boss' && params.approach === 'auto'));
        // Per-axis cross-over distances also apply only to a boss in AUTO (used by traverseOver).
        const crossBlock = el('m_crossover_block');
        if (crossBlock) crossBlock.classList.toggle('hidden', !(params.featureType === 'boss' && params.approach === 'auto'));

        const gcode = wizard.generate(params);
        el('wiz_middle_code').innerHTML = UIUtils.formatGCode(gcode);
        // Infer the spindle start (pocket → centre; boss → outside the first side) so the preview begins right.
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'middleVizContainer', wizard.inferStart(params, stock), wizard.inferStarts(params, stock));

        // Update middle status label
        const middleStatus = el('middleVizStatus');
        const dirLabel = params.dir1 === 'pos' ? 'pos' : 'neg';
        const bothLabel = params.findBoth ? ` (both: ${params.dir1}/${params.dir2})` : '';
        if (middleStatus) middleStatus.textContent = `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;

        // Autoplay simulation when Middle wizard is opened — use discoverAnimSteps + PathAnimator
        if (window.discoverAnimSteps && window.PathAnimator) {
            try {
                const animInput = window.discoverAnimSteps({
                    featureType: params.featureType,
                    axis: params.axis,
                    dir1: params.dir1,
                    twoAxis: !!params.findBoth,
                    dir2: params.dir2
                });
                console.debug('middleView.update: animInput', animInput);

                // Check if animation is enabled
                const animate = el('m_animate')?.checked !== false; // default true
                console.debug('middleView.update: animate =', animate);

                // Stop any running animation and cancel pending start timer
                if (window.__middleAnimTimeout) { clearTimeout(window.__middleAnimTimeout); window.__middleAnimTimeout = null; }
                if (window.__middleAnimator) {
                    try {
                        console.debug('middleView.update: stopping previous animator (if any)');
                        window.__middleAnimator.stop();
                    } catch (e) { console.debug('middleView.update: stop() threw', e); }
                }

                if (animate) {
                    // Animated mode - use PathAnimator
                    if (!window.__middleAnimator) {
                        window.__middleAnimator = new window.PathAnimator({ loop: true });
                        console.debug('middleView.update: created __middleAnimator');
                    }

                    // play asynchronously (do not block UI)
                    window.__middleAnimTimeout = setTimeout(() => {
                        window.__middleAnimTimeout = null;
                        const wcsId = `middle_probe_${params.featureType}_${params.axis}_${params.dir1}_wcs`;
                        animInput.wcsEls = [document.getElementById(wcsId)].filter(Boolean);
                        console.debug('middleView.update: starting playSequence with animInput');
                        window.__middleAnimator.playSequence(animInput).then(() => {
                            console.debug('middleView.update: playSequence completed');
                        }).catch(err => {
                            console.debug('middleView.update: playSequence rejected', err);
                        });
                    }, 60);
                } else {
                    // Static mode - show all paths immediately
                    console.debug('middleView.update: static mode - showing all paths');
                    const allSteps = [
                        ...(animInput.axis1Steps || []),
                        ...(animInput.jogPath ? [animInput.jogPath] : []),
                        ...(animInput.axis2Steps || [])
                    ];
                    setTimeout(() => {
                        allSteps.forEach(step => {
                            if (!step || !step.selector) return;
                            const pathEl = document.querySelector(step.selector);
                            if (pathEl) {
                                pathEl.classList.add('path-draw');
                                const parent = pathEl.closest('g');
                                if (parent) {
                                    if (step.type === 'probe') parent.classList.add('is-probing');
                                    else if (step.type === 'retract') parent.classList.add('is-retracting');
                                    else if (step.type === 'jog') parent.classList.add('is-jogging');
                                }
                                console.debug('middleView.update: added path-draw to', step.selector);
                            }
                        });
                    }, 60);
                }
            } catch (err) {
                console.warn('MiddleViz autoplay failed', err);
            }
        }
    },
};
