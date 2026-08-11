/** views/atcViews.js — the ATC wizard views (length / warmup / change / commissioning test). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { getTncStatus, refreshTncStatus } from '../../ui/tncInstallStatus.js';   // [B] gateway-verified install tri-state
import { num } from '../ops/util.js';
import { toolProfileSvg } from '../../viz/toolProfile.js';
import { renderMagazineTable } from '../../ui/ioTable.js';
import { AtcLengthWizard } from '../atcLengthWizard.js';
import { AtcWarmupWizard } from '../atcWarmupWizard.js';
import { AtcChangeWizard, atcChoreography, firmwareStationSeed } from '../atcChangeWizard.js';
import { atcCombo } from '../atcModel.js';
import { opSimContext } from '../../viz/opSimContext.js';   // t714 (R-A) — the ONE declared per-type intent; applyPreviewIntent reads it so built-in views + twins agree
import { motionToSimGcode, interpCtxFromAtc } from '../atcInterpreter.js';
import { traceToolpath } from '../../engine/trace.js';
import { AtcTestWizard } from '../atcTestWizard.js';
import { AtcToolCheckWizard } from '../atcToolCheckWizard.js';
import { AtcTableWizard } from '../atcTableWizard.js';

const lengthWizard = new AtcLengthWizard();
const warmupWizard = new AtcWarmupWizard();
const changeWizard = new AtcChangeWizard();
const testWizard = new AtcTestWizard();
const toolCheckWizard = new AtcToolCheckWizard();
const tableWizard = new AtcTableWizard();

const setStatus = (id, text) => { const e = el(id); if (e) e.textContent = text; };

/** One tool tile: the real tool profile (now-accurate shapes) + a label + sub-line. `on` = highlighted. */
function toolTile(tool, label, sub, on) {
    const t = tool || { type: 'endmill', dia: 6, length: '' };
    return `<div title="${t.type || 'tool'}${t.dia ? ' Ø' + t.dia : ''}" style="text-align:center;flex:0 0 auto;font-size:10px;color:var(--text-dim);padding:2px 5px;border-radius:6px;${on ? 'background:rgba(45,226,255,.14);outline:1px solid var(--accent,#2de2ff);' : ''}">`
        + toolProfileSvg(t, on ? { w: 30, h: 46, color: 'var(--accent,#2de2ff)' } : { w: 30, h: 46 })
        + `<div>${label}</div><div>${sub || ''}</div></div>`;
}

/**
 * Magazine rack strip — the "see the pockets + tools" preview, shared by the ATC wizards. If a magazine is built,
 * it shows one tile per POCKET (with the assigned tool's real profile). If no magazine yet but the library has
 * tools, it shows the TOOL LIBRARY so you still SEE your tools (build the magazine to assign pockets).
 * `opts.highlight` = a tool number to emphasise (e.g. the tool being changed to).
 */
function magazineRackHtml(a, opts = {}) {
    const byNum = {};
    (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
    const mag = Array.isArray(a.magazine) ? a.magazine : [];
    const hl = opts.highlight != null && opts.highlight !== '' ? Number(opts.highlight) : null;
    if (mag.length) {
        return mag.map((p, i) => {
            const tn = Number(p.tool);
            const tool = byNum[tn] || { type: 'endmill', dia: 6, length: '' };
            const len = (tool.length !== '' && tool.length != null) ? tool.length + 'mm' : '';
            return toolTile(tool, `P${num(p.pocket, i + 1)}${tn ? ' · T' + tn : ''}`, len, hl != null && tn === hl);
        }).join('');
    }
    // No magazine pockets yet — still show the tool LIBRARY so the user sees the tools they added.
    const tools = (a.tools || []).filter((t) => t && t.num != null && t.num !== '');
    if (!tools.length) return '<span style="font-size:11px;color:var(--text-dim);">No tools yet — add them in Settings → Tool table (＋ Tool library).</span>';
    return tools.map((t) => toolTile(t, 'T' + t.num, (t.length !== '' && t.length != null) ? t.length + 'mm' : (t.name || ''), hl != null && Number(t.num) === hl)).join('');
}

/** Build the 3D-magazine pocket list (machine XYZ + the assigned tool's full shape) for viz.setMagazine. For a
 *  disk/carousel the pockets have no per-pocket XYZ, so lay them in a ring of the carousel Ø around the pickup. */
export function magazinePockets(a, theta) {
    const byNum = {};
    (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
    const mag = Array.isArray(a.magazine) ? a.magazine : [];
    const toolOf = (p) => { const t = byNum[Number(p.tool)] || {}; return { type: t.type || 'endmill', dia: num(t.dia, 6), angle: t.angle, length: num(t.length, 30), num: Number(p.tool) }; };
    if (a.magType === 'disk') {
        // The pickup is a point ON the carousel rim (where the spindle picks up); the disk centre is offset from
        // it by the radius. Pocket 1 sits at the pickup; the rest ring around the centre. `theta` (t197) rotates the
        // whole ring (the carousel indexing) so a target pocket comes to the pickup.
        const pk = a.pickup || {};
        const R = num(a.diskDia, 0) / 2;
        const dirs = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
        const o = dirs[a.diskAxis] || dirs['+y'];              // pickup → centre direction (the carousel axis)
        const cx = num(pk.x, 0) + R * o[0], cy = num(pk.y, 0) + R * o[1], cz = num(pk.z, 0);
        // t885 — the DECLARED carousel mounting offset (a.diskOffsetDeg): rotate the WHOLE ring by it (folded into ang0), so
        // pocket 0 sits at pickup+offset. Slot i angle = ang0_base + offset + i*(360/n). index stays the array position.
        const ang0 = Math.atan2(-o[1], -o[0]) + num(a.diskOffsetDeg, 0) * Math.PI / 180;   // angle from centre back to the pickup (+ the declared offset) = pocket 0
        const n = mag.length || 1;
        const out = mag.map((p, i) => {
            const ang = ang0 + (i / n) * Math.PI * 2 + (Number(theta) || 0);
            return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), z: cz, pocket: p.pocket != null ? p.pocket : i + 1, tool: toolOf(p), empty: (p.tool === '' || p.tool == null), ang };
        });
        out.disk = { cx, cy, cz, R };   // t885 — the carousel plate geometry for the 3D render (setMagazine draws a thin disc)
        return out;
    }
    return mag.map((p, i) => ({ x: p.x, y: p.y, z: p.z, pocket: p.pocket != null ? p.pocket : i + 1, tool: toolOf(p), empty: (p.tool === '' || p.tool == null) }));
}

