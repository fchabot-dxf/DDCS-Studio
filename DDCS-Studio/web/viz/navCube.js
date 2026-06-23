/**
 * viz/navCube.js — the interactive ViewCube (corner orientation cube).
 * Extracted from GcodeViz3D; every function takes the viz instance first.
 */
    // Interactive ViewCube: a small labelled cube in the corner that mirrors the camera
    // orientation; clicking a face snaps the main camera to that view.
export function initCube(viz) {
        const THREE = viz.THREE;
        viz._cubeScene = new THREE.Scene();
        viz._cubeCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        viz._cubeCam.up.set(0, 0, 1);
        // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
        const labels = ['RIGHT', 'LEFT', 'BACK', 'FRONT', 'TOP', 'BOTTOM'];
        viz._cubeViews = ['right', 'left', 'back', 'front', 'top', 'bottom'];
        const mats = labels.map((label) => {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const x = c.getContext('2d');
            x.fillStyle = '#cdd5df'; x.fillRect(0, 0, 128, 128);
            x.strokeStyle = '#7e8a9a'; x.lineWidth = 7; x.strokeRect(4, 4, 120, 120);
            x.fillStyle = '#2b3340'; x.font = 'bold 19px sans-serif';
            x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillText(label, 64, 66);
            return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
        });
        viz._cubeMats = mats; // kept for hover highlighting
        viz._cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
        viz._cubeScene.add(viz._cube);
        viz._cubeScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(viz._cube.geometry), new THREE.LineBasicMaterial({ color: 0x55606e })));
        viz._cubeScene.add(new THREE.AxesHelper(0.95));
    }

    // Hit-test a click against the ViewCube viewport; snaps the view if a face is hit.
    // Returns true when the click landed inside the cube box (so it shouldn't orbit).
    // Cube face material index under the cursor; -1 if in the cube region but off a face,
    // -2 if the cursor is outside the cube viewport.
export function cubeFaceAt(viz, e) {
        if (!viz._cubeScene || !viz._cubeRect) { viz._cubeHoverEvent = null; return -2; }
        const r = viz.renderer.domElement.getBoundingClientRect();
        const { size, m } = viz._cubeRect;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const left = r.width - size - m, top = m; // top-right corner
        if (cx < left || cx > left + size || cy < top || cy > top + size) { viz._cubeHoverEvent = null; return -2; }
        viz._cubeHoverEvent = e;   // stashed so highlightCubeFace can also preview the corner/edge under the cursor
        const ndc = new viz.THREE.Vector2(((cx - left) / size) * 2 - 1, -(((cy - top) / size) * 2 - 1));
        viz.raycaster.setFromCamera(ndc, viz._cubeCam);
        const hit = viz.raycaster.intersectObject(viz._cube, false)[0];
        return (hit && hit.face) ? hit.face.materialIndex : -1;
    }

    // Accent colour for the hover cues (corner chip + edge bar), matching the face-tint blue.
const CUBE_HL = 0x66aaff;

    // Lazily build the corner + edge hover cues once and park them in the cube scene (hidden).
    //   • corner cue = a small bright sphere sitting on the hovered vertex
    //   • edge cue   = a thin bright bar laid along the hovered edge (between its two vertices)
    // Both draw OVER the cube (depthTest off, high renderOrder) like the face tint, so they read as a glow.
function ensureCubeCues(viz) {
        if (viz._cubeCorner) return;
        const THREE = viz.THREE;
        const mat = () => new THREE.MeshBasicMaterial({ color: CUBE_HL, transparent: true, opacity: 0.85, depthTest: false });
        const corner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat());
        corner.renderOrder = 999; corner.visible = false;
        // A unit-length bar along +X (length 1 = the cube edge); reoriented/positioned per hovered edge.
        const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.12), mat());
        edge.renderOrder = 999; edge.visible = false;
        viz._cubeCorner = corner; viz._cubeEdge = edge;
        viz._cubeScene.add(corner); viz._cubeScene.add(edge);
    }

    // Position/orient the edge bar along the cube edge whose midpoint is CUBE_EDGES[i] (the bar's length runs
    // along the one axis that is zero in that midpoint vector).
