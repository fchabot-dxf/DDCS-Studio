/**
 * ui/profileModal.js — THE PROFILE BROWSER (t684 b). A project-browser-style modal (13100 tier, [Done] footer) over the
 * EXISTING profile library (data/profileLibrary.js) + cloud store (profileStore.js) — UI only, the full-swap semantics +
 * the library API are unchanged. Two doors:
 *   openProfileModal('browse')  — local + cloud rows, per-row Load / Delete / Export, [Import file] [Sync cloud] [Done]
 *   openProfileModal('save')    — the ONE naming moment: dlgPrompt the name → save the CURRENT config as that profile
 *                                 (a same-name profile asks to overwrite via dlgConfirm). Duplicate = save-as from current.
 *
 * RECENTS: a switch or a save pushes the profile id onto ddcs_profile_recents (localStorage) — the header menu reads it.
 * Load = library.switchProfile (the built full-swap). Delete / cloud-delete confirm via the in-app dialog.
 */
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';
import * as L from '../data/profileLibrary.js';
import { CONTROLLER_PROFILES, getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { installSelectLoad, syncPrimary } from './selectLoad.js';   // t805 — the shared select-then-load model

const RECENTS_KEY = 'ddcs_profile_recents';
const norm = (s) => String(s || '').trim().toLowerCase();
const ctrlName = (id) => (CONTROLLER_PROFILES[id] || {}).name || id;

/** Record a profile as most-recently-used (for the header menu). Newest first, de-duped, capped. */
export function pushRecentProfile(id) {
    if (!id) return;
    let r = recentProfileIds();
    r = [id, ...r.filter((x) => x !== id)].slice(0, 6);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(r)); } catch (_) { /* private mode */ }
}
/** The recent profile ids (newest first), filtered to ones that still exist. */
export function recentProfileIds() {
    let r = []; try { r = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch (_) { r = []; }
    const live = new Set(L.listProfiles().map((p) => p.id));
    return (Array.isArray(r) ? r : []).filter((id) => live.has(id));
}

let _afterChange = () => window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
/** The Settings panel passes its afterProfileChange so the modal's Load/Delete refreshes the live UI. */
export function setProfileChangeHook(fn) { if (typeof fn === 'function') _afterChange = fn; }

let _cloud = [];
async function refreshCloud() {
    try { _cloud = (window.ddcsListCloudProfiles ? (await window.ddcsListCloudProfiles()) : []) || []; }
    catch (_) { _cloud = []; }
}

export async function openProfileModal(mode = 'browse') {
    if (mode === 'save') return saveAsFlow();
    return browse();
}

/** SAVE-AS — the only naming moment. Prompt a name, then save the CURRENT config as that profile (same-name → overwrite). */
async function saveAsFlow() {
    const active = L.activeProfile() || {};
    const name = await dlgPrompt('Save this machine configuration as a profile:', active.name || '', { title: 'Save as profile', placeholder: 'e.g. Shop router — Expert', okLabel: 'Save' });
    if (name == null) return;
    const nm = String(name).trim();
    if (!nm) { dlgNotice('Give the profile a name to save it.'); return; }
    const existing = L.listProfiles().find((p) => norm(p.name) === norm(nm) && p.id !== active.id);
    if (existing) {
        if (!(await dlgConfirm(`A profile named “${nm}” already exists — overwrite it with the current configuration?`, { danger: true, okLabel: 'Overwrite' }))) return;
        L.deleteProfile(existing.id);   // replace: drop the old same-name, then create fresh from current (below)
    }
    // An UNNAMED active (or a save-as under its own name) NAMES the current config in place — no orphan unnamed profile.
    // A named active saved under a NEW name DUPLICATES the current config as that new profile (createProfile switches to it).
    if (!String(active.name || '').trim() || norm(active.name) === norm(nm)) { L.renameProfile(active.id, nm); L.saveActiveSnapshot(); pushRecentProfile(active.id); }
    else { const id = L.createProfile({ from: 'dup', name: nm }); if (id) pushRecentProfile(id); }
    _afterChange();
    // t754 — cloud-default: the LOCAL save above always lands; when connected + the pref prefers cloud, ALSO push to
    // cloud so the profile syncs across devices. A failed push keeps the local save + shows the note (never lost work).
    let SP = null; try { SP = await import('./savePrefs.js'); } catch (_) { /* optional */ }
    if (SP && SP.preferredSaveTarget() === 'cloud' && typeof window.ddcsSaveProfileToCloud === 'function') {
        try { await window.ddcsSaveProfileToCloud(nm); dlgNotice(`Saved “${nm}” — synced to cloud.`); return; }
        catch (_) { dlgNotice(SP.localFallbackNote('failed')); return; }
    }
    if (SP && SP.getDefaultSaveLocation() === 'cloud-when-connected' && !SP.cloudConnected()) { dlgNotice(SP.localFallbackNote('offline')); return; }
    dlgNotice(`Saved “${nm}”.`);
}

/** BROWSE — local + cloud rows; Load (full-swap) / Delete / Export per local row; download / delete per cloud-only row. */
async function browse() {
    await refreshCloud();
    const ov = document.createElement('div');
    ov.className = 'profile-modal';   // NOT 'app-dialog' — dialogs (dlgConfirm etc.) are a distinct layer that sits ABOVE this modal
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed; inset:0; z-index:13100; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px;';
    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(560px,96vw); max-height:88vh; display:flex; flex-direction:column; background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; box-shadow:0 14px 40px rgba(0,0,0,.6);';
    panel.innerHTML = `
        <div style="padding:14px 18px 8px; display:flex; align-items:center; gap:10px;">
            <h2 style="margin:0; font-size:15px; flex:1;">Profiles</h2>
            <button type="button" data-pa="save" class="toolbar-btn settings-io" title="Save the current configuration as a new profile">＋ Save as…</button>
        </div>
        <div data-plist style="flex:1; overflow:auto; padding:4px 18px; display:flex; flex-direction:column; gap:5px; min-height:120px;"></div>
        <div style="padding:10px 18px 14px; display:flex; gap:8px; align-items:center; border-top:1px solid var(--border,#2a313b);">
            <button type="button" data-pa="import" class="toolbar-btn settings-io" title="Import a profile from a .json export">⬆ Import file</button>
            <button type="button" data-pa="cloudsave" class="toolbar-btn settings-io" title="Save the CURRENT profile to your cloud (Google Drive)">☁ Save to cloud</button>
            <button type="button" data-pa="sync" class="toolbar-btn settings-io" title="Refresh the cloud profile list">☁ Sync</button>
            <span style="flex:1"></span>
            <button type="button" data-sl-primary class="sl-primary" disabled title="Load the selected profile (full-swap)">Load</button>
            <button type="button" data-pa="done" style="padding:6px 16px; font-size:12px; border-radius:5px; cursor:pointer; border:1px solid var(--border,#2a313b); background:transparent; color:var(--text-main,#e6ecf2);">Done</button>
        </div>`;
    ov.appendChild(panel);
    const importInput = document.createElement('input');
    importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.style.display = 'none';
    ov.appendChild(importInput);
    document.body.appendChild(ov);

    const listEl = panel.querySelector('[data-plist]');
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });

    function render() {
        const active = L.activeProfile() || {};
        const cloudByName = new Map(_cloud.filter((c) => c.name).map((c) => [norm(c.name), c]));
        const matched = new Set();
        const rows = [];
        for (const p of L.listProfiles()) {
            const on = p.id === active.id;
            const cl = p.name ? cloudByName.get(norm(p.name)) : null; if (cl) matched.add(cl.id);
            const tag = cl ? '☁ synced' : '💾 on this device';   // t805 — local/cloud unambiguous
            // t805 — SELECT-THEN-LOAD: rows are sl-rows selected then loaded via the footer [Load]/dblclick (no per-row
            // Load). The ACTIVE profile carries a distinct "Active" badge (not the selection ring).
            rows.push(`<div class="prof-row sl-row" data-pid="${p.id}" data-sl-id="${p.id}" data-sl-kind="local"${on ? ' data-sl-active' : ''} style="display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid ${on ? 'var(--accent,#2d7ff9)' : 'var(--border,#2a313b)'}; border-radius:6px;">
                <span class="sl-name" style="flex:1; ${on ? 'font-weight:700;' : ''}">${esc(p.name || '(unnamed)')} <span style="opacity:.6; font-weight:400;">· ${esc(ctrlName(p.controllerId))}</span></span>
                ${on ? '<span class="sl-active-badge">Active</span>' : ''}
                <span class="sl-tag">${tag}</span>
                <button type="button" class="toolbar-btn settings-io" data-export="${p.id}" title="Export this profile to a .json file">⤓</button>
                <button type="button" class="op-btn" data-del="${p.id}" title="Delete this profile">🗑</button>
            </div>`);
        }
        for (const c of _cloud.filter((c) => !matched.has(c.id))) {
            const d = c.savedAt ? new Date(c.savedAt).toLocaleDateString() : '';
            rows.push(`<div class="prof-row sl-row" data-sl-id="${c.id}" data-sl-kind="cloud" style="display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px dashed var(--border,#2a313b); border-radius:6px;">
                <span class="sl-name" style="flex:1; opacity:.85;">☁ ${esc(c.name)}${d ? ` <span style="opacity:.5; font-size:11px;">· ${d}</span>` : ''}</span>
                <span class="sl-tag">☁ in cloud</span>
                <button type="button" class="op-btn" data-cdel="${c.id}" title="Delete this cloud copy">✕</button>
            </div>`);
        }
        listEl.innerHTML = rows.join('') || '<div style="opacity:.6; padding:14px; text-align:center;">No profiles yet — Save as… to create one.</div>';
        syncPrimary(panel);   // t805 — a fresh row list carries no selection → disable [Load]
    }

    // t805 — SELECT-THEN-LOAD: a row selects; the footer [Load] (disabled until selected) or a double-click loads.
    // Local → full-swap switchProfile; cloud → download-then-activate (asks first). One dedicated action, no per-row Load.
    installSelectLoad(panel, async (id, row) => {
        if (row.dataset.slKind === 'cloud') {
            if (!window.ddcsLoadCloudProfile) return;
            if (!(await dlgConfirm('Load this cloud profile onto this device? It lands as a named profile and becomes active.', { okLabel: 'Load' }))) return;
            try { await window.ddcsLoadCloudProfile(id); _afterChange(); await refreshCloud(); render(); }
            catch (err) { dlgNotice('Load failed: ' + (err && err.message ? err.message : err)); }
        } else {
            L.switchProfile(id); pushRecentProfile(id); _afterChange(); render();
        }
    });

    listEl.addEventListener('click', async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.del) {
            const p = L.listProfiles().find((x) => x.id === t.dataset.del); if (!p) return;
            if (L.listProfiles().length <= 1) { dlgNotice('The last profile can’t be deleted.'); return; }
            if (!(await dlgConfirm(`Delete the profile “${p.name || 'unnamed'}”? This can’t be undone.`, { danger: true, okLabel: 'Delete' }))) return;
            L.deleteProfile(p.id); _afterChange(); render();
        }
        else if (t.dataset.export) { exportProfile(t.dataset.export); }
        else if (t.dataset.cdel) {
            if (!(await dlgConfirm('Delete this cloud profile? (Only the cloud copy — nothing on this device changes.)', { danger: true, okLabel: 'Delete' }))) return;
            try { await window.ddcsDeleteCloudProfile(t.dataset.cdel); await refreshCloud(); render(); }
            catch (err) { dlgNotice('Delete failed: ' + (err && err.message ? err.message : err)); }
        }
    });
    panel.addEventListener('click', async (e) => {
        const a = (e.target.closest('[data-pa]') || {}).dataset ? e.target.closest('[data-pa]').dataset.pa : null;
        if (a === 'done') close();
        else if (a === 'save') { await saveAsFlow(); render(); }
        else if (a === 'import') importInput.click();
        else if (a === 'sync') { const b = e.target.closest('[data-pa]'); const o = b.textContent; b.textContent = 'Syncing…'; b.disabled = true; await refreshCloud(); render(); b.textContent = o; b.disabled = false; }
        else if (a === 'cloudsave') {
            if (!window.ddcsSaveProfileToCloud) { dlgNotice('Connect a cloud account first (Settings → Cloud).'); return; }
            const ap = L.activeProfile() || {}; const nm = String(ap.name || '').trim();
            if (!nm) { dlgNotice('Save the current config as a named profile first (Save as…), then it can go to the cloud.'); return; }
            const dup = _cloud.find((c) => norm(c.name) === norm(nm));
            if (dup && !(await dlgConfirm(`A cloud profile named “${nm}” already exists — overwrite it?`, { okLabel: 'Overwrite' }))) return;
            const b = e.target.closest('[data-pa]'); const o = b.textContent; b.textContent = 'Saving…'; b.disabled = true;
            try { await window.ddcsSaveProfileToCloud(nm); await refreshCloud(); render(); dlgNotice(`Saved “${nm}” to your cloud.`); }
            catch (err) { dlgNotice('Cloud save failed: ' + (err && err.message ? err.message : err)); }
            b.textContent = o; b.disabled = false;
        }
    });
    importInput.addEventListener('change', async () => {
        const f = importInput.files && importInput.files[0]; if (!f) return;
        try {
            const bundle = JSON.parse(await f.text());
            const nm = (bundle && (bundle.name || (bundle.profile && bundle.profile.name))) || f.name.replace(/\.json$/i, '');
            L.importAsProfile(bundle, nm); _afterChange(); render();
            dlgNotice(`Imported “${nm}”.`);
        } catch (err) { dlgNotice('Import failed — not a valid profile file. ' + (err && err.message || '')); }
        importInput.value = '';
    });
    render();
}

function exportProfile(id) {
    try {
        const p = (L.getLibrary().profiles || []).find((x) => x.id === id) || {};   // the full stored entry (settings/userVars)
        const bundle = { name: p.name || '', controllerId: p.controllerId, settings: p.settings || {}, userVars: p.userVars || [] };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = ((p.name || 'profile').replace(/[^\w.-]+/g, '_')) + '.json';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { dlgNotice('Export failed: ' + (err && err.message || err)); }
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
