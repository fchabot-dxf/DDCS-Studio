/** views/middleView.js — Middle (pocket/boss centre) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { MiddleWizard } from '../middleWizard.js';

const wizard = new MiddleWizard();

export const middleView = {
    type: 'middle',
    panelId: 'wiz_middle',
    codeElId: 'wiz_middle_code',
    large: true,
    twoPane: true,
    inputIds: [
        'm_type', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_sync_a', 'm_wcs', 'm_slave',
        'm_dist', 'm_retract', 'm_safe_z',
        'm_feed_fast', 'm_feed_slow', 'm_port', 'm_level', 'm_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { m_port: 'port', m_level: 'level', m_feed_fast: 'fastFeed', m_retract: 'retract' },

    onOpen(ctx) {
        setTimeout(() => { ctx.update(); }, 50);
    },

    async update(ctx) {
        const dir1val = el('m_dir')?.value || 'pos';
        const dir2val = el('m_dir2')?.value || (dir1val === 'pos' ? 'neg' : 'pos');

        const params = {
            featureType: el('m_type')?.value || 'pocket',
            axis: el('m_axis')?.value || 'X',
            dir1: dir1val,
            dir2: dir2val,
            findBoth: el('m_both')?.checked || false,
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

        const middleDesc = el('middle_desc');
        if (middleDesc) {
            const pocketDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it completes both edge touches on the selected axis, then repeats the same two-edge cycle on the perpendicular axis.'
                : 'With <b>Probe Both Axes</b> disabled, it still probes <b>two opposite edges on the selected axis</b> and calculates the midpoint on that axis.';
            const bossDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it performs the two-edge cycle on the selected axis, then repeats on the perpendicular axis (with reposition pauses where required).'
                : 'With <b>Probe Both Axes</b> disabled, it performs <b>two opposite-edge probes on the selected axis</b> and computes midpoint/offset from that axis only.';

            middleDesc.innerHTML = params.featureType === 'boss'
                ? `<b>Boss (outside feature):</b> Start with the probe near one external wall of the boss at probe height. Keep approach clear so the stylus can move away for retract and return safely. ${bossDetail}`
                : `<b>Pocket (inside feature):</b> Start near the pocket center so there is travel room in both directions on the chosen axis. The macro performs internal wall touches and retract moves to establish center/offset safely. ${pocketDetail}`;
        }

        // Show/hide secondary direction control when Find Both is enabled
        const dir2Block = el('m_dir2_block');
        const dir2El = el('m_dir2');
        if (dir2Block) dir2Block.classList.toggle('hidden', !params.findBoth);
        if (params.findBoth && dir2El) dir2El.value = dir2val;

        const gcode = wizard.generate(params);
        el('wiz_middle_code').innerHTML = UIUtils.formatGCode(gcode);
        // Infer the spindle start (pocket → centre; boss → outside the first side) so the preview begins right.
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'middleVizContainer', wizard.inferStart(params, stock));

        // Update middle status label
        const middleStatus = el('middleVizStatus');
        const dirLabel = params.dir1 === 'pos' ? 'pos' : 'neg';
        const bothLabel = params.findBoth ? ` (both: ${params.dir1}/${params.dir2})` : '';
        if (middleStatus) middleStatus.textContent = `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;

        // Update visualization if function exists — await SVG injection so autoplay can find elements
        if (window.drawMiddleViz) {
            console.debug('middleView.update: calling drawMiddleViz and awaiting completion');
            await window.drawMiddleViz();
            console.debug('middleView.update: drawMiddleViz complete');

            // Diagnostic: show available SVG IDs and resolved selectors in the status area
            try {
                const svgRoot = document.getElementById('middleVizContainer')?.querySelector('svg');
                const statusEl = document.getElementById('middleVizStatus');
                if (!svgRoot) {
                    if (statusEl) statusEl.textContent = 'ERROR: SVG not injected into middleVizContainer';
                    console.warn('middleView.update: svgRoot missing after drawMiddleViz');
                } else {
                    const ids = Array.from(svgRoot.querySelectorAll('[id]')).map(e => e.id);
                    if (statusEl) {
                        // Show the first non-empty line of the generated G-code (the current configC)
                        const firstLine = (gcode || '').split(/\r?\n/).find(l => l.trim().length > 0)
                            || `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;
                        const title = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
                        // Only show the config (do not append SVG element counts)
                        statusEl.textContent = title;
                    }
                    console.debug('middleView.update: SVG element IDs (first 60)=', ids.slice(0, 60));
                }
            } catch (e) { console.warn('middleView.update: diagnostics failed', e); }
        }

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
