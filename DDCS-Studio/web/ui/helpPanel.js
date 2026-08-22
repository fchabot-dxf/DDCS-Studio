/**
 * ui/helpPanel.js — HELP, out of Settings (t1245, user ruling).
 *
 * FAQ and About were two of the nine subtabs under Settings' old "General" catch-all. Neither is a SETTING: nothing
 * on either panel changes how the app behaves, so putting them behind a gear taught people to go looking for answers
 * in the configuration screen.
 *
 * t2149 (BACKLOG #9, human amendment: "i meant seperate them in 2 panel") — THEY ARE TWO PANELS NOW, not one panel
 * with two sections. t1245's actual ruling was that neither belongs behind the gear — ONE panel was how that move
 * got BUILT, not the point of it. FAQ (searched when stuck) and About (identity — version, credits) are genuinely
 * different things with very different visit frequency; one panel made the rare one pad the common one. Both are
 * still rows in the app menu (`data-act="helpFaq"` / `data-act="helpAbout"`), both still out of Settings.
 * `openHelp(section)` builds ONE overlay containing only that section's content — the SAME overlay/close/Esc
 * machinery either way, so this stayed a clean cut rather than two near-duplicate modal implementations.
 *
 * FEEDBACK went with them but NOT here: the app menu already has a Rate / Feedback row whose toast takes stars, a
 * comment and an email fallback, so the old Settings > Feedback button (a bare mailto) was a second, weaker door to
 * the same place. One feedback door, and the FAQ answer that used to point at the old one now names it.
 */

import { BACKUP_STORES } from '../data/backup.js';   // t1253 — the file's own contents list, one source

/**
 * THE LINK REGISTRY (t1251, user amendment) — every surface the FAQ names, DECLARED once.
 *
 * An answer that says "Settings → Controller → Gateway" makes the reader walk there themselves, and the sentence goes
 * stale the moment a tab is renamed (this turn had to fix two such sentences). So a named path is a LINK: the id maps
 * to the call that opens the surface, the markup references the id, one delegated handler runs it, and the spec walks
 * EVERY entry here and asserts its opener lands. A renamed surface then breaks a test instead of a reader.
 *
 * Each opener uses the app's own structural doors — openSettings({panel}) resolves the panel's own group (t1245), so
 * these survive another Settings reshuffle without being touched. `label` is what the link reads as, so the words and
 * the destination cannot drift apart either.
 */
export const FAQ_LINKS = {
    'settings-gateway':   { label: 'Settings → Controller → Gateway',      open: async () => (await import('./settingsPanel.js')).openSettings({ panel: 'set_tab_gateway' }) },
    'settings-profile':   { label: 'Settings → Controller → Profile',      open: async () => (await import('./settingsPanel.js')).openSettings({ panel: 'set_tab_profile' }) },
    'settings-wizardbar': { label: 'Settings → Look and feel → Wizard bar', open: async () => (await import('./settingsPanel.js')).openSettings({ panel: 'set_tab_wizards' }) },
    'settings-hardware':  { label: 'Settings → Hardware',                  open: async () => (await import('./settingsPanel.js')).openSettings({ panel: 'set_tab_machine' }) },
    'workspace-manager':  { label: 'the workspace manager',                open: () => window.openWorkspaceManager && window.openWorkspaceManager('open') },
    'workspace-cloud':    { label: 'the Cloud tab',                        open: () => window.openWorkspaceManager && window.openWorkspaceManager('open', { place: 'cloud' }) },
    'gateway-tab':        { label: 'the Gateway tab',                      open: () => window.showApp && window.showApp('gateway') },
    'gateway-files':      { label: 'Gateway → Files',                      open: () => { if (window.showApp) window.showApp('gateway'); } },
    // A two-step destination: show the Macros app, THEN select its CAM panel. The second step has to WAIT — showApp
    // mounts the app, and clicking its subtab in the same tick lands on Macros with the CAM panel still hidden, which
    // is a link that half-arrives. Poll briefly for the wired subtab instead of assuming the mount was synchronous.
    'macros-cam':         { label: 'Macros → CAM Pack Builder',            open: async () => {
        if (window.showApp) window.showApp('macros');
        const sel = '#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]';
        for (let i = 0; i < 40; i++) {
            const t = document.querySelector(sel);
            const panel = document.getElementById('macros_panel_cam');
            if (t) { t.click(); if (panel && getComputedStyle(panel).display !== 'none') return; }
            await new Promise((r) => setTimeout(r, 25));
        }
    } },
    'blocks-tab':         { label: 'the Blocks tab',                       open: () => window.showApp && window.showApp('blocks') },
};

/** The markup for one FAQ link. Reads its words from the registry, so the label and the destination are one fact. */
const lk = (id, text) => `<a href="#" class="help-link" data-help-link="${id}">${text || FAQ_LINKS[id].label}</a>`;