/** t1722 (gate repair, cycle 857 ACT 2) — the SAME pocket list, filtered to tool-assigned pockets only (empty
 *  pockets omitted). Survey finding: the single-op wizard preview showed EVERY configured pocket while the
 *  whole-program preview (createPreviewPanel.js's setShowMagazine) independently filtered to occupied-only —
 *  same declared showMagazine intent, two computations, visibly different magazines for the same op. This is
 *  the ONE function both hosts now call, so they cannot disagree by construction (the survey's own Good/Bad
 *  dividing line: does a preview call the shared function, or re-derive the fact next to it). */
export function magazineOccupiedPockets(a, theta) {
    const all = magazinePockets(a, theta);
    const list = all.filter((p) => !p.empty);
    list.disk = all.disk;   // t885 — keep the carousel-plate metadata through the occupancy filter
    return list;
}

/**
 * t714 (R-A/R-B) — apply an op's DECLARED opSimContext(opType) preview intent to a container, via the manager's preview*
 * methods. THE ONE apply that BOTH the built-in views AND the twin (userOpView) call, so the built-in and the twin get the
 * SAME frame / seat / rig / magazine BY CONSTRUCTION — retiring the imperative-vs-declared drift (the alignment-seat class).
 * Idempotent (the panel setters early-return when unchanged). Call AFTER preview3D (the panel/viz must exist).
 *   forceMachine → envelope · toolMachineFrame → raw-machine-coords tool · seatAtStart → seat at the Start · rig · magazine.
 */
export function applyPreviewIntent(mgr, containerId, opType) {
    if (!mgr || !containerId) return;
    try {
        const ctx = opSimContext(opType);
        if (mgr.previewRotaryFixture) mgr.previewRotaryFixture(containerId, !!ctx.showRotaryRig);
        if (ctx.forceMachine && mgr.previewMachine) mgr.previewMachine(containerId, true);            // R-B #7 — honor plain forceMachine, not only tmf
        if (ctx.toolMachineFrame && mgr.previewToolMachineFrame) mgr.previewToolMachineFrame(containerId, true);
        if (mgr.previewSeatAtStart) mgr.previewSeatAtStart(containerId, !!ctx.seatAtStart);
        if (mgr.previewProbesForWcs) mgr.previewProbesForWcs(containerId, !!ctx.probesForWcs);   // t1203 — a probe op never renders through the declared WCS table
        if (ctx.showMagazine && mgr.previewMagazine) {
            const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings()) || {};
            mgr.previewMagazine(containerId, magazineOccupiedPockets(s.atc || {}));   // t1722 — the SAME occupancy-filtered list the whole-program preview shows
        }
    } catch (_) { /* op declares no rig/machine/seat/magazine intent → harmless no-ops */ }
}

