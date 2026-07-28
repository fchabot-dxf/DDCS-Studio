/**
 * data/deployFolder.js — THE DEPLOY TARGET (t1249, user ruling). The third and last folder; the ownership model closes.
 *
 * The three folders answer three different questions, and keeping them separate is the whole point:
 *
 *   WORKSPACES   where THIS machine's .ddcs lives            — the workspace IS the machine
 *   LIBRARY      where shareable SOURCES live (.wiz / .cam)  — things you hand to another person
 *   DEPLOY       where BAKED OUTPUT goes                     — things the CONTROLLER eats
 *
 * The headline case for this one is granting the USB STICK ITSELF, so a deploy writes straight onto the medium that
 * walks to the machine. That is why every baked output routes here instead of downloading: a download lands in
 * Downloads, and then a person has to find it, copy it to a stick, and remember which of the four similarly-named
 * files was the current one. Granting the stick removes all of that — the export IS the copy.
 *
 * ONE GLOBAL TARGET, not one per kind. A stick is a stick; asking "which folder for CAM, which for programs" would be
 * ceremony about a distinction the user does not have. Asked on first deploy, re-pickable any time from the Gateway's
 * files surface (the deploy home).
 *
 * SOURCES ARE NOT DEPLOYS. A .ddcs, a .wiz and a .cam keep their own folders — sharing a wizard with a friend and
 * loading a macro onto a controller are different acts, and merging them would put your shareable sources on a stick
 * you are about to hand to a machine.
 */
import { makeGrantedFolder } from './grantedFolder.js';

export const DEPLOY_KEY = 'deployFolder';

const folder = makeGrantedFolder({ key: DEPLOY_KEY, pickerId: 'ddcsDeploy', what: 'deploy' });

export const getDeployFolder = folder.get;
export const ensureDeployFolder = folder.ensure;
export const forgetDeployFolder = folder.forget;
export const deployReady = folder.ready;
export const listDeployFolder = folder.list;
export const deployFolderState = folder.state;   // t1263 — query-only state, safe outside a user gesture
export const hasFSA = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/**
 * DEPLOY a set of baked files to the target.
 *
 * @param {Array<{name:string, data:string|Uint8Array}>} files  names may declare subfolders ("CAM/macro_cam22.nc")
 * @param {{fallbackDownload?: (files) => void}} [opts]
 *   fallbackDownload — the TRUE no-File-System-Access path only. It is never used to paper over a DECLINED picker:
 *   a user who backs out of choosing a folder has said no, and turning that into a surprise download would be the
 *   app deciding it knew better. Declined = nothing written, nothing downloaded.
 * @returns {Promise<{ok:boolean, dir?:string, written:string[], failed:Array, aborted?:boolean, viaDownload?:boolean}>}
 */
export async function deployFiles(files, { fallbackDownload = null } = {}) {
    if (!hasFSA()) {
        if (fallbackDownload) { fallbackDownload(files); return { ok: true, written: files.map((f) => f.name), failed: [], viaDownload: true }; }
        return { ok: false, written: [], failed: [], error: 'this browser cannot write to a folder.' };
    }
    return folder.writeFiles(files);
}

/** What to show as the current target: the folder's name, or null when none is granted yet. */
export async function deployTargetName() {
    const d = await getDeployFolder();
    return d ? (d.name || 'deploy folder') : null;
}

/**
 * The sentence a deploy reports. Never the word "saved" (user ruling): saving is what you do to YOUR workspace, and
 * a deploy is a copy onto a medium for a machine — calling both "saved" is how people end up believing their work is
 * safe because a macro reached a stick.
 */
export function deployedMessage(r) {
    if (r.viaDownload) return `Downloaded ${r.written.length} file${r.written.length === 1 ? '' : 's'} — this browser cannot write to a folder, so there is no deploy target to write to.`;
    const n = r.written.length;
    const head = `Deployed ${n} file${n === 1 ? '' : 's'} to ${r.dir}`;
    const names = r.written.length <= 6 ? r.written.join(', ') : `${r.written.slice(0, 5).join(', ')} and ${r.written.length - 5} more`;
    if (!r.failed.length) return `${head}: ${names}.`;
    return `${head}: ${names}.\n\nCould not write ${r.failed.length}: ${r.failed.map((f) => `${f.name} (${f.why})`).join('; ')}`;
}

if (typeof window !== 'undefined') {
    window.ddcsDeploy = { deployFiles, getDeployFolder, ensureDeployFolder, forgetDeployFolder, deployTargetName, deployReady };
}
