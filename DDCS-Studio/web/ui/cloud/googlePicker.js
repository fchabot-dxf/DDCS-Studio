/**
 * ui/cloud/googlePicker.js — Google PICKER folder chooser. With the drive.file scope the app can't browse the
 * user's existing Drive (it only sees files IT created), so the Google-hosted Picker is the ONLY way to let the
 * user grant access to a chosen existing folder. Needs the OAuth token (from googleDrive) + a developer API key
 * (PUBLIC browser key; see providers.googleApiKey). Returns the picked { id, name }; rejects on cancel/missing key.
 */
import { getAccessToken } from './googleDrive.js';
import { googleApiKey } from './providers.js';

/** Load the gapi loader + the 'picker' module (once). */
function loadPickerApi() {
    return new Promise((resolve, reject) => {
        const ready = () => window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('picker module failed')) });
        if (window.gapi && window.gapi.load) return ready();
        const s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js'; s.async = true; s.defer = true;
        s.onload = ready;
        s.onerror = () => reject(new Error('Google API script failed to load'));
        document.head.appendChild(s);
    });
}

/** Open the Picker to choose a FOLDER. Resolves { id, name }; rejects Error('cancelled') / Error('no-api-key'). */
export async function pickFolder() {
    const tokenVal = getAccessToken();
    if (!tokenVal) throw new Error('cloud-auth');
    const key = googleApiKey();
    if (!key) throw new Error('no-api-key');
    await loadPickerApi();
    const g = window.google;
    return new Promise((resolve, reject) => {
        const view = new g.picker.DocsView(g.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setIncludeFolders(true)
            .setMimeTypes('application/vnd.google-apps.folder');
        const picker = new g.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(tokenVal)
            .setDeveloperKey(key)
            .setTitle('Choose a folder to hold your DDCS Studio projects')
            .setCallback((data) => {
                const a = data[g.picker.Response.ACTION];
                if (a === g.picker.Action.PICKED) {
                    const doc = (data[g.picker.Response.DOCUMENTS] || [])[0];
                    if (doc) resolve({ id: doc[g.picker.Document.ID], name: doc[g.picker.Document.NAME] || 'folder' });
                    else reject(new Error('no-folder'));
                } else if (a === g.picker.Action.CANCEL) {
                    reject(new Error('cancelled'));
                }
            })
            .build();
        picker.setVisible(true);
    });
}
