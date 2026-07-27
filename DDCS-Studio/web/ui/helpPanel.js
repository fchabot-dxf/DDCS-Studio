/**
 * ui/helpPanel.js — HELP, out of Settings (t1245, user ruling).
 *
 * FAQ and About were two of the nine subtabs under Settings' old "General" catch-all. Neither is a SETTING: nothing
 * on either panel changes how the app behaves, so putting them behind a gear taught people to go looking for answers
 * in the configuration screen. They are one small panel now, opened from the header quick menu's Help row — two
 * sections, the same content, moved intact.
 *
 * FEEDBACK went with them but NOT here: the quick menu already had a Rate / Feedback row whose toast takes stars, a
 * comment and an email fallback, so the old Settings > Feedback button (a bare mailto) was a second, weaker door to
 * the same place. One feedback door, and the FAQ answer that used to point at the old one now names it.
 */
const FAQ_HTML = `
    <div class="settings-section">
        <div class="settings-section-title">FREQUENTLY ASKED</div>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is DDCS Studio?</summary><div class="settings-hint" style="margin-top:6px;">A companion app for DDCS Expert / M350 controllers: wizards that generate G-code, a CAM-pack builder, a full toolpath simulator, and a gateway to send programs to the machine.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Do I need the desktop app?</summary><div class="settings-hint" style="margin-top:6px;">To talk to a real controller, yes — the desktop app is the <b>gateway</b> (it reaches your machine's CNCDISK share on the LAN). The hosted web page can design + simulate offline, but can't reach a machine.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I send a program to the controller?</summary><div class="settings-hint" style="margin-top:6px;">Open the <b>Gateway</b> tab, point it at your controller share (Settings → Gateway), then Send. System macros (T.nc, key-<i>N</i>.nc, slib-m.nc) are written to SYSDISK and backed up first.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Which controllers are supported?</summary><div class="settings-hint" style="margin-top:6px;">DDCS <b>Expert / M350</b> is the primary, fully-mapped target. V4.1 and a few others have partial support — the post/dialect switches with the selected profile.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I add a probe, ATC, or spindle?</summary><div class="settings-hint" style="margin-top:6px;">Settings → <b>Hardware</b> → use <b>+ Add</b> on the relevant tab. Adding an ATC also seeds the essential drawbar + sensor I/O.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I simulate a program before running it?</summary><div class="settings-hint" style="margin-top:6px;">Press <b>▶</b> in the preview bar. The simulator runs the full G-code through the execution engine — resolving #vars, IF/GOTO loops and probes — so parametric/probe macros play correctly, not just straight moves.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Can I edit a wizard op after inserting it?</summary><div class="settings-hint" style="margin-top:6px;">Yes — every wizard op you insert becomes an editable <b>block stack</b>. Open the <b>Blocks</b> tab to see its individual steps, reorder or tweak them, and even extend it (e.g. add an extra probe). Your changes round-trip back to the wizard form — the form and the blocks are two views of the same op, so nothing is a dead end.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What does "Pull from controller" do?</summary><div class="settings-hint" style="margin-top:6px;">Reads your machine's live settings — WCS table, tool lengths, ATC magazine, travel/soft-limits — into a review modal so you can adopt them. Needs the gateway + a connected controller. It never writes the firmware-owned <code>camsetting</code>.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is a CAM pack?</summary><div class="settings-hint" style="margin-top:6px;">A DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's on-board CAM page. Build, simulate and export one (USB-ready .zip) in the <b>Macros</b> tab → CAM Pack Builder.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Can I use Studio on my phone?</summary><div class="settings-hint" style="margin-top:6px;">Yes — the UI is responsive. Your desktop app serves Studio on your LAN; open the URL shown in Settings → Gateway from a phone/laptop on the same wifi.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">How do I update Studio?</summary><div class="settings-hint" style="margin-top:6px;">The desktop app shows an in-app banner when a new release is published, with a one-click update. The web version updates automatically on load.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Cloud vs Gateway — what's the difference?</summary><div class="settings-hint" style="margin-top:6px;">The <b>Gateway</b> is the local desktop app that talks to <i>your machine</i> over the LAN (send programs, read settings, write macros). <b>Cloud</b> is optional <i>project storage</i> (e.g. Google Drive), separate from the machine — it syncs your profiles and programs across devices. You can use the Gateway with no Cloud, and Cloud with no machine connected.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">What is the virtual I/O panel?</summary><div class="settings-hint" style="margin-top:6px;">The <b>I/O</b> button in the preview bar opens a floating panel showing the controller's inputs/outputs. During a simulation it <b>auto-answers sensors</b> so probe / M-code wait loops terminate hands-free; you can also flip inputs manually to test your logic.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why does a probe in the sim run to the limit?</summary><div class="settings-hint" style="margin-top:6px;">A probe (G31) traces its full travel until it has <b>stock</b> to stop on. Set the Stock (the 📦 button) so the probe contacts the surface — then it stops at the real face instead of the soft-limit.</div></details>
        <details style="margin:6px 0; border:1px solid var(--border); border-radius:6px; padding:6px 10px;"><summary style="cursor:pointer; font-weight:600; font-size:13px;">Why do some ops need me to jog the start position first?</summary><div class="settings-hint" style="margin-top:6px;">Some ops — especially <b>incremental / relative probes</b> — run <i>from the tool's current position</i>, not an absolute coordinate. Set where it begins by jogging the machine there (or dragging the <b>①</b> start handle in the preview) before running; otherwise the op traces from zero and can probe the wrong spot.</div></details>
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

/** Fill the version from the header .ver chip — the one place the app's version is written (same source as About was). */
function fillVersion(root) {
    const v = document.querySelector('.ver');
    const el = root.querySelector('#help_about_ver');
    if (el) el.textContent = v ? v.textContent.trim() : '—';
}

export function openHelp() {
    closeHelp();
    const ov = document.createElement('div');
    ov.className = 'help-overlay';
    ov.id = 'helpOverlay';
    ov.innerHTML = `<div class="help-modal" role="dialog" aria-modal="true" aria-label="Help">
        <div class="help-head"><b>Help</b>
            <button type="button" class="help-close" id="helpClose" title="Close (Esc)" aria-label="Close help">&#10005;</button></div>
        <div class="help-body">
            <div class="help-section" id="help_faq">${FAQ_HTML}</div>
            <div class="help-section" id="help_about">${ABOUT_HTML}</div>
        </div>
    </div>`;
    document.body.appendChild(ov);
    fillVersion(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('#helpClose')) closeHelp(); });
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