/**
 * Bold "UNVERIFIED" banner for the generic/disk INLINE tool change (A2). The inline change SEQUENCE (magazine
 * pick&place) is an ASSUMPTION never proven on real DDCS firmware — the real M350 O10102 is a pneumatic push
 * station, not a drawbar changer. INC-B2: the drawbar/sensor CODES now come from the user's Settings → ATC I/O
 * (one source, via tncProgram), but the MOTION sequence stays unverified — so the banner stays RED, reworded to
 * pin the distinction. Created once (lazily, anchored above the method-specific rows) then toggled per method.
 * INC-C3: gated on callMacro=false — the inline body only ships when INLINING. In the default T# M6 mode
 * (callMacro=true) the op just calls the installed T.nc, so this is hidden (the amber install banner covers it).
 */
function syncChangeUnverifiedBanner(method, callMacro) {
    const unverified = !callMacro && (method === 'generic' || method === 'auto' || method === 'disk');
    let banner = el('atc_change_unverified');
    if (!banner) {
        const anchor = el('atc_change_manual_params');   // first method-specific row, right under the Method selector
        if (!anchor || !anchor.parentNode) return;
        banner = document.createElement('div');
        banner.id = 'atc_change_unverified';
        banner.setAttribute('role', 'alert');
        banner.style.cssText = 'display:none; margin:4px 0 8px; padding:8px 10px; border:1px solid var(--danger,#ef4444);'
            + ' border-left:4px solid var(--danger,#ef4444); border-radius:5px; background:rgba(239,68,68,0.10);'
            + ' color:var(--danger,#ef4444); font-size:12px; line-height:1.5;';
        banner.innerHTML = '<b>⚠ Change SEQUENCE unverified on real DDCS firmware</b> — this magazine pick &amp; place'
            + ' MOTION is an ASSUMPTION (the real M350 O10102 is a pneumatic push station, not a drawbar changer).'
            + ' The drawbar / sensor <b>codes come from your Settings → ATC I/O</b>, but the sequence is unverified —'
            + ' <b>review every emitted line before running</b>, with no tool in the spindle and a hand on e-stop.';
        anchor.parentNode.insertBefore(banner, anchor);
    }
    banner.style.display = unverified ? '' : 'none';
}

/**
 * INC-C2 (guardrail A) + [B] gateway-VERIFY: the install-DEPENDENCY banner, now a live TRI-STATE. An AUTOMATIC method
 * (firmware/generic/disk) emitting the DEFAULT `T# M6` call (callMacro=true) does NOTHING on the machine unless the
 * operator has installed a T.nc macro. When a gateway is CONNECTED we VERIFY it (tncInstallStatus.getTncStatus — a
 * declared read-only check, never scraped): GREEN installed-verified · RED not-found-on-controller · AMBER can't
 * verify (no gateway → today's "install it" text). Hidden for the inline fallback (callMacro=false) + for m6/manual.
 */
function syncChangeMacroBanner(method, callMacro) {
    const show = !!callMacro && (method === 'firmware' || method === 'generic' || method === 'disk');
    let banner = el('atc_change_macrodep');
    if (!banner) {
        const anchor = el('atc_change_automatic_params');   // sits right above the callMacro toggle it explains
        if (!anchor || !anchor.parentNode) return;
        banner = document.createElement('div');
        banner.id = 'atc_change_macrodep';
        banner.setAttribute('role', 'alert');
        // Static shell; renderTncBanner fills the state-varying border/background/color + text (so it can re-render
        // async on ddcs:tnc-status without clobbering the display the caller sets).
        banner.style.cssText = 'display:none; margin:4px 0 8px; padding:8px 10px; border-radius:5px; font-size:12px; line-height:1.5;';
        anchor.parentNode.insertBefore(banner, anchor);
    }
    if (show) { renderTncBanner(banner); refreshTncStatus(); }   // kick a read-only re-verify; the listener re-renders when it lands
    banner.style.display = show ? '' : 'none';
}

// The three install states → the banner's [border/text-color, background, html] (the value the [B] spec asserts).
const TNC_BANNER = {
    installed: ['var(--success,#22c55e)', 'rgba(34,197,94,0.10)',
        '<b>✓ T.nc installed on the controller</b> — verified via the connected gateway. This T# M6 change will call it.'],
    missing: ['var(--danger,#ef4444)', 'rgba(239,68,68,0.10)',
        '<b>⚠ T.nc NOT FOUND on the controller</b> — this change emits a bare <b>T# M6</b> that will do <b>NOTHING</b>.'
        + ' Generate + install it via <b>Settings → ATC → Generate T.nc</b>.'],
    unknown: ['var(--warning,#f59e0b)', 'rgba(245,158,11,0.10)',
        '<b>⚠ Calls your installed T.nc macro</b> — this change emits a bare <b>T# M6</b>. Install it first via'
        + ' <b>Settings → ATC → Generate T.nc</b>, or a bare T# M6 does <b>NOTHING</b> on the machine.'
        + ' (Uncheck “Call installed T.nc macro” below to inline the full sequence instead.)'],
};
function renderTncBanner(banner) {
    const [color, bg, html] = TNC_BANNER[getTncStatus()] || TNC_BANNER.unknown;
    banner.style.border = '1px solid ' + color;
    banner.style.borderLeft = '4px solid ' + color;
    banner.style.background = bg;
    banner.style.color = color;
    banner.innerHTML = html;
}
// A read-only re-verify landed → re-render the banner in place if it's currently shown (never touches its display).
document.addEventListener('ddcs:tnc-status', () => { const b = el('atc_change_macrodep'); if (b && b.style.display !== 'none') renderTncBanner(b); });

