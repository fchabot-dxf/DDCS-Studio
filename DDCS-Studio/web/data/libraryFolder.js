/**
 * data/libraryFolder.js — THE ONE GRANTED LIBRARY FOLDER (t1247).
 *
 * Sources you SHARE — a wizard (`.wiz`) or a CAM recipe (`.cam`) — all live in one folder you pick once. Not two
 * folders, not a download each time: the same "grant a directory, then it is just a list" model the workspaces folder
 * already uses, because the second folder is the same idea applied to a different kind of thing.
 *
 * WHY A FOLDER AND NOT DOWNLOADS. A download is a one-way door: the file lands somewhere the app can never read back,
 * so "share this wizard" and "use a shared wizard" become two unrelated chores with a file manager in between. With a
 * granted handle, exporting writes a file the app can immediately LIST, and importing is a click on a card. The
 * download path survives only as the TRUE fallback — an environment with no File System Access at all.
 *
 * WHAT THESE FILES ARE (the ruled model): SOURCE, never baked output. A `.wiz` carries the op's def — template,
 * bindings, declared sim intent — so it imports LIVE and editable, exactly like an op you authored yourself. A `.cam`
 * carries a slot's STRUCTURED ops (the buildSlotFromOps input), never the generated macro text. Sharing baked output
 * would hand someone a thing they cannot edit, which is the opposite of what a library is for.
 *
 * THE RULES THIS MODULE ENFORCES, so no caller has to remember them:
 *   - ASK ONCE. The handle persists in IDB beside the workspaces one; a later use re-grants permission in the user's
 *     click rather than re-opening the OS dialog.
 *   - ZERO WRITES ON READ. Listing and importing never create, touch or rewrite a file. Only an explicit export writes.
 *   - FAILS CLOSED. No folder, no permission, no File System Access → say so and do nothing. Never a silent download,
 *     never a half-import.
 *   - NAMED REFUSALS (the t1225 pattern). A file that cannot be read says WHICH CHECK FAILED — "not JSON", "a .cam,
 *     not a .wiz" — because "invalid file" tells a person nothing about the file in their hand.
 */
import { getHandle, putHandle, handleGranted, requestHandle } from './fsHandles.js';

export const LIBRARY_KEY = 'libraryFolder';

/**
 * THE SESSION'S FOLDER, cached in memory beside the IDB record. Persisting a directory handle is BEST-EFFORT — a
 * private window, a locked-down webview or a quota refusal can all reject the write — and without this cache such an
 * environment would forget the folder the instant the user picked it, making the shelf look broken rather than
 * unpersisted. The handle you just granted is usable NOW whether or not it survives the reload.
 */
let _dir = null;

/**
 * THE DECLARED KINDS. Each shareable source declares its extension, its file `kind` marker and what it is, in ONE
 * place — so the folder listing, the refusal messages and the pickers all read the same table instead of three
 * hand-rolled copies. A third kind is a row here, not a new module.
 */
export const LIBRARY_KINDS = {
    wiz: { ext: '.wiz', kind: 'ddcs.wizard', what: 'wizard' },
    cam: { ext: '.cam', kind: 'ddcs.cam', what: 'CAM recipe' },
};

export const hasFSA = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/** The remembered folder handle, or null. Does NOT request permission — reading is not an act. */
export async function getLibraryFolder() {
    return _dir || getHandle(LIBRARY_KEY);
}

/**
 * The folder, ready to use. MUST be called inside a user gesture: a remembered handle whose permission lapsed is
 * re-requested (one click, no OS folder dialog), and only a folder we have never been given opens the picker.
 * @returns {Promise<FileSystemDirectoryHandle|null>} null = the user declined, or this environment cannot
 */
export async function ensureLibraryFolder({ ask = true } = {}) {
    const known = _dir || await getHandle(LIBRARY_KEY);
    if (known && await requestHandle(known)) { _dir = known; return known; }
    if (!ask || !hasFSA()) return null;
    try {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'ddcsLibrary' });
        _dir = dir;
        await putHandle(LIBRARY_KEY, dir);   // best-effort: the cache above is what makes this session work regardless
        return dir;
    } catch (_) { return null; }   // declined / unavailable → fails closed, and the caller says so
}

/** Forget the folder (the user re-picks next time). */
export async function forgetLibraryFolder() { _dir = null; await putHandle(LIBRARY_KEY, null); }

const extOf = (name) => { const m = String(name || '').match(/\.[a-z0-9]+$/i); return m ? m[0].toLowerCase() : ''; };
const stemOf = (name) => String(name || '').replace(/\.[a-z0-9]+$/i, '');

/**
 * LIST the folder's shareable sources. Reads headers only — name, kind, and whatever `summary` the kind's own reader
 * pulls out — and writes nothing at all.
 * @param {string[]} kinds  which LIBRARY_KINDS keys to list (default: all)
 * @returns {Promise<Array<{name:string, stem:string, kindKey:string, text:string, obj:object|null, error:string|null}>>}
 */