/**
 * WHAT A .ddcs CONTAINS — READ FROM THE REGISTRY, never transcribed (t1253).
 *
 * The honest answer to "what is in my file" is the list of BACKUP_STORES rows, because that registry IS what the
 * writer walks. Copying those names into prose would create a second list, and a second list is one somebody forgets
 * to update — the FAQ would then confidently name nine things while the file carried ten. So the sentence reads the
 * same declared rows the file is built from: add a store and this answer names it, with no edit here at all.
 */
// t1327 — JOINED WITH A MIDDOT, not a comma. A label carries its own comma ("Window layout (which panes are open,
// their sizes)"), so a comma-joined sentence is STRUCTURALLY AMBIGUOUS: nothing reading it back can tell a separator
// from a label's punctuation, and the spec that checks this answer against the registry split that one row into two
// and failed on a registry that was perfectly correct. The separator has to be a character the labels cannot
// contain. The typography is better anyway.
export const CONTENTS_SEP = ' · ';
const ddcsContents = () => BACKUP_STORES.map((s) => s.label).join(CONTENTS_SEP);

const FAQ_HTML = `
    <div class="settings-section">
        <div class="settings-section-title">FREQUENTLY ASKED</div>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is DDCS Studio?</summary><div class="settings-hint" style="margin-top:6px;">A companion app for DDCS Expert / M350 controllers: wizards that generate G-code, a CAM-pack builder, a full toolpath simulator, and a gateway to send programs to the machine.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Where is my work saved?</summary><div class="settings-hint" style="margin-top:6px;">While you work, everything lives in a <b>temporary buffer</b> in this browser — handy, but not a file you own. Pressing <b>Ctrl+S</b> (or the disk button in the header) writes the whole workspace to a <code>.ddcs</code> file that is yours: the first save asks for a name and for your <b>workspaces folder</b> in one step, and every save after that goes straight back to the same file. The header disk button tells you which file you are in and whether it has unsaved changes.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What exactly is inside a .ddcs file?</summary><div class="settings-hint" style="margin-top:6px;">Everything this workspace <i>is</i>, in one file: <b>${ddcsContents()}</b>. That is the whole list — it is read from the same declared registry the save itself walks, so it cannot drift out of date. Tokens and cloud credentials are never included, which is why a <code>.ddcs</code> is safe to copy to another machine or hand to someone rebuilding your setup.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">.ddcs, .wiz, .cam, .nc — which file is which?</summary><div class="settings-hint" style="margin-top:6px;"><b><code>.ddcs</code></b> — the WHOLE workspace: one machine and everything you made on it (the list above).<br><b><code>.wiz</code></b> — ONE wizard's recipe. Source, not output: importing it installs the operation live and editable.<br><b><code>.cam</code></b> — ONE CAM slot's recipe, same idea: it rebuilds into a slot you can edit.<br><b><code>.nc</code> and the other deploy outputs</b> — BAKED files the controller runs. They are the end of the line, not re-importable; to change one, change its source and deploy again.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I work with two machines?</summary><div class="settings-hint" style="margin-top:6px;"><b>One workspace per machine</b> — the <code>.ddcs</code> file <i>is</i> the machine: its controller, envelope, WCS table, tools, macros and custom wizards all ride inside it. To set up a second machine, open ${lk('workspace-manager')}, <b>Duplicate</b> the one you have, and change the controller on the copy; switching machines is then just opening the other file. Nothing is shared behind your back, so tuning one machine cannot disturb the other.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I share a wizard or a CAM recipe?</summary><div class="settings-hint" style="margin-top:6px;">Both are shared as <b>source</b>, not as baked output, so what you send arrives editable. On ${lk('settings-wizardbar')}, <b>Export .wiz</b> writes an operation to your <b>library folder</b>; on ${lk('macros-cam')}, <b>⬆ Export .cam</b> writes a slot's recipe there too. Every <code>.wiz</code> / <code>.cam</code> in that folder shows up as a card on the same screens — click one and it installs live: a wizard lands on your bar and opens in Blocks, a recipe rebuilds into a slot you can edit like your own.</div></details>
<details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I get files onto the USB stick?</summary><div class="settings-hint" style="margin-top:6px;">Grant the stick itself as your <b>deploy target</b> — the row at the top of ${lk('gateway-files')} names it and lets you change it, and the first deploy asks if you have not chosen one. After that every baked output writes straight onto it: a program export, a CAM pack, a SYSDISK file like <code>T.nc</code> or <code>key-N.nc</code>. Nothing lands in Downloads to be found and copied — deploy, eject, and walk to the machine.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Do I need the desktop app?</summary><div class="settings-hint" style="margin-top:6px;">To talk to a real controller, yes — the desktop app is the <b>gateway</b> (it reaches your machine's CNCDISK share on the LAN). The hosted web page can design + simulate offline, but can't reach a machine.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I send a program to the controller?</summary><div class="settings-hint" style="margin-top:6px;">Open ${lk('gateway-tab')}, point it at your controller share (${lk('settings-gateway')}), then Send. System macros (T.nc, key-<i>N</i>.nc, slib-m.nc) are written to SYSDISK and backed up first. No LAN? Grant your USB stick as the deploy folder and export the program to it instead.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Which controllers are supported?</summary><div class="settings-hint" style="margin-top:6px;">DDCS <b>Expert / M350</b> is the primary, fully-mapped target; V4.1 and a few others have partial support. <b>Each workspace targets ONE controller</b> — the <code>.ddcs</code> file <i>is</i> that machine, and the post/dialect follows it, so opening a workspace switches Studio to its controller. Have a second machine? <b>Duplicate</b> the workspace in ${lk('workspace-manager')} and change the controller on the copy.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I add a probe, ATC, or spindle?</summary><div class="settings-hint" style="margin-top:6px;">${lk('settings-hardware')} → use <b>+ Add</b> on the relevant tab. Adding an ATC also seeds the essential drawbar + sensor I/O.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I simulate a program before running it?</summary><div class="settings-hint" style="margin-top:6px;">Press <b>▶</b> in the preview bar. The simulator runs the full G-code through the execution engine — resolving #vars, IF/GOTO loops and probes — so parametric/probe macros play correctly, not just straight moves.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Can I edit a wizard operation after inserting it?</summary><div class="settings-hint" style="margin-top:6px;">Yes — every wizard operation you insert becomes an editable <b>block stack</b>. Open ${lk('blocks-tab')} to see its individual steps, reorder or tweak them, and even extend it (e.g. add an extra probe). Your changes round-trip back to the wizard form — the form and the blocks are two views of the same operation, so nothing is a dead end.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">If I remove a form field param block from a custom wizard's Parameter Group, does it delete the parameter?</summary><div class="settings-hint" style="margin-top:6px;">No. Removing a field block from the <code>Parameter Group</code> strictly removes it from the user-facing form. The underlying execution blocks (e.g., <code>Surface Raster</code> or <code>Drill</code>) still preserve their value sockets (like <code>feed</code> or <code>depth</code>) and keep their baked defaults. If you need to edit a hidden parameter on a specific job, you can always insert your wizard and then click <b>Customize as blocks</b> to edit the raw execution blocks directly.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What does "Pull from controller" do?</summary><div class="settings-hint" style="margin-top:6px;">Reads your machine's live settings — WCS table, tool lengths, ATC magazine, travel and soft-limits — into a review step where you tick what to adopt. ${lk('settings-profile', 'Settings → Controller → Profile')} → ↧ Pull from controller, then choose either transport in the same modal: <b>↧ Live via the Gateway</b>, or <b>📁 From a USB copy</b> (the <code>.eng</code> file the controller writes, or a copy of its whole disk — no LAN needed). The modal states which controller it thinks it read, amber while that is still an assumption; if it does not match this workspace it offers to <b>Duplicate as</b> the detected machine, because a pull never silently retargets the workspace you are in.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is a CAM pack?</summary><div class="settings-hint" style="margin-top:6px;">A DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's on-board CAM page. Build and simulate one in the ${lk('macros-cam', 'the Macros tab → CAM Pack Builder')}, then <b>📦 Deploy pack</b> writes the vendor's own file set — <code>camN.nc</code> at the root, icons under <code>install/CAM/</code>, the eng/chs lines to merge and an install README — straight to your deploy folder. Grant the USB stick as that folder and the files land on it ready to carry to the machine; only a browser that cannot write to a folder falls back to a <code>.zip</code>.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Can I use Studio on my phone?</summary><div class="settings-hint" style="margin-top:6px;">Yes — the UI is responsive. Your desktop app serves Studio on your LAN; open the URL shown in <b>Settings → Controller → Gateway</b> from a phone/laptop on the same wifi.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I update Studio?</summary><div class="settings-hint" style="margin-top:6px;">The desktop app shows an in-app banner when a new release is published, with a one-click update. The web version updates automatically on load.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Cloud vs Gateway — what's the difference?</summary><div class="settings-hint" style="margin-top:6px;">The <b>Gateway</b> is the local desktop app that talks to <i>your machine</i> over the LAN — send programs, read settings, write macros. <b>Cloud</b> is simply <i>another place your workspaces live</i>: sign in on the workspace manager's ${lk('workspace-cloud', 'Cloud tab')} and your <code>.ddcs</code> files open and save to your own Google Drive, reachable from any machine you sign in on. They are independent — Gateway with no Cloud, or Cloud with no machine connected.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is the virtual I/O panel?</summary><div class="settings-hint" style="margin-top:6px;">The <b>I/O</b> button in the preview bar opens a floating panel showing the controller's inputs/outputs. During a simulation it <b>auto-answers sensors</b> so probe / M-code wait loops terminate hands-free; you can also flip inputs manually to test your logic.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why does a probe in the sim run to the limit?</summary><div class="settings-hint" style="margin-top:6px;">A probe (G31) traces its full travel until it has <b>stock</b> to stop on. Set the Stock (the 📦 button) so the probe contacts the surface — then it stops at the real face instead of the soft-limit.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why do some operations need me to jog the start position first?</summary><div class="settings-hint" style="margin-top:6px;">Some operations — especially <b>incremental / relative probes</b> — run <i>from the tool's current position</i>, not an absolute coordinate. Set where it begins by jogging the machine there (or dragging the <b>①</b> start handle in the preview) before running; otherwise the operation traces from zero and can probe the wrong spot.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Found a bug or have an idea?</summary><div class="settings-hint" style="margin-top:6px;">Use <b>⭐ Rate / Feedback</b> in the header menu — it takes stars, a comment, and can send by email. Tell us what you did and what you expected.</div></details>
    </div>
`;

