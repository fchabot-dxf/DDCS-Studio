/**
 * DDCS Studio — 3D G-code toolpath viewer
 *
 * Renders parsed toolpath segments with three.js (loaded globally as
 * window.THREE so it survives the standalone bundler and works offline /
 * inside pywebview). CNC convention: Z is up.
 *   - Feed moves: bright, tinted by Z depth.
 *   - Rapid moves: dim red.
 * Controls: left-drag orbit · wheel zoom · right/shift-drag pan.
 *
 * The scene renders on demand (after data/camera/resize changes) — no animation
 * loop — so it costs nothing while idle or when the EDITOR tab is showing.
 */
export class GcodeViz3D {
    constructor(container) {
        const THREE = window.THREE;
        if (!THREE) throw new Error('three.js not loaded');
        this.THREE = THREE;
        this.container = container;
        this.active = false;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05070a);
        this.scene = scene;

        const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1e6);
        camera.up.set(0, 0, 1); // Z up
        this.persp = camera;
        const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e6, 1e6);
        ortho.up.set(0, 0, 1);
        this.ortho = ortho;
        this._ortho = false;
        this.camera = camera; // active camera — perspective normally, parallel on ViewCube faces

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        container.appendChild(renderer.domElement);
        this.renderer = renderer;

        // Orbit state (Z-up spherical around target)
        this.target = new THREE.Vector3(0, 0, 0);
        this.radius = 200;
        this.theta = -Math.PI / 2;  // azimuth in XY (front view: +X right, +Y back)
        this.phi = Math.PI / 3;     // polar from +Z

        this.lineGroups = {};      // type -> LineSegments (world coords)
        this._dataBounds = null;
        this._stock = null;
        this._machine = null;
        this.stockMesh = null;
        this.stockEdges = null;
        this.machineBox = null;
        this._segs = [];
        this._passCount = 1;

        // One draggable start (ruby + X/Y/Z gizmo) per pass. Each manual REPOSITION in the
        // macro begins a new pass, placed relative to its own start so you can park it.
        this.starts = [{ x: 0, y: 0, z: 0 }];
        this.spindleMarkers = [];
        this._axisMat = {};        // `${pass}:${axis}` -> { mat, base }
        this.pathGroup = new THREE.Group();
        this.scene.add(this.pathGroup);
        this.raycaster = new THREE.Raycaster();
        this.onStartChange = null; // optional callback(starts)
        this.showRapids = true;
        this._animOn = true;   // play by default
        this._animPaused = false;
        this._gizmoPx = 60;    // on-screen gizmo size (smaller still in the compact wizard preview)
        this._animRaf = null;
        this._animDist = 0;
        this._animLast = 0;
        this._animPts = [];
        this._animLen = 0;

        this._setupJogPendant();
        this._initStaticScene();
        this._initCube();
        this._bindControls();
        this._applyCamera();

        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(container);
        this._resize();
    }

    _initStaticScene() {
        const THREE = this.THREE;
        const grid = new THREE.GridHelper(200, 20, 0x2a4866, 0x16242f);
        grid.rotation.x = Math.PI / 2; // GridHelper is XZ by default → lay it in XY (Z up)
        this.grid = grid;
        this.scene.add(grid);
        const axes = new THREE.AxesHelper(25); // X red, Y green, Z blue
        this.axes = axes;
        this.scene.add(axes);
        // Direction labels on the grid edges (repositioned to the footprint in setSegments)
        this._gridLabels = {
            xp: this._makeTextSprite('+X'), xn: this._makeTextSprite('-X'),
            yp: this._makeTextSprite('+Y'), yn: this._makeTextSprite('-Y'),
        };
        for (const k in this._gridLabels) this.scene.add(this._gridLabels[k]);
    }

    _makeTextSprite(text) {
        const THREE = this.THREE;
        const c = document.createElement('canvas');
        c.width = 128; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#7fa8cc';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 36);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
        sp.renderOrder = 1;
        return sp;
    }

    // Interactive ViewCube: a small labelled cube in the corner that mirrors the camera
    // orientation; clicking a face snaps the main camera to that view.
    _initCube() {
        const THREE = this.THREE;
        this._cubeScene = new THREE.Scene();
        this._cubeCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        this._cubeCam.up.set(0, 0, 1);
        // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
        const labels = ['RIGHT', 'LEFT', 'BACK', 'FRONT', 'TOP', 'BOTTOM'];
        this._cubeViews = ['right', 'left', 'back', 'front', 'top', 'bottom'];
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
        this._cubeMats = mats; // kept for hover highlighting
        this._cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
        this._cubeScene.add(this._cube);
        this._cubeScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(this._cube.geometry), new THREE.LineBasicMaterial({ color: 0x55606e })));
        this._cubeScene.add(new THREE.AxesHelper(0.95));
    }

    // Hit-test a click against the ViewCube viewport; snaps the view if a face is hit.
    // Returns true when the click landed inside the cube box (so it shouldn't orbit).
    // Cube face material index under the cursor; -1 if in the cube region but off a face,
    // -2 if the cursor is outside the cube viewport.
    _cubeFaceAt(e) {
        if (!this._cubeScene || !this._cubeRect) return -2;
        const r = this.renderer.domElement.getBoundingClientRect();
        const { size, m } = this._cubeRect;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const left = r.width - size - m, top = m; // top-right corner
        if (cx < left || cx > left + size || cy < top || cy > top + size) return -2;
        const ndc = new this.THREE.Vector2(((cx - left) / size) * 2 - 1, -(((cy - top) / size) * 2 - 1));
        this.raycaster.setFromCamera(ndc, this._cubeCam);
        const hit = this.raycaster.intersectObject(this._cube, false)[0];
        return (hit && hit.face) ? hit.face.materialIndex : -1;
    }

    // Tint the hovered cube face (idx 0-5); idx < 0 clears. Re-renders only on a change.
    _highlightCubeFace(idx) {
        if (!this._cubeMats) return;
        let changed = false;
        for (let i = 0; i < this._cubeMats.length; i++) {
            const hex = i === idx ? 0x66aaff : 0xffffff;
            if (this._cubeMats[i].color.getHex() !== hex) { this._cubeMats[i].color.setHex(hex); changed = true; }
        }
        if (changed) this.render();
    }

    // Hit-test a click against the ViewCube; snaps the view if a face is hit.
    // Returns true when the click landed inside the cube viewport (so it shouldn't orbit).
    _pickCube(e) {
        const idx = this._cubeFaceAt(e);
        if (idx === -2) return false;
        if (idx >= 0) { const v = this._cubeViews[idx]; if (v) this.setView(v); }
        return true;
    }

    // A draggable start marker for one pass: ruby probe tip
    _makeMarker(pass) {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        const ruby = new THREE.Mesh(
            new THREE.SphereGeometry(3, 20, 20),
            new THREE.MeshBasicMaterial({ color: 0xc4122e, depthTest: false })
        );
        ruby.renderOrder = 11;
        grp.add(ruby);
        grp.add(this._makeNumberSprite(pass + 1)); // execution order (1-based)
        return grp;
    }

    // A camera-facing numbered badge floating above the ruby (order of execution)
    _makeNumberSprite(n) {
        const THREE = this.THREE;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.beginPath(); ctx.arc(32, 32, 29, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(18,18,22,0.88)'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), 32, 35);
        const tex = new THREE.CanvasTexture(c);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        sp.scale.set(11, 11, 1);
        sp.position.set(0, 0, 11); // float just above the ruby
        sp.renderOrder = 13;
        return sp;
    }

    _setupJogPendant() {
        const div = document.createElement('div');
        div.className = 'viz3d-jog-pendant';
        div.style.cssText = 'background: rgba(18, 18, 22, 0.95); border-top: 1px solid rgba(255,255,255,0.08); padding: 8px 12px 12px; color: #fff; z-index: 100; font-size: 11px; display: none; user-select: none; width: 100%; box-sizing: border-box;';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 0 4px;">
                <span style="font-weight: bold; color: #aaa; letter-spacing: 1px;">JOG START</span>
                <span style="display: flex; gap: 8px; align-items: center; color: #888;">
                    Step:
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="0.1"> 0.1</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="1" checked> 1.0</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="10"> 10</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="100"> 100</label>
                </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 32px 32px; gap: 6px;">
                <button class="toolbar-btn" data-axis="x" data-dir="-1" style="font-weight:bold; padding:0;">X-</button>
                <button class="toolbar-btn" data-axis="y" data-dir="1" style="font-weight:bold; padding:0;">Y+</button>
                <button class="toolbar-btn" data-axis="z" data-dir="1" style="font-weight:bold; padding:0;">Z+</button>
                <button class="toolbar-btn" data-axis="x" data-dir="1" style="font-weight:bold; padding:0;">X+</button>
                <button class="toolbar-btn" data-axis="y" data-dir="-1" style="font-weight:bold; padding:0;">Y-</button>
                <button class="toolbar-btn" data-axis="z" data-dir="-1" style="font-weight:bold; padding:0;">Z-</button>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
                <button class="toolbar-btn" data-axis="xy" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555;" title="Reset X/Y to 0">0 XY</button>
                <button class="toolbar-btn" data-axis="z" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555;" title="Reset Z to 0">0 Z</button>
            </div>
        `;
        this.container.appendChild(div);
        this.jogPendant = div;
        
        // Prevent touches on the jog panel from rotating the view
        div.addEventListener('pointerdown', e => e.stopPropagation());
        
        div.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const axis = btn.getAttribute('data-axis');
                const dir = parseFloat(btn.getAttribute('data-dir'));
                const stepInput = div.querySelector('input[type="radio"]:checked');
                const step = stepInput ? parseFloat(stepInput.value) : 1;
                
                if (this.starts && this.starts.length > 0) {
                    const s = this.starts[0]; // Jog the primary start position
                    if (axis === 'x') s.x += dir * step;
                    if (axis === 'y') s.y += dir * step;
                    if (axis === 'z') s.z += dir * step;
                    if (axis === 'xy' && dir === 0) { s.x = 0; s.y = 0; }
                    if (axis === 'z' && dir === 0) { s.z = 0; }
                    
                    this._positionMarkers();
                    this._rebuild();
                    this.render();
                    if (typeof this.onStartChange === 'function') this.onStartChange(this.starts);
                }
            });
        });
    }

    // Recreate markers only when the pass count changes
    _ensureMarkers() {
        if (this.spindleMarkers.length === this._passCount) return;
        for (const m of this.spindleMarkers) this.scene.remove(m);
        this.spindleMarkers = [];
        this._hoverKey = undefined;
        for (let p = 0; p < this._passCount; p++) {
            const m = this._makeMarker(p);
            this.spindleMarkers.push(m);
            this.scene.add(m);
        }
    }

    _positionMarkers() {
        for (let p = 0; p < this.spindleMarkers.length; p++) {
            const s = this.starts[p] || { x: 0, y: 0, z: 0 };
            this.spindleMarkers[p].position.set(s.x, s.y, s.z);
        }
    }

    // Keep each gizmo a constant on-screen size (independent of zoom): world size ∝ the
    // world-per-pixel at the marker (camera distance for perspective, frustum for ortho).
    _scaleMarkers() {
        if (!this.spindleMarkers.length) return;
        const H = this.container.clientHeight || 1;
        const targetPx = this._gizmoPx || 90, base = 26; // base = the arrow length at scale 1
        const ortho = this.camera.isOrthographicCamera;
        const tanHalf = Math.tan((this.persp.fov * Math.PI / 180) / 2);
        for (const m of this.spindleMarkers) {
            const worldPerPx = ortho
                ? (this.camera.top - this.camera.bottom) / H
                : (2 * this.camera.position.distanceTo(m.position) * tanHalf) / H;
            m.scale.setScalar(Math.max(1e-4, (targetPx * worldPerPx) / base));
        }
        if (this.jogPendant) {
            this.jogPendant.style.display = (this.starts && this.starts.length > 0) ? 'block' : 'none';
        }
    }

    // Set a pass's start programmatically (pass defaults to 0)
    setStart(x, y, z, pass) {
        const p = pass | 0;
        if (!this.starts[p]) this.starts[p] = { x: 0, y: 0, z: 0 };
        this.starts[p].x = x; this.starts[p].y = y;
        if (typeof z === 'number') this.starts[p].z = z;
        this._rebuild();
        this.render();
        if (typeof this.onStartChange === 'function') this.onStartChange(this.starts);
    }

    setShowRapids(on) {
        this.showRapids = !!on;
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.render();
    }

    // Snap the camera to a standard view (keeps the current target + radius)
    setView(name) {
        const H = Math.PI / 2;
        const views = {
            top: [-H, 0], bottom: [-H, Math.PI], front: [-H, H], back: [H, H],
            right: [0, H], left: [Math.PI, H], iso: [Math.PI / 4, Math.PI / 3],
        };
        const v = views[name] || views.iso;
        this.theta = v[0];
        this.phi = v[1];
        this.camera = this.ortho; this._ortho = true; // standard views are parallel/orthographic
        this._applyCamera();
        this.render();
    }


    _ensureAnimTool() {
        if (this._animTool) return;
        const THREE = this.THREE;
        this._animTool = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
        );
        this._animTool.renderOrder = 25; // above the toolpath (20) so the dot stays visible
        this._animTool.visible = false;
        this.scene.add(this._animTool);
    }

    // Toggle a tool dot that travels the whole path in execution order (~5s loop)
    setAnimate(on) {
        this._animOn = !!on;
        this._ensureAnimTool();
        this._animTool.visible = this._animOn;
        if (this._animOn) {
            this._animDist = 0;
            this._animLast = 0;
            if (!this._animRaf) this._animTick();
        } else {
            if (this._animRaf) cancelAnimationFrame(this._animRaf);
            this._animRaf = null;
            this.render();
        }
    }

    // Called by execution engine to update tool position during execution
    setToolPosition(pos) {
        if (!pos || (!Number.isFinite(pos.x) && !Number.isFinite(pos.y) && !Number.isFinite(pos.z))) return;
        this._ensureAnimTool();
        this._animTool.visible = true;
        this._animTool.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
        this.render();
    }

    _animTick() {
        if (!this._animOn || !this.active) { this._animRaf = null; return; }
        const pts = this._animPts;
        if (pts && pts.length >= 6) {
            const now = (typeof performance !== 'undefined' ? performance.now() : 0);
            const dt = this._animLast ? Math.min(0.1, (now - this._animLast) / 1000) : 0;
            this._animLast = now;
            const total = this._animLen || 1;
            if (!this._animPaused) {
                this._animDist += (total / 5) * dt; // whole path ~5s
                if (this._animDist >= total) {       // reached the end → hold 1s + beep, then loop
                    this._animDist = total;
                    this._animPaused = true;
                    this._beep();
                    setTimeout(() => { this._animDist = 0; this._animPaused = false; this._animLast = 0; }, 1000);
                }
            }
            let d = Math.min(this._animDist, total);
            for (let i = 0; i + 5 < pts.length; i += 3) {
                const ax = pts[i], ay = pts[i + 1], az = pts[i + 2];
                const bx = pts[i + 3], by = pts[i + 4], bz = pts[i + 5];
                const segLen = Math.hypot(bx - ax, by - ay, bz - az);
                if (d <= segLen || i + 6 >= pts.length) {
                    const t = segLen > 0 ? d / segLen : 0;
                    this._animTool.position.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
                    break;
                }
                d -= segLen;
            }
            this.render();
        }
        this._animRaf = requestAnimationFrame(() => this._animTick());
    }

    // Short beep at the end of each animation loop (Web Audio; silent until a user gesture)
    _beep() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (!this._audio) this._audio = new Ctx();
            const ctx = this._audio;
            if (ctx.state === 'suspended') ctx.resume();
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'square'; o.frequency.value = 880;
            g.gain.value = 0.04;
            o.connect(g); g.connect(ctx.destination);
            o.start(); o.stop(ctx.currentTime + 0.12);
        } catch (_) { /* ignore */ }
    }

    _ndc(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return new this.THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -(((e.clientY - r.top) / r.height) * 2 - 1)
        );
    }

    // Disabled gizmo picking
    _pickGizmo(e) {
        return null;
    }

    // t along axisDir (unit) from lineOrigin to the point closest to the pointer ray
    _closestAxisT(ray, lineOrigin, axisDir) {
        const d = axisDir.dot(w0);
        const e = ray.direction.dot(w0);
        const denom = c - b * b; // a = axisDir·axisDir = 1
        if (Math.abs(denom) < 1e-9) return 0;
        return (b * e - c * d) / denom;
    }

    setSegments(parsed) {
        this._segs = (parsed && parsed.segments) || [];
        this._passCount = Math.max(1, (parsed && parsed.stats && parsed.stats.passes) || 1);
        // one draggable start per pass (keep existing positions; new passes default to origin)
        while (this.starts.length < this._passCount) this.starts.push({ x: 0, y: 0, z: 0 });
        this.starts.length = this._passCount;
        this._ensureMarkers();
        this._rebuild();
        this.fitAll();
    }

    // Walk each pass, clamping probes to the stock so they stop at the wall instead of
    // running the full search distance (which would drift the path off into space).
    // Emits world-coordinate line groups (one per move type) and positions the markers.
    _rebuild() {
        const THREE = this.THREE;
        for (const k in this.lineGroups) {
            const o = this.lineGroups[k];
            if (o) { this.pathGroup.remove(o); o.geometry.dispose(); o.material.dispose(); }
        }
        this.lineGroups = {};

        const st = this._stock;
        const pocket = !!(st && st.shape === 'pocket');
        let box = null;
        if (st && st.show && st.x > 0 && st.y > 0 && st.z > 0) {
            if (pocket) {
                // probe cavity = the inset hole (matches the rendered pocket)
                const w = Math.max(8, Math.min(st.x, st.y) * 0.25);
                box = { min: { x: w, y: w, z: -st.z }, max: { x: st.x - w, y: st.y - w, z: 0 } };
            } else {
                box = { min: { x: 0, y: 0, z: -st.z }, max: { x: st.x, y: st.y, z: 0 } };
            }
        }
        const CAP = 20; // fallback probe length when it never contacts the stock

        const byPass = [];
        for (const s of this._segs) { const p = s.pass | 0; (byPass[p] || (byPass[p] = [])).push(s); }

        const feedPos = [], rapidPos = [], retractPos = [], probeFastPos = [], probeSlowPos = [], jogPos = [];
        // The highest probe feed = fast approach; anything slower = the precise re-probe.
        let maxProbeFeed = 0;
        for (const s of this._segs) { if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed; }
        const animPts = []; // ordered world points along the whole path (for the play animation)
        const pushPt = (x, y, z) => {
            const n = animPts.length;
            if (n >= 3 && animPts[n - 3] === x && animPts[n - 2] === y && animPts[n - 1] === z) return;
            animPts.push(x, y, z);
        };
        let bounds = null;
        const grow = (x, y, z) => { bounds = this._growBounds(bounds, x, y, z, x, y, z); };

        let prevEnd = null;
        for (let p = 0; p < this._passCount; p++) {
            const segs = byPass[p] || [];
            const mk = this.starts[p] || { x: 0, y: 0, z: 0 };
            // manual jog from the previous pass's end to this pass's start marker
            if (prevEnd) { jogPos.push(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z); grow(prevEnd.x, prevEnd.y, prevEnd.z); grow(mk.x, mk.y, mk.z); pushPt(prevEnd.x, prevEnd.y, prevEnd.z); pushPt(mk.x, mk.y, mk.z); }
            let cur = { x: 0, y: 0, z: 0 }; // pass-local, relative to the marker
            for (const s of segs) {
                const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
                const type = s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
                const start = cur;
                let end = { x: start.x + dx, y: start.y + dy, z: start.z + dz };

                // Probe collision with stock bounds
                if (type === 'probe' && box) {
                    const Aw = { x: start.x + mk.x, y: start.y + mk.y, z: start.z + mk.z };
                    const Bw = { x: end.x + mk.x, y: end.y + mk.y, z: end.z + mk.z };
                    const r = this._boxRange(Aw, Bw, box.min, box.max);
                    if (r.hit) {
                        let tt = null;
                        if (pocket) { if (r.tEnter <= 1e-6 && r.tExit > 1e-6 && r.tExit < 1 - 1e-6) tt = r.tExit; }
                        else { if (r.tEnter > 1e-6 && r.tEnter < 1 - 1e-6) tt = r.tEnter; }
                        if (tt != null) { end = { x: start.x + dx * tt, y: start.y + dy * tt, z: start.z + dz * tt }; }
                    }
                }

                const ax = start.x + mk.x, ay = start.y + mk.y, az = start.z + mk.z;
                const bx = end.x + mk.x, by = end.y + mk.y, bz = end.z + mk.z;
                grow(ax, ay, az); grow(bx, by, bz);
                const arr = type === 'rapid' ? rapidPos
                    : type === 'retract' ? retractPos
                    : type === 'probe' ? (((s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed) ? probeSlowPos : probeFastPos)
                    : feedPos;
                arr.push(ax, ay, az, bx, by, bz);
                pushPt(ax, ay, az); pushPt(bx, by, bz);
                cur = end;
            }
            prevEnd = { x: cur.x + mk.x, y: cur.y + mk.y, z: cur.z + mk.z };
        }

        // Ordered path + total length for the play animation
        this._animPts = animPts;
        let alen = 0;
        for (let i = 0; i + 5 < animPts.length; i += 3) alen += Math.hypot(animPts[i + 3] - animPts[i], animPts[i + 4] - animPts[i + 1], animPts[i + 5] - animPts[i + 2]);
        this._animLen = alen;

        // Cuts: blue→cyan gradient by depth across the whole scene
        let feedCol = null;
        if (feedPos.length) {
            const zMin = bounds ? bounds.minZ : 0, zRange = bounds ? (bounds.maxZ - bounds.minZ) || 1 : 1;
            const cLow = new THREE.Color(0x0a4fd0), cHigh = new THREE.Color(0x35ffd0), tmp = new THREE.Color();
            feedCol = [];
            for (let i = 0; i < feedPos.length; i += 3) { tmp.copy(cLow).lerp(cHigh, (feedPos[i + 2] - zMin) / zRange); feedCol.push(tmp.r, tmp.g, tmp.b); }
        }
        // Colours match the wizard visualiser
        this.lineGroups.feed = this._addLine(feedPos, { vertexColors: feedCol });
        this.lineGroups.rapid = this._addLine(rapidPos, { color: 0x00cc00, opacity: 0.55 });
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.lineGroups.retract = this._addLine(retractPos, { color: 0xfacc15, opacity: 0.85 });
        this.lineGroups.probe = this._addLine(probeFastPos, { color: 0x3b82f6 });      // fast probe (blue)
        this.lineGroups.probeSlow = this._addLine(probeSlowPos, { color: 0x93c5fd });  // slow re-probe (light blue)
        this.lineGroups.jog = this._addLine(jogPos, { color: 0xff9a0d, opacity: 0.95, dashed: true });

        this._positionMarkers();
        this._dataBounds = bounds;
    }

    // Build a LineSegments from a flat positions array; null if empty.
    _addLine(pos, opt) {
        if (!pos || !pos.length) return null;
        const THREE = this.THREE;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        let mat;
        if (opt.vertexColors) {
            g.setAttribute('color', new THREE.Float32BufferAttribute(opt.vertexColors, 3));
            mat = new THREE.LineBasicMaterial({ vertexColors: true });
        } else if (opt.dashed) {
            mat = new THREE.LineDashedMaterial({ color: opt.color, transparent: opt.opacity < 1, opacity: opt.opacity, dashSize: 3, gapSize: 2 });
        } else {
            const op = opt.opacity != null ? opt.opacity : 1;
            mat = new THREE.LineBasicMaterial({ color: opt.color, transparent: op < 1, opacity: op });
        }
        mat.depthTest = false;            // draw the toolpath on top of the gizmo / stock
        const lines = new THREE.LineSegments(g, mat);
        lines.renderOrder = 20;           // above the gizmo (11–13); the anim tool (25) stays on top
        if (opt.dashed) lines.computeLineDistances();
        this.pathGroup.add(lines);
        return lines;
    }

    // Parametric range [tEnter, tExit] where the line A→B crosses an axis-aligned box.
    _boxRange(A, B, boxMin, boxMax) {
        const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
        let tEnter = -Infinity, tExit = Infinity;
        for (const ax of ['x', 'y', 'z']) {
            if (Math.abs(d[ax]) < 1e-9) {
                if (A[ax] < boxMin[ax] - 1e-6 || A[ax] > boxMax[ax] + 1e-6) return { hit: false };
            } else {
                let t1 = (boxMin[ax] - A[ax]) / d[ax];
                let t2 = (boxMax[ax] - A[ax]) / d[ax];
                if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
                if (t1 > tEnter) tEnter = t1;
                if (t2 < tExit) tExit = t2;
            }
        }
        return { hit: tEnter <= tExit, tEnter, tExit };
    }

    fit(b) {
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        this.target.set(cx, cy, cz);

        const sx = b.maxX - b.minX, sy = b.maxY - b.minY, sz = b.maxZ - b.minZ;
        const radius = Math.max(1, 0.5 * Math.hypot(sx, sy, sz));
        const fov = this.camera.fov * Math.PI / 180;
        this.radius = (radius / Math.sin(fov / 2)) * 1.25;
        // Start orientation from the saved JSON settings (defaults to the front view)
        const sv = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().view) || {};
        this.theta = (typeof sv.theta === 'number') ? sv.theta : -Math.PI / 2;
        this.phi = (typeof sv.phi === 'number') ? sv.phi : Math.PI / 3;

        // Rescale the floor grid to roughly match the part footprint
        const span = Math.max(sx, sy, 10);
        if (this.grid) {
            this.grid.scale.setScalar(span / 200);
            this.grid.position.set(cx, cy, b.minZ);
        }
        if (this.axes) this.axes.scale.setScalar(Math.max(1, span / 200));
        if (this._gridLabels) {
            const half = span / 2, off = span * 0.07, lw = span * 0.14, z = b.minZ;
            const L = this._gridLabels;
            L.xp.position.set(cx + half + off, cy, z); L.xn.position.set(cx - half - off, cy, z);
            L.yp.position.set(cx, cy + half + off, z); L.yn.position.set(cx, cy - half - off, z);
            for (const k in L) L[k].scale.set(lw, lw / 2, 1);
        }

        this._applyCamera();
    }

    _growBounds(b, x0, y0, z0, x1, y1, z1) {
        if (!b) return { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 };
        b.minX = Math.min(b.minX, x0); b.minY = Math.min(b.minY, y0); b.minZ = Math.min(b.minZ, z0);
        b.maxX = Math.max(b.maxX, x1); b.maxY = Math.max(b.maxY, y1); b.maxZ = Math.max(b.maxZ, z1);
        return b;
    }

    // Frame the union of toolpath + stock + machine envelope (whichever are present)
    fitAll() {
        let b = null;
        const d = this._dataBounds;
        if (d) b = this._growBounds(b, d.minX, d.minY, d.minZ, d.maxX, d.maxY, d.maxZ);
        const s = this._stock;
        if (s && s.show && s.x > 0 && s.y > 0 && s.z > 0) b = this._growBounds(b, 0, 0, -s.z, s.x, s.y, 0);
        const m = this._machine;
        if (m && m.show && m.x > 0 && m.y > 0 && m.z > 0) {
            const ox = m.ox || 0, oy = m.oy || 0, oz = m.oz || 0;
            b = this._growBounds(b, -ox, -oy, -oz, m.x - ox, m.y - oy, m.z - oz);
        }
        if (b) this.fit(b);
        this.render();
    }

    // Translucent stock block — WCS zero at the top, min XY corner: X[0..x] Y[0..y] Z[-z..0]
    setStock(stock) {
        const THREE = this.THREE;
        this._stock = stock || null;
        if (this.stockMesh) { this.scene.remove(this.stockMesh); this.stockMesh.geometry.dispose(); this.stockMesh.material.dispose(); this.stockMesh = null; }
        if (this.stockEdges) { this.scene.remove(this.stockEdges); this.stockEdges.geometry.dispose(); this.stockEdges.material.dispose(); this.stockEdges = null; }
        if (stock && stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0) {
            const pocket = stock.shape === 'pocket';
            const fillCol = pocket ? 0x6a8fbe : 0x8fae6a;  // pocket = blue, boss = green
            const edgeCol = pocket ? 0x86b6ff : 0xa6d77c;
            let geo;
            const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.12, depthWrite: false });
            const mesh = new THREE.Mesh();
            if (pocket) {
                // Square donut: a frame of material around the cavity. The cavity (the hole,
                // = stock X×Y) is the probe area; the frame walls are the surrounding stock.
                // Outer block = the stock dimensions (same as a boss); the cavity is inset by w.
                const w = Math.max(8, Math.min(stock.x, stock.y) * 0.25); // wall thickness (cavity inset)
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(stock.x, 0);
                shape.lineTo(stock.x, stock.y);
                shape.lineTo(0, stock.y);
                shape.lineTo(0, 0);
                const hole = new THREE.Path();
                hole.moveTo(w, w); hole.lineTo(stock.x - w, w); hole.lineTo(stock.x - w, stock.y - w); hole.lineTo(w, stock.y - w); hole.lineTo(w, w);
                shape.holes.push(hole);
                geo = new THREE.ExtrudeGeometry(shape, { depth: stock.z, bevelEnabled: false });
                mesh.position.set(0, 0, -stock.z); // extrude [0,z] → world [-z,0], top at the table
            } else {
                geo = new THREE.BoxGeometry(stock.x, stock.y, stock.z);
                mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
            }
            mesh.geometry = geo;
            mesh.material = mat;
            this.stockMesh = mesh; this.scene.add(mesh);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.55 }));
            edges.position.copy(mesh.position);
            this.stockEdges = edges; this.scene.add(edges);
        }
    }

    // Tool Setter Block
    setProbes(probes) {
        const THREE = this.THREE;
        if (this.setterMesh) { this.scene.remove(this.setterMesh); this.setterMesh.geometry.dispose(); this.setterMesh.material.dispose(); this.setterMesh = null; }
        if (this.setterEdges) { this.scene.remove(this.setterEdges); this.setterEdges.geometry.dispose(); this.setterEdges.material.dispose(); this.setterEdges = null; }
        if (probes && probes.setterW > 0 && probes.setterH > 0) {
            const fillCol = 0xff00ff; // Magenta
            const edgeCol = 0xff66ff;
            const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.25, depthWrite: false });
            // Cylinder: radiusTop, radiusBottom, height, radialSegments
            // Rotate it so it points up along Z axis
            const geo = new THREE.CylinderGeometry(probes.setterW / 2, probes.setterW / 2, probes.setterH, 16);
            geo.rotateX(Math.PI / 2); // align with Z axis
            const mesh = new THREE.Mesh(geo, mat);
            // Center is at X, Y, Z - H/2 (since setterZ is the top surface)
            mesh.position.set(probes.setterX, probes.setterY, probes.setterZ - (probes.setterH / 2));
            this.setterMesh = mesh; this.scene.add(mesh);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.6 }));
            edges.position.copy(mesh.position);
            this.setterEdges = edges; this.scene.add(edges);
        }
    }

    // Wireframe machine envelope — origin = program-zero offset from the envelope's min corner
    setMachine(machine) {
        const THREE = this.THREE;
        this._machine = machine || null;
        if (this.machineBox) { this.scene.remove(this.machineBox); this.machineBox.geometry.dispose(); this.machineBox.material.dispose(); this.machineBox = null; }
        if (machine && machine.show && machine.x > 0 && machine.y > 0 && machine.z > 0) {
            const src = new THREE.BoxGeometry(machine.x, machine.y, machine.z);
            const eg = new THREE.EdgesGeometry(src);
            src.dispose();
            const box = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6c7a8c, transparent: true, opacity: 0.4 }));
            const ox = machine.ox || 0, oy = machine.oy || 0, oz = machine.oz || 0;
            box.position.set(machine.x / 2 - ox, machine.y / 2 - oy, machine.z / 2 - oz);
            this.machineBox = box; this.scene.add(box);
        }
    }

    // Re-pivot the orbit on the point under the cursor (the stock surface if hovered,
    // otherwise the point at that screen location on the focus plane). Camera stays put.
    _setPivotFromCursor(e) {
        const THREE = this.THREE;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        let pivot = null;
        if (this.stockMesh) {
            const hit = this.raycaster.intersectObject(this.stockMesh, false)[0];
            if (hit) pivot = hit.point.clone();
        }
        if (!pivot) {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const plane = new THREE.Plane(camDir, -camDir.dot(this.target));
            const pt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, pt)) pivot = pt;
        }
        if (!pivot) return;
        const off = this.camera.position.clone().sub(pivot);
        this.radius = Math.max(1, off.length());
        this.phi = Math.acos(Math.max(-1, Math.min(1, off.z / this.radius)));
        this.theta = Math.atan2(off.y, off.x);
        this.target.copy(pivot);
    }

    _applyCamera() {
        this.phi = Math.max(0.0005, Math.min(Math.PI - 0.0005, this.phi));
        const sinPhi = Math.sin(this.phi);
        const x = this.radius * sinPhi * Math.cos(this.theta);
        const y = this.radius * sinPhi * Math.sin(this.theta);
        const z = this.radius * Math.cos(this.phi);
        // Up tangent to the meridian: identical to Z-up away from the poles, but stays valid AT
        // a pole, so a true top/bottom view has no gimbal tilt (stock top/bottom edges align).
        this.camera.up.set(-Math.cos(this.phi) * Math.cos(this.theta), -Math.cos(this.phi) * Math.sin(this.theta), sinPhi);
        this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
        this.camera.lookAt(this.target);
        if (this.camera.isOrthographicCamera) {
            // match the perspective framing at the target distance, so zoom (radius) still works
            const halfH = this.radius * Math.tan((this.persp.fov * Math.PI / 180) / 2);
            const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
            this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
            this.camera.top = halfH; this.camera.bottom = -halfH;
            this.camera.updateProjectionMatrix();
        }
        this.camera.updateMatrixWorld();
    }

    _toPerspective() {
        if (!this._ortho) return;
        this._ortho = false;
        this.camera = this.persp;
        this._applyCamera();
    }

    _bindControls() {
        const THREE = this.THREE;
        const el = this.renderer.domElement;
        el.style.touchAction = 'none';   // stop the browser turning a drag into scroll / "look"
        el.style.userSelect = 'none';
        let mode = null, px = 0, py = 0;
        const pointers = new Map(); // active pointers — two fingers = pinch zoom/pan (mobile)

        const onMove = (e) => {
            if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (mode === 'pinch') {
                if (pointers.size < 2) return;
                const pts = [...pointers.values()];
                const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
                const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
                this.radius = Math.max(0.5, Math.min(5e5, this._pinchRadius * (this._pinchDist / d)));
                const pdx = mx - this._pinchMid.x, pdy = my - this._pinchMid.y;
                this._pinchMid = { x: mx, y: my };
                const ps = this.radius * 0.0015;
                const r0 = new THREE.Vector3(), u0 = new THREE.Vector3();
                this.camera.matrixWorld.extractBasis(r0, u0, new THREE.Vector3());
                this.target.addScaledVector(r0, -pdx * ps);
                this.target.addScaledVector(u0, pdy * ps);
                this._applyCamera(); this.render();
                return;
            }
            if (mode === 'gizmo') {
                this.raycaster.setFromCamera(this._ndc(e), this.camera);
                const t1 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
                const delta = t1 - this._dragT0;
                const s = this.starts[this._dragPass] || (this.starts[this._dragPass] = { x: 0, y: 0, z: 0 });
                s.x = this._dragStart0.x + this._dragDir.x * delta;
                s.y = this._dragStart0.y + this._dragDir.y * delta;
                s.z = this._dragStart0.z + this._dragDir.z * delta;
                this._rebuild();
                this.render();
                return;
            }
            const dx = e.clientX - px, dy = e.clientY - py;
            px = e.clientX; py = e.clientY;
            if (mode === 'rot') {
                this.theta -= dx * 0.01;
                this.phi -= dy * 0.01;
            } else if (mode === 'pan') {
                const panScale = this.radius * 0.0015;
                const right = new THREE.Vector3(), up = new THREE.Vector3();
                this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
                this.target.addScaledVector(right, -dx * panScale);
                this.target.addScaledVector(up, dy * panScale);
            } else { return; }
            this._applyCamera();
            this.render();
        };
        const onUp = (e) => {
            if (e) pointers.delete(e.pointerId);
            if (mode === 'pinch' && pointers.size < 2) mode = null;
            if (pointers.size > 0) return;   // other fingers still down
            if (mode === 'gizmo' && typeof this.onStartChange === 'function') {
                this.onStartChange(this.starts);
            }
            mode = null;
            try { if (this._pid != null) el.releasePointerCapture(this._pid); } catch (_) {}
            this._pid = null;
            if (this.renderer) this.renderer.domElement.style.cursor = 'default';
            this._setHighlight(null, null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {   // second finger → pinch zoom + pan
                const pts = [...pointers.values()];
                this._pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
                this._pinchRadius = this.radius;
                this._pinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
                mode = 'pinch'; this._toPerspective();
                return;
            }
            if (pointers.size > 2) return;
            if (e.button === 0 && this._pickCube(e)) { pointers.delete(e.pointerId); return; } // ViewCube click → snap view
            const g = (e.button === 0 && !e.shiftKey) ? this._pickGizmo(e) : null;
            if (g) {
                mode = 'gizmo';
                this._dragPass = g.pass;
                this._dragDir = g.axis === 'x' ? new THREE.Vector3(1, 0, 0)
                    : g.axis === 'y' ? new THREE.Vector3(0, 1, 0)
                    : new THREE.Vector3(0, 0, 1);
                const s = this.starts[g.pass] || { x: 0, y: 0, z: 0 };
                this._dragStart0 = new THREE.Vector3(s.x, s.y, s.z);
                this.raycaster.setFromCamera(this._ndc(e), this.camera);
                this._dragT0 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
                this._setHighlight(g.pass, g.axis);
                this.renderer.domElement.style.cursor = 'grabbing';
            } else {
                mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
                if (mode === 'rot') this._toPerspective(); // orbit around the framed centre (predictable); pan to recentre
            }
            px = e.clientX; py = e.clientY;
            if (e.pointerType !== 'touch') { try { el.setPointerCapture(e.pointerId); this._pid = e.pointerId; } catch (_) {} }
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
        el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // no page scroll on touch-drag
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no middle-click autoscroll
        // Hover feedback: highlight the ViewCube face or the axis handle under the cursor
        el.addEventListener('pointermove', (e) => {
            if (mode) return;
            const faceIdx = this._cubeFaceAt(e);
            if (faceIdx !== -2) { // over the ViewCube
                this._highlightCubeFace(faceIdx);
                el.style.cursor = faceIdx >= 0 ? 'pointer' : 'default';
                this._setHighlight(null, null);
                return;
            }
            this._highlightCubeFace(-1);
            const g = this._pickGizmo(e);
            this._setHighlight(g ? g.pass : null, g ? g.axis : null);
        });
        el.addEventListener('pointerleave', () => { if (!mode) { this._setHighlight(null, null); this._highlightCubeFace(-1); } });
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const old = this.radius;
            const next = Math.max(0.5, Math.min(5e5, old * Math.exp(e.deltaY * 0.002)));
            // Dolly toward the actual geometry under the cursor (stock / toolpath) so the zoom
            // keeps closing in on the part itself. Over empty space, just zoom the current
            // centre — never drift toward an empty point (which feels like it stalls).
            this.raycaster.setFromCamera(this._ndc(e), this.camera);
            this.raycaster.params.Line.threshold = old * 0.02;
            const objs = [];
            if (this.stockMesh) objs.push(this.stockMesh);
            if (this.pathGroup) objs.push(this.pathGroup);
            const hit = objs.length ? this.raycaster.intersectObjects(objs, true)[0] : null;
            if (hit) this.target.lerp(hit.point, 1 - next / old);
            this.radius = next;
            this._applyCamera();
            this.render();
        }, { passive: false });
    }

    _resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        this.persp.aspect = w / h;
        this.persp.updateProjectionMatrix();
        this._applyCamera(); // re-derives the ortho frustum when it's the active camera
        this.render();
    }

    // Called when the 3D tab becomes visible — the container had zero size while
    // hidden, so re-measure and re-render.
    // Re-parent the viewer's canvas into another container (used for the wizard previews).
    attach(container) {
        if (!container) return;
        const cv = this.renderer.domElement;
        container.style.position = 'relative';
        cv.style.position = 'absolute';
        cv.style.inset = '0';
        cv.style.zIndex = '2';
        if (this.container !== container) {
            this.container = container;
            container.appendChild(cv);
            if (this._ro) { this._ro.disconnect(); this._ro.observe(container); }
        }
        
        // Move jog pendant
        if (this.jogPendant) {
            const wizBody = container.closest('.wiz-body');
            if (wizBody) {
                const legend = wizBody.querySelector('.viz-legend');
                if (legend) {
                    legend.insertAdjacentElement('afterend', this.jogPendant);
                } else {
                    wizBody.appendChild(this.jogPendant);
                }
            } else {
                container.appendChild(this.jogPendant);
            }
        }
        
        this._resize();
    }

    setActive(on) {
        this.active = on;
        if (on) {
            this._resize();
            if (this._animOn) {
                this._ensureAnimTool();
                this._animTool.visible = true;
                if (!this._animRaf) { this._animLast = 0; this._animTick(); }
            }
        } else if (this._animRaf) {
            cancelAnimationFrame(this._animRaf);
            this._animRaf = null;
        }
    }

    render() {
        const r = this.renderer;
        const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
        this._scaleMarkers();
        r.setScissorTest(false);
        r.setViewport(0, 0, w, h);
        r.render(this.scene, this.camera);
        if (this._cubeScene) {
            const size = Math.max(64, Math.min(96, w * 0.16)), m = 10;
            const sp = Math.sin(this.phi);
            this._cubeCam.position.set(sp * Math.cos(this.theta), sp * Math.sin(this.theta), Math.cos(this.phi)).multiplyScalar(3.4);
            this._cubeCam.lookAt(0, 0, 0);
            this._cubeCam.updateMatrixWorld();
            const vx = w - size - m, vy = h - size - m; // top-right (gl viewport y is from the bottom)
            r.setViewport(vx, vy, size, size);
            r.setScissor(vx, vy, size, size);
            r.setScissorTest(true);
            r.autoClear = false;  // float the cube over the scene (no opaque background box)
            r.clearDepth();       // but draw it on top
            r.render(this._cubeScene, this._cubeCam);
            r.autoClear = true;
            r.setScissorTest(false);
            r.setViewport(0, 0, w, h);
            this._cubeRect = { size, m };
        }
    }

    dispose() {
        if (this._ro) this._ro.disconnect();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}