function placeEdgeCue(viz, i) {
        const mid = CUBE_EDGES[i];
        const edge = viz._cubeEdge;
        edge.position.set(mid[0], mid[1], mid[2]);
        const runAxis = mid[0] === 0 ? 0 : (mid[1] === 0 ? 1 : 2);   // the zero component = the edge's long axis
        edge.rotation.set(0, 0, 0);
        if (runAxis === 1) edge.rotation.z = Math.PI / 2;            // bar (+X) → +Y
        else if (runAxis === 2) edge.rotation.y = Math.PI / 2;       // bar (+X) → +Z
    }

    // Hover feedback for the ViewCube. Mirrors the click priority (corner > edge > face) so the highlight previews
    // exactly what a click would select: a corner-hover shows the corner chip, an edge-hover shows the edge bar, a
    // mid-face hover tints the face. `idx` is the face material index under the cursor (cubeFaceAt) used as the
    // face-tint candidate; the stashed pointer event (viz._cubeHoverEvent) drives the corner/edge test. A missing
    // event (e.g. pointerleave / off-cube) clears everything. Re-renders only on a change.
export function highlightCubeFace(viz, idx) {
        if (!viz._cubeMats) return;
        ensureCubeCues(viz);
        const e = viz._cubeHoverEvent;
        // Corner > edge > face — same order as pickCube. Only meaningful while actually over the cube square.
        let corner = -1, edge = -1, face = -1;
        if (e) {
            corner = cubeCornerHit(viz, e);
            if (corner < 0) {
                edge = cubeEdgeHit(viz, e);
                if (edge < 0) face = idx;   // fall through to the face the raycast hit
            }
        }
        let changed = false;
        // Face tint (cleared whenever a corner/edge wins, or nothing is hovered).
        for (let i = 0; i < viz._cubeMats.length; i++) {
            const hex = i === face ? CUBE_HL : 0xffffff;
            if (viz._cubeMats[i].color.getHex() !== hex) { viz._cubeMats[i].color.setHex(hex); changed = true; }
        }
        // Corner chip.
        if (corner >= 0) {
            const c = CUBE_CORNERS[corner];
            if (!viz._cubeCorner.visible || viz._cubeCornerIdx !== corner) {
                viz._cubeCorner.position.set(c[0], c[1], c[2]);
                viz._cubeCorner.visible = true; viz._cubeCornerIdx = corner; changed = true;
            }
        } else if (viz._cubeCorner.visible) { viz._cubeCorner.visible = false; viz._cubeCornerIdx = -1; changed = true; }
        // Edge bar.
        if (edge >= 0) {
            if (!viz._cubeEdge.visible || viz._cubeEdgeIdx !== edge) {
                placeEdgeCue(viz, edge);
                viz._cubeEdge.visible = true; viz._cubeEdgeIdx = edge; changed = true;
            }
        } else if (viz._cubeEdge.visible) { viz._cubeEdge.visible = false; viz._cubeEdgeIdx = -1; changed = true; }
        if (changed) viz.render();
    }

    // Forgiving fallback: the cube viewport SQUARE has empty corners around the rotated box. Snap a near-miss
    // (cursor in the square but off the box silhouette) to the VISIBLE face whose projected centre is closest to
    // the cursor — so a click anywhere in the cube square picks a sensible view instead of doing nothing.
function nearestVisibleFace(viz, e) {
        if (!viz._cubeRect) return -1;
        const THREE = viz.THREE;
        const r = viz.renderer.domElement.getBoundingClientRect();
        const { size, m } = viz._cubeRect;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const left = r.width - size - m, top = m;
        const centers = [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]]; // +X -X +Y -Y +Z -Z
        const cam = viz._cubeCam.position;
        let best = -1, bestD = Infinity;
        for (let i = 0; i < 6; i++) {
            const c = centers[i];
            if (c[0] * cam.x + c[1] * cam.y + c[2] * cam.z <= 0) continue;   // back-facing → not clickable
            const v = new THREE.Vector3(c[0], c[1], c[2]).project(viz._cubeCam);
            const sx = left + (v.x * 0.5 + 0.5) * size, sy = top + (-v.y * 0.5 + 0.5) * size;
            const d = (sx - cx) ** 2 + (sy - cy) ** 2;
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    // The 8 cube CORNERS (3 non-zero, ±0.5 each axis) and 12 EDGE midpoints (exactly 2 non-zero, ±0.5; the third 0).
    // Clicking near a corner/edge orients the camera to look ALONG that direction (theta/phi of the point's vector):
    //   corner → 45° body-diagonal ISO view; edge → 45° view between the two adjacent faces.
    // Corners > edges > faces (Fusion/CAD nav-cube semantics) so the diagonal views are reachable from any view.
    // `cubeCornerHit`/`cubeEdgeHit` find the closest VISIBLE corner/edge near the cursor; `setCubeDir` applies it.
const CUBE_CORNERS = (() => {
        const out = [];
        for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) out.push([sx * 0.5, sy * 0.5, sz * 0.5]);
        return out;
    })();

    // 12 edge midpoints: pick the pair of axes that are non-zero, all four sign combinations.
