/**
 * viz/atcSetupCanvas.js — the ATC SETUP drag canvas (GUI-1).
 *
 * A 2D TOP-DOWN of the MACHINE FRAME (envelope + magazine + firmware push station) with draggable HANDLES, so the
 * operator can DRAG the taught points instead of typing machine coords. It reuses the wizard's FeatureCanvas (grid /
 * pan / zoom / drag hit-test) — here the "stock" rect is the machine envelope and the handles are ATC points, all in
 * raw MACHINE coords (placement = {0,0}). This is a visual PEER to the numeric magazine table: one source (settings.atc),
 * two views. It writes ONLY the DECLARED config — settings.atc.magazine (generic pockets), settings.atc.pickup (disk
 * pickup) and a NEW settings.atc.firmwareStation store (the firmware push points). SIM-SIDE ONLY — it never writes the
 * controller (the generic/disk coords are emitted as literals as they always were; the firmwareStation store only
 * var-seeds the preview so the station renders from the store instead of untaught-0). No push to the machine here.
 */
import { FeatureCanvas } from './featureCanvas.js';

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const numOr = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Sensible starting firmware-station points (machine coords) for an UNTAUGHT station — placed in the back area so
 *  they're on-canvas and draggable. NOT persisted until the user actually drags (the station is theirs to teach). */
export function defaultFirmwareStation(machine) {
    const X = numOr(machine && machine.x, 400), Y = numOr(machine && machine.y, 300);
    return {
        safeZ: numOr(machine && machine.z, -10),
        pushStart: { x: r1(X * 0.72), y: r1(Y * 0.82) },
        pushEnd: { x: r1(X * 0.88), y: r1(Y * 0.82) },
        retreat: { x: r1(X * 0.88), y: r1(Y * 0.64) },
    };
}

const FW_KEYS = { pushStart: 'PUSH START', pushEnd: 'PUSH END', retreat: 'RETREAT' };

/** (Re)draw the ATC setup canvas into `container`. Cheap to call on every change. onChange() (optional) fires on a
 *  DRAG END (persist + refresh the numeric table); the canvas redraws itself live during the drag. */
export function renderAtcSetupCanvas(container, { atc, machine, onChange } = {}) {
    if (!container || !atc) return null;
    const fc = container.__atcFc || (container.__atcFc = new FeatureCanvas());
    const mach = machine || {};

    const buildSpec = () => {
        const items = [];
        const handles = [];
        const isDisk = atc.magType === 'disk';

        if (isDisk) {
            // Disk: one draggable PICKUP + the carousel ring & pocket dots as (non-draggable) guides.
            const pk = atc.pickup || {};
            handles.push({ id: 'pickup', x: numOr(pk.x, 0), y: numOr(pk.y, 0), label: 'PICKUP', color: '#4ab3ff' });
            const R = numOr(atc.diskDia, 0) / 2;
            if (R > 0) {
                const dirs = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
                const o = dirs[atc.diskAxis] || dirs['+y'];   // pickup → carousel-centre direction (the ring guide)
                items.push({ kind: 'circle', cx: numOr(pk.x, 0) + R * o[0], cy: numOr(pk.y, 0) + R * o[1], r: R, cls: 'fc-guide' });
            }
        } else {
            // Straight/linear: one draggable handle per magazine pocket (writes settings.atc.magazine[i].x/y).
            (Array.isArray(atc.magazine) ? atc.magazine : []).forEach((p, i) => {
                if (!p) return;
                const tn = p.tool != null && p.tool !== '' ? ' · T' + p.tool : '';
                handles.push({ id: 'pocket:' + i, x: numOr(p.x, 0), y: numOr(p.y, 0), label: 'P' + (p.pocket != null ? p.pocket : i + 1) + tn, color: '#4ab3ff' });
            });
        }

        // Firmware push station — the 3 taught points (#1320/1321 → #1323/1324 → #1325/1326). Shown from the store when
        // taught, else at sensible defaults so they're draggable (the first drag persists the store). A dashed guide
        // traces the push stroke start → end → retreat so the station reads as a path, not 3 loose points.
        const fw = atc.firmwareStation || defaultFirmwareStation(mach);
        const pts = { pushStart: fw.pushStart || {}, pushEnd: fw.pushEnd || {}, retreat: fw.retreat || {} };
        const seg = (a, b) => items.push({ kind: 'line', x1: numOr(a.x, 0), y1: numOr(a.y, 0), x2: numOr(b.x, 0), y2: numOr(b.y, 0), cls: 'fc-guide' });
        seg(pts.pushStart, pts.pushEnd); seg(pts.pushEnd, pts.retreat);
        Object.keys(FW_KEYS).forEach((k) => handles.push({ id: 'fw:' + k, x: numOr(pts[k].x, 0), y: numOr(pts[k].y, 0), label: FW_KEYS[k], color: '#ffb454' }));

        return {
            stock: { ox: 0, oy: 0, w: numOr(mach.x, 400), h: numOr(mach.y, 300) },
            items,
            handles,
            onDrag: (id, w) => { writePoint(id, w); fc.render(container, buildSpec()); },   // live: move the config + redraw the handle
            onDragEnd: () => { if (onChange) onChange(); },                                  // persist + refresh the table
        };
    };

    // Map a handle drag (machine world coords) onto the matching DECLARED config / store field.
    const writePoint = (id, w) => {
        const x = r1(w.x), y = r1(w.y);
        if (id === 'pickup') { atc.pickup = atc.pickup || {}; atc.pickup.x = x; atc.pickup.y = y; return; }
        if (id.startsWith('pocket:')) { const i = Number(id.slice(7)); if (atc.magazine && atc.magazine[i]) { atc.magazine[i].x = x; atc.magazine[i].y = y; } return; }
        if (id.startsWith('fw:')) {
            const k = id.slice(3);
            if (!atc.firmwareStation) atc.firmwareStation = defaultFirmwareStation(mach);   // first firmware drag teaches all 3 from the shown defaults
            atc.firmwareStation[k] = { x, y };
        }
    };

    fc.render(container, buildSpec());
    container.__atcRender = () => fc.render(container, buildSpec());   // let the caller redraw after an external (table) edit
    return fc;
}
