/**
 * ui/cloud/cloudVolume.js — resolve the storage adapter for a connected provider. Every adapter exposes the SAME
 * shape over an opaque "ref" (Google: Drive file id · Dropbox: path · OneDrive: item id):
 *   ensureRoot() -> rootRef
 *   list(ref) -> [{ ref, name, type:'folder'|'project', savedAt }]   (folders first, then name)
 *   read(ref) -> the parsed .mjson object
 *   write(name, obj, parentRef) -> ref     (create or overwrite)
 *   mkdir(name, parentRef) -> ref
 *   del(ref) / rename(ref, name)
 * A 401 throws Error('cloud-auth') so the UI prompts a reconnect. The Project Manager's Cloud tab drives this
 * generically, so adding a provider = one adapter module.
 */
export async function getAdapter(provider) {
    if (provider === 'google') return import('./googleDrive.js');
    if (provider === 'dropbox') return import('./dropbox.js');
    // onedrive: adapter not built yet → null (Cloud tab shows "coming soon")
    return null;
}
