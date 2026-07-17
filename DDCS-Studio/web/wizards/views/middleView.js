/** views/middleView.js — Middle (pocket/boss centre) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { MiddleWizard } from '../middleWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { getWorkpiece, workpieceBackdrop } from '../../engine/workpiece.js';   // flatten-migration: draw the DECLARED workpiece cavity at its OFFSET (byte-identical to the legacy centered inset for a derived pocket)
import { slaveFollowing } from '../../engine/gantry.js';   // t648 — the Dual-Gantry Sync A field gates on the DECLARED topology (a Y-slave in Settings → Axes), one source

const wizard = new MiddleWizard();
const layout = new FeatureCanvas();
const num = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

/** TIE ② → the trans-axial diagonal: drag-the-position, the-number-follows. The auto trans-axial is `X[#53-#52-rv] Y#21`
 *  (re-centre the primary to the measured centre, then go OUT by #21=diagTravel on the SECONDARY axis toward ②). So #21 IS
 *  the centre→② out-distance. When the SECONDARY-axis start ② (the diagonal's target) is dragged, derive #21 from ②'s
 *  out-distance from the inferred centre and write the diagTravel field — so the diagonal ENDS on ②, and #21 can no longer
 *  drift from ② (② is the master). NOTE: the diagonal re-centres the PRIMARY axis, so only the SECONDARY out-distance ties —
 *  if ② is dragged off-centre in the primary axis, that coord can't be honoured by the re-centred primary leg. */
function tieDiagTravel(pass, world) {
    if (el('m_type')?.value !== 'boss' || !el('m_both')?.checked || el('m_transaxis')?.value !== 'auto') return;   // diagonal not emitted
    const secStart = (el('m_inaxis')?.value === 'manual') ? 2 : 1;   // the first secondary-axis start = the trans-axial target
    if (pass !== secStart) return;
    const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
    const primaryX = (el('m_axis')?.value || 'X') !== 'Y';           // primary X → secondary Y (and vice-versa)
    const centreSec = primaryX ? num(stock.y, 80) / 2 : num(stock.x, 100) / 2;
    const draggedSec = primaryX ? world.y : world.x;
    const draggedPrim = primaryX ? world.x : world.y;                 // ②'s PRIMARY-axis coord = the diagonal's X target (#22)
    const d21 = Math.max(1, Math.round(Math.abs(draggedSec - centreSec)));   // #21 = the secondary out-distance (Y)
    const d22 = Math.round(draggedPrim);                              // B-TRANS (b): #22 = ②'s primary coord (the diagonal targets ②'s FULL position)
    const f = el('m_diag_travel'), fp = el('m_diag_primary');
    let changed = false;
    if (f && f.value !== String(d21)) { f.value = String(d21); changed = true; }
    if (fp && fp.value !== String(d22)) { fp.value = String(d22); changed = true; }   // ② drives BOTH #21 (Y) and #22 (X) — the diagonal joins ②
    if (changed && f) f.dispatchEvent(new Event('input', { bubbles: true }));   // ONE re-generate (update() reads both fields)
}

/** The ②-AIM feature-canvas spec: the per-pass start markers ①②③④ as DRAGGABLE POINT handles. Unlike Edge's vector (which
 *  wrote FORM fields), a drag here writes the SIM-ONLY DECLARED value via panel.onStartDrag → userStarts[p] → the same seam
 *  the 2D/3D markers use (computePassStarts → the trace AND the engine). So dragging ② makes that probe pass BEGIN there.
 *  PLUS ② also drives the macro's #21 (tieDiagTravel) so the auto trans-axial diagonal ends ON ② — ONE handle, BOTH outputs. */
/** The FEATURE shape to DRAW in the canvas (so it shows WHAT'S being probed, not just the stock rect). The STOCK shape is
 *  the ONE source — the SAME value the 3D reads — so the 2D and 3D always match. The op-type PRESELECTS it (see syncStockShape
 *  in update(): picking a pocket op declares a pocket stock), and the stock panel OVERRIDES it (declare-default +
 *  autonomy-override). Sizes reuse the 3D model (pocket cavity inset 0.25·min(x,y)); the size is approximate pre-probe. */
function buildFeatureItems(sw, sh, stock) {
    if (!(sw > 0 && sh > 0)) return [];
    const shape = stock && stock.shape;
    if (shape === 'cylinder') return [{ kind: 'circle', cx: sw / 2, cy: sh / 2, r: Math.min(sw, sh) * 0.4, cls: 'fc-feature-boss' }];   // round bar / boss
    // POCKET → read the DECLARED workpiece cavity so it renders at its OFFSET (a legacy pocket derives the SAME centered 25%
    // inset → byte-identical; a stock-modal-declared off-centre pocket draws at its real pos+size — the ONE source, no inset).
    if (shape === 'pocket') { try { return workpieceBackdrop(getWorkpiece(), { ox: 0, oy: 0 }).items || []; } catch (_) { return []; } }
    return [{ kind: 'rect', x: 0, y: 0, w: sw, h: sh, cls: 'fc-feature-boss' }];   // BOSS block (the probe approaches it from outside)
}

