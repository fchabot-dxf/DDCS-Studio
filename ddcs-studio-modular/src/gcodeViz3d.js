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
        this.camera = camera;

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
        this.theta = Math.PI / 4;   // azimuth in XY
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

        this._initStaticScene();
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
    }

    // A draggable start marker for one pass: ruby probe tip + X/Y/Z translate gizmo
    _makeMarker(pass) {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        const ruby = new THREE.Mesh(
            new THREE.SphereGeometry(3, 20, 20),
            new THREE.MeshBasicMaterial({ color: 0xc4122e, depthTest: false })
        );
        ruby.renderOrder = 11;
        grp.add(ruby);
        grp.add(this._makeAxisArrow(new THREE.Vector3(1, 0, 0), 0xff4d4d, 'x', pass));
        grp.add(this._makeAxisArrow(new THREE.Vector3(0, 1, 0), 0x4dff7a, 'y', pass));
        grp.add(this._makeAxisArrow(new THREE.Vector3(0, 0, 1), 0x4da6ff, 'z', pass));
        return grp;
    }

    _makeAxisArrow(dir, color, axisName, pass) {
        const THREE = this.THREE;
        const len = 26, headLen = 7, shaftR = 1.0, headR = 2.8;
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, len - headLen, 10), mat);
        shaft.position.y = (len - headLen) / 2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(headR, headLen, 12), mat);
        head.position.y = len - headLen / 2;
        g.add(shaft); g.add(head);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); // orient +Y → dir
        g.traverse((o) => { o.renderOrder = 12; if (o.userData) { o.userData.gizmoAxis = axisName; o.userData.gizmoPass = pass; } });
        this._axisMat[pass + ':' + axisName] = { mat, base: color };
        return g;
    }

    // Recreate markers only when the pass count changes
    _ensureMarkers() {
        if (this.spindleMarkers.length === this._passCount) return;
        for (const m of this.spindleMarkers) this.scene.remove(m);
        this.spindleMarkers = [];
        this._axisMat = {};
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

    // Highlight one axis handle (hover/active) — pass (null, null) to clear
    _setHighlight(pass, axis) {
        const key = (pass != null && axis) ? pass + ':' + axis : null;
        if (this._hoverKey === key) return;
        this._hoverKey = key;
        const HL = 0xffe24a; // amber highlight
        for (const k in this._axisMat) {
            const h = this._axisMat[k];
            if (h) h.mat.color.setHex(k === key ? HL : h.base);
        }
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.cursor = key ? 'grab' : 'default';
        }
        this.render();
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

    _ndc(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return new this.THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -(((e.clientY - r.top) / r.height) * 2 - 1)
        );
    }

    // Returns { pass, axis } of the gizmo handle under the pointer, or null
    _pickGizmo(e) {
        if (!this.spindleMarkers.length) return null;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        const hits = this.raycaster.intersectObjects(this.spindleMarkers, true);
        for (const h of hits) {
            let o = h.object;
            while (o) {
                if (o.userData && o.userData.gizmoAxis) return { pass: o.userData.gizmoPass | 0, axis: o.userData.gizmoAxis };
                o = o.parent;
            }
        }
        return null;
    }

    // t along axisDir (unit) from lineOrigin to the point closest to the pointer ray
    _closestAxisT(ray, lineOrigin, axisDir) {
        const w0 = lineOrigin.clone().sub(ray.origin);
        const b = axisDir.dot(ray.direction);
        const c = ray.direction.dot(ray.direction);
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
        const box = (st && st.show && st.x > 0 && st.y > 0 && st.z > 0)
            ? { min: { x: 0, y: 0, z: -st.z }, max: { x: st.x, y: st.y, z: 0 } } : null;
        const pocket = !!(st && st.shape === 'pocket');
        const CAP = 20; // fallback probe length when it never contacts the stock

        const byPass = [];
        for (const s of this._segs) { const p = s.pass | 0; (byPass[p] || (byPass[p] = [])).push(s); }

        const feedPos = [], rapidPos = [], retractPos = [], probePos = [], jogPos = [];
        let bounds = null;
        const grow = (x, y, z) => { bounds = this._growBounds(bounds, x, y, z, x, y, z); };

        let prevEnd = null;
        for (let p = 0; p < this._passCount; p++) {
            const segs = byPass[p] || [];
            const mk = this.starts[p] || { x: 0, y: 0, z: 0 };
            // manual jog from the previous pass's end to this pass's start marker
            if (prevEnd) { jogPos.push(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z); grow(prevEnd.x, prevEnd.y, prevEnd.z); grow(mk.x, mk.y, mk.z); }
            let cur = { x: 0, y: 0, z: 0 }; // pass-local, relative to the marker
            for (const s of segs) {
                const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
                const type = s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
                const start = cur;
                let end = { x: start.x + dx, y: start.y + dy, z: start.z + dz };
                if (type === 'probe') {
                    let hit = false;
                    if (box) {
                        const Aw = { x: start.x + mk.x, y: start.y + mk.y, z: start.z + mk.z };
                        const Bw = { x: end.x + mk.x, y: end.y + mk.y, z: end.z + mk.z };
                        const r = this._boxRange(Aw, Bw, box.min, box.max);
                        if (r.hit) {
                            let tt = null;
                            if (pocket) { if (r.tEnter <= 1e-6 && r.tExit > 1e-6 && r.tExit < 1 - 1e-6) tt = r.tExit; }
                            else { if (r.tEnter > 1e-6 && r.tEnter < 1 - 1e-6) tt = r.tEnter; }
                            if (tt != null) { end = { x: start.x + dx * tt, y: start.y + dy * tt, z: start.z + dz * tt }; hit = true; }
                        }
                    }
                    if (!hit) { // no contact → cap so the path can't run away
                        const len = Math.hypot(dx, dy, dz) || 1;
                        const f = Math.min(1, CAP / len);
                        end = { x: start.x + dx * f, y: start.y + dy * f, z: start.z + dz * f };
                    }
                }
                const ax = start.x + mk.x, ay = start.y + mk.y, az = start.z + mk.z;
                const bx = end.x + mk.x, by = end.y + mk.y, bz = end.z + mk.z;
                grow(ax, ay, az); grow(bx, by, bz);
                const arr = type === 'rapid' ? rapidPos : type === 'retract' ? retractPos : type === 'probe' ? probePos : feedPos;
                arr.push(ax, ay, az, bx, by, bz);
                cur = end;
            }
            prevEnd = { x: cur.x + mk.x, y: cur.y + mk.y, z: cur.z + mk.z };
        }

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
        this.lineGroups.probe = this._addLine(probePos, { color: 0x3b82f6 });
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
        const lines = new THREE.LineSegments(g, mat);
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
        this.theta = Math.PI / 4;
        this.phi = Math.PI / 3;

        // Rescale the floor grid to roughly match the part footprint
        const span = Math.max(sx, sy, 10);
        if (this.grid) {
            this.grid.scale.setScalar(span / 200);
            this.grid.position.set(cx, cy, b.minZ);
        }
        if (this.axes) this.axes.scale.setScalar(Math.max(1, span / 200));

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
                const w = Math.max(8, Math.min(stock.x, stock.y) * 0.25); // frame wall thickness (visual)
                const shape = new THREE.Shape();
                shape.moveTo(-w, -w);
                shape.lineTo(stock.x + w, -w);
                shape.lineTo(stock.x + w, stock.y + w);
                shape.lineTo(-w, stock.y + w);
                shape.lineTo(-w, -w);
                const hole = new THREE.Path();
                hole.moveTo(0, 0); hole.lineTo(stock.x, 0); hole.lineTo(stock.x, stock.y); hole.lineTo(0, stock.y); hole.lineTo(0, 0);
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

    _applyCamera() {
        this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi));
        const sinPhi = Math.sin(this.phi);
        const x = this.radius * sinPhi * Math.cos(this.theta);
        const y = this.radius * sinPhi * Math.sin(this.theta);
        const z = this.radius * Math.cos(this.phi);
        this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }

    _bindControls() {
        const THREE = this.THREE;
        const el = this.renderer.domElement;
        let mode = null, px = 0, py = 0;

        const onMove = (e) => {
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
            }
            this._applyCamera();
            this.render();
        };
        const onUp = () => {
            mode = null;
            if (this.renderer) this.renderer.domElement.style.cursor = 'default';
            this._setHighlight(null, null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
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
            }
            px = e.clientX; py = e.clientY;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no middle-click autoscroll
        // Hover feedback: highlight the axis handle under the cursor when not dragging
        el.addEventListener('pointermove', (e) => {
            if (mode) return;
            const g = this._pickGizmo(e);
            this._setHighlight(g ? g.pass : null, g ? g.axis : null);
        });
        el.addEventListener('pointerleave', () => { if (!mode) this._setHighlight(null, null); });
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const old = this.radius;
            const next = Math.max(1, Math.min(5e5, old * Math.exp(e.deltaY * 0.0015)));
            // Zoom toward the point under the cursor (dolly-to-cursor) — homes in on what
            // you're looking at, so it doesn't feel slow/wonky around a fixed centre.
            this.raycaster.setFromCamera(this._ndc(e), this.camera);
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const plane = new THREE.Plane(camDir, -camDir.dot(this.target));
            const cursorPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, cursorPt)) {
                this.target.lerp(cursorPt, 1 - next / old);
            }
            this.radius = next;
            this._applyCamera();
            this.render();
        }, { passive: false });
    }

    _resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.render();
    }

    // Called when the 3D tab becomes visible — the container had zero size while
    // hidden, so re-measure and re-render.
    setActive(on) {
        this.active = on;
        if (on) this._resize();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this._ro) this._ro.disconnect();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}
