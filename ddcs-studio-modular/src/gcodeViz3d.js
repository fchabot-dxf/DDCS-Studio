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
        // Cone body pointing down, tip at the start point (z = 0 of the group)
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(4, 16, 18),
            new THREE.MeshBasicMaterial({ color: 0xff5577, transparent: true, opacity: 0.85, depthTest: false })
        );
        cone.rotation.x = Math.PI / 2; // +Y apex → -Z (downward)
        cone.position.set(0, 0, 8);    // apex at z = 0, base at z = 16
        cone.renderOrder = 10;
        grp.add(cone);
        const tip = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 14, 14),
            new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
        );
        tip.renderOrder = 11;
        grp.add(tip);
        this.spindleMarker = grp;
        this.scene.add(grp);
    }

    // Position the toolpath group + spindle marker at the current start
    _applyStart() {
        const s = this.start;
        if (this.pathGroup) this.pathGroup.position.set(s.x, s.y, s.z);
        if (this.spindleMarker) this.spindleMarker.position.set(s.x, s.y, s.z);
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

    // Is the pointer over the spindle marker?
    _pickSpindle(e) {
        if (!this.spindleMarker) return false;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        return this.raycaster.intersectObject(this.spindleMarker, true).length > 0;
    }

    setSegments(parsed) {
        const THREE = this.THREE;
        for (const key of ['feedLines', 'rapidLines', 'probeLines']) {
            const obj = this[key];
            if (obj) {
                this.pathGroup.remove(obj);
                obj.geometry.dispose();
                obj.material.dispose();
                this[key] = null;
            }
        }

        const segs = (parsed && parsed.segments) || [];
        const b = parsed && parsed.bounds;
        const zMin = b ? b.minZ : 0;
        const zRange = b ? (b.maxZ - b.minZ) || 1 : 1;

        const feedPos = [], feedCol = [], rapidPos = [], probePos = [];
        const cLow = new THREE.Color(0x0a4fd0);   // deepest Z
        const cHigh = new THREE.Color(0x35ffd0);  // highest Z
        const tmp = new THREE.Color();

        for (const s of segs) {
            if (s.probe) {
                probePos.push(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
            } else if (s.rapid) {
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
        if (probePos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(probePos, 3));
            const mat = new THREE.LineBasicMaterial({ color: 0xffcc33 }); // probe (G31) = amber
            this.probeLines = new THREE.LineSegments(g, mat);
            this.pathGroup.add(this.probeLines);
        }

        this._dataBounds = b || null;
        this._applyStart();
        this.fitAll();
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
            const geo = new THREE.BoxGeometry(stock.x, stock.y, stock.z);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x8fae6a, transparent: true, opacity: 0.12, depthWrite: false }));
            mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
            this.stockMesh = mesh; this.scene.add(mesh);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xa6d77c, transparent: true, opacity: 0.55 }));
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
            if (mode === 'spindle') {
                this.raycaster.setFromCamera(this._ndc(e), this.camera);
                const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.start.z);
                const pt = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(plane, pt)) {
                    this.start.x = pt.x; this.start.y = pt.y;
                    this._applyStart();
                    this.render();
                }
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
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (e.button !== 2 && !e.shiftKey && this._pickSpindle(e)) mode = 'spindle';
            else mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
            px = e.clientX; py = e.clientY;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.radius *= (e.deltaY > 0 ? 1.1 : 0.9);
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
