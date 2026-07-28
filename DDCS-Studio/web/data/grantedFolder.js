/**
 * data/grantedFolder.js — ONE ENGINE FOR "a folder the user granted us" (t1249).
 *
 * Studio now has THREE of these and they are the same machine: pick a directory once, remember the handle in IDB,
 * re-grant permission inside a click rather than re-opening the OS dialog, list what is in it, write into it, and
 * fail closed when there is no folder. The workspaces folder was the first, the library folder the second — and the
 * deploy folder is the third, which is the case that forces the abstraction rather than a third near-copy of it.
 *
 * What differs between them is DATA, not behaviour: which IDB key remembers the handle, which picker id the browser
 * groups it under (so the OS reopens each in its own last location), and what the thing is called when we have to
 * explain it. So a folder is DECLARED — `makeGrantedFolder({key, pickerId, what})` — and a fourth is a declaration,
 * not another module.
 *
 * WHAT IS NOT HERE: the workspaces folder keeps its own richer flow (a save handle, a replace prompt, the first-save
 * dialog that grants the folder in the same step). Folding it in would mean rewriting the save path to serve a
 * generalisation, which is the wrong direction — the engine exists to stop the NEXT copy, not to absorb a working one.
 */
import { getHandle, putHandle, handleGranted, requestHandle } from './fsHandles.js';

export const hasFSA = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/**
 * @param {{key:string, pickerId:string, what:string}} decl
 *   key       the IDB key that remembers this folder's handle
 *   pickerId  the browser's picker id — its own last-location, so granting the deploy stick does not move the
 *             library folder's dialog and vice versa
 *   what      what this folder holds, in words, for the messages
 */
export function makeGrantedFolder({ key, pickerId, what }) {
    /**
     * The SESSION's handle, cached beside the IDB record. Persisting a directory handle is best-effort — a private
     * window, a locked-down webview or a quota refusal can all reject the write — and without this the folder would be
     * forgotten the instant it was picked, which reads as broken rather than unpersisted.
     */
    let _dir = null;

    /** The remembered handle, or null. Does NOT request permission — reading is not an act. */
    const get = async () => _dir || getHandle(key);

    /**
     * WHAT STATE IS THIS FOLDER IN — asked with a QUERY, never a request (t1263, user-proven).
     *
     * Chromium auto-denies a permission REQUEST made outside a user gesture. Boot-time code was calling one, getting
     * "denied", and concluding the folder was gone — so a folder the user had granted looked unchosen after every
     * restart, and they were sent back through the OS picker. A query is safe anywhere and answers the only question
     * a non-gesture caller should be asking.
     * @returns {Promise<'none'|'remembered'|'ready'>}
     *   none       — nothing has ever been granted
     *   remembered — we HAVE the handle; the runtime wants one click to re-allow it (NOT a reason to forget it)
     *   ready      — usable right now
     */
    const state = async () => {
        const known = _dir || await getHandle(key);
        if (!known) return 'none';
        _dir = known;
        return (await handleGranted(known)) ? 'ready' : 'remembered';
    };

    /**
     * The folder, ready to use. CALL THIS INSIDE A USER GESTURE.
     *
     * A remembered handle is re-requested — that is the one-click "Allow" on a folder the user already chose, with NO
     * OS picker — and the picker opens ONLY when there is nothing remembered at all. The distinction matters: a
     * picker asks "which folder?", which is the wrong question when the app already knows and merely needs permission
     * again. An explicit denial is the only thing that can forget a folder, and the caller is told so it can say why.
     * @returns {Promise<FileSystemDirectoryHandle|null>} null = declined / unavailable
     */
    const ensure = async ({ ask = true, repick = false, forgetOnDeny = false } = {}) => {
        if (!repick) {
            const known = _dir || await getHandle(key);
            if (known) {
                if (await handleGranted(known)) { _dir = known; return known; }
                if (await requestHandle(known)) { _dir = known; return known; }   // one click, the SAME folder
                // An in-gesture DENIAL: the user said no to a folder they had chosen. Keep it unless the caller has
                // decided otherwise — a denial today is not "this folder no longer exists", and re-picking it from
                // the OS dialog is a worse answer than offering Allow again next time.
                if (forgetOnDeny) await forget();
                return null;
            }
        }
        if (!ask || !hasFSA()) return null;
        try {
            const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: pickerId });
            _dir = dir;
            await putHandle(key, dir);
            return dir;
        } catch (_) { return null; }   // declined → fails closed; the caller says so, and nothing is written
    };

    const forget = async () => { _dir = null; await putHandle(key, null); };

    /** Is the folder usable right now, without asking for anything? */
    const ready = async () => { const d = await get(); return !!(d && await handleGranted(d)); };

    /**
     * WRITE FILES into the folder, creating any subdirectories a name declares ("CAM/macro_cam22.nc" makes CAM/).
     * All-or-nothing is deliberately NOT promised — a USB stick that fills up halfway has written what it wrote, and
     * pretending otherwise would be a lie — so the result reports exactly which files landed and which did not.
     * @param {Array<{name:string, data:string|Uint8Array}>} files
     * @returns {Promise<{ok:boolean, dir?:string, written:string[], failed:Array<{name:string, why:string}>, aborted?:boolean}>}
     */
    const writeFiles = async (files, { ensureFolder = true } = {}) => {
        const dir = ensureFolder ? await ensure() : await get();
        if (!dir) return { ok: false, aborted: true, written: [], failed: [], error: `no ${what} folder — choose one and try again.` };
        const written = [], failed = [];
        for (const f of files) {
            try {
                const parts = String(f.name).split('/').filter(Boolean);
                const fileName = parts.pop();
                let d = dir;
                for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
                const h = await d.getFileHandle(fileName, { create: true });
                const w = await h.createWritable();
                await w.write(f.data);
                await w.close();
                written.push(f.name);
            } catch (e) {
                // NAMED REFUSAL: a read-only or ejected stick says so in the words the OS gave us, not "write failed"
                failed.push({ name: f.name, why: (e && e.message) || String(e) });
            }
        }
        return { ok: failed.length === 0, dir: dir.name || what, written, failed };
    };

    /** List the folder's entries, optionally filtered by extension. Reads only — writes nothing. */
    const list = async (exts = null) => {
        const dir = await get();
        if (!dir || !(await handleGranted(dir, 'read'))) return [];
        const want = exts && exts.map((e) => e.toLowerCase());
        const out = [];
        try {
            for await (const [name, h] of dir.entries()) {
                if (h.kind !== 'file') continue;
                if (want && !want.some((e) => name.toLowerCase().endsWith(e))) continue;
                out.push({ name, handle: h });
            }
        } catch (_) { /* a folder that vanished mid-read lists what it managed */ }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    };

    return { key, pickerId, what, get, state, ensure, forget, ready, writeFiles, list };
}
