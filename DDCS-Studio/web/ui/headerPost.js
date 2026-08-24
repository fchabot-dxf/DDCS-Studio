/**
 * ui/headerPost.js — the app header's TWO menus: #hdrPostBtn / #hdrPostMenu (the FILE menu — workspace
 * save/open/settings, load/export, the library, the wizard manager, setup docs) and #hdrAppBtn / #hdrAppMenu
 * (the APP menu — FAQ, About, the desktop download, Rate, the website). Plus a capability LINT
 * (#hdrPostWarn) on the loaded program against the workspace's OWN controller.
 *
 * t2149 (BACKLOG #9) — THE SPLIT, and the test that drew the line: does going through this door bring
 * something INTO your work, or come OUT of it? Save/Open/Load/Export/Library/Wizards/Setup-sheet/
 * Setup-checklist all do (FILE scope); FAQ/About/the desktop download/Rate/the version are about the
 * PRODUCT itself, never this file (APP scope). Before this turn both lived in ONE menu hanging off the
 * workspace filename chip — so "Settings…" under your filename read as THIS FILE's settings, a mismatch
 * t2147 made worse by design. The logo, previously a plain `<a href>` out to the marketing site (a real
 * mis-click hazard — the same one that forced t2147's whole layout argument), is now the APP menu's own
 * trigger; "open the website" is one row inside it. Both menus share ONE dismissal contract (`makePopover`
 * below) rather than being two hand-rolled popovers, and opening one closes the other.
 * t2184 (amendment 2) — SETTINGS MOVED BACK, from the APP menu into the FILE menu's Workspace section (last
 * row, after Save/Open/Wizards). Not a reversal of the t2149 test above, a DIFFERENT and more specific one:
 * backup.js's own save registry carries a 'settings' row (key ddcs_studio_settings) — Settings is SAVED INTO
 * the .ddcs, so it travels with the workspace exactly as Wizards does, even though opening it doesn't "bring
 * something in" the way Load does. The mechanical rule going forward: in backup.js's registry → workspace
 * (file-scoped); not in it → app/device (stays app-scoped, e.g. FAQ/About/Rate/the desktop download/website).
 * ⚠ THEME IS NOT A ROW HERE: t2147 already moved the theme picker to Settings (#set_theme, UI →
 * Appearance) and it already switches independently. A `Theme ▸` row would only point at Settings one click
 * deeper for no reason — BACKLOG item 1's own warning — so it is deliberately absent, not forgotten.
 *
 * t2137 — this used to ALSO be a post-processor (dialect) picker: pick a different controller than the
 * workspace's own to preview its G-code (e.g. grbl/LinuxCNC from a DDCS bench). That picker's rows were
 * already gone from the menu (an earlier diet pass), and the underlying override mechanism is now retired
 * outright (human ruling, 2026-08-22 — [[one-workspace-one-machine]]): the emitted code ALWAYS follows this
 * workspace's ONE machine. Want a different controller's output — that is a different machine, so a
 * different workspace.
 *
 * LINT (warn-don't-break): a loaded program may use capabilities THIS workspace's controller lacks — e.g.
 * grbl has no #variables/flow, so a probe/ATC macro built for it is non-runnable (probing on grbl is
 * host-side). Rather than silently hand over broken G-code, a ⚠ explains the mismatch. Cutting programs (no
 * #vars) are always fine.
 */
