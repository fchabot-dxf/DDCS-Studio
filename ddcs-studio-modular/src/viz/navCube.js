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
        if (!viz._cubeScene || !viz._cubeRect) return -2;
        const r = viz.renderer.domElement.getBoundingClientRect();
        const { size, m } = viz._cubeRect;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const left = r.width - size - m, top = m; // top-right corner
        if (cx < left || cx > left + size || cy < top || cy > top + size) return -2;
        const ndc = new viz.THREE.Vector2(((cx - left) / size) * 2 - 1, -(((cy - top) / size) * 2 - 1));
        viz.raycaster.setFromCamera(ndc, viz._cubeCam);
        const hit = viz.raycaster.intersectObject(viz._cube, false)[0];
        return (hit && hit.face) ? hit.face.materialIndex : -1;
    }

    // Tint the hovered cube face (idx 0-5); idx < 0 clears. Re-renders only on a change.
export function highlightCubeFace(viz, idx) {
        if (!viz._cubeMats) return;
        let changed = false;
        for (let i = 0; i < viz._cubeMats.length; i++) {
            const hex = i === idx ? 0x66aaff : 0xffffff;
            if (viz._cubeMats[i].color.getHex() !== hex) { viz._cubeMats[i].color.setHex(hex); changed = true; }
        }
        if (changed) viz.render();
    }

    // Hit-test a click against the ViewCube; snaps the view if a face is hit.
    // Returns true when the click landed inside the cube viewport (so it shouldn't orbit).
export function pickCube(viz, e) {
        const idx = cubeFaceAt(viz, e);
        if (idx === -2) return false;
        if (idx >= 0) { const v = viz._cubeViews[idx]; if (v) viz.setView(v); }
        return true;
    }
