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

        this.feedLines = null;
        this.rapidLines = null;
        this.probeLines = null;
        this._dataBounds = null;
        this._stock = null;
        this._machine = null;
        this.stockMesh = null;
        this.stockEdges = null;
        this.machineBox = null;

        // Spindle / program-zero position — the toolpath is offset by this, and you can
        // drag the marker in the 3D view to place a relative program over the stock.
        this.start = { x: 0, y: 0, z: 0 };
        this.pathGroup = new THREE.Group();
        this.scene.add(this.pathGroup);
        this.raycaster = new THREE.Raycaster();
        this.onStartChange = null; // optional callback(start)

        this._initStaticScene();
        this._initSpindle();
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

    _initSpindle() {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        // Ruby probe tip: a red sphere at the start point
        const ruby = new THREE.Mesh(
            new THREE.SphereGeometry(3, 20, 20),
            new THREE.MeshBasicMaterial({ color: 0xc4122e, depthTest: false })
        );
        ruby.renderOrder = 11;
        grp.add(ruby);
        // Three translate handles (X red, Y green, Z blue)
        this._axisMat = {};
        grp.add(this._makeAxisArrow(new THREE.Vector3(1, 0, 0), 0xff4d4d, 'x'));
        grp.add(this._makeAxisArrow(new THREE.Vector3(0, 1, 0), 0x4dff7a, 'y'));
        grp.add(this._makeAxisArrow(new THREE.Vector3(0, 0, 1), 0x4da6ff, 'z'));
        this.spindleMarker = grp;
        this.scene.add(grp);
    }

    _makeAxisArrow(dir, color, axisName) {
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
        g.traverse((o) => { o.renderOrder = 12; if (o.userData) o.userData.gizmoAxis = axisName; });
        this._axisMat[axisName] = { mat, base: color };
        return g;
    }

    // Highlight one axis handle (hover/active) — pass null to clear
    _setHighlight(axis) {
        if (this._hoverAxis === axis) return;
        this._hoverAxis = axis;
        const HL = 0xffe24a; // amber highlight
        for (const k of ['x', 'y', 'z']) {
            const h = this._axisMat && this._axisMat[k];
            if (h) h.mat.color.setHex(axis === k ? HL : h.base);
        }
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.cursor = axis ? 'grab' : 'default';
        }
        this.render();
    }

    // Position the toolpath group + spindle marker at the current start
    _applyStart() {
        const s = this.start;
        if (this.pathGroup) this.pathGroup.position.set(s.x, s.y, s.z);
        if (this.spindleMarker) this.spindleMarker.position.set(s.x, s.y, s.z);
        this._buildProbe(); // re-clamp G31 moves to the stock at the new start
        if (typeof this.onStartChange === 'function') this.onStartChange({ ...s });
    }

    setStart(x, y, z) {
        this.start.x = x; this.start.y = y;
        if (typeof z === 'number') this.start.z = z;
        this._applyStart();
        this.render();
    }

    _ndc(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return new this.THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -(((e.clientY - r.top) / r.height) * 2 - 1)
        );
    }

    // Returns the gizmo axis ('x'|'y'|'z') under the pointer, or null
    _pickGizmo(e) {
        if (!this.spindleMarker) return null;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        const hits = this.raycaster.intersectObject(this.spindleMarker, true);
        for (const h of hits) {
            let o = h.object;
            while (o && o !== this.spindleMarker) {
                if (o.userData && o.userData.gizmoAxis) return o.userData.gizmoAxis;
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
        const THREE = this.THREE;
        for (const key of ['feedLines', 'rapidLines']) {
            const obj = this[key];
            if (obj) {
                this.pathGroup.remove(obj);
                obj.geometry.dispose();
                obj.material.dispose();
                this[key] = null;
            }
        }

        const segs = (parsed && parsed.segments) || [];
        this._segs = segs;
        const b = parsed && parsed.bounds;
        const zMin = b ? b.minZ : 0;
        const zRange = b ? (b.maxZ - b.minZ) || 1 : 1;

        const feedPos = [], feedCol = [], rapidPos = [];
        const cLow = new THREE.Color(0x0a4fd0);   // deepest Z
        const cHigh = new THREE.Color(0x35ffd0);  // highest Z
        const tmp = new THREE.Color();

        for (const s of segs) {
            if (s.probe) continue; // probe lines are built + clamped to the stock in _buildProbe
            if (s.rapid) {
                rapidPos.push(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
            } else {
                feedPos.push(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
                tmp.copy(cLow).lerp(cHigh, (s.z1 - zMin) / zRange); feedCol.push(tmp.r, tmp.g, tmp.b);
                tmp.copy(cLow).lerp(cHigh, (s.z2 - zMin) / zRange); feedCol.push(tmp.r, tmp.g, tmp.b);
            }
        }

        if (feedPos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(feedPos, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(feedCol, 3));
            const mat = new THREE.LineBasicMaterial({ vertexColors: true });
            this.feedLines = new THREE.LineSegments(g, mat);
            this.pathGroup.add(this.feedLines);
        }
        if (rapidPos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(rapidPos, 3));
            const mat = new THREE.LineBasicMaterial({ color: 0x7a3030, transparent: true, opacity: 0.55 });
            this.rapidLines = new THREE.LineSegments(g, mat);
            this.pathGroup.add(this.rapidLines);
        }
        this._dataBounds = b || null;
        this._applyStart();
        this.fitAll();
    }

    // Build the probe (G31) lines, clamping each to where it first hits the stock
    // ("collision") at the current spindle start. Re-run on start / stock change.
    _buildProbe() {
        const THREE = this.THREE;
        if (this.probeLines) {
            this.pathGroup.remove(this.probeLines);
            this.probeLines.geometry.dispose();
            this.probeLines.material.dispose();
            this.probeLines = null;
        }
        if (!this._segs) return;
        const s = this.start;
        const st = this._stock;
        let box = null;
        if (st && st.show && st.x > 0 && st.y > 0 && st.z > 0) {
            box = { min: { x: 0, y: 0, z: -st.z }, max: { x: st.x, y: st.y, z: 0 } };
        }
        const pos = [];
        for (const seg of this._segs) {
            if (!seg.probe) continue;
            const A = { x: seg.x1, y: seg.y1, z: seg.z1 };       // program coords
            let B = { x: seg.x2, y: seg.y2, z: seg.z2 };
            if (box) {
                // collide in WORLD (program + start) vs the stock (program coords = world)
                const Aw = { x: A.x + s.x, y: A.y + s.y, z: A.z + s.z };
                const Bw = { x: B.x + s.x, y: B.y + s.y, z: B.z + s.z };
                const r = this._boxRange(Aw, Bw, box.min, box.max);
                if (r.hit) {
                    let t = null;
                    if (st.shape === 'pocket') {
                        // probe starts inside the cavity → stop at the inner wall (exit)
                        if (r.tEnter <= 1e-6 && r.tExit > 1e-6 && r.tExit < 1 - 1e-6) t = r.tExit;
                    } else {
                        // boss/block: probe from outside → stop at the outer wall (entry)
                        if (r.tEnter > 1e-6 && r.tEnter < 1 - 1e-6) t = r.tEnter;
                    }
                    if (t != null) B = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t };
                }
            }
            pos.push(A.x, A.y, A.z, B.x, B.y, B.z);
        }
        if (pos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            const mat = new THREE.LineBasicMaterial({ color: 0xffcc33 }); // probe (G31) = amber
            this.probeLines = new THREE.LineSegments(g, mat);
            this.pathGroup.add(this.probeLines);
        }
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
        if (d) {
            const sx = this.start.x, sy = this.start.y, sz = this.start.z;
            b = this._growBounds(b, d.minX + sx, d.minY + sy, d.minZ + sz, d.maxX + sx, d.maxY + sy, d.maxZ + sz);
        }
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
                this.start.x = this._dragStart0.x + this._dragDir.x * delta;
                this.start.y = this._dragStart0.y + this._dragDir.y * delta;
                this.start.z = this._dragStart0.z + this._dragDir.z * delta;
                this._applyStart();
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
            this._setHighlight(null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const axis = (e.button === 0 && !e.shiftKey) ? this._pickGizmo(e) : null;
            if (axis) {
                mode = 'gizmo';
                this._dragDir = axis === 'x' ? new THREE.Vector3(1, 0, 0)
                    : axis === 'y' ? new THREE.Vector3(0, 1, 0)
                    : new THREE.Vector3(0, 0, 1);
                this._dragStart0 = new THREE.Vector3(this.start.x, this.start.y, this.start.z);
                this.raycaster.setFromCamera(this._ndc(e), this.camera);
                this._dragT0 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
                this._setHighlight(axis);
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
            this._setHighlight(this._pickGizmo(e));
        });
        el.addEventListener('pointerleave', () => { if (!mode) this._setHighlight(null); });
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            // proportional zoom — the step scales with distance, so it eases/decelerates
            // as you approach the target (and is finer for trackpad pixel-scroll)
            this.radius *= Math.exp(e.deltaY * 0.0011);
            this.radius = Math.max(0.5, Math.min(5e5, this.radius));
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