import { resolveActivePost, getCaps } from '../wizards/dialects/index.js';
import { getActiveProfile, CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { validate, summarize } from '../shared/js/validate/validate.js';
import { dlgNotice } from './dialog.js';   // in-app notice (t684 d — no bare alert)
import { getMachine, envelopeSummary } from '../data/workspaceMachine.js';   // t1217 — the identity line names THIS WORKSPACE'S MACHINE; t1231 — with its signed envelope
import { fileSavedStem, fileSavedAt, fileSavedPlace } from '../data/backup.js';   // t2145 — the workspace's name IS its last-saved .ddcs file's name; no separate field. BACKLOG #7 — when + where it was saved, for the new menu footer line.
import { EXE_DOWNLOAD_URL, getRoleInfo } from './gatewayStatus.js';   // the "standalone" desktop EXE release link (same as the Gateway page); t2145/t2151 — the client-side-derived, workspace-relative PC role
import { openExternal } from './openExternal.js';   // t2066 — open external links once, host-side in the exe
import { openSetupSheet } from './setupSheet.js';   // t850 — the print-ready job page (reads every value from its declared source)
// t2190 — libraryModal.js's openLibrary() (Open) and projects/projectModal.js's openSaveModal() (Save) are BOTH
// retired: the wizard-manager idiom replaces them with ONE door, projects/projectManager.js's openProjectManager()
// — Save and Open are one surface now, exactly like Wizards. See that file's own header for the ruling.
import { openProjectManager } from './projects/projectManager.js';

// Quick-menu glyphs (24×24 stroke grid) — mirror the dock toolbar icons so the menu reads consistently.
const HQ_ICONS = {
    // t2186 (brand/icons.json — the human's own ruling, "decided by circling a rendered comparison") — open and
    // cloud are the only two true single-shape CONTAINERS in the set, so they alone get a solid fill (a CHOSEN
    // colour, not an opacity — an opacity composites with whatever's behind the menu, so the same icon would
    // read as a different colour on every surface). Every other icon stays pure outline, byte-identical.
    open:   { c: '#f59e0b', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#d99a2b"/>' },
    save:   { c: '#0ea5e9', d: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' },
    insert: { c: '#14b8a6', d: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>' },
    copy:   { c: '#6366f1', d: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
    clear:  { c: '#ef4444', d: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>' },
    standalone: { c: '#22c55e', d: '<rect x="3" y="3" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><polyline points="9 13 12 16 15 13"/><line x1="12" y1="11" x2="12" y2="16"/>' },
    settings: { c: '#94a3b8', d: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    checklist: { c: '#3ddc84', d: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    setupSheet: { c: '#c084fc', d: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>' },
    wizard: { c: '#a855f7', d: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>' },
    // t2184 (amendment 4's own rule, extended to the APP menu on direct human instruction: "yes, unify it too") —
    // three genuinely NEW icons (the file menu's rows all reused an existing entry; these didn't exist yet).
    // Same 24×24 stroke-grid convention, drawn in the spirit of each: a question mark for "ask something" (FAQ),
    // an info glyph for "read about this" (About), a star for "rate this" (the literal glyph the row's own old
    // emoji already used, traced as line art instead of a platform emoji).
    help: { c: '#38bdf8', d: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
    about: { c: '#94a3b8', d: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/>' },
    rate: { c: '#f0b429', d: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    // BACKLOG #7 — the "Saved …" footer line's WHERE, an icon not a word (fileSavedPlace() is a strict binary).
    // ⛔ NOT in ui/wizIcons.js — that registry holds OPERATION icons only; a save-location mark is UI CHROME, so
    // it belongs beside this menu's other chrome glyphs, same table, same convention.
    local: { c: '#0ea5e9', d: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' },
    cloud: { c: '#0ea5e9', d: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#2f8fc4"/>' },
    // t2149 (BACKLOG #9) — the APP menu's "Open the website" row: the external-link glyph the retired brand
    // <a href> used to imply just by being a link, now carried explicitly since the logo itself no longer is one.
    website: { c: '#0ea5e9', d: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' },
};
// t2149 — the marketing site the logo used to link to directly; now the APP menu's own "Open the website" row.
const WEBSITE_URL = 'https://ddcs-studio.pages.dev';
// data-act → the existing handler it proxies (file ops are window globals; Open/Save click their header buttons).
// t1257 — HQ_ACTIONS / HQ_STANDALONE DELETED (authorized). They were the quick menu's gcode-row list until the t1227
// curation moved those actions to the editor's own corner menu; nothing has read either since, and one of their
// comments still called Clear "the phone access point", which stopped being true in t1227 and again in t1255.

function runQuickAction(act) {
    switch (act) {
        // t2184 (amendment 1) — 'open'/'save' REMOVED: they proxied clicks to #projOpenBtn/#projSaveBtn, both
        // deleted this turn (nothing anywhere ever called runQuickAction with either act — dead since whatever
        // turn stopped wiring a row to them; the menu's own 'library'/'projSave' cases below are the live doors).
        case 'wizard': window.ddcsSaveAsWizard ? window.ddcsSaveAsWizard() : dlgNotice('Open an operation in the Blocks tab first, then save it as a wizard.'); break;
        // t2078 — Load / Export are BACK (see the fileRows comment for the human's reasoning: they act
        // on the program as a whole, not on the text under the caret). ONE implementation — these call the same
        // window globals ui/globalFunctions.js EDITOR_FILE_ACTIONS called, never a second copy of the logic.
        // ⛔ CLEAR is deliberately NOT routed here (t1255): the 🗑 in the editor toolbar is the one clear.
        // t2173 (tail, human: "insert is redundant beside load remove it completely") — Insert is GONE, not
        // hidden: the row, this case, and its own handler (window.insertGcodeFile, commandDeck.js) are all
        // deleted. The pre-existing, already-unreachable corner-menu leftover (globalFunctions.js
        // EDITOR_FILE_ACTIONS' own 'insert' entry — dead since t2078 retired the button that opened it) still
        // references the now-gone global via `?.()`, so it stays a safe no-op; left untouched as pre-existing
        // dead code, not this turn's to clean up.
        case 'getDesktop': {
            // opened through the SAME door the update banner uses: in the exe the gateway opens the real
            // system browser server-side, which fires exactly once — window.open double-fired inside the
            // embedded webview (t2066).
            import('./updateCheck.js').then((m) => (m.openExternal || window.open)(EXE_DOWNLOAD_URL, '_blank'))
                .catch(() => window.open(EXE_DOWNLOAD_URL, '_blank', 'noopener'));
            break;
        }
        case 'fileLoad':   window.loadGcodeFile ? window.loadGcodeFile() : dlgNotice('Loading is unavailable.'); break;
        case 'fileExport': window.downloadFile ? window.downloadFile() : dlgNotice('Export is unavailable.'); break;
        case 'standalone':
            // The "standalone" IS the desktop EXE (bundles the gateway, runs fully offline) — open the SAME
            // release link the Gateway page uses (gatewayStatus.EXE_DOWNLOAD_URL → the latest GitHub release).
            // t2066 — via openExternal so a desktop-app viewer's embedded webview doesn't double-download the .exe.
            openExternal(EXE_DOWNLOAD_URL);
            break;
        case 'settings': window.openSettings?.(); break;
        case 'checklist': window.openSetupChecklist?.(); break;
        case 'setupSheet': openSetupSheet(); break;   // t850 — the print-ready job page
        case 'library': openProjectManager(); break;   // t2190 — the project manager (was t854's Library)
        case 'rate': window.ddcsOpenRate?.(); break;   // t598 — the always-available Rate / Feedback path (opens the repo)
        // t2149 (human amendment: "i meant seperate them in 2 panel") — FAQ and About are TWO rows opening TWO
        // panels now, not one Help row opening one two-section panel. See helpPanel.js's own header for why.
        case 'helpFaq':   import('./helpPanel.js').then((m) => m.openHelp('faq')); break;
        case 'helpAbout': import('./helpPanel.js').then((m) => m.openHelp('about')); break;
        case 'openWebsite': openExternal(WEBSITE_URL); break;   // t2149 — the logo's old <a href>, now a menu row
        // t1223 — WORKSPACE (the .ddcs). Open still opens the ONE manager modal, focused on the granted folder's
        // cards — browsing genuinely needs a picker, there is no "silent open".
        // t2196 (amendment 2, bug 2) — Save no longer does: this row's own label ("Save", no ellipsis, unlike
        // every OTHER row here that needs more input from you — "Open…", "Save as…") and its tooltip ("Save
        // this workspace to its .ddcs file") both already promised a direct write, but the handler opened the
        // manager instead — the SAME regression class the file-menu's Ctrl+S-equivalent contract exists to rule
        // out. ui/workspaceSave.js's saveWorkspace() (window.ddcsSaveWorkspace, wired to Ctrl+S at that file's
        // own onKeydown) already IS the "write silently to the remembered FSA handle, ask only when there is
        // nothing to write to yet" door — the handle persists across a reload via IndexedDB (data/fsHandles.js),
        // so this is not the browser-permission dead end it might look like; requestHandle() re-verifies inside
        // this very click's own user gesture. window.ddcsFileSaveState.save (ui/fileSaveState.js) is the thin
        // wrapper that also refreshes the dot and announces the result — the same one Ctrl+S's own success path
        // feeds into (window.ddcsAnnounceSaved).
        case 'wsSave': window.ddcsFileSaveState?.save?.(); break;
        case 'wsOpen': window.openWorkspaceManager?.('open'); break;
        // t1617 — the WIZARD manager, the workspace manager's sibling: wizard lifecycle (fork / rename / duplicate /
        // delete + the .wiz library shelves). Distinct from 'wizard' above, which SAVES the current stack as one.
        case 'wizards': window.openWizardManager?.(); break;
        // t2184 — the Project section's own Save row. Until now the menu could save the OUTPUT (G-code) but not
        // the WORK (the op stack + stock + post, as one job) — this is the door that was missing.
        // t2190 — opens the SAME manager as Open, with the save prompt fired immediately (promptSave) — Save and
        // Open are one surface now, not two separate modals.
        case 'projSave': openProjectManager({ promptSave: true }); break;
    }
}

// t1243 — openCloudModal is DELETED with the ☁ badge that opened it. The shared renderCloudLogin it hosted is
// still the ONE connect UI (Settings + the projects drawer use it); the workspace manager's Cloud tab is the
// wizard-side door now, carrying sign-in, the signed-in account and sign-out.

// t2149 (BACKLOG #9) — TWO MENUS, ONE DISMISSAL CONTRACT. Rather than two hand-rolled show/hide pairs (which is
// exactly the "second floating-menu implementation" the repo's op-context menu comment warns against), one small
// factory wires a button+popover pair with the shared behaviour every quick-menu needs: opening one closes any
// other tracked popover, outside-click and Escape close whichever is open, and each remembers its own `fill`.
const openPopovers = new Set();
let docDismissWired = false;
function wireDocDismiss() {
    if (docDismissWired) return;
    docDismissWired = true;
    document.addEventListener('click', (e) => {
        for (const p of [...openPopovers]) if (!p.menu.contains(e.target) && !p.btn.contains(e.target)) p.close();
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        for (const p of [...openPopovers]) { p.close(); p.btn.focus(); }
    }, true);
}
function makePopover(btnId, menuId, fill) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return null;
    const api = { btn, menu };
    api.close = () => {
        if (menu.hidden) return;
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        openPopovers.delete(api);
    };
    api.open = () => {
        for (const other of [...openPopovers]) if (other !== api) other.close();   // opening one closes the other
        fill(btn, menu);
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        openPopovers.add(api);
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden ? api.open() : api.close(); });
    wireDocDismiss();
    return api;
}
// Route a menu click shared by BOTH popovers: an identity-line sub-target (☁ / ↧), a workspace button, or a
// plain row. The app menu has no pull-btn/ws-btn rows, so those two branches simply never match there — one
// listener, not two near-identical copies.
function wireMenuClicks(pop) {
    pop.menu.addEventListener('click', (e) => {
        const exactPull = e.target.closest('.hq-pull-btn[data-profact]');
        if (exactPull) {
            pop.close();
            if (window.openSettings) window.openSettings({ group: 'controller', panel: 'set_tab_profile' });
            setTimeout(() => { const b = document.getElementById('set_profile_pull'); if (b) b.click(); }, 60);
            return;
        }
        const rowBtn = e.target.closest('.hq-ws-btn');
        if (rowBtn && rowBtn.dataset.act) { pop.close(); runQuickAction(rowBtn.dataset.act); return; }
        const it = e.target.closest('.hdr-quick-item');
        if (!it) return;
        pop.close();
        if (it.dataset.act) runQuickAction(it.dataset.act);
    });
}

export function initHeaderPost() {
    const warnEl = document.getElementById('hdrPostWarn');

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const svgIco = (k) => `<svg class="hq-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${HQ_ICONS[k].c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HQ_ICONS[k].d}</svg>`;

    // ── FILE MENU (#hdrPostBtn/#hdrPostMenu) — everything that acts on THIS workspace/program. ─────────────
    // Layout: FOUR labelled sections (t2184, scratchpad/t-filemenu-sections.md), each a two-column GRID of the
    // SAME declared tile button (amendment 16 — one shared style, every width, no odd-item special case) —
    // Workspace (identity + saved lines, then Save/Open/Wizards…/Settings… as a 2x2) · G-code (Save
    // as…/Open… — save-first, amendment 17) · Project (Save…/Open…) · Reference (Setup sheet…/Setup checklist).
    // MOVED NOT LOST, across several turns:
    // standalone/checklist-toggle → Settings (t2149 to the APP menu, t2184 amendment 2 back here — see this
    // file's own header comment for the two different tests each move used); t1227 Load/Insert/Export/Clear →
    // the editor's corner menu, then t2078 brought Load/Insert/Export back HERE (Clear alone stayed in the
    // editor toolbar, t1255); BACKLOG #1 (t2147) — Theme → Settings' own #set_theme picker; BACKLOG #9 (t2149) —
    // FAQ/About/desktop-download/Rate/version → the new APP menu, because none of them act on this file.
    // t2173 (tail) — Insert REMOVED entirely (human: too close a duplicate of Load to earn its own row); the two
    // history lines above are left as they were AT THE TIME, not rewritten to erase what actually happened.

    const fillFileMenu = (btn, menu) => {
        // ── IDENTITY LINE (t1227 amendment, user) ─────────────────────────────────────────────────────
        // It was a big compound BUTTON whose tap opened the machine's settings — a door built for the retired profile
        // world. It is now one QUIET PLAIN-TEXT line, "<workspace> · <dialect>", sitting directly above Save / Open so
        // a save has its context: no click handler, no button styling, nothing to press by accident.
        // The ↧ span stays: it is its OWN tap target for a live feature (pull from the controller) — never the row's
        // retired click. (t1243 — the ☁ badge that sat beside it moved to the workspace manager's Cloud tab.)
        const ap = getMachine();
        // t2145 (BACKLOG F2, human ruling 2026-08-22: "we dont need a name just display the file name") — THERE IS
        // NO SEPARATE WORKSPACE-NAME FIELD ANY MORE. The name IS the last-saved `.ddcs` file's name (fileSavedName,
        // data/backup.js) — never synced, never a second home for the same fact. A workspace that has never been
        // saved to a file has no name to show: "Not saved" is the honest label, not a fake title (makes the
        // localStorage-is-a-buffer principle visible instead of implied).
        const apName = fileSavedStem() || 'Not saved';
        const apCtrl = (CONTROLLER_PROFILES[ap.controllerId] || {}).name || ap.controllerId || '';
        // t1231 (user) — the line also carries the ENVELOPE, signed, from the SAME formatter the manager rows and the
        // Settings band use. Three surfaces, one source: they cannot describe the same machine differently.
        const apEnv = envelopeSummary((window.ddcsGetSettings && window.ddcsGetSettings().machine) || {});
        // t1267 — a LATHE workspace says so on the identity line. Only when it is a lathe: 'mill' is the default and
        // labelling every mill workspace "mill" would be noise on the line that identifies the machine.
        const apKind = ap.kind === 'lathe' ? ' · Lathe' : '';
        // t1243 (user) — THE ☁ BADGE IS GONE. Cloud access lives in ONE place: the workspace manager's Local | Cloud
        // tabs, which carry the sign-in, the signed-in account and the sign-out. A second door in the header meant two
        // places to learn for one connection. The ↧ PULL span stays — that is a controller read, not a cloud thing.
        // t2145 (ROLES-PLAN S0/S1, human 2026-08-22) — the PC role, right here: "Workspace: <name> · <dialect> ·
        // <role> · <envelope>". This is the one surface it was always supposed to reach — see gatewayStatus.js's
        // getEffectiveRole() for how it derives client-side with no daemon required. Deliberately DERIVED, not
        // cached: a gateway whose daemon is down shows 'client' too (human ruling — it describes what this PC
        // can actually DO right now) and self-corrects the moment the daemon answers again, no restart needed.
        // t2151 (BACKLOG #11 care #3) — the role is now WORKSPACE-RELATIVE too (see gatewayStatus.js's
        // getRoleInfo()), so it can flip mid-session on a workspace switch. "Say WHY, never just the bare
        // word" — the reason (when the demotion is the workspace-mismatch kind, not a plain no-daemon client)
        // rides as this span's title, a hover away rather than crowding the line itself.
        const roleInfo = getRoleInfo();
        const roleText = roleInfo.role;
        const roleTitle = roleInfo.reason ? ` title="${esc(roleInfo.reason)}"` : '';
        // t2184 (amendment 13, human: "identity can be inside the workspace border") — the "Workspace: " label
        // (t1249) is DROPPED: the line now lives inside the WORKSPACE section (see the assembly below), so the
        // section header already states the subject once — the line reads as the box's content (name, dialect,
        // role, travel), not a fourth fact needing its own label.
        const identityRow =
            `<div class="hq-identity-line hq-identity">`
            + `<span class="hq-identity-txt"><b>${esc(apName)}</b>`
            + `<span class="hq-cur"> · ${esc(apCtrl)}</span>`
            + `<span class="hq-cur">${esc(apKind)}</span>`
            + `<span class="hq-cur"${roleTitle}> · ${esc(roleText)}</span>`
            + (apEnv ? `<span class="hq-cur hq-env"> · ${esc(apEnv)}</span>` : '')
            + `</span>`
            + `<span class="hq-pull-btn" data-profact="pull" role="button" tabindex="0" title="Pull from controller">↧</span>`
            + `</div>`;

        // BACKLOG #7 (t2147) — "Saved 14:22 [icon]": WHEN + WHERE, both already declared in data/backup.js, only
        // surfaced here. ⛔ Cut by the human, do not reinstate: a separate "Not saved to a file" line (a saved/
        // dirty state does not need its own line — the disk chip's colour is the one indicator, t1223's ruling,
        // reaffirmed at t2147 amendment 3 which dropped the workspace chip's own dot for the same reason) and a
        // filename row (it's the identity line's name plus ".ddcs", pure redundancy) — so this row renders
        // NOTHING at all when never saved, not a fallback line.
        const at = fileSavedAt();
        let savedRow = '';
        if (at != null) {
            const d = new Date(at), now = new Date();
            const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
            const yest = new Date(now); yest.setDate(now.getDate() - 1);
            const hhmm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            // t2147 — THE HONESTY RULE: a save from days ago must not read as "just now" right before an overwrite.
            const when = sameDay(d, now) ? hhmm
                : sameDay(d, yest) ? `yesterday ${hhmm}`
                : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${hhmm}`;
            const place = fileSavedPlace();   // 'local' | 'cloud' — a strict binary, so an ICON, not ~9 chars of words
            const placeTitle = place === 'cloud' ? 'Saved to your cloud — travels to another PC' : 'Saved to this PC only';
            savedRow = `<div class="hq-saved-line" title="${esc(placeTitle)}">`
                + `<span class="hq-cur">Saved ${esc(when)}</span>`
                + svgIco(place === 'cloud' ? 'cloud' : 'local')
                + `</div>`;
        }

        // t1227 CURATION (user ruling), REVERSED BY t2078 — see the fileRows comment below for the current story.
        // Load / Export are back in THIS menu (Insert removed entirely, t2173); the editor's own corner file
        // button/menu is gone entirely. Clear alone stayed out (t1255) — it lives in the editor's own toolbar row.

        // t2184 (amendment 3A, human: "icons arent unified, keep the more fancy ones"; amendment 4 closed the
        // escape hatch — "if they dont have svg they need one", enforcing commandDeck.js's own documented icon
        // convention rather than a taste) — EVERY row renders the declared SVG icon (svgIco/HQ_ICONS); no emoji
        // baked into a label string anywhere in this menu. `wsBtn` is the one place a row is built. In practice
        // every action already had a matching HQ_ICONS entry — nothing new needed drawing.
        // t2184 (amendments 3B → 16, human: "also use the workspace layout with 2 colums" → "make it a grid in
        // wide too... and all buttons can share their style") — amendment 16 SUPERSEDES 3's pairs-plus-an-
        // odd-item-spanning-full-width rule entirely: ONE shared tile button, in a GRID, at every width — no
        // more a full-width `.hdr-quick-item` for Wizards/Settings while their neighbours are boxed pairs. This
        // is a SIMPLIFICATION, not an addition: it deletes both the odd-item rule from amendment 3 and the
        // mobile-only split amendment 15 first proposed — both were solving a problem that stops existing once
        // every row is one tile in one grid. The counts fall out clean: Workspace is now four (2x2), G-code /
        // Project / Reference are two each (one row).
        const wsBtn = (act, icon, label, title) =>
            `<button type="button" class="hq-ws-btn" data-act="${act}"${title ? ` title="${esc(title)}"` : ''}>`
            + svgIco(icon) + label + `</button>`;
        const grid = (...btns) => `<div class="hq-ws-row">${btns.filter(Boolean).join('')}</div>`;

        // t2184 (amendment 17, human, arrow between Load and Save as: "switch") — THE SAVE ACTION IS ALWAYS
        // FIRST IN ITS SECTION. Workspace: Save then Open. G-code: Save as then Open (was Load then Save as —
        // swapped). Project: Save then Open. A future row added to any section has an obvious position: is it
        // the save action? First. Everything else follows.
        // t2184 (amendments 18/19/20, human: "the labels are different for the same action... save vs save as
        // is legitimate... open vs load is not") — THE MENU'S FIVE LABEL RULES, all from the human, all reached
        // by looking at a picture rather than arguing prose:
        //   1. the section carries the noun, the item carries the verb (rule 1, scratchpad/t-filemenu-sections.md)
        //   2. the save action is always first in its section (this comment, above)
        //   3. a trailing ellipsis means the action will ask you something first — a dialog, a picker, a modal;
        //      no ellipsis means it just happens
        //   4. Save vs Save as is the one legitimate exception to rule 3: Save writes straight to the known
        //      target (falling back to a picker only in the not-yet-saved state, which is what "Save" already
        //      means in every app anyone has used — not a state worth disclosing in the label), Save as always
        //      asks. Neither gets "harmonised" to match the other.
        //   5. OPEN is the only word for picking a file — G-code's "Load…" is now "Open…", matching Workspace
        //      and Project. (Load carried a real warning Open doesn't — loading replaces the editor's contents
        //      and Insert is gone (t2173), so this is the only door and it IS destructive. That warning still
        //      lives in the title attribute below; amendment 20 also asked whether a stale confirm-before-
        //      replace fires on an empty canvas — investigated and reported in WORK-LOG, not fixed this turn:
        //      the root cause traces into boot/watermark timing in data/backup.js, real surgery that deserves
        //      its own turn rather than a rushed patch onto this one.)
        const workspaceGrid = grid(
            wsBtn('wsSave', 'save', 'Save', 'Save this workspace to its .ddcs file'),
            wsBtn('wsOpen', 'open', 'Open…', 'Open a workspace from your workspaces folder'),
            // t1617 — the WIZARD MANAGER's entry, the workspace manager's sibling: the wizards embedded in THIS
            // workspace + the .wiz library shelves. Lifecycle, not bar arrangement (that stays in Settings).
            wsBtn('wizards', 'wizard', 'Wizards…', ''),
            // t2184 (amendment 2) — SETTINGS, moved here from the APP menu (see this file's own header comment
            // for why: it's SAVED INTO the .ddcs, so it's workspace content, not product chrome).
            wsBtn('settings', 'settings', 'Settings…', '')
        );

        // ── UTILITY ROWS (FILE-scoped) ────────────────────────────────────────────────────────────────
        // t854/t2149/t2190 — Projects: both rows open the ONE project manager (projects/projectManager.js), on the
        // half the user asked for — Save fires the save prompt immediately, Open lands on the workspace's own list.
        // t2184 — Project Save is NEW (scratchpad/t-filemenu-sections.md rule 4): it exists because a project IS
        // the program, saved — same op stack, same stock, same post, one live in the editor and one on disk.
        // t2186 (brand/icons.json's shared_glyphs — "one glyph per ACT, not per row") — Open here uses the SAME
        // 'open' icon key as Workspace Open and G-code Open; the label is the differentiator, not the glyph.
        // The old dedicated 'library' HQ_ICONS entry retired with this — no other caller was left reading it.
        // t2190 (amendment 1) — "Save…" → "Save as…": the verb now encodes the SAME "does this interrupt me"
        // fact the ellipsis already carried, promoted into the word — Workspace says plain Save because it
        // writes a known file and never asks; G-code and Project both always ask, so both say Save as… now.
        const projectGrid = grid(
            wsBtn('projSave', 'save', 'Save as…', 'Save the current program into this workspace, as a project (.mjson) — name it and pick a folder inside this workspace'),
            wsBtn('library', 'open', 'Open…', 'Your saved projects, embedded in this workspace — not raw G-code files, see Save as/Open above')
        );

        const healthOn = (window.ddcsHealthSignalsOn ? window.ddcsHealthSignalsOn() : true);
        // t2184 — Reference grid (Setup sheet + Setup checklist); grid()'s own Boolean filter drops Setup
        // checklist cleanly when health signals are off, no separate branch needed.
        const referenceGrid = grid(
            wsBtn('setupSheet', 'setupSheet', 'Setup sheet…', ''),   // t850 — print-ready job page.
            healthOn ? wsBtn('checklist', 'checklist', 'Setup checklist', '') : ''
        );

        // t2078 (human: "the load insert export button can go in the quick menu") — THE PROGRAM FILE ROWS RETURN.
        // ⚠ THIS REVERSES t1227, which moved them OUT of here because this menu is for APP things, "not what to
        // do with the program in front of you". The human's own refinement of that rule, which is why it is a
        // correction and not a flip-flop: Load / Export act on the program AS A WHOLE — they are what you
        // reach for with an EMPTY editor (start one) or a FINISHED one (ship it), never mid-edit. t1227's test was
        // right; these fall on the app side of it, unlike Comment/Undo which act on the text
        // under the caret and stay in the pane. The editor's own ▾ file button is gone with this, so these are
        // once again the ONE door to Load/Export, not a second one. Handlers are the SAME globals the editor menu called (loadGcodeFile /
        // downloadFile), so there is one implementation, not a copy.
        // ⛔ CLEAR IS STILL NOT HERE (t1255): the 🗑 is the one clear, now in the editor's toolbar row. Two doors
        // to a destructive action is one too many.
        // t2173 (tail, human: "insert is redundant beside load remove it completely") — Insert ITSELF is gone
        // too, not just muted: it duplicated Load closely enough (both "bring a G-code file in," differing only
        // by replace-vs-splice-at-caret) that the human judged the second row wasn't earning its place. See the
        // `case 'fileInsert'` removal above for the handler side.
        // t2149/t2173/t2178 (superseded by t2184 amendment 20 below) — this row's label went through "Load…" →
        // "Load G-code…" → back to "Load…", each pass disambiguating it from Workspace's Open and the Library's
        // Open. Left as history, not rewritten: at each of those points the label WAS the most literal choice
        // available; amendment 20 is what finally named the actual shared concept (picking a file) "Open"
        // everywhere, superseding the disambiguation-by-different-words approach entirely.
        // t2184 (amendment 17, "switch") — Save as now comes FIRST (the save action always leads); amendment 20
        // ("open vs load is not [legitimate]") — "Load…" → "Open…", matching Workspace/Project. The title still
        // carries Load's own warning (replaces the editor's contents — the only door, since Insert is gone).
        // t2186 (brand/icons.json's shared_glyphs — "Save and Save as share one glyph, the LABEL is the
        // differentiator") — Save as… uses the SAME 'save' icon key as Workspace Save and Project Save; the old
        // dedicated 'export' HQ_ICONS entry retired with this, no other caller was left reading it.
        const gcodeGrid = grid(
            wsBtn('fileExport', 'save', 'Save as…', 'Save the program as a .nc file — the native save dialog opens so you pick the destination yourself, every time'),
            wsBtn('fileLoad', 'open', 'Open…', 'Open a G-code file into the editor (replaces the program) — not a workspace or a project')
        );

        // ── ASSEMBLE — t2184 (scratchpad/t-filemenu-sections.md, the human's own pasted mockup is the spec) ────
        // FOUR labelled, bordered sections: Workspace (identity + saved-line, then a 2x2 grid — Save, Open,
        // Wizards…, Settings…), G-code (Save as…/Open… grid), Project (Save…/Open… grid), Reference (Setup
        // sheet…/Setup checklist grid). See the label-rules comment above workspaceGrid for the five rules that
        // govern every row's wording.
        // t2184 (amendment 13, human: "identity can be inside the workspace border") — the identity line lives
        // inside the Workspace box as its first row (above the grid), resolving the "does the box header
        // restate the identity line" worry a floating identity line raised: inside the box, the header labels
        // the box and the identity is its content, not a competing statement of the same fact six pixels away.
        // The saved-line (BACKLOG #7 — when/where last saved) moves with it, same reasoning.
        const section = (title, rows) =>
            `<div class="hdr-menu-section"><div class="hdr-menu-section-title">${esc(title)}</div>${rows}</div>`;
        menu.innerHTML =
            section('Workspace', identityRow + savedRow + workspaceGrid)
            + section('G-code', gcodeGrid)
            + section('Project', projectGrid)
            + section('Reference', referenceGrid);

        btn.title = `File menu — ${apName} · ${apCtrl}`;
        btn.setAttribute('aria-label', `File menu (${apName} · ${apCtrl})`);
    };

    // ── APP MENU (#hdrAppBtn/#hdrAppMenu) — the product itself, never this file. Small and rarely opened,
    //    which BACKLOG #9 calls out as correct, not lopsided: most of what a user does lives in the file menu. ──
    // t2184 (amendment 2) — Settings MOVED OUT, to the FILE menu's Workspace section (see fillFileMenu above and
    // this file's own header comment for why: it's saved into the .ddcs, so it's workspace content).
    const fillAppMenu = (btn, menu) => {
        // t1245 (user) — HELP leaves Settings and lands here. FAQ and About are not settings: nothing on either
        // changes how the app behaves, so a gear was the wrong door for them.
        // t2149 (human amendment: "i meant seperate them in 2 panel") — TWO rows, TWO panels, not one Help row
        // opening one two-section panel: FAQ (searched when stuck) and About (identity — version, credits) are
        // different things at very different visit frequencies. See helpPanel.js's own header for the full reasoning.
        // t2184 (amendment 4's own convention, extended here on direct human instruction — asked via
        // AskUserQuestion with a screenshot of both menus side by side: "yes, unify it too") — SVG icons, no
        // emoji, matching the file menu's own finished convention.
        const faqRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="helpFaq">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('help')
            + '<span class="hdr-quick-lbl">FAQ</span></button>';
        const aboutRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="helpAbout">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('about')
            + '<span class="hdr-quick-lbl">About</span></button>';
        // t598 — always-available Rate / Feedback. t1245 — and now the ONE feedback door: Settings' Report-a-bug
        // button was a bare mailto pointing at the same maintainer this toast already reaches (with stars and a
        // comment), so it retired rather than being carried along beside it.
        // t2113 (human: "maybe the exe download can go back in the quick menu") — THE DESKTOP DOWNLOAD. It is
        // about the application itself, not the program in front of you — exactly what this menu is for now.
        // ⚠ THE UNCONDITIONAL RULING SURVIVES THE MOVE: the human ruled this is never gated on whether a
        //    gateway answers ("its not because i have the app open that i dont want to download it again"), and
        //    it is not gated here either.
        // t2184 — reuses the 'standalone' icon (already means "the desktop EXE" everywhere else it appears,
        // e.g. the Gateway page) rather than drawing a second desktop-download glyph.
        const downloadRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="getDesktop">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('standalone')
            + '<span class="hdr-quick-lbl">Get DDCS Studio for desktop</span></button>';
        const rateRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="rate">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('rate')
            + '<span class="hdr-quick-lbl">Rate / Feedback</span></button>';
        // t2149 (BACKLOG #9) — "open the website" is the retired brand <a href>'s one function, carried over as
        // a row now that the logo itself opens this menu instead of navigating away.
        const websiteRow =
            `<button type="button" role="menuitem" class="hdr-quick-item" data-act="openWebsite" title="${esc(WEBSITE_URL)}">`
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('website')
            + '<span class="hdr-quick-lbl">Open the website</span></button>';

        // BACKLOG #7 (t2147) — the version. The literal `<span class="ver">` element stays in index.html
        // (bump-version.cjs/check-version-sync.cjs both find it by a raw-text regex on the HTML file, not a DOM
        // query — moving it in the page changes nothing for either script); this reads its live text each open.
        // ⚠ SELECTABLE, on purpose — plain text, not a button, and `.hdr-quick-menu`'s inherited `user-select:none`
        // (from `.app-header`) is overridden for this one row: the human reads this string to confirm a release
        // landed, so a footer that cannot be copied is a regression for that use.
        const verText = (document.querySelector('.ver') || {}).textContent || '';
        const versionFooter = verText ? `<div class="hq-ver-footer" title="App version">${esc(verText)}</div>` : '';

        menu.innerHTML =
            faqRow + aboutRow + downloadRow + rateRow + websiteRow
            + (verText ? '<div class="hdr-quick-sep"></div>' : '')
            + versionFooter;
    };

    // Warn (don't break) when the loaded program uses capabilities the active post lacks.
    const lint = () => {
        if (!warnEl) return;
        const post = resolveActivePost(getActiveProfile().id);   // t2137 — the workspace's own controller, always (no override any more)
        const caps = getCaps(post.id);
        const ed = document.getElementById('editor');
        const text = ed ? ed.value : '';
        const hasVars = /#\d/.test(text);
        const hasProbe = /\b(?:G38\.2|G31|M101)\b/.test(text);
        let msg = '';
        if (!caps.vars && hasVars) {
            msg = `${post.name} can't run this program — it uses #variables (a probe/ATC macro). Probing on this `
                + `controller is host-side (stream G38.2 → read [PRB:] → G10 L20); the emitted macro won't execute as-is.`;
        } else if (caps.flowStreamable === false && (hasProbe || hasVars)) {
            msg = `${post.name}: load this macro from SD/littlefs — its O-word flow doesn't run while streaming over serial.`;
        }
        let linterMsg = '';
        if (post.id.includes('ddcs')) {
            const res = validate(text);
            if (!res.ok || res.warnings > 0) {
                linterMsg = summarize(res) + ' - ' + res.findings.map(f => `Line ${f.line}: ${f.msg}`).join(' | ');
            }
        }

        const combinedMsg = [msg, linterMsg].filter(Boolean).join('\n\n');
        warnEl.hidden = !combinedMsg;
        warnEl.title = combinedMsg;

        const statusBar = document.getElementById('editor-statusbar');
        const statusText = document.getElementById('editor-status-text');
        if (statusBar && statusText) {
            statusBar.classList.toggle('hidden', !linterMsg);
            statusText.textContent = linterMsg;
        }
    };

    const copyBtn = document.getElementById('editor-status-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const statusText = document.getElementById('editor-status-text');
            if (!statusText || !statusText.textContent) return;
            const text = statusText.textContent;
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
            }
            
            copyBtn.style.color = '#00ff00';
            setTimeout(() => copyBtn.style.color = '', 500);
        });
    }

    // Floating Copy-program button in the editor (moved out of the quick-menu) → copy the whole program + flash.
    const progCopyBtn = document.getElementById('editor-copy-btn');
    if (progCopyBtn) {
        progCopyBtn.addEventListener('click', () => {
            window.copyCode?.();
            progCopyBtn.classList.add('copied');
            setTimeout(() => progCopyBtn.classList.remove('copied'), 600);
        });
    }

    // t2149 — TWO POPOVERS, ONE FACTORY (see makePopover above): each remembers its own fill function, and
    // opening either closes the other. The file popover pre-existed under #hdrPostBtn/#hdrPostMenu — those IDs
    // are UNCHANGED, so every prior wire (every spec that clicks #hdrPostBtn) keeps working untouched.
    const filePop = makePopover('hdrPostBtn', 'hdrPostMenu', fillFileMenu);
    const appPop = makePopover('hdrAppBtn', 'hdrAppMenu', fillAppMenu);
    if (filePop) { wireMenuClicks(filePop); fillFileMenu(filePop.btn, filePop.menu); }   // paint once before first open (title/aria-label read on hover)
    if (appPop) wireMenuClicks(appPop);

    // Re-sync the file menu's title/identity + re-lint when the profile/post or program changes elsewhere.
    // (The app menu has nothing live to resync — its rows are static until Settings/the version itself change,
    // and it re-reads both on every open via fillAppMenu.)
    const refreshFileMenu = () => { if (filePop) fillFileMenu(filePop.btn, filePop.menu); lint(); };
    window.addEventListener('ddcs:settings-changed', refreshFileMenu);
    // t2145 — the identity line's role segment reads gatewayStatus.js's poll cache; refresh it as that poll
    // ticks so the line doesn't need a reopen to catch a daemon appearing/disappearing.
    if (filePop) document.addEventListener('ddcs:gateway-status', () => fillFileMenu(filePop.btn, filePop.menu));
    const ed = document.getElementById('editor');
    if (ed) ed.addEventListener('input', lint);
    lint();
}