// The op-type PRESELECTS the stock shape (so a pocket op shows a pocket in BOTH the 2D canvas AND the 3D, which both read
// stock.shape). Only on an op-type/circular CHANGE — never on every update — so a stock-panel OVERRIDE isn't clobbered. The
// in-memory mutation is on the SAME _ddcsSettings object the 3D/sim read, and gets persisted on the next saveSettings; we
// do NOT call saveSettings here (it would re-enter update() via the ddcs:settings-changed listener).
let _lastShapeKey = null;
function syncStockShape(featureType, circular) {
    const key = (circular ? 'cyl' : '') + featureType;
    if (key === _lastShapeKey) return;
    _lastShapeKey = key;
    const want = circular ? 'cylinder' : (featureType === 'boss' ? 'boss' : 'pocket');
    const stk = window.ddcsGetSettings && window.ddcsGetSettings().stock;
    if (!stk || stk.shape === want) return;
    stk.shape = want;   // declare the stock for BOTH views (the 2D reads it; preview3D re-setStocks the 3D this render)
    // Persist + broadcast (so a reload + the open stock dialog stay in sync), but DEFERRED — saveSettings re-enters
    // update() via the ddcs:settings-changed listener, so run it AFTER this render completes (queueMicrotask), not inside it.
    if (window.ddcsSaveSettings) queueMicrotask(() => window.ddcsSaveSettings());
}