/**
 * INC-B2b — the post-field-gating pattern ([[post-field-gating]]): GREY (not hide) a form field the current method/mode
 * cannot honor, with a tooltip explaining WHY, so the UI never declares an intent the emit can't deliver (valid-by-
 * construction). Mirrors the probe formWidgets greying (disabled + opacity + title). Preserves the field's original
 * title (captured once) so un-gating restores it.
 */
function gateField(id, gated, why) {
    const inp = el(id); if (!inp) return;
    const host = inp.closest('label') || inp;
    if (host.dataset.origTitle == null) host.dataset.origTitle = host.title || '';
    inp.disabled = !!gated;
    // Declared contract with postGating: an op-gated field owns its own disabled state — postGating (which blanket-
    // re-enables every control in a cap-ON panel) reads this flag and leaves a `data-op-gated=true` field disabled.
    inp.dataset.opGated = gated ? 'true' : 'false';
    host.style.opacity = gated ? '.5' : '';
    host.title = gated ? (why || '') : host.dataset.origTitle;
}

/** Pop the full magazine editor as a modal with a Done button — the wizard's own table stays read-only/compact. */
function openMagazineModal(refresh) {
    const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    s.atc = s.atc || {};
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
    ov.innerHTML = `<div style="width:min(900px,95vw); max-height:88vh; overflow:auto; background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
        <b>Edit tool magazine</b>
        <div class="mag-edit-host"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px;"><button class="toolbar-btn settings-io" data-mag-done>✓ Done</button></div>
    </div>`;
    document.body.appendChild(ov);
    renderMagazineTable(ov.querySelector('.mag-edit-host'), s.atc, () => { if (window.ddcsSaveSettings) window.ddcsSaveSettings(); if (refresh) refresh(); });
    const close = () => ov.remove();
    ov.querySelector('[data-mag-done]').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
}

export const atcLengthView = {
    type: 'atc_length',
    panelId: 'wiz_atc_length',
    codeElId: 'wiz_atc_length_code',
    large: true,
    twoPane: true,
    inputIds: [],   // no wizard inputs — params come from Settings → ATC (tool-setter pin from Probes)
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 100,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        const gcode = lengthWizard.generate(params);
        el('wiz_atc_length_code').innerHTML = UIUtils.formatGCode(gcode);
        const setter = (p.setterW > 0 && p.setterH > 0) ? p : null;
        if (mgr) mgr.preview3D(gcode, 'atcLengthViz');
        if (mgr) applyPreviewIntent(mgr, 'atcLengthViz', 'atc_length');   // t714 — the DECLARED intent (envelope), single-sourced with the twin
        if (mgr && mgr.previewToolSetter) mgr.previewToolSetter('atcLengthViz', setter);   // the fixed touch-off block at its configured machine position
        setStatus('atcLengthVizStatus', 'Z touch on the tool setter · ▶ traces the fast approach, slow touch + retract');
    },
};

export const atcCheckView = {
    type: 'atc_check',
    panelId: 'wiz_atc_check',
    codeElId: 'wiz_atc_check_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_check_tol'],   // tolerance only — setter + feeds come from Settings → ATC / Probes
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 100,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            tolerance: el('atc_check_tol')?.value || '0.5',
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        const gcode = toolCheckWizard.generate(params);
        el('wiz_atc_check_code').innerHTML = UIUtils.formatGCode(gcode);
        const setter = (p.setterW > 0 && p.setterH > 0) ? p : null;
        if (mgr) mgr.preview3D(gcode, 'atcCheckViz');
        if (mgr) applyPreviewIntent(mgr, 'atcCheckViz', 'atc_check');   // t714 — single-sourced with the twin
        if (mgr && mgr.previewToolSetter) mgr.previewToolSetter('atcCheckViz', setter);   // the fixed touch-off block at its configured machine position
        setStatus('atcCheckVizStatus', 'Z re-tap on the setter · ▶ traces the probe; aborts if broken / wrong length');
    },
};

