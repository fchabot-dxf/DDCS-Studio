/**
 * ui/backupModal.js — the RESTORE preview-then-confirm modal for the one-file backup (t852).
 *
 * Restore is destructive (it REPLACES each selected store), so it is never one-click: pick a file → PREVIEW what it
 * contains (counts per store, the app version it came from, a newer-format warning) → tick which stores to restore
 * (default all present) → Confirm. A SAFETY auto-export of the current state is downloaded FIRST (the undo path).
 * Stores absent from the file are shown as "not in this backup" and cannot be selected (left untouched).
 *
 * The data layer (buildBackup/previewBackup/restoreBackup/safetyExport) lives in data/backup.js — this is only its UI.
 */
import { previewBackup, restoreBackup, safetyExport, exportEverything } from '../data/backup.js';
import { dlgNotice } from './dialog.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Pick a local file → resolve its text (or null if cancelled). Mirrors the profileStore importer pattern.
function pickFileText() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.ddcs,.json,application/json';   // t1137 — .ddcs workspace + legacy .json (same JSON shape)
        input.addEventListener('change', () => {
            const f = input.files && input.files[0];
            if (!f) { resolve(null); return; }
            const r = new FileReader();
            r.onload = (e) => resolve(String(e.target.result || ''));
            r.onerror = () => resolve(null);
            r.readAsText(f);
        });
        input.click();
    });
}

/** Open the restore flow. Pass a parsed backup object to skip the file picker (used by tests). */
export async function openBackupRestore(preloaded) {
    let obj = preloaded;
    if (!obj) {
        const text = await pickFileText();
        if (text == null) return;
        try { obj = JSON.parse(text); } catch (_) { dlgNotice('That file is not a valid workspace — pick a .ddcs file.'); return; }
    }
    const pv = previewBackup(obj);
    if (!pv.valid) { dlgNotice('That file is not a DDCS workspace (the marker is missing).'); return; }
    return renderRestoreModal(obj, pv);
}

function renderRestoreModal(obj, pv) {
    document.getElementById('backupRestoreOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'backupRestoreOverlay';
    ov.className = 'backup-restore-overlay';
    const rows = pv.rows.map((r) => `<label class="bk-row${r.present ? '' : ' bk-absent'}">`
        + `<input type="checkbox" data-store="${esc(r.id)}" ${r.present ? 'checked' : ''} ${r.present ? '' : 'disabled'}>`
        + `<span class="bk-lbl">${esc(r.label)}</span>`
        + `<span class="bk-count">${r.present ? (r.count != null ? esc(r.count + ' ' + (r.unit || '')) : 'included') : 'not in this backup'}</span>`
        + `</label>`).join('');
    ov.innerHTML = `<div class="backup-restore-modal" role="dialog" aria-label="Open workspace">`
        + `<div class="bk-head"><span class="bk-title">Open workspace</span><button type="button" class="bk-x" aria-label="Close">✕</button></div>`
        + `<div class="bk-body">`
        + `<div class="bk-meta">From app <b>${esc(pv.app)}</b>${pv.date ? ' · ' + esc(String(pv.date).slice(0, 10)) : ''}`
        + (pv.newer ? ` · <span class="bk-warn">⚠ newer backup format — some data may not import</span>` : '') + `</div>`
        + `<div class="bk-note">Pick what to restore. Restoring <b>replaces</b> each selected store. A safety copy of your current state is downloaded first, so you can undo.</div>`
        + `<div class="bk-rows">${rows}</div>`
        + `</div>`
        + `<div class="bk-foot"><button type="button" class="bk-btn bk-cancel">Cancel</button>`
        + `<button type="button" class="bk-btn bk-confirm bk-danger">Restore selected</button></div>`
        + `</div>`;
    document.body.appendChild(ov);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    ov.querySelector('.bk-x').addEventListener('click', close);
    ov.querySelector('.bk-cancel').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    ov.querySelector('.bk-confirm').addEventListener('click', async () => {
        const sel = [...ov.querySelectorAll('.bk-row input[data-store]:checked')].map((i) => i.dataset.store);
        if (!sel.length) { dlgNotice('Nothing selected to restore.'); return; }
        const btn = ov.querySelector('.bk-confirm'); btn.disabled = true; btn.textContent = 'Restoring…';
        try {
            await safetyExport();                       // the undo path FIRST
            const res = await restoreBackup(obj, sel);
            close();
            await dlgNotice(`Restored ${res.restored.length} store${res.restored.length !== 1 ? 's' : ''}. The app will reload to apply the changes.`);
            if (!window.__ddcsNoReload) location.reload();
        } catch (e) { btn.disabled = false; btn.textContent = 'Restore selected'; dlgNotice('Restore failed: ' + ((e && e.message) || e)); }
    });
    return ov;
}

if (typeof window !== 'undefined') {
    window.openBackupRestore = openBackupRestore;
    window.ddcsExportBackup = exportEverything;   // also reachable from the header, if ever wired there
}