function renderStartCanvas(panel, stock) {
    const container = el('middleLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];
    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const handles = starts.map((s, p) => ({ id: 'start:' + p, x: +s.x || 0, y: +s.y || 0, kind: 'move', label: String(p + 1) }));   // ①②③④ as POINT handles
    const spec = {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items: buildFeatureItems(sw, sh, stock), handles,
        // a handle drag hands back a WORLD point → write the per-pass start through the shared seam, then redraw THIS canvas
        // (the 2D/3D + engine already followed inside onStartDrag → setGcode/replay; getPassStarts() now has the new value).
        onDrag: (id, world) => {
            const p = parseInt(String(id).split(':')[1], 10) || 0;
            const z = (starts[p] && starts[p].z) || 0;
            panel.onStartDrag({ x: world.x, y: world.y, z }, p);   // ① SIM: userStarts[p] (the pass begins here)
            tieDiagTravel(p, world);                                // ② G-CODE: ② also drives #21 → the diagonal ends ON ②
            renderStartCanvas(panel, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        },
    };
    layout.render(container, spec);
}

export const middleView = {
    type: 'middle',
    panelId: 'wiz_middle',
    codeElId: 'wiz_middle_code',
    large: true,
    twoPane: true,
    inputIds: [
        'm_type', 'm_inaxis', 'm_transaxis', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_circular', 'm_probe_z_first', 'm_sync_a', 'm_wcs', 'm_slave',
        'm_dist', 'm_retract', 'm_clear_mode', 'm_hop_dist', 'm_plane_z', 'm_clear', 'm_crossX', 'm_crossY', 'm_diag_travel',
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
            featureType: el('m_type')?.value || 'boss',
            inAxis: el('m_inaxis')?.value || 'auto',        // INC3: per-traverse toggles (replace the single approach)
            transAxis: el('m_transaxis')?.value || 'auto',
            clearOver: el('m_clear')?.value || '15',
            crossX: el('m_crossX')?.value,   // boss-auto per-axis cross-over (string: a number or the [#1+#2] expression default)
            crossY: el('m_crossY')?.value,
            diagTravel: el('m_diag_travel')?.value,   // boss probe-both auto trans-axis: the diagonal traverse distance (#21)
            diagPrimary: el('m_diag_primary')?.value,   // B-TRANS (b): the diagonal's X target (#22) — '#53' at rest, ②.X when placed
            axis: el('m_axis')?.value || 'X',
            dir1: dir1val,
            dir2: dir2val,
            findBoth: el('m_both')?.checked || false,
            circular: el('m_circular')?.checked || false,
            probeZ: el('m_probe_z_first')?.checked || false,   // probe-Z-first: Z datum before the XY work
            syncA: el('m_sync_a')?.checked || false,
            slave: el('m_slave')?.value || '3',
            wcs: el('m_wcs')?.value || 'active',
            dist: el('m_dist')?.value || '200',
            retract: el('m_retract')?.value || '2',
            clearMode: el('m_clear_mode')?.value || 'max',   // t921 B2b-2b — the declared CLEARANCE MODE (replaces the retired Safe-Z field): max (machine margin) | hop | plane
            hopDist: el('m_hop_dist')?.value || '15',         // shown only when clearMode==='hop'
            planeZ: el('m_plane_z')?.value || '10',           // shown only when clearMode==='plane'
            clearance: '2',
            f_fast: el('m_feed_fast')?.value || '200',
            f_slow: el('m_feed_slow')?.value || '50',
            qStop: el('m_q')?.value || '1',
            port: window.ddcsGetSettings().probes.probePin,
            level: window.ddcsGetSettings().probes.probeLevel,
            radius: window.ddcsGetSettings().probes.radius,   // stylus tip radius → #6 (diameter/Z-surface comp); matches the sim collision

            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        // POCKET reaches both walls from the centre → no reposition ever → force both auto + hide the toggles.
        // BOSS: the IN-axis toggle always applies; the TRANS-axis toggle only when probing BOTH axes.
        const isBoss = params.featureType === 'boss';
        if (!isBoss) { params.inAxis = 'auto'; params.transAxis = 'auto'; }
        const inAxisBlock = el('m_inaxis_block'); if (inAxisBlock) inAxisBlock.classList.toggle('hidden', !isBoss);
        const transAxisBlock = el('m_transaxis_block'); if (transAxisBlock) transAxisBlock.classList.toggle('hidden', !(isBoss && params.findBoth));

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

        // Traverse-over clearance + per-axis cross-over apply to a BOSS with the IN-axis traverse on AUTO (traverseOver).
        const inAxisAuto = isBoss && params.inAxis === 'auto';
        const clearBlock = el('m_clear_block'); if (clearBlock) clearBlock.classList.toggle('hidden', !inAxisAuto);
        const crossBlock = el('m_crossover_block'); if (crossBlock) crossBlock.classList.toggle('hidden', !inAxisAuto);
        // t921 B2b-2b — the per-mode CLEARANCE field WHEN-GATES on the dropdown: HOP HEIGHT shows only for Hop, CLEARANCE PLANE
        // only for Plane; Max shows neither (it needs no field). Every visible field now DRIVES the emit (the Safe-Z-drives-nothing complaint closed).
        const hopBlock = el('m_hop_block'); if (hopBlock) hopBlock.classList.toggle('hidden', params.clearMode !== 'hop');
        const planeBlock = el('m_plane_block'); if (planeBlock) planeBlock.classList.toggle('hidden', params.clearMode !== 'plane');
        // TRAVEL-START inc2a: the DIAG TRAVEL field is GONE from the UI — #21 is DERIVED from the dragged ② (tieDiagTravel).
        // m_diag_block stays permanently hidden (no show-toggle); the readonly input persists the derived value + round-trips.

        // t648 — the Dual-Gantry Sync A field GATES on the DECLARED machine topology (a Y-slave in Settings → Hardware →
        // Machine → Axes), NOT a free per-op checkbox. No Y-slave → grey + uncheck (nothing to sync); a Y-slave declared →
        // enable + DERIVE the slave index (A=3/B=4) from the topology (one source). The EMIT stays byte-identical (it still
        // honours params.syncA); this is a VIEW gate, so the middleStack + the data-op twin are untouched.
        const gSlaveIdx = slaveFollowing((window.ddcsGetSettings && window.ddcsGetSettings().motors) || {}, 'y');
        const gSync = el('m_sync_a'), gSlave = el('m_slave');
        if (gSync) {
            const hasSlave = gSlaveIdx != null;
            gSync.disabled = !hasSlave;
            if (hasSlave) gSync.removeAttribute('data-op-gated'); else { gSync.setAttribute('data-op-gated', 'true'); gSync.checked = false; }
            const lbl = gSync.closest('label');
            if (lbl) { lbl.style.opacity = hasSlave ? '' : '0.5'; lbl.title = hasSlave
                ? 'Dual-gantry: writes the found centre to the slave-axis WCS, keeping the twin-motor gantry squared.'
                : 'No gantry slave declared — set an axis to “Gantry slave” in Settings → Hardware → Machine → Axes to enable.'; }
        }
        if (gSlave && gSlaveIdx != null) gSlave.value = String(gSlaveIdx);   // derive the slave index from the topology
        params.syncA = el('m_sync_a')?.checked || false;   // re-read after the gate (an un-topology'd machine can't force the sync on)
        params.slave = el('m_slave')?.value || '3';

        const gcode = wizard.generate(params);
        el('wiz_middle_code').innerHTML = UIUtils.formatGCode(gcode);
        // The op-type PRESELECTS the stock shape (BEFORE the preview, so the 3D + 2D read the declared shape this render).
        syncStockShape(params.featureType, !!el('m_circular')?.checked);
        // Infer the spindle start (pocket → centre; boss → outside the first side) so the preview begins right.
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'middleVizContainer', wizard.inferStart(params, stock), wizard.inferStarts(params, stock));
        // ②-aim feature canvas: render the per-pass start markers as draggable handles (panel exists after preview3D).
        renderStartCanvas(ctx._activePanel, stock);

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