export const atcWarmupView = {
    type: 'atc_warmup',
    panelId: 'wiz_atc_warmup',
    codeElId: 'wiz_atc_warmup_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_warmup_rpm1', 'atc_warmup_time1', 'atc_warmup_rpm2', 'atc_warmup_time2'],
    update(mgr) {
        const params = {
            rpm1: el('atc_warmup_rpm1')?.value || '6000',
            time1: el('atc_warmup_time1')?.value || '30',
            rpm2: el('atc_warmup_rpm2')?.value || '12000',
            time2: el('atc_warmup_time2')?.value || '30'
        };
        const gcode = warmupWizard.generate(params);
        el('wiz_atc_warmup_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcWarmupViz');
        if (mgr) applyPreviewIntent(mgr, 'atcWarmupViz', 'atc_warmup');   // t714 — envelope + magazine (the twin declares magazine:true), single-sourced (fixes the missing rack)
        setStatus('atcWarmupVizStatus', 'Spindle warm-up · no toolpath — ▶ steps the RPM / dwell stages');
    },
};

export const atcChangeView = {
    type: 'atc_change',
    panelId: 'wiz_atc_change',
    codeElId: 'wiz_atc_change_code',
    large: true,
    twoPane: true,
    inputIds: [
        'atc_change_method',
        'atc_change_x', 'atc_change_y', 'atc_change_z',
        'atc_change_zclear', 'atc_change_fixedt', 'atc_change_orient',
        'atc_change_m300', 'atc_change_cover', 'atc_change_confirm',
        'atc_change_callmacro',   // INC-C1: toggling re-renders the preview (T# M6 call ↔ inline dance)
    ],
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const method = el('atc_change_method')?.value || 'm6';
        // Populate the "change to tool" selector from the magazine tools (preserve the current choice).
        const ftSel = el('atc_change_fixedt');
        if (ftSel && ftSel.tagName === 'SELECT') {
            const cur = ftSel.value;
            const byNum = {}; (s.atc?.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
            const opts = ['<option value="0">From program (M6 Txx)</option>'];
            (s.atc?.magazine || []).forEach((p) => { if (p.tool !== '' && p.tool != null) { const t = byNum[Number(p.tool)]; opts.push(`<option value="${p.tool}">T${p.tool}${t && t.name ? ' · ' + t.name : ''} (P${p.pocket})</option>`); } });
            ftSel.innerHTML = opts.join('');
            if ([...ftSel.options].some((o) => o.value === cur)) ftSel.value = cur;
        }
        // Method-specific parameter rows
        const manualRow = el('atc_change_manual_params');   // park XYZ
        const m6Row = el('atc_change_m6_params');           // change position + target
        const autoRow = el('atc_change_auto_params');       // generic/disk magazine toggles
        const fwRow = el('atc_change_fw_params');           // firmware M19 toggle
        const callMacro = el('atc_change_callmacro')?.checked !== false;
        const auto = method === 'firmware' || method === 'generic' || method === 'disk';
        if (manualRow) manualRow.style.display = method === 'manual' ? '' : 'none';
        // INC-B2b: the change-target + Z-height row now shows for the AUTOMATIC methods too — grey-not-hide the parts they
        // can't honor (below), so the "Change to tool" target is settable for the T# M6 call. Hidden only for manual.
        if (m6Row) m6Row.style.display = method === 'manual' ? 'none' : '';
        if (autoRow) autoRow.style.display = (method === 'generic' || method === 'disk') ? '' : 'none';
        if (fwRow) fwRow.style.display = method === 'firmware' ? '' : 'none';
        const macroRow = el('atc_change_automatic_params');   // INC-C1: the callMacro toggle (all AUTOMATIC methods)
        if (macroRow) macroRow.style.display = auto ? '' : 'none';
        syncChangeUnverifiedBanner(method, callMacro);   // A2 + INC-C3: red UNVERIFIED only when INLINING those codes (callMacro=false)
        syncChangeMacroBanner(method, callMacro);   // INC-C2: install-dependency banner for T# M6 mode

        // INC-B2b — GATE the fields a method/mode can't honor (valid-by-construction, tooltip why):
        // • zClear feeds only the M6-delegate stack; every automatic method uses the machine Safe Z (Settings → ATC).
        gateField('atc_change_zclear', method !== 'm6' && method !== 'manual',
            'The automatic tool change uses your machine Safe Z (Settings → ATC). Z change height applies to the M6-delegate method.');
        // • fixedT: the T# M6 call carries it as the T-word (target follows the field); the INLINE body CANNOT set the
        //   requested tool — the DDCS #1504 register is populated by a Tn M6, not written inline (grounded: not in the
        //   confirmed register set; #1300 is the writable one). So grey it in inline mode rather than silently ignore it.
        gateField('atc_change_fixedt', auto && !callMacro,
            'Inline mode can’t set the requested tool — the DDCS #1504 register is populated by a Tn M6 call, not written inline. Use the recommended “Call installed T.nc macro” mode to change to a specific tool, or select it in your program.');
        // • m300 / dustCover / confirm are consumed by NO stack now — the change sequence + its sensor waits come from
        //   your changer declaration + installed T.nc (Settings → ATC), not these toggles.
        const dead = method === 'generic' || method === 'disk';
        gateField('atc_change_m300', dead, 'Handled by your changer declaration + installed T.nc (Settings → ATC) — the inline body sources its sensor waits from your ATC I/O.');
        gateField('atc_change_cover', dead, 'Handled by your changer declaration + installed T.nc (Settings → ATC).');
        gateField('atc_change_confirm', dead, 'Handled by your changer declaration + installed T.nc (Settings → ATC).');

        const params = {
            method,
            // manual park
            x: el('atc_change_x')?.value || '100',
            y: el('atc_change_y')?.value || '100',
            z: el('atc_change_z')?.value || '0',
            // m6 / generic
            zClear: el('atc_change_zclear')?.value || '0',
            fixedT: el('atc_change_fixedt')?.value || '0',
            // firmware
            orient: el('atc_change_orient')?.checked !== false,
            // generic / disk
            waitSpindle: el('atc_change_m300')?.checked !== false,
            dustCover: el('atc_change_cover')?.checked === true,
            confirm: el('atc_change_confirm')?.checked === true,
            magazine: (s.atc && s.atc.magazine) || [],   // pockets + park XYZ come from Settings → Tool table
            magType: s.atc && s.atc.magType,             // 'disk' → rotate-to-pocket change; else per-pocket moves
            pickup: s.atc && s.atc.pickup,               // disk: the fixed pickup XYZ
            // INC-B2b (4b): the inline body's changer config + I/O CODES are read LIVE by inlineTncStack (ddcsGetSettings),
            // NOT threaded here — that keeps a settings snapshot OUT of the exported op marker and re-emits fresh on reload.
            // INC-B/C1: DEFAULT true — the automatic change emits a T# M6 CALL to the installed T.nc; the #atc_change_callmacro
            // checkbox (INC-C1, guardrail [C]) is the inline-fallback escape hatch — unchecked → the inline body.
            callMacro: el('atc_change_callmacro')?.checked !== false,
        };
        const gcode = changeWizard.generate(params);
        el('wiz_atc_change_code').innerHTML = UIUtils.formatGCode(gcode);
        // I4: a from-zero / RapidChange combo (a CANDIDATE motion with no hand-written stack — e.g. magnet × plunge ×
        // linear) has the choreography INTERPRETER walk its declared steps → a SIM-ONLY path that drives the preview,
        // proving a config-only changer sims. The 3 shipped presets (non-candidate motions) keep their played-inline
        // emit (byte + sim identical). The CODE PREVIEW stays the emit (the interpreter path is sim-only until I5).
        const cmb = atcCombo(params, s.atc);
        // INC-A (sim-decouple): the WIZARD preview animates via the INTERPRETER for a candidate combo OR any AUTOMATIC
        // method (firmware/generic/disk) — the played motion, machine-frame (G53), station from settings.atc.firmwareStation.
        // ADDITIVE: only the sim/preview switches; the EMIT (gcode) stays atcChangeStack (m6/manual keep their played emit).
        const interpret = !!(cmb && cmb.motion && (cmb.motion.candidate || ['firmware', 'generic', 'disk'].includes(cmb.method)));
        const simGcode = interpret ? motionToSimGcode(cmb, interpCtxFromAtc(s.atc, magazinePockets(s.atc || {}), { outputs: s.outputs, inputs: s.inputs })) : gcode;
        if (mgr) mgr.preview3D(simGcode, 'atcChangeViz');
        if (mgr) applyPreviewIntent(mgr, 'atcChangeViz', 'atc_change');   // t714 — envelope + tool-machine-frame + magazine, single-sourced (fixes the wrong tool frame)
        // I4: a FORK/DOCK grip (magnet — RapidChange) renders the forks the tool plunges into at each dock; else clear.
        if (mgr && mgr.previewForkDock) mgr.previewForkDock('atcChangeViz', (interpret && cmb.grip && cmb.grip.device === 'fork') ? magazinePockets(s.atc || {}).map((p) => ({ x: p.x, y: p.y, z: p.z })) : null);
        // P-C.1a: the op's DECLARED choreography (ATC_CHOREOGRAPHY, keyed on the method) drives the sim visual. FIRMWARE
        // = a fixed-station push → highlight the taught #1320-1326 station region (resolved from a trace of this op's
        // G53 code) on the fixed machine frame. Non-firmware (m6/generic/disk/manual) → clear (no inline push station).
        if (mgr && mgr.previewAtcStation) {
            const choreo = atcChoreography(params, s.atc);   // I3: a Studio-declared changer (settings.atc.grip/motion) drives the sim; else the method preset
            // GUI-1: VAR-SEED the firmware station from the Studio-authored store (settings.atc.firmwareStation) so the
            // taught points render from the store instead of untaught-0. One store → one seed → two consumers: the
            // station-highlight trace (below) AND the PLAYED preview engine (previewVarSeed) so the animated push travel
            // also reaches the taught station. SIM-ONLY — the emit still references the controller's own #1320-1326.
            const seed = firmwareStationSeed(s.atc && s.atc.firmwareStation);
            const region = (choreo && choreo.kind === 'push') ? choreo.region(traceToolpath(gcode, { captureVars: choreo.stationVars, createVarStore: seed ? () => new Map(seed) : undefined }).vars || {}) : null;
            mgr.previewAtcStation('atcChangeViz', region);
            if (mgr.previewVarSeed) mgr.previewVarSeed('atcChangeViz', seed);
            // P-C.1b: arm the tool-swap too — a REAL tool change (T#/M6) in the played program retires the old tool to
            // this station + puts the new tool on the spindle. The isolated firmware op (no tool change) shows no swap.
            if (mgr.previewAtcSwap) mgr.previewAtcSwap('atcChangeViz', choreo, region);
        }
        // Magazine strip: show the pockets + tools; highlight the fixed test tool being swapped to.
        const ft = Number(el('atc_change_fixedt')?.value || 0);
        const rack = el('atcChangeTools');
        const showRack = method === 'm6' || method === 'generic' || method === 'disk';
        if (rack) rack.innerHTML = magazineRackHtml(s.atc || {}, { highlight: showRack && ft > 0 ? ft : '' });
        const STATUS = {
            m6: 'Delegate to controller M6 · ▶ traces the safe-Z retract + move to the change position, then M6',
            firmware: 'Firmware push station (O10102) · #1306/#1320-1326 G53 stations + M19 orient — verify on the machine',
            manual: 'Manual park · ▶ traces the safe-Z retract then the move to the swap position',
            generic: 'Generic ASSUMED pick & place · verify on your machine before trusting it',
            disk: 'Disk ASSUMED template · carousel indexing is firmware-specific — verify on your machine',
        };
        setStatus('atcChangeVizStatus', STATUS[method] || STATUS.m6);
    },
};