export async function listLibrary(kinds = Object.keys(LIBRARY_KINDS)) {
    const dir = await getLibraryFolder();
    if (!dir || !(await handleGranted(dir, 'read'))) return [];
    const want = new Map(kinds.map((k) => [LIBRARY_KINDS[k].ext, k]));
    const out = [];
    try {
        for await (const [name, h] of dir.entries()) {
            if (h.kind !== 'file') continue;
            const kindKey = want.get(extOf(name));
            if (!kindKey) continue;
            const r = await readLibraryEntry(h, kindKey);
            out.push({ name, stem: stemOf(name), kindKey, ...r });
        }
    } catch (_) { /* a folder that vanished mid-read lists what it managed — never throws at the UI */ }
    return out.sort((a, b) => a.stem.localeCompare(b.stem));
}

/**
 * Read ONE entry and say precisely why it cannot be used, if it cannot (t1225's reporting pattern: name the check that
 * failed, never a flat "invalid file"). A leading byte-order mark is tolerated — the app never writes one, but a file
 * that has been through an external editor can pick one up, and refusing a share over an invisible character is absurd.
 */
async function readLibraryEntry(fileHandle, kindKey) {
    const want = LIBRARY_KINDS[kindKey];
    let text;
    try { const f = await fileHandle.getFile(); text = await f.text(); }
    catch (_) { return { text: '', obj: null, error: 'could not be read from disk.' }; }
    const body = String(text || '').replace(/^﻿/, '').trim();
    if (!body) return { text, obj: null, error: 'is empty — there is nothing in it to import.' };
    let obj;
    try { obj = JSON.parse(body); } catch (e) { return { text, obj: null, error: `is not a ${want.what}: its contents are not valid JSON (${(e && e.message) || 'parse error'}).` }; }
    if (!obj || typeof obj !== 'object') return { text, obj: null, error: `is not a ${want.what}: it holds a bare value, not an object.` };
    if (obj.kind !== want.kind) {
        // name the shape we DID recognise — the likeliest mistake is the other kind, renamed
        const other = Object.values(LIBRARY_KINDS).find((k) => k.kind === obj.kind);
        return { text, obj: null, error: other
            ? `is a ${other.what} (${other.ext}) named ${want.ext} — rename it and it will import.`
            : `is not a ${want.what}: it carries no “${want.kind}” marker.` };
    }
    return { text, obj, error: null };
}

/** Read one named file from the library folder (same named refusals as the listing). */
export async function readLibraryFile(name, kindKey) {
    const dir = await getLibraryFolder();
    if (!dir) return { text: '', obj: null, error: 'there is no library folder yet.' };
    let h;
    try { h = await dir.getFileHandle(name); }
    catch (_) { return { text: '', obj: null, error: `“${name}” is not in the library folder any more.` }; }
    return readLibraryEntry(h, kindKey);
}

/**
 * WRITE a source into the library folder. ONE-NAME: the file is named after the thing, so what you see in the app and
 * what you see in the folder are the same string. Replacing an existing file is the caller's decision, asked before
 * the write happens (`confirmReplace` returns false → nothing is written at all).
 * @returns {Promise<{ok:boolean, name?:string, aborted?:boolean, error?:string}>}
 */
export async function writeLibraryFile(stem, kindKey, text, { confirmReplace = null } = {}) {
    const want = LIBRARY_KINDS[kindKey];
    if (!want) return { ok: false, error: `unknown library kind “${kindKey}”.` };
    const dir = await ensureLibraryFolder();
    if (!dir) return { ok: false, aborted: true, error: 'no library folder — pick one and try again.' };
    const name = `${String(stem).replace(/[\\/:*?"<>|]/g, '-').trim() || 'untitled'}${want.ext}`;
    let existing = null;
    try { existing = await dir.getFileHandle(name); } catch (_) { existing = null; }
    if (existing && confirmReplace) {
        let ok = false;
        try { ok = await confirmReplace(name, dir.name || 'the library folder'); } catch (_) { ok = false; }
        if (!ok) return { ok: false, aborted: true };
    }
    try {
        const h = existing || await dir.getFileHandle(name, { create: true });
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
        return { ok: true, name };
    } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}

/** Delete a source from the library folder (the user's explicit act only). */
export async function deleteLibraryFile(name) {
    const dir = await getLibraryFolder();
    if (!dir) return false;
    try { await dir.removeEntry(name); return true; } catch (_) { return false; }
}

if (typeof window !== 'undefined') {
    window.ddcsLibraryFolder = { getLibraryFolder, ensureLibraryFolder, listLibrary, writeLibraryFile, deleteLibraryFile, forgetLibraryFolder, LIBRARY_KINDS };
}