const ABOUT_HTML = `
    <div class="settings-section">
        <div class="settings-section-title">DDCS STUDIO</div>
        <div class="settings-hint">Version <b id="help_about_ver">—</b></div>
        <div class="settings-hint">Modular G-code generator &amp; 3D simulator for the DDCS Expert / FOINNC M350 controller.</div>
    </div>
    <div class="settings-section">
        <div class="settings-section-title">CREDITS</div>
        <div class="settings-hint">Built by Frédéric Chabot · MIT License</div>
    </div>
`;

let _ov = null;

/** Fill the version from the header .ver chip — the one place the app's version is written (same source as About was).
 *  ⚠ t2149 — NOW POTENTIALLY DUPLICATED with the app menu's own `.hq-ver-footer` (BACKLOG #7/#9, both land in the
 *  same menu this turn). Deliberately NOT resolved here — the amendment that split this panel in two flagged the
 *  duplication and asked to report it, not silently drop either: both are kept until the human picks which survives. */
function fillVersion(root) {
    const v = document.querySelector('.ver');
    const el = root.querySelector('#help_about_ver');
    if (el) el.textContent = v ? v.textContent.trim() : '—';
}

// t2149 — ONE overlay, ONE section per open: 'faq' (the default — every existing bare openHelp() call in the
// test suite reads #help_faq and keeps working unchanged) or 'about'. Never both at once any more.
export function openHelp(section = 'faq') {
    closeHelp();
    const isAbout = section === 'about';
    const ov = document.createElement('div');
    ov.className = 'help-overlay';
    ov.id = 'helpOverlay';
    ov.innerHTML = `<div class="help-modal" role="dialog" aria-modal="true" aria-label="${isAbout ? 'About' : 'FAQ'}">
        <div class="help-head"><b>${isAbout ? 'About' : 'FAQ'}</b>
            <button type="button" class="help-close" id="helpClose" title="Close (Esc)" aria-label="Close help">&#10005;</button></div>
        <div class="help-body">
            ${isAbout
                ? `<div class="help-section" id="help_about">${ABOUT_HTML}</div>`
                : `<div class="help-section" id="help_faq">${FAQ_HTML}</div>`}
        </div>
    </div>`;
    document.body.appendChild(ov);
    if (isAbout) fillVersion(ov);
    ov.addEventListener('click', async (e) => {
        // t1251 — an in-app link: close Help, then open the surface the answer names. Closing FIRST matters — the
        // destination is often a modal of its own, and leaving Help on top of it would hide the thing you asked for.
        const link = e.target.closest('[data-help-link]');
        if (link) {
            e.preventDefault();
            const entry = FAQ_LINKS[link.dataset.helpLink];
            closeHelp();
            if (entry) { try { await entry.open(); } catch (_) { /* a surface that will not open is not worth a crash */ } }
            return;
        }
        if (e.target === ov || e.target.closest('#helpClose')) closeHelp();
    });
    document.addEventListener('keydown', _esc, true);
    _ov = ov;
    try { window.ddcsTrack?.('feature', 'help'); } catch (_) { /* noop */ }
    return ov;
}

function _esc(e) { if (e.key === 'Escape') { e.preventDefault(); closeHelp(); } }

export function closeHelp() {
    document.removeEventListener('keydown', _esc, true);
    if (_ov) { _ov.remove(); _ov = null; }
    const stray = document.getElementById('helpOverlay');
    if (stray) stray.remove();
}

if (typeof window !== 'undefined') { window.openHelp = openHelp; window.closeHelp = closeHelp; }