export const atcTestView = {
    type: 'atc_test',
    panelId: 'wiz_atc_test',
    codeElId: 'wiz_atc_test_code',
    large: true,
    twoPane: true,
    inputIds: [
        'atc_test_mode',
        'atc_test_cycles', 'atc_test_dwell',
        'atc_test_first', 'atc_test_count', 'atc_test_zclear', 'atc_test_descend',
    ],
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const mode = el('atc_test_mode')?.value || 'drawbar';
        const drawbarRow = el('atc_test_drawbar_params');
        const pocketRow = el('atc_test_pocket_params');
        if (drawbarRow) drawbarRow.style.display = mode === 'drawbar' ? '' : 'none';
        if (pocketRow) pocketRow.style.display = mode === 'pockets' ? '' : 'none';

        const params = {
            mode,
            cycles: el('atc_test_cycles')?.value || '10',
            dwellMs: el('atc_test_dwell')?.value || '500',
            first: el('atc_test_first')?.value || '1',
            count: el('atc_test_count')?.value || '8',
            zClear: el('atc_test_zclear')?.value || '0',
            descend: el('atc_test_descend')?.checked === true,
            magazine: (s.atc && s.atc.magazine) || [],   // pocket dry-run visits the Settings → Tool table magazine
        };
        const gcode = testWizard.generate(params);
        el('wiz_atc_test_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcTestViz');
        if (mgr) applyPreviewIntent(mgr, 'atcTestViz', 'atc_test');   // t714 — envelope + tool-machine-frame + magazine, single-sourced
        setStatus('atcTestVizStatus', mode === 'pockets'
            ? 'Pocket dry-run · visits each magazine pocket (Settings → Tool table) at clearance Z'
            : 'Drawbar cycle · no toolpath — ▶ steps the release / lock sequence');
    },
};

