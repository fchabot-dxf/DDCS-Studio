/**
 * data/controllerFiles.js — the per-controller FILE-TREE DECLARATION (t662, E1). Each controller DECLARES its baseline
 * file tree so the Macros tab renders THAT controller's structure ALWAYS (offline included — the tree makes the
 * controller's structure explicit and editable). This is pure, dumb data (declare-not-hand-roll): the Macros tab reads
 * it to build the sidebar; it never reverse-engineers structure from machine state.
 *
 * A file entry is one of:
 *   { path, title, sub, panel }            — WRAPS an existing Studio builder/editor panel (Expert keeps its surfaces:
 *                                             O100nn M-codes, K-buttons, CAM pack, the autostart boot generator). The
 *                                             panel id is an existing #macros_panel_* — behaviour is byte-identical.
 *   { path, title, sub, editable, seed }    — a PLAIN file: opens in the generalized simple editor; the body is stored
 *                                             IN THE PROFILE (settings.workspace[path]); seed:true → first-open body
 *                                             comes from data/controllerFileSeeds where we have a dump copy, else empty.
 * A group is { group:'NAME/', children:[…] } and may nest.
 *
 * transport: 'lan'  → files push to the controller (the existing writeSysfile gateway flow, per file).
 *            'export'→ no LAN (DM500): files EXPORT (download / save-as) for USB transfer.
 *
 * Keyed by CONTROLLER id (getActiveProfile().id — ddcs-expert-m350 / ddcs-v41 / ddcs-v3-dm500), NOT the dialect/post id.
 * File sets grounded in the repo dumps: Expert SYSDISK (bridge/controllers/expert-m350/…/SYSDISK), V4.1 firmware set
 * (bridge/controllers/v4.1/assets/firmware/…/ddcsv4), DM500 install set (bridge/controllers/dm500/install).
 */

export const CONTROLLER_FILES = {
    // Expert — the fully-supported controller. Its entries WRAP today's builder/editor panels (no regression). Its boot
    // file is sysstart.nc (the autostart generator writes it); its macro library is slib-m.nc; tool change is T.nc.
    'ddcs-expert-m350': {
        transport: 'lan',
        tree: [
            { group: 'SYSDISK/', children: [
                { path: 'slib-m.nc',      title: 'slib-m.nc',      sub: 'Custom M-codes',    panel: 'macros_panel_mcode' },
                { path: 'sysstart.nc',    title: 'sysstart.nc',    sub: 'Boot initialization', panel: 'macros_panel_sysstart' },
                { path: 'T.nc',           title: 'T.nc',           sub: 'Tool change hook',  panel: 'macros_panel_tnc' },
                { path: 'error.nc',       title: 'error.nc',       sub: 'Alarm / fault hook', panel: 'macros_panel_error' },
                { path: 'probe.nc',       title: 'probe.nc',       sub: 'Native probing',    panel: 'macros_panel_probe' },
                { path: 'key-N.nc',       title: 'key-N.nc',       sub: 'K-buttons',         panel: 'macros_panel_kbtn' },
                // t2118 -- flattened out of a CAM/ group: camN.nc lives at the SYSDISK root (t2117's own
                // rename), and the 2026-07-31 capture confirms the real controller's files sit flat there too.
                { path: 'camN.nc', title: 'camN.nc', sub: 'CAM Pack Builder', panel: 'macros_panel_cam' },
            ] },
        ],
    },
    // V4.1 — LAN. Fixed firmware files + the advanced-start boot (wraps the autostart generator, which already targets
    // advstart.nc on V4.1). NO custom-M-code / K-button / CAM machinery (the V4.1 fact) — the rest are plain editors.
    'ddcs-v41': {
        transport: 'lan',
        tree: [
            { group: 'SYSDISK/', children: [
                { path: 'advstart.nc',   title: 'advstart.nc',   sub: 'Advanced start (boot)', panel: 'macros_panel_sysstart' },
                { path: 'M6.rc',         title: 'M6.rc',         sub: 'Tool-change dialog',   editable: true, seed: true },
                { path: 'selcoord.nc',   title: 'selcoord.nc',   sub: 'WCS-select dialog',    editable: true, seed: true },
                { path: 'probe-fix.nc',  title: 'probe-fix.nc',  sub: 'Fixed-position probe', editable: true, seed: true },
                { path: 'gotoz.nc',      title: 'gotoz.nc',      sub: 'Go to Z zero',         editable: true, seed: true },
                { path: 'safez.nc',      title: 'safez.nc',      sub: 'Safe-Z retract',       editable: true, seed: true },
                { path: 'pause.nc',      title: 'pause.nc',      sub: 'Pause / park hook',    editable: true, seed: true },
                { path: 'slib-m.nc',     title: 'slib-m.nc',     sub: 'M-macro library',      editable: true, seed: true },
            ] },
        ],
    },
    // DM500 — NO LAN (export-for-USB). Its install set; plain editors. `tc` in the dump is a language dictionary
    // (NOT tool-change) so it isn't a macro file here; tool change lives in slib.nc O-subprograms.
    'ddcs-v3-dm500': {
        transport: 'export',
        tree: [
            { group: 'INSTALL/', children: [
                { path: 'probe.nc',    title: 'probe.nc',    sub: 'Probing macro',              editable: true, seed: true },
                { path: 'defprobe.nc', title: 'defprobe.nc', sub: 'Probe/plate define (G92)',   editable: true, seed: true },
                { path: 'slib.nc',     title: 'slib.nc',     sub: 'Canned-cycle library',       editable: true, seed: true },
                { path: 'safez.nc',    title: 'safez.nc',    sub: 'Safe-Z retract',             editable: true, seed: true },
                { path: 'gotoz.nc',    title: 'gotoz.nc',    sub: 'Go to Z zero',               editable: true, seed: true },
                { path: 'pause.nc',    title: 'pause.nc',    sub: 'Pause hook',                 editable: true, seed: true },
            ] },
        ],
    },
    // Unknown controller — no declared baseline tree; the tab shows an explain-state (the user adds files in E3).
    'generic': { transport: 'export', tree: [] },
};

/** The declaration for a controller id (falls back to a plain empty export tree). */
export function fileTreeFor(controllerId) {
    return CONTROLLER_FILES[controllerId] || CONTROLLER_FILES.generic;
}

/** Flatten a controller's tree to its leaf file entries (in declared order). */
export function flattenFiles(controllerId) {
    const out = [];
    const walk = (nodes) => nodes.forEach((n) => { if (n.group) walk(n.children || []); else out.push(n); });
    walk(fileTreeFor(controllerId).tree || []);
    return out;
}