const CUBE_EDGES = (() => {
        const out = [];
        for (const zero of [0, 1, 2]) {            // which axis is the zero (edge runs along it)
            for (const a of [0.5, -0.5]) for (const b of [0.5, -0.5]) {
                const v = [0, 0, 0];
                const axes = [0, 1, 2].filter((k) => k !== zero);
                v[axes[0]] = a; v[axes[1]] = b;
                out.push(v);
            }
        }
        return out;   // 3 axes × 4 sign combos = 12
    })();

    // Closest visible point (corner or edge midpoint) within a screen-pixel radius of the cursor, or -1.
    // Visible = the point's direction faces the cube cam. `pts` is the candidate list, `tol2` the px² hot-zone.
function closestVisiblePoint(viz, e, pts, tol2) {
        if (!viz._cubeScene || !viz._cubeRect) return -1;
        const THREE = viz.THREE;
        const r = viz.renderer.domElement.getBoundingClientRect();
        const { size, m } = viz._cubeRect;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const left = r.width - size - m, top = m;
        if (cx < left || cx > left + size || cy < top || cy > top + size) return -1;   // outside the cube square
        const cam = viz._cubeCam.position;
        let best = -1, bestD = tol2;
        for (let i = 0; i < pts.length; i++) {
            const c = pts[i];
            if (c[0] * cam.x + c[1] * cam.y + c[2] * cam.z <= 0) continue;   // point faces away from the cube cam
            const v = new THREE.Vector3(c[0], c[1], c[2]).project(viz._cubeCam);
            const sx = left + (v.x * 0.5 + 0.5) * size, sy = top + (-v.y * 0.5 + 0.5) * size;
            const d = (sx - cx) ** 2 + (sy - cy) ** 2;
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    // Tight hot-zones (px²) so a click in the middle of a face stays a FACE click: corners/edges only trigger right
    // at the projected vertex / edge-midpoint. Scaled with the cube size, clamped small.
function cornerTol2(size) { return Math.max(8, size * 0.11) ** 2; }
function edgeTol2(size) { return Math.max(8, size * 0.10) ** 2; }

function cubeCornerHit(viz, e) {
        if (!viz._cubeRect) return -1;
        return closestVisiblePoint(viz, e, CUBE_CORNERS, cornerTol2(viz._cubeRect.size));
    }
function cubeEdgeHit(viz, e) {
        if (!viz._cubeRect) return -1;
        return closestVisiblePoint(viz, e, CUBE_EDGES, edgeTol2(viz._cubeRect.size));
    }

    // Orient the main camera to look ALONG direction vector `dir` (sign vector → theta/phi), keeping target+radius.
    // GENERAL mapping: works for faces, edges (2 non-zero) and corners (3 non-zero) alike. Parallel (ortho) view.
export function setCubeDir(viz, dir) {
        const len = Math.hypot(dir[0], dir[1], dir[2]); if (!len) return;
        viz.theta = Math.atan2(dir[1], dir[0]);
        viz.phi = Math.acos(dir[2] / len);   // e.g. ≈54.7° from +Z for a body-diagonal iso, 45° for an edge with z≠0
        viz.camera = viz.ortho; viz._ortho = true;   // match face-view behaviour (parallel projection)
        viz._applyCamera();
        viz.render();
    }
export function setIsoCorner(viz, i) { setCubeDir(viz, CUBE_CORNERS[i]); }     // 45° body-diagonal iso view
export function setEdgeView(viz, i) { setCubeDir(viz, CUBE_EDGES[i]); }        // 45° between two adjacent faces
export function cubeCornerAt(viz, e) { return cubeCornerHit(viz, e); }
export function cubeEdgeAt(viz, e) { return cubeEdgeHit(viz, e); }

    // Hit-test a click against the ViewCube; snaps the view if a corner (iso) > edge (45°) > face is hit (or the
    // nearest face on a near-miss). Returns true when the click landed inside the cube viewport (so it shouldn't orbit).
export function pickCube(viz, e) {
        const corner = cubeCornerHit(viz, e);
        if (corner >= 0) { setIsoCorner(viz, corner); return true; }   // 3 non-zero → iso corner (highest priority)
        const edge = cubeEdgeHit(viz, e);
        if (edge >= 0) { setEdgeView(viz, edge); return true; }        // 2 non-zero → 45° edge view
        const idx = cubeFaceAt(viz, e);
        if (idx === -2) return false;                                // outside the cube square → orbit
        const face = idx >= 0 ? idx : nearestVisibleFace(viz, e);    // near-miss inside the square → nearest visible face
        if (face >= 0) { const v = viz._cubeViews[face]; if (v) viz.setView(v); }
        return true;
    }