export const atcTableView = {
    type: 'atc_table',
    panelId: 'wiz_atc_table',
    codeElId: 'wiz_atc_table_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_table_lengths', 'atc_table_pockets'],   // include lengths / include pockets
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const params = {
            tools: a.tools || [],
            magazine: a.magazine || [],
            includeLengths: el('atc_table_lengths') ? el('atc_table_lengths').checked : true,
            includePockets: el('atc_table_pockets') ? el('atc_table_pockets').checked : true,
        };
        const gcode = tableWizard.generate(params);   // the apply-macro the operator RUNS on the controller
        el('wiz_atc_table_code').innerHTML = UIUtils.formatGCode(gcode);
        // Programming the table is PARAMETER writes (no motion) — so DON'T plot a rapid path (that stray "single
        // movement" was just one G0 to a pocket). Keep the 3D on the bare envelope; the magazine strip below is
        // the real preview (pockets + tools).
        const mag = (Array.isArray(a.magazine) ? a.magazine : []).filter((p) => p && (p.x !== '' || p.y !== '' || p.z !== ''));
        if (mgr) mgr.preview3D('G90', 'atcTableViz');
        if (mgr) applyPreviewIntent(mgr, 'atcTableViz', 'atc_table');   // t714 — envelope + tool-machine-frame + magazine, single-sourced
        // Tool-profile rack strip: each magazine tool drawn at its real shape (type/Ø) + length — review the rack.
        const rack = el('atcTableTools');
        if (rack) rack.innerHTML = magazineRackHtml(a);
        // The wizard's magazine view is READ-ONLY + compact; "✎ Edit table…" pops the full editor as a modal (Done).
        const host = el('atc_table_magazine');
        if (host) {
            const magAll = Array.isArray(a.magazine) ? a.magazine : [];
            const byNum = {}; (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
            const td = 'padding:3px 7px; border-bottom:1px solid var(--border);';
            let orphanCount = 0;   // A7: pockets referencing a tool# no longer in the library
            const rows = magAll.map((p, i) => {
                const t = byNum[Number(p.tool)] || {};
                const has = p.tool !== '' && p.tool != null;
                const orphan = has && !byNum[Number(p.tool)];   // tool# set but missing from the library
                if (orphan) orphanCount++;
                const name = orphan ? `⚠ tool #${p.tool} not in library` : (has ? (t.name || [t.type, t.dia ? 'Ø' + t.dia : ''].filter(Boolean).join(' ') || '—') : '(empty)');
                const len = (has && t.length !== '' && t.length != null) ? t.length + 'mm' : '';
                const icon = (has && !orphan) ? toolProfileSvg({ type: t.type || 'endmill', dia: num(t.dia, 6), angle: t.angle, length: num(t.length, 30) }, { w: 18, h: 26 }) : '';
                const rowBg = orphan ? ' background:rgba(239,68,68,0.08);' : '';
                const dCol = orphan ? 'var(--danger,#ef4444)' : 'inherit';
                const ttl = orphan ? ` title="Tool #${p.tool} is not in the library — re-add it or reassign this pocket."` : '';
                return `<tr style="${rowBg}"${ttl}><td style="${td} color:var(--text-dim);">P${p.pocket != null ? p.pocket : i + 1}</td><td style="${td} width:22px; text-align:center;">${icon}</td><td style="${td} font-weight:600; color:${orphan ? 'var(--danger,#ef4444)' : 'inherit'};">${has ? 'T' + p.tool : '—'}</td><td style="${td} color:${dCol};">${name}</td><td style="${td} color:var(--text-dim);">${len}</td></tr>`;
            }).join('');
            const table = magAll.length
                ? `<table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;"><thead><tr style="color:var(--text-dim); text-align:left; font-size:10px;"><th style="padding:0 7px 3px;">Pocket</th><th></th><th style="padding:0 7px 3px;">Tool</th><th style="padding:0 7px 3px;">Description</th><th style="padding:0 7px 3px;">Length</th></tr></thead><tbody>${rows}</tbody></table>`
                : '<div class="settings-hint" style="margin:6px 0 0;">No pockets yet — click Edit table to build the magazine.</div>';
            const orphanBanner = orphanCount
                ? `<div data-mag-orphan style="margin:6px 0 0; padding:6px 9px; border:1px solid var(--danger,#ef4444); border-left:3px solid var(--danger,#ef4444); border-radius:5px; background:rgba(239,68,68,0.10); color:var(--danger,#ef4444); font-size:11px; line-height:1.45;"><b>⚠ ${orphanCount} pocket${orphanCount === 1 ? '' : 's'} reference a tool that is no longer in the library.</b> Re-add the tool or reassign the pocket (Edit table).</div>`
                : '';
            host.innerHTML = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;"><button class="toolbar-btn settings-io" data-edit-mag>✎ Edit table…</button><span class="settings-hint" style="margin:0;">${magAll.length} pocket${magAll.length === 1 ? '' : 's'} · ${a.magType === 'disk' ? 'disk / carousel' : 'linear'}</span></div>${orphanBanner}${table}`;
            host.querySelector('[data-edit-mag]').addEventListener('click', () => openMagazineModal(() => this.update(mgr)));
        }
        const lens = (a.tools || []).filter((t) => t && t.length !== '' && t.length != null).map((t) => `T${t.num} ${t.length}`).join(' · ');
        setStatus('atcTableVizStatus', `Magazine: ${mag.length} pocket${mag.length === 1 ? '' : 's'}${lens ? ' · lengths ' + lens : ' · no tool lengths set'} — writes the table, no motion; review the strip below`);
    },
};
