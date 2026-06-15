/**
 * ui/macroBar.js — the header Macro control: Save / Open a .mjson macro + a storage-location chip (Local/Cloud).
 *
 * Lives in the global header so it's available from the Studio and Blocks tabs. Save/Open are LOCAL (.mjson
 * files on the device) for now; the chip reflects the connected service (service.js) and points at the Gateway
 * Console picker — cloud macro sync follows the storage backend (see [[gateway-cloud-architecture]]).
 */
import { downloadMacro, openMacroText } from '../blocks/macroFile.js';
import { getService } from './gateway/service.js';

export function initMacroBar() {
    const saveBtn = document.getElementById('macroSaveBtn');
    const openBtn = document.getElementById('macroOpenBtn');
    const fileInput = document.getElementById('macroFileInput');
    const storageBtn = document.getElementById('macroStorageBtn');
    const storageLabel = document.getElementById('macroStorageLabel');
    if (!saveBtn || !openBtn || !fileInput) return;

    saveBtn.addEventListener('click', () => {
        const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
        if (!stack.length) { window.alert('Nothing to save yet — build a program first.'); return; }
        const name = window.prompt('Save macro as (.mjson):', 'macro');
        if (name == null) return;
        try { downloadMacro(name.trim() || 'macro'); } catch (e) { window.alert('Save failed: ' + e.message); }
    });

    openBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { openMacroText(String(r.result)); } catch (err) { window.alert('Not a valid .mjson macro: ' + err.message); } };
        r.readAsText(f);
        fileInput.value = '';   // allow re-opening the same file
    });

    // Storage chip — reflects the connected service. Cloud macro sync awaits the storage backend; for now
    // Save/Open are local files regardless, and clicking the chip jumps to the Gateway Console service picker.
    const refreshStorage = () => {
        if (!storageLabel) return;
        const cloud = getService().mode === 'cloud';
        storageLabel.textContent = cloud ? 'CLOUD' : 'LOCAL';
        if (storageBtn) storageBtn.title = cloud
            ? 'Storage: a cloud service is connected — cloud macro sync is coming; Save/Open use local .mjson files for now.'
            : 'Storage: local — Save/Open use .mjson files on this device. Connect a service in Gateway → Console for cloud.';
    };
    refreshStorage();
    window.addEventListener('ddcs:settings-changed', refreshStorage);
    if (storageBtn) storageBtn.addEventListener('click', () => { if (window.showApp) window.showApp('gateway'); });
}
