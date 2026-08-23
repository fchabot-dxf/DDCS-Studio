/**
 * ui/headerPost.js — the app header's TWO menus: #hdrPostBtn / #hdrPostMenu (the FILE menu — workspace
 * save/open, load/insert/export, the library, the wizard manager, setup docs) and #hdrAppBtn / #hdrAppMenu
 * (the APP menu — Settings, FAQ, About, the desktop download, Rate, the website). Plus a capability LINT
 * (#hdrPostWarn) on the loaded program against the workspace's OWN controller.
 *
 * t2149 (BACKLOG #9) — THE SPLIT, and the test that drew the line: does going through this door bring
 * something INTO your work, or come OUT of it? Save/Open/Load/Insert/Export/Library/Wizards/Setup-sheet/
 * Setup-checklist all do (FILE scope); Settings/FAQ/About/the desktop download/Rate/the version are about the
 * PRODUCT itself, never this file (APP scope). Before this turn both lived in ONE menu hanging off the
 * workspace filename chip — so "Settings…" under your filename read as THIS FILE's settings, a mismatch
 * t2147 made worse by design. The logo, previously a plain `<a href>` out to the marketing site (a real
 * mis-click hazard — the same one that forced t2147's whole layout argument), is now the APP menu's own
 * trigger; "open the website" is one row inside it. Both menus share ONE dismissal contract (`makePopover`
 * below) rather than being two hand-rolled popovers, and opening one closes the other.
 * ⚠ THEME IS NOT A ROW HERE: t2147 already moved the theme picker to Settings (#set_theme, Look and feel →
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
import { openLibrary } from './libraryModal.js';   // t854 — the Library (Projects · Wizards; Profiles retired t1217)

// Quick-menu glyphs (24×24 stroke grid) — mirror the dock toolbar icons so the menu reads consistently.
const HQ_ICONS = {
    open:   { c: '#f59e0b', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
    save:   { c: '#0ea5e9', d: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' },
    load:   { c: '#f59e0b', d: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
    insert: { c: '#14b8a6', d: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>' },
    copy:   { c: '#6366f1', d: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
    clear:  { c: '#ef4444', d: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>' },
    export: { c: '#0ea5e9', d: '<path d="M16 9h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2"/><line x1="12" y1="14" x2="12" y2="3"/><polyline points="8 7 12 3 16 7"/>' },
    standalone: { c: '#22c55e', d: '<rect x="3" y="3" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><polyline points="9 13 12 16 15 13"/><line x1="12" y1="11" x2="12" y2="16"/>' },
    settings: { c: '#94a3b8', d: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    checklist: { c: '#3ddc84', d: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    setupSheet: { c: '#c084fc', d: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>' },
    library: { c: '#38bdf8', d: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
    wizard: { c: '#a855f7', d: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>' },
    // BACKLOG #7 — the "Saved …" footer line's WHERE, an icon not a word (fileSavedPlace() is a strict binary).
    // ⛔ NOT in ui/wizIcons.js — that registry holds OPERATION icons only; a save-location mark is UI CHROME, so
    // it belongs beside this menu's other chrome glyphs, same table, same convention.
    local: { c: '#0ea5e9', d: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' },
    cloud: { c: '#0ea5e9', d: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>' },
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
        case 'open':   document.getElementById('projOpenBtn')?.click(); break;
        case 'save':   document.getElementById('projSaveBtn')?.click(); break;
        case 'wizard': window.ddcsSaveAsWizard ? window.ddcsSaveAsWizard() : dlgNotice('Open an operation in the Blocks tab first, then save it as a wizard.'); break;
        // t2078 — Load / Insert / Export are BACK (see the fileRows comment for the human's reasoning: they act
        // on the program as a whole, not on the text under the caret). ONE implementation — these call the same
        // window globals ui/globalFunctions.js EDITOR_FILE_ACTIONS called, never a second copy of the logic.
        // ⛔ CLEAR is deliberately NOT routed here (t1255): the 🗑 in the editor toolbar is the one clear.
        case 'getDesktop': {
            // opened through the SAME door the update banner uses: in the exe the gateway opens the real
            // system browser server-side, which fires exactly once — window.open double-fired inside the
            // embedded webview (t2066).
            import('./updateCheck.js').then((m) => (m.openExternal || window.open)(EXE_DOWNLOAD_URL, '_blank'))
                .catch(() => window.open(EXE_DOWNLOAD_URL, '_blank', 'noopener'));
            break;
        }
        case 'fileLoad':   window.loadGcodeFile ? window.loadGcodeFile() : dlgNotice('Loading is unavailable.'); break;
        case 'fileInsert': window.insertGcodeFile ? window.insertGcodeFile() : dlgNotice('Insert is unavailable.'); break;
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
        case 'library': openLibrary(); break;   // t854 — the Library (last-used tab)
        case 'rate': window.ddcsOpenRate?.(); break;   // t598 — the always-available Rate / Feedback path (opens the repo)
        // t2149 (human amendment: "i meant seperate them in 2 panel") — FAQ and About are TWO rows opening TWO
        // panels now, not one Help row opening one two-section panel. See helpPanel.js's own header for why.
        case 'helpFaq':   import('./helpPanel.js').then((m) => m.openHelp('faq')); break;
        case 'helpAbout': import('./helpPanel.js').then((m) => m.openHelp('about')); break;
        case 'openWebsite': openExternal(WEBSITE_URL); break;   // t2149 — the logo's old <a href>, now a menu row
        // t1223 — WORKSPACE (the .ddcs). Both open the ONE manager modal, on the half the user asked for: Save
        // focuses the current workspace + its delta, Open focuses the granted folder's cards.
        case 'wsSave': window.openWorkspaceManager?.('save'); break;
        case 'wsOpen': window.openWorkspaceManager?.('open'); break;
        // t1617 — the WIZARD manager, the workspace manager's sibling: wizard lifecycle (fork / rename / duplicate /
        // delete + the .wiz library shelves). Distinct from 'wizard' above, which SAVES the current stack as one.
        case 'wizards': window.openWizardManager?.(); break;
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
    // Layout: identity row · saved row · workspace row (Save/Open) · Wizards… · Load/Insert/Export · Library… ·
    // Setup sheet… · Setup checklist. MOVED NOT LOST, across several turns: standalone/checklist-toggle → Settings
    // (now the APP menu); t1227 Load/Insert/Export/Clear → the editor's corner menu, then t2078 brought
    // Load/Insert/Export back HERE (Clear alone stayed in the editor toolbar, t1255); BACKLOG #1 (t2147) — Theme
    // → Settings' own #set_theme picker; BACKLOG #9 (t2149) — Settings/FAQ/About/desktop-download/Rate/version →
    // the new APP menu, because none of them act on this file (see this file's header comment for the test that split them).

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
        const identityRow =
            `<div class="hq-identity-line hq-identity">`
            // t1249 (user) — the line says WHAT it describes. Without the label it is three facts with no subject:
            // a reader has to work out that "Rig B" is the workspace and not, say, the controller. Same wording as
            // the disk tooltip, so the two surfaces name the same thing the same way.
            + `<span class="hq-identity-txt"><span class="hq-label">Workspace: </span><b>${esc(apName)}</b>`
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
        // Load / Insert / Export are back in THIS menu; the editor's own corner file button/menu is gone entirely.
        // Clear alone stayed out (t1255) — it lives in the editor's own toolbar row.

        // ── t1223 (1) — WORKSPACE ROW: Save + Open are the PRIMARY buttons, and all workspace management lives
        //    here rather than in a new header menu. ────────────────────────────────────────────────────────────
        const workspaceRow =
            `<div class="hq-ws-row">`   // its OWN class (a workspace row is not a gcode row); the menu-diet spec counts it
            + `<button type="button" class="hq-ws-btn" data-act="wsSave" title="Save this workspace to its .ddcs file">💾 Save</button>`
            + `<button type="button" class="hq-ws-btn" data-act="wsOpen" title="Open a workspace from your workspaces folder">📂 Open</button>`
            + `</div>`;

        // t1617 — the WIZARD MANAGER's entry, the workspace manager's sibling (same place, next row): the wizards
        // embedded in THIS workspace + the .wiz library shelves. Lifecycle, not bar arrangement (that stays in Settings).
        const wizardsRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="wizards">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('wizard')
            + '<span class="hdr-quick-lbl">Wizards…</span></button>';

        // ── UTILITY ROWS (FILE-scoped) ────────────────────────────────────────────────────────────────
        // t854/t2149 — the Library: one door to Projects · Wizards (the Profiles tab retired at t1217 — the
        // workspace's ONE machine lives in Settings now, not a browsable list; this comment used to still name
        // it, the removal-chain pattern again). Both Projects and Wizards are "bring something INTO this job",
        // which is why Library stays FILE-scoped even though its own name sounds product-ish.
        const libraryRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="library" title="Your saved projects (.mjson) and the wizard catalogue — not raw G-code files, see Load below">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('library')
            + '<span class="hdr-quick-lbl">Library…</span></button>';
        const healthOn = (window.ddcsHealthSignalsOn ? window.ddcsHealthSignalsOn() : true);
        const checklistRow = !healthOn ? '' :
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="checklist">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('checklist')
            + '<span class="hdr-quick-lbl">Setup checklist</span></button>';

        // t850 — print-ready job page.
        const setupSheetRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="setupSheet">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('setupSheet')
            + '<span class="hdr-quick-lbl">Setup sheet…</span></button>';

        // t2078 (human: "the load insert export button can go in the quick menu") — THE PROGRAM FILE ROWS RETURN.
        // ⚠ THIS REVERSES t1227, which moved them OUT of here because this menu is for APP things, "not what to
        // do with the program in front of you". The human's own refinement of that rule, which is why it is a
        // correction and not a flip-flop: Load / Insert / Export act on the program AS A WHOLE — they are what you
        // reach for with an EMPTY editor (start one) or a FINISHED one (ship it), never mid-edit. t1227's test was
        // right; these three simply fall on the app side of it, unlike Comment/Undo which act on the text
        // under the caret and stay in the pane. The editor's own ▾ file button is gone with this, so these are
        // once again the ONE door to Load/Insert/Export, not a second one. Handlers are the SAME globals the editor menu called (loadGcodeFile / insertGcodeFile /
        // downloadFile), so there is one implementation, not a copy.
        // ⛔ CLEAR IS STILL NOT HERE (t1255): the 🗑 is the one clear, now in the editor's toolbar row. Two doors
        // to a destructive action is one too many.
        // t2149 — Load…'s title disambiguates the "three doors to open a saved thing" (BACKLOG #9): Open (above)
        // opens a WORKSPACE (.ddcs — the machine), Load opens a raw G-CODE FILE, Library→Projects opens a
        // .mjson JOB. Genuinely three different file formats, not one act with three names — CHECKED, not
        // assumed (Open reads a workspace via workspaceManager.js, Load reads a program via loadGcodeFile in
        // globalFunctions.js, Projects reads a multi-op .mjson via projectModal.js's openMacroText).
        const fileRows =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="fileLoad" title="Load a G-code file into the editor (replaces the program) — not a workspace or a project">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">📂 Load…</span></button>'
            + '<button type="button" role="menuitem" class="hdr-quick-item" data-act="fileInsert">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">➕ Insert…</span></button>'
            + '<button type="button" role="menuitem" class="hdr-quick-item" data-act="fileExport">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">⭳ Export…</span></button>';

        // ── ASSEMBLE ──────────────────────────────────────────────────────────────────────────────────
        menu.innerHTML =
            identityRow          // t1227 — the quiet name · dialect line sits WITH the workspace buttons (save context)
            + savedRow           // BACKLOG #7 — when + where this workspace was last saved; nothing when never saved
            + workspaceRow
            + wizardsRow         // t1617 — the wizard manager, beside the workspace it serves
            + '<div class="hdr-quick-sep"></div>'
            + fileRows
            + '<div class="hdr-quick-sep"></div>'
            + libraryRow
            + '<div class="hdr-quick-sep"></div>'
            + setupSheetRow + checklistRow;

        btn.title = `File menu — ${apName} · ${apCtrl}`;
        btn.setAttribute('aria-label', `File menu (${apName} · ${apCtrl})`);
    };

    // ── APP MENU (#hdrAppBtn/#hdrAppMenu) — the product itself, never this file. Small and rarely opened,
    //    which BACKLOG #9 calls out as correct, not lopsided: most of what a user does lives in the file menu. ──
    const fillAppMenu = (btn, menu) => {
        const settingsRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="settings">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('settings')
            + '<span class="hdr-quick-lbl">Settings…</span></button>';
        // t1245 (user) — HELP leaves Settings and lands here. FAQ and About are not settings: nothing on either
        // changes how the app behaves, so a gear was the wrong door for them.
        // t2149 (human amendment: "i meant seperate them in 2 panel") — TWO rows, TWO panels, not one Help row
        // opening one two-section panel: FAQ (searched when stuck) and About (identity — version, credits) are
        // different things at very different visit frequencies. See helpPanel.js's own header for the full reasoning.
        const faqRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="helpFaq">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">❓ FAQ</span></button>';
        const aboutRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="helpAbout">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">ℹ About</span></button>';
        // t598 — always-available Rate / Feedback. t1245 — and now the ONE feedback door: Settings' Report-a-bug
        // button was a bare mailto pointing at the same maintainer this toast already reaches (with stars and a
        // comment), so it retired rather than being carried along beside it.
        // t2113 (human: "maybe the exe download can go back in the quick menu") — THE DESKTOP DOWNLOAD. It is
        // about the application itself, not the program in front of you — exactly what this menu is for now.
        // ⚠ THE UNCONDITIONAL RULING SURVIVES THE MOVE: the human ruled this is never gated on whether a
        //    gateway answers ("its not because i have the app open that i dont want to download it again"), and
        //    it is not gated here either.
        const downloadRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="getDesktop">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">⬇ Get DDCS Studio for desktop</span></button>';
        const rateRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="rate">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">⭐ Rate / Feedback</span></button>';
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
            settingsRow
            + '<div class="hdr-quick-sep"></div>'
            + faqRow + aboutRow + downloadRow + rateRow + websiteRow
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
