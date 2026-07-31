/**
 * ui/opContextMenu.js — the shared right-click op menu (✎ Edit / ⧉ Duplicate / 🗑 Delete), reused by every
 * surface that can identify an op: the editor (line→op), the Blocks code panel (span ancestry→op), and the
 * Blockly op blocks. Acts via the window hooks (ddcsEditOp + opSession duplicate/delete) — params stay the truth.
 */
import { seedFromOp, isCamableType, isCamGeneratorTwin } from '../data/opCamMap.js';   // t1045 S1c — the per-op CAM action (door 1). U2 — seedFromOp is the FINAL verdict (generator | universal | unsupported), so the universal fallback greys/enables correctly. t1073 — isCamGeneratorTwin gates the Customize action to the 8 CAM-generator twins
import { getUserDef } from '../blocks/userOps.js';   // t1073 — the Customize action needs a registered def (else editWizardDef alerts "no longer in your library")

let menu = null;
function ensure() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'op-ctx-menu'; menu.hidden = true;
    document.body.appendChild(menu);
    document.addEventListener('mousedown', (e) => { if (menu && !menu.hidden && !menu.contains(e.target)) hideOpMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideOpMenu(); });
    window.addEventListener('ddcs:stop-previews', hideOpMenu);
    return menu;
}

export function hideOpMenu() { if (menu) menu.hidden = true; }

// Render the items into the shared menu element + clamp it into the viewport at (x, y).
function place(m, x, y) {
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.round(Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.round(Math.min(y, window.innerHeight - r.height - 6)) + 'px';
}
function item(m, label, fn, disabled) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'op-ctx-item'; b.textContent = label; b.disabled = !!disabled;
    b.addEventListener('click', () => { hideOpMenu(); fn(); });
    m.appendChild(b);
}

/**
 * ── t1452 — LONG-PRESS IS RIGHT-CLICK, DECLARED ONCE ─────────────────────────────────────────────────────────────
 *
 * The user tests on a phone, where there is no right button — so every context menu in the app would be unreachable
 * on the surface they actually use it on. That makes long-press not an enhancement but the OTHER HALF of the gesture,
 * and it is written down once rather than six times: six hand-rolled press timers is six chances to disagree about
 * how long a press is, how far a finger may drift, and whether a scroll counts.
 *
 * IT SYNTHESISES A REAL `contextmenu` EVENT rather than calling the handler, and that is the whole design: every
 * surface keeps ONE listener, written for the mouse, and neither knows nor cares which input opened it. A parallel
 * touch path per surface is how the two drift — a menu gains an entry on desktop and silently lacks it on the phone.
 *
 * THE THRESHOLDS ARE THE PLATFORM'S, not invented: 500ms is the long-press interval Android and iOS both use, and
 * 10px of slop is what distinguishes a press from the start of a SCROLL — without it, flicking a list would fire
 * menus. A second touch (pinch/zoom) cancels, for the same reason.
 */
export const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

export function attachLongPress(el, opts = {}) {
    if (!el || el.dataset.lpWired === '1') return;
    el.dataset.lpWired = '1';
    let timer = null, sx = 0, sy = 0, target = null;
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; target = null; };
    el.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length !== 1) return cancel();
        const t = e.touches[0];
        sx = t.clientX; sy = t.clientY; target = e.target;
        timer = setTimeout(() => {
            timer = null;
            // The synthesized event carries the touch point, so a handler that positions the menu at
            // (clientX, clientY) — all of them do — puts it under the finger with no extra code.
            (target || el).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy }));
            if (typeof opts.onFire === 'function') opts.onFire();
        }, opts.ms || LONG_PRESS_MS);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
        if (!timer || !e.touches || !e.touches[0]) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - sx) > LONG_PRESS_SLOP || Math.abs(t.clientY - sy) > LONG_PRESS_SLOP) cancel();   // it is a scroll
    }, { passive: true });
    for (const ev of ['touchend', 'touchcancel']) el.addEventListener(ev, cancel, { passive: true });
}

/**
 * t1450 — OPEN AN ARBITRARY MENU in this same element: `[{ label, fn, disabled }]` at (x, y).
 *
 * Exported because the editor's indent/outdent entries are NOT op actions — they act on a text selection that may
 * have nothing to do with an op — and a second floating-menu implementation would be a second thing to dismiss, a
 * second thing to clamp into the viewport, and a second thing to forget on `ddcs:stop-previews`. One element, one
 * dismissal contract; the caller only decides what goes in it.
 */
export function openMenu(items, x, y) {
    const m = ensure();
    m.innerHTML = '';
    for (const it of (items || [])) if (it) item(m, it.label, it.fn, it.disabled);
    if (!m.children.length) return false;
    // …and these entries do NOT steal focus. The op menu's actions open a wizard, so focus moving is fine there; a
    // TEXT action has to run against the selection that is live when it is picked, and a blur drops it (the same
    // reason the toolbar buttons preventDefault on mousedown — see editorIndent).
    for (const b of m.children) b.addEventListener('mousedown', (e) => e.preventDefault());
    place(m, x, y);
    return true;
}

/** Show the op menu for `op` ({ id, opType, label }) at viewport (x, y). */
export function showOpMenu(op, x, y) {
    if (!op || !op.id) return;
    const m = ensure();
    m.innerHTML = '';
    const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
    item(m, `✎ Edit ${op.label || op.opType || 'op'}`, () => window.ddcsEditOp && window.ddcsEditOp(op.id), !editable);
    item(m, '⧉ Duplicate', async () => { try { (await import('../blocks/opSession.js')).duplicateOp(op.id); } catch (_) { /* */ } });
    // the full placed record (params = the truth) for the CAM actions below — re-hydrated from the program by id
    const full = (window.ddcsGetBlockProgram && (window.ddcsGetBlockProgram() || []).find((b) => b && b.id === op.id)) || op;
    // t1045 S1c — the per-op CAM action (door 1): only for CAM-able op TYPES; greyed with the reason when this op's
    // variant has no generator (e.g. a single-axis middle). Opens the SAME authoring modal, pre-seeded from THIS op.
    if (isCamableType(op.opType)) {
        const seed = seedFromOp(full);   // the FINAL verdict: a generator/universal camType, or {unsupported} (no def / no bindings)
        item(m, seed.unsupported ? '▸ Build CAM slot — not CAM-able' : '▸ Build CAM slot', async () => {
            try { (await import('./macrosApp.js')).initMacrosApp(); } catch (_) { /* */ }   // idempotent — ensures the opener is registered
            if (window.ddcsOpenCamAuthoring) window.ddcsOpenCamAuthoring(full);
        }, !!seed.unsupported);
    }
    // t1073 S4-Part2 (A) — Customize as blocks: fork a CAM-generator twin (surfacing/pocket/corner/edge/slot/drill/bore/middle)
    // → editWizardDef wraps a recognized-at-default op's exec atoms in an opunit boundary (the standard sub-unit stays LIVE in
    // CAM) + opens it in Blocks to customize. Gate = isCamGeneratorTwin (params-independent, the SAME 8-twin set the wizard list
    // + CAM builder surface) AND a registered def (editWizardDef resolves via listUserOps; else it alerts). Real placed ops are twins.
    if (isCamGeneratorTwin(full.opType) && getUserDef(full.opType)) {
        item(m, '🧩 Customize as blocks', () => { if (window.ddcsEditWizardDef) window.ddcsEditWizardDef(full.opType); });
    }
    item(m, '🗑 Delete', async () => { try { (await import('../blocks/opSession.js')).deleteOp(op.id); } catch (_) { /* */ } });
    place(m, x, y);
}

/** Show the in-context "Group" menu for a contiguous LOOSE run (right-click a hand-built atom). `runIds` is the run
 *  of top-level loose block ids (from programModel.looseRunAtLine); "Group" wraps exactly that run in one `group` op
 *  → the editor hover ✎ chip then finds it. Declarative + explicit: the user PICKS the run, the app never auto-grabs. */
export function showGroupMenu(runIds, x, y) {
    if (!Array.isArray(runIds) || !runIds.length) return;
    const m = ensure();
    m.innerHTML = '';
    item(m, `▣ Group ${runIds.length} block${runIds.length === 1 ? '' : 's'}`, async () => {
        try { (await import('../blocks/opSession.js')).groupLooseAtoms('Hand-built', runIds); } catch (_) { /* */ }
    });
    place(m, x, y);
}
