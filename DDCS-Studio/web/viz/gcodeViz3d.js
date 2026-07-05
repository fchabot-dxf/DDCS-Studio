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
import { initCube, cubeFaceAt, highlightCubeFace, pickCube } from './navCube.js';
import { setupJogPendant } from './jogPendant.js';
import { toolHalfProfile } from './toolProfile.js';
import { PartFrame } from './sceneFrame.js';
import { getRotaryAxes } from '../ui/settingsPanel.js';
import { stockProbeStop, barRadius } from '../engine/probeGeometry.js';
import { passAnchorFor } from '../engine/passAnchor.js';   // t94/t107 — an AUTO reposition pass's ROUTE (+ its probe-collision Aw/Bw) draws from the RUNTIME END of the previous pass (t107 machine-faithful, via _passEnds), else the static previous START (t94), not its own net-endpoint marker
import { markerWorldOf } from './markerWorld.js';   // t301 Seam C — the ONE per-pass marker-world fn the Layout ALSO reads, so the 3D ruby + the Layout handle can't diverge
import { PATH_TYPES, PATH_STATE, FEED_LOW, FEED_HIGH } from './pathStyle.js';   // t317 — the ONE declared path-visual palette, shared with the 2D + the legend

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
        // Follow-cam: while playing, smoothly slide the orbit target onto the moving tool (centre-lock). followLerp
        // is the per-frame smoothing (small = damped/laggy, large = snappy); a separate rAF runs while on.
        this.followCam = false;
        this.followLerp = 0.16;
        this._followRaf = null;
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
        this._passEnds = null;   // t107 — per-pass RUNTIME world-ENDs from the trace: an anchorsAtPrev pass anchors its route/tool-head/marker HERE (machine-faithful). null → passAnchorFor degrades to the t94 static previous-start.
        this.spindleMarkers = [];
        this.selectedStart = 0;   // which start the jog pendant drives
        // Whether the toolpath is anchored to the start MARKER. true = incremental/probe (the macro emanates from the
        // operator start). false = absolute/mill (the path sits at its own coords; the start is independent — moving
        // it must NOT drag the path). Set per-op by createPreviewPanel; default true preserves probe behaviour.
        this._anchorToStart = true;
        this._downMarker = -1;    // marker under a pending click (selected on pointer-up)
        this._axisMat = {};        // `${pass}:${axis}` -> { mat, base }
        // Machine frame (envelope/grid/table/home) stays in the scene; the PART frame (op/stock/tool/markers/WCS
        // axes) shifts to +workOrigin so the setup sits at its WCS spot inside the fixed envelope. See sceneFrame.js.
        this.partFrame = new PartFrame(this.scene, THREE);
        this.pathGroup = new THREE.Group();
        this.partFrame.add(this.pathGroup);
        this.raycaster = new THREE.Raycaster();
        this.onStartChange = null; // optional callback(starts)
        this.showRapids = true;
        this._animOn = true;   // play by default
        this._animSimSpeed = 1;   // feed-true playback: 1 = real time (matches the engine)
        this._animPaused = false;
        this._gizmoPx = 60;    // on-screen gizmo size (smaller still in the compact wizard preview)
        this._animRaf = null;
        this._animDist = 0;   // elapsed program-time (ms) along the animated path
        this._animLast = 0;
        this._animSegs = [];
        this._animMs = 0;

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
        // Floor grid — a custom rectangular LineSegments LINKED TO THE ENVELOPE footprint (rebuilt in fit). Lines
        // run at multiples of the increment FROM THE ORIGIN and are CLIPPED to the envelope. A GridHelper is always
        // square so it can't match a non-square envelope; this can. `_gridStep` 0 = auto nice-step, else fixed mm.
        this.grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x16242f }));
        this.scene.add(this.grid);
        this._gridStep = 0;
        // Lights — only affect SHADED materials (the stock in mill mode); the flat MeshBasic geometry ignores them.
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.68));
        const _dl = new THREE.DirectionalLight(0xffffff, 0.55); _dl.position.set(0.4, 0.8, 2); this.scene.add(_dl);
        // Floor axis lines through the ORIGIN (scene 0 = part-zero), SPANNING THE ENVELOPE — these ARE the X / Y
        // axes (no separate part-zero triad, which would just duplicate them): X red along y=0, Y green along x=0.
        // Re-laid each fit(). The machine-zero marker (setMachine) still shows a full XYZ gizmo at home.
        const mkAxisLine = (color) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
            this.partFrame.add(ln);   // the origin axes mark part-zero / the WCS → ride the part frame
            return ln;
        };
        this._axisLineX = mkAxisLine(0xff6b6b);
        this._axisLineY = mkAxisLine(0x5fd35f);
        this._axisLineZ = mkAxisLine(0x6b9bff);   // vertical Z axis at the origin column, spanning the envelope height
        // Labelled WORK-ORIGIN gizmo at part-zero (the WCS). The thin axis LINES above span the footprint, but the
        // datum itself is easy to miss — so add a small constant-screen-size crosshair + dot + "WCS" label that rides
        // the part frame (same datum tracking as the axis lines). Scaled per-frame in _scaleMarkers so it never grows
        // with zoom. Built in part-local units (base size ~1mm); _scaleMarkers sets the group scale for ~constant px.
        const og = new THREE.Group();
        og.renderOrder = 14;
        const omat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthTest: false });
        const ogeo = new THREE.BufferGeometry();
        // a 3D crosshair (±X, ±Y, ±Z) of unit half-length — one mm at scale 1
        ogeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            -1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1,
        ]), 3));
        const cross = new THREE.LineSegments(ogeo, omat); cross.renderOrder = 14; og.add(cross);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffe08a, depthTest: false }));
        dot.renderOrder = 14; og.add(dot);
        // NO persistent text label — the yellow square IS the STOCK WCS (the datum/pin saved in settings.stock). A
        // hover TOOLTIP ("stock") identifies it instead of a floating label (user request). _scaleMarkers guards null.
        this._originGizmo = og;
        this._originLabel = null;
        this.partFrame.add(og);   // rides the part frame → tracks the datum exactly like the axis lines
        if (typeof document !== 'undefined' && this.container) {
            if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
            const tip = document.createElement('div');
            tip.className = 'viz-stock-tip'; tip.textContent = 'stock';
            tip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:20;padding:2px 7px;font:600 11px/1.2 system-ui,sans-serif;color:#241a06;background:#ffe08a;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.45);transform:translate(-50%,-150%);white-space:nowrap;display:none;';
            this.container.appendChild(tip);
            this._stockTip = tip;
        }
        // PROBE-WCS marker (slice 3): the datum DERIVED by the probe, a PEER of the stock-WCS — same size, EQUAL
        // importance, different COLOUR (cyan vs the stock amber). A plain POINT (dot, NO crosshair — user request) so it
        // reads as a result, not a gizmo. Always visible; starts superimposed on part-zero (setup-right) and each G31
        // converges its probed axis to the contact. Rides the part frame + scaled by _scaleMarkers like the origin dot.
        // PROBE CUE (advisor turn 30 — TRANSIENT-DISC model). Each probe drops a TRANSIENT soft glow DISC at its contact
        // (in the perp plane), sized by FEED (slow/fine probe → BIG disc, fast/rough → small — the user's request) that
        // glows 3× slowly + fades over ~_probeDiscFadeMs; overlapping discs add → the intersection reads thicker. Two
        // PERSISTENT, no-fade layers, built at the REAL datum (un-probed axes ride the CONTACT, NOT the projected WCS):
        // the AXIS LINE (the 2-plane intersection, along the un-probed axis — CYAN) + the DATUM point (where the planes
        // cross — GOLD, a different colour). Both vanish when the next probe LOOP starts. Constant-screen in _scaleMarkers.
        this._datumColor = 0xff2d2d; this._lineColor = 0x00e5ff;   // DATUM = RED 2-axis crosshair (was a gold sphere)
        this._probeDiscFadeMs = 16000;                                  // disc lifetime at 1× (scaled by the live sim speed) — longer-lived (user request)
        this._probeBurstBasePx = 200; this._probeBurstRefFeed = 250;    // disc radius px = base × clamp(√(feed/ref), .6, 1.8) — FASTER → bigger (LARGER disc, user)
        this._probeLinePx = 200; this._probeLineRadPx = 0.8; this._simSpeed = 1;   // THIN axis line (length spans the scene — see _scaleMarkers)
        // DATUM gizmo — a thin RED 2-axis CROSSHAIR, a PEER of the stock-WCS crosshair (same LineSegments style; red vs amber).
        // The `+` lies in the plane of the 2 displayed/probed axes; the 3rd axis is just DEPTH (the cross sits at that depth).
        // Built as a 2D `+` in XY and rotated into the probed plane (XY/XZ/YZ) in _updateDatum. Constant on-screen via _scaleMarkers.
        const pg = new THREE.Group();
        const dmat = new THREE.LineBasicMaterial({ color: this._datumColor, transparent: true, opacity: 0.98, depthTest: false, blending: THREE.AdditiveBlending });   // additive → luminous red GLOW (pulsed in _pulseDatum)
        const dgeo = new THREE.BufferGeometry();
        dgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0]), 3));   // a 2-axis `+` in XY, unit half-length
        const dcross = new THREE.LineSegments(dgeo, dmat); dcross.renderOrder = 20;
        pg.add(dcross);
        // GLOW HALO — a soft additive radial sprite behind the `+` (hot core → red → transparent) so it reads as a bright,
        // hard glow. Constant-screen (rides pg's scale). Pulsed brighter/larger in _pulseDatum.
        if (typeof document !== 'undefined') {
            const gc = document.createElement('canvas'); gc.width = gc.height = 64;
            const gx = gc.getContext('2d');
            const grd = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grd.addColorStop(0, 'rgba(255,180,170,1)'); grd.addColorStop(0.3, 'rgba(255,60,55,0.85)'); grd.addColorStop(1, 'rgba(255,45,45,0)');
            gx.fillStyle = grd; gx.fillRect(0, 0, 64, 64);
            const gspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 1 }));
            gspr.scale.set(5.5, 5.5, 1); gspr.renderOrder = 19;   // behind the sharp lines (19 < 20)
            pg.add(gspr); this._datumGlow = gspr;
        }
        pg.renderOrder = 20; pg.visible = false;   // renders OVER the line (20 > 13)
        this._probeGizmo = pg; this._probeCross = dcross;   // the DATUM — thin RED 2-axis crosshair + glow halo (shown ≥2 axes), rotated to the probed plane
        this.partFrame.add(pg);
        this._probeLine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 14), new THREE.MeshBasicMaterial({ color: this._lineColor, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }));
        this._probeLine.renderOrder = 13; this._probeLine.visible = false; this.partFrame.add(this._probeLine);
        this._probeVals = { x: 0, y: 0, z: 0 }; this._probeAxes = {}; this._probeContacts = [];
        // Direction labels on the grid edges (repositioned to the footprint in setSegments)
        this._gridLabels = {
            xp: this._makeTextSprite('+X', '#ff6b6b'), xn: this._makeTextSprite('-X', '#ff6b6b'),
            yp: this._makeTextSprite('+Y', '#5fd35f'), yn: this._makeTextSprite('-Y', '#5fd35f'),
        };
        for (const k in this._gridLabels) this.scene.add(this._gridLabels[k]);
    }

    _makeTextSprite(text, color) {
        const THREE = this.THREE;
        const c = document.createElement('canvas');
        c.width = 128; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.font = 'bold 46px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Dark outline so the label stays legible over the grid / toolpath, then the axis-tint fill.
        ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, 64, 36);
        ctx.fillStyle = color || '#7fa8cc';
        ctx.fillText(text, 64, 36);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
        sp.renderOrder = 1;
        return sp;
    }

    // Interactive ViewCube — implementation in viz/navCube.js
    _initCube() { initCube(this); }
    _cubeFaceAt(e) { return cubeFaceAt(this, e); }
    _highlightCubeFace(idx) { highlightCubeFace(this, idx); }
    _pickCube(e) { return pickCube(this, e); }

    // A draggable start marker for one pass. RED is reserved for the moving probe tip (the ruby that touches), so the
    // STATIC start gets a distinct non-red glyph: a CAMERA-LOCKED cyan/amber shape — a hollow CIRCLE ○ (sim-only) or a
    // filled SQUARE ■ (emitting) per pass — that reads identically to the 2D canvas + the Layout handle from any angle.
    _makeMarker() {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        grp.add(this._makeStartGlyph());            // the camera-locked start glyph (children[0]) — glyph + colour ONLY, no number badge (the named label lives on the Layout)
        return grp;
    }

    // The start-glyph textures (WHITE so material.color tints them per-pass — cyan=auto / amber=manual — hi-res keeps them
    // crisp), cached per shape. SHAPE axis (orthogonal to colour): SIM-ONLY / manual-jog = a hollow CIRCLE ○ (jog preview, never
    // emitted); EMITTING = a FILLED SQUARE ■ (a drag writes a macro var into the program, corner #21-#24) — ONE glyph language
    // with the 2D toolpath + the Layout handle (the old lozenge/diamond is retired).
    _startGlyphTex(emits) {
        const key = emits ? '_emitStartTex' : '_simStartTex';
        if (this[key]) return this[key];
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 18; ctx.lineJoin = 'round';
        ctx.beginPath();
        if (emits) { ctx.fillRect(20, 20, 88, 88); }   // AUTO = filled SQUARE ■
        else { ctx.arc(64, 64, 46, 0, Math.PI * 2); ctx.fill(); }   // MANUAL / Start = filled CIRCLE ●
        return (this[key] = new this.THREE.CanvasTexture(c));
    }

    // The start glyph: a camera-facing (billboard) cyan sprite — the 3D twin of the 2D start handle (hollow circle ○ =
    // sim-only, filled square ■ = emitting, set live per pass). depthTest:false → always visible.
    _makeStartGlyph() {
        const THREE = this.THREE;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._startGlyphTex(false), color: 0x22d3ee, depthTest: false, transparent: true }));   // cyan (auto) + hollow (sim-only) defaults
        sp.scale.set(9, 9, 1);   // ~9 mm
        sp.renderOrder = 11;
        return sp;
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

    // JOG START pendant — implementation in viz/jogPendant.js
    _setupJogPendant() { setupJogPendant(this); }

    // Recreate markers only when the pass count changes
    _ensureMarkers() {
        if (this.spindleMarkers.length === this._passCount) return;
        for (const m of this.spindleMarkers) this.partFrame.group.remove(m);
        this.spindleMarkers = [];
        this._hoverKey = undefined;
        for (let p = 0; p < this._passCount; p++) {
            const m = this._makeMarker(p);
            this.spindleMarkers.push(m);
            this.partFrame.add(m);   // start markers ride the part frame
        }
        if (this.selectedStart >= this._passCount) this.selectedStart = 0;
        if (this._renderJogStarts) this._renderJogStarts();   // refresh the jog pendant's start selector
    }

    _positionMarkers() {
        for (let p = 0; p < this.spindleMarkers.length; p++) {
            const s = this._markerWorld(p);
            this.spindleMarkers[p].position.set(s.x, s.y, s.z);
        }
        this._highlightSelectedStart();
    }

    // t107 — where a marker SPRITE actually renders. A reposition-DESTINATION marker (anchorsAtPrev) sits where its
    // dog-leg ENDS: the previous pass's RUNTIME END (_passEnds, post probe+retract+lift) + the pass's reposition delta
    // (its declared marker − the previous declared marker = the emitted #23/#24 cross). So the ruby lands on the
    // machine-correct wall approach, matching the drawn route end + the probe fire. This is a display-only VIEW of the
    // DECLARED `starts` (the drag + #21-#24 still derive from starts); no runtime end yet / not flagged → the declared row.
    _markerWorld(p) {
        // t301 Seam C — delegate to the shared markerWorldOf (the Layout handle reads the SAME fn off the SAME per-pass
        // starts): a datum-PINNED wall is absolute (Seam B — it no longer RIDES the dragged Start off the runtime END);
        // an AUTO reposition relocates to the previous pass's runtime END + delta; else the declared row.
        return markerWorldOf(this.starts, this._passEnds, p);
    }

    // Choose which start the jog pendant drives (and which ruby is highlighted).
    selectStart(i) {
        const n = this.spindleMarkers.length || 1;
        this.selectedStart = Math.max(0, Math.min(n - 1, i | 0));
        this._highlightSelectedStart();
        if (this._renderJogStarts) this._renderJogStarts();
        this.render();
    }

    // Brighten the selected start glyph, dim the rest (via OPACITY), AND colour each by its reposition SOURCE: AUTO
    // traverse = CYAN, MANUAL jog = AMBER (the white lozenge texture is tinted by material.color). Red is the probe tip.
    _highlightSelectedStart() {
        for (let p = 0; p < this.spindleMarkers.length; p++) {
            const glyph = this.spindleMarkers[p].children[0];
            if (!glyph || !glyph.material) continue;
            const sel = p === this.selectedStart;
            glyph.material.opacity = sel ? 1 : 0.45;
            const src = (this._startSources && this._startSources[p]) || 'auto';
            // t293 — ONE glyph language: AUTO reposition (machine drives there) = a CYAN SQUARE ■; MANUAL jog / the operator
            // Start = an AMBER CIRCLE ●. Shape + colour agree (matches the 2D toolpath + the Layout). Pass-0 is ALWAYS the
            // operator's first jog (the Start) → manual; every later pass follows its reposition SOURCE.
            const manual = p === 0 || src === 'manual';
            glyph.material.color.setHex(manual ? 0xffb300 : 0x22d3ee);
            const tex = this._startGlyphTex(!manual);
            if (glyph.material.map !== tex) { glyph.material.map = tex; glyph.material.needsUpdate = true; }
        }
    }
    // Per-pass reposition sources (['auto'|'manual',…]) → start-marker colour. Re-applies via the highlight pass.
    setStartSources(sources) { this._startSources = Array.isArray(sources) ? sources : []; this._highlightSelectedStart(); this.render(); }
    // Per-pass emitting flags ([bool,…]) → start-marker SHAPE (emitting=filled ◆, sim-only=hollow ◇). Re-applies via highlight.
    setStartEmits(emits) { this._startEmits = Array.isArray(emits) ? emits : []; this._highlightSelectedStart(); this.render(); }
    // t107 — per-pass RUNTIME world-ENDs (from the trace): an anchorsAtPrev pass anchors its route/tool-head at _passEnds[p-1]
    // (machine-faithful) and relocates its marker sprite to end+cross. A full route rebuild reads it; null → t94 static-start.
    setPassEnds(ends) { this._passEnds = Array.isArray(ends) ? ends : null; }

    // Ray-pick a start marker (ruby + numbered badge) under the pointer; returns pass index or -1.
    _pickMarker(e) {
        if (!this.spindleMarkers.length) return -1;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        let best = -1, bestDist = Infinity;
        for (let p = 0; p < this.spindleMarkers.length; p++) {
            const hit = this.raycaster.intersectObject(this.spindleMarkers[p], true)[0];
            if (hit && hit.distance < bestDist) { bestDist = hit.distance; best = p; }
        }
        return best;
    }

    // Keep on-screen gizmos a CONSTANT screen size (independent of zoom): world size ∝ the world-per-pixel at the
    // object (camera distance for perspective, frustum for ortho). Applies to the start markers AND the axis labels.
    // World units per screen pixel at a world position — the basis for constant on-screen sizing (see _scaleMarkers).
    _worldPerPx(pos) {
        const H = this.container.clientHeight || 1;
        if (this.camera.isOrthographicCamera) return (this.camera.top - this.camera.bottom) / H;
        const tanHalf = Math.tan((this.persp.fov * Math.PI / 180) / 2);
        return (2 * this.camera.position.distanceTo(pos) * tanHalf) / H;
    }

    _scaleMarkers() {
        const H = this.container.clientHeight || 1;
        const ortho = this.camera.isOrthographicCamera;
        const tanHalf = Math.tan((this.persp.fov * Math.PI / 180) / 2);
        const worldPerPxAt = (pos) => ortho
            ? (this.camera.top - this.camera.bottom) / H
            : (2 * this.camera.position.distanceTo(pos) * tanHalf) / H;
        const targetPx = this._gizmoPx || 90, base = 26; // base = the arrow length at scale 1
        for (const m of this.spindleMarkers) m.scale.setScalar(Math.max(1e-4, (targetPx * worldPerPxAt(m.position)) / base));
        // Work-origin gizmo: constant on-screen size. Group crosshair is ±1mm at scale 1, so scale it so the cross
        // spans ~36px; the label sprite (a group child) is counter-scaled so the "WCS" text stays a fixed px width
        // (canvas is 2:1) instead of compounding with the group scale.
        if (this._originGizmo) {
            const wpp = worldPerPxAt(this._originGizmo.getWorldPosition(this._ogV3 || (this._ogV3 = new this.THREE.Vector3())));
            const gs = Math.max(1e-4, 18 * wpp);   // ±18px crosshair half-length
            this._originGizmo.scale.setScalar(gs);
            if (this._originLabel) { const w = Math.max(1e-4, 48 * wpp / gs); this._originLabel.scale.set(w, w / 2, 1); }
        }
        if (this._probeGizmo && this._probeGizmo.visible) {   // DATUM dot — constant on-screen size (peer of the stock-WCS dot)
            const wpp = worldPerPxAt(this._probeGizmo.getWorldPosition(this._pgV3 || (this._pgV3 = new this.THREE.Vector3())));
            this._probeGizmo.scale.setScalar(Math.max(1e-4, 14 * wpp));
        }
        // The persistent AXIS LINE: CONSTANT on-screen length + thickness (a big WCS offset can't shrink it to a speck).
        if (this._probeLine && this._probeLine.visible) {
            const wpp = worldPerPxAt(this._probeLine.getWorldPosition(this._plV3 || (this._plV3 = new this.THREE.Vector3())));
            const rad = Math.max(1e-4, this._probeLineRadPx * 2 * wpp);   // CylinderGeometry radius 0.5 → ×2 to read as px (thin)
            const len = 100000;   // span "infinitely" across the whole scene — fixed world length, not constant-screen (user)
            this._probeLine.scale.set(rad, len, rad);
        }
        // Direction labels (+X/-X/+Y/-Y): constant on-screen width too (canvas is 2:1), so they don't grow with zoom.
        const L = this._gridLabels;
        if (L) for (const k in L) { const w = Math.max(1e-4, 55 * worldPerPxAt(L[k].position)); L[k].scale.set(w, w / 2, 1); }
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


    _ensureAnimTool() { if (!this._animTool) this._buildAnimTool(); }
    // The moving SPINDLE ASSEMBLY: spindle (body) ▸ collet (holder) ▸ tool (the actual revolved profile, the same
    // builder as the ATC magazine) — SEPARATE meshes in one group, used for EVERY op (probe + mill), so ATC can
    // later move the tool independently of the collet. Tool tip at the local origin (setToolPosition puts it on the
    // path); the collet + spindle stack up (+Z) toward the machine spindle. Each part is toggle-able (setPartVisible).
    _buildAnimTool() {
        const THREE = this.THREE;
        if (this._animTool) { this.partFrame.group.remove(this._animTool); this._animTool.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
        const tool = this._simTool || { type: 'endmill', dia: 6 };
        const half = toolHalfProfile(tool);
        const tr = Math.max(0.5, (Number(tool.dia) || 6) / 2);          // shank radius (what the collet clamps)
        const topZ = Math.max(0.1, ...half.map((p) => p[1]));           // the tool's TOP (the shank) — sets the clamp height
        const part = (geo, color, op, name) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: op })); m.name = name; return m; };
        const tgeo = new THREE.LatheGeometry(half.map((q) => new THREE.Vector2(Math.max(0.001, q[0]), q[1])), 24); tgeo.rotateX(Math.PI / 2);   // TOOL — real profile, tip at origin
        // COLLET + SPINDLE dims come from the machine HEAD settings (pulled by the preview via setHead); the cutter
        // only sets WHERE the collet clamps (the shank top). Defaults below match a typical spindle if no head is set.
        const head = this._head || {};
        // COLLET — a plain CYLINDER clamping the shank top (overlaps it); always wider than the shank.
        const colletR = Math.max(tr + 1, (Number(head.colletDia) || 20) / 2), ch = Number(head.colletLen) || 30, colletBot = topZ - 6;
        const cgeo = new THREE.CylinderGeometry(colletR, colletR, ch, 20); cgeo.rotateX(Math.PI / 2); cgeo.translate(0, 0, colletBot + ch / 2);
        // SPINDLE — a real-size body above the collet (head.spindleDia × head.spindleLen).
        const spR = (Number(head.spindleDia) || 80) / 2, sh = Number(head.spindleLen) || 200, spBot = colletBot + ch - 3;
        const sgeo = new THREE.CylinderGeometry(spR, spR, sh, 28); sgeo.rotateX(Math.PI / 2); sgeo.translate(0, 0, spBot + sh / 2);
        this._animParts = { tool: part(tgeo, 0xffab40, 0.9, 'tool'), collet: part(cgeo, 0x9aa6b2, 0.9, 'collet'), spindle: part(sgeo, 0x6b7682, 0.85, 'spindle') };
        const grp = new THREE.Group();
        grp.add(this._animParts.spindle, this._animParts.collet, this._animParts.tool);
        // PROBE op: the touching RUBY BALL is RED (mirrors the 2D red head + the real touch-probe look). ONLY the ball —
        // the stylus/body/shank stay the orange tool colour, collet/spindle grey, the MILL tool stays orange. A solid red
        // sphere at the tip (depthTest:false, higher renderOrder → drawn on top) overlays the lathe's ball; radius matches
        // toolProfile's ruby (probeDims.ballDia, else dia/4) so it coincides exactly. No ruby for a mill.
        if (tool.type === 'probe') {
            const pd = tool.probeDims || {};
            const rball = (pd.ballDia > 0) ? Number(pd.ballDia) / 2 : Math.max(1, ((Number(tool.dia) || 6) / 2) * 0.5);
            // transparent:true (opacity 1) + a HIGH renderOrder so the ruby sorts into the SAME (transparent) pass as the
            // orange tool and draws LAST → it covers the lathe's orange ball. (An OPAQUE ruby renders in the opaque pass
            // BEFORE the transparent orange tool, so the orange would draw over it → it would NOT read red. The user hit that.)
            const ruby = new THREE.Mesh(new THREE.SphereGeometry(rball * 1.04, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff2a44, depthTest: false, transparent: true, opacity: 1 }));
            ruby.position.set(0, 0, rball); ruby.renderOrder = 30; ruby.name = 'ruby';   // ball centred at z=rball (lathe ball spans z∈[0,2·rball]); ×1.04 so no orange rim peeks
            this._animParts.ruby = ruby; grp.add(ruby);
        }
        grp.renderOrder = 25; grp.visible = !!this._animOn;
        this._animTool = grp; this._applyPartVis(); this.partFrame.add(grp);   // tool rides the part frame
        this._applyColletState();   // P-C.3a: a tool-swap rebuild keeps the collet's open/close state
    }
    _applyPartVis() { const v = this._partVis || {}; if (this._animParts) { for (const k of ['tool', 'collet', 'spindle']) if (this._animParts[k]) this._animParts[k].visible = v[k] !== false; if (this._animParts.ruby) this._animParts.ruby.visible = v.tool !== false; } }   // the red ruby tip follows the tool
    // Show/hide spindle / collet / tool independently, e.g. setPartVisible({ spindle: false }).
    setPartVisible(parts) { this._partVis = Object.assign({ tool: true, collet: true, spindle: true }, this._partVis, parts); this._applyPartVis(); this.render(); }
    // Set the PER-OP tool { type, dia, length } → rebuild the assembly's tool to its real profile.
    setSimTool(tool) { this._simTool = tool || null; if (this._animTool) this._buildAnimTool(); }
    // Machine HEAD dims { spindleDia, spindleLen, colletDia, colletLen } (mm) — pulled from settings by the preview.
    setHead(head) { this._head = head || null; if (this._animTool) this._buildAnimTool(); }
    // Per-op SIM MODE: 'mill' → solid shaded stock; 'probe' → translucent so the probe/feature shows through.
    _stockOpacity() { return this._simMode === 'probe' ? 0.16 : 0.72; }
    setSimMode(mode) { if (mode === this._simMode) return; this._simMode = mode; if (this.stockMesh && this.stockMesh.material) { this.stockMesh.material.opacity = this._stockOpacity(); this.render(); } }

    // Toggle a tool dot that travels the whole path in execution order, feed-true (real program time)
    setAnimate(on) {
        this._animOn = !!on;
        this._ensureAnimTool();
        this._animTool.visible = this._animOn;
        this._dimRoute(this._animOn);   // play: route faint + bold trail revealed; stop: restore the full route
        if (this._animOn) {
            this._animDist = 0;
            this._animLast = 0;
            if (!this._animRaf) this._animTick();
        } else {
            if (this._animRaf) cancelAnimationFrame(this._animRaf);
            this._animRaf = null;
            this._applyPartRotation(0, 0); // return the part to rest when the play stops
            this.render();
        }
    }

    // Trail mode: while playing, keep the full route (the type-grouped lines) visible but faint — a thin 50%
    // "ghost" of the whole path — and reveal the bold solid "executed" overlay up to the tool head, so you can
    // read where you are against where you're going. Restores the original opacity on stop.
    _dimRoute(on) {
        this._trailOn = on;
        for (const k in this.lineGroups) {
            const o = this.lineGroups[k]; if (!o) continue;
            if (on) {
                if (o.material.__op0 == null) o.material.__op0 = o.material.opacity != null ? o.material.opacity : 1;
                o.material.transparent = true; o.material.opacity = PATH_STATE.future.alpha;   // t313/t317 — untraveled guide alpha = the ONE palette's future state (0.8), SHARED with the 2D future so a human mod hits both; the bold _trailLine still carries the traveled emphasis
            } else if (o.material.__op0 != null) {
                o.material.opacity = o.material.__op0; o.material.transparent = o.material.__op0 < 1;
            }
        }
        if (this._trailLine) {
            this._trailLine.visible = on;
            if (!on) {
                // Restore any partial tip vertex so the geometry is clean for the next run, then hide the trail.
                if (this._trailTipIdx != null && this._trailTipOrig) {
                    const o = this._trailTipOrig, pa = this._trailLine.geometry.getAttribute('position');
                    pa.setXYZ(this._trailTipIdx, o.x, o.y, o.z); pa.needsUpdate = true;
                }
                this._trailTipIdx = null; this._trailTipOrig = null;
                this._trailLine.geometry.setDrawRange(0, 0);
            }
        }
        this.render();
    }

    // Called by execution engine to update tool position during execution
    setToolPosition(pos) {
        if (!pos || (!Number.isFinite(pos.x) && !Number.isFinite(pos.y) && !Number.isFinite(pos.z))) return;
        this._ensureAnimTool();
        this._animTool.visible = true;
        // The live tool is offset by the start marker of its CURRENT pass (INC4: a REPOSITION moves to the next start ②,
        // not back to starts[0]=① — else a boss-manual probes the Y walls from ① and looks like a pocket). Single-pass /
        // no pass → starts[0]. ONLY when anchored (probe/incremental); absolute/mill sits at its own coords (no offset).
        const pass = (pos.pass != null && pos.pass >= 0 && pos.pass < this.starts.length) ? pos.pass : 0;
        // t94/t107 — the LIVE engine-driven tool head must ride the SAME re-park draw-anchor as its route (line ~757) +
        // the engine collision/DRO, else on a corner AUTO reposition pass the head floats off the drawn dog-leg it traces.
        // passAnchorFor → the previous pass's RUNTIME END for a flagged pass (t107), else self (non-corner / manual / pass 0).
        const o = this._anchorToStart ? (passAnchorFor(this.starts, this._passEnds, pass) || this.starts[pass] || { x: 0, y: 0, z: 0 }) : { x: 0, y: 0, z: 0 };
        this._animTool.position.set((pos.x || 0) + o.x, (pos.y || 0) + o.y, (pos.z || 0) + o.z);
        // Engine-driven trail: bold the executed route up to the tool head (option B — what you see is the path
        // the engine actually ran). Enable trail mode lazily; setAnimate(false)/ddcsStopPreview restores it.
        if (this._trailLine && this._animSegs && this._animSegs.length) {
            if (!this._trailOn) this._dimRoute(true);
            this._updateTrailTip(this._animTool.position);
        }
        this.render();
    }

    // Grow the bold trail so its tip sits EXACTLY on the tool head, drawing a partial current segment instead of
    // revealing whole segments (which read as a visibility toggle). Completed segments draw fully; the current
    // segment is shortened to a→toolhead by temporarily moving its end vertex (restored when the tip advances).
    _updateTrailTip(tp) {
        const line = this._trailLine, segs = this._animSegs;
        if (!line || !segs || !segs.length) return;
        const pos = line.geometry.getAttribute('position');
        // Restore the segment we shortened last frame to its true end before choosing a new tip.
        if (this._trailTipIdx != null && this._trailTipOrig) {
            const o = this._trailTipOrig;
            pos.setXYZ(this._trailTipIdx, o.x, o.y, o.z);
        }
        // Current segment = the one whose [a,b] span the tool head projects onto closest (clamped).
        let ci = 0, best = Infinity, qx = 0, qy = 0, qz = 0;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const dx = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az;
            const len2 = dx * dx + dy * dy + dz * dz || 1e-9;
            let t = ((tp.x - s.ax) * dx + (tp.y - s.ay) * dy + (tp.z - s.az) * dz) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const cx = s.ax + dx * t, cy = s.ay + dy * t, cz = s.az + dz * t;
            const dd = (tp.x - cx) ** 2 + (tp.y - cy) ** 2 + (tp.z - cz) ** 2;
            if (dd < best) { best = dd; ci = i; qx = cx; qy = cy; qz = cz; }
        }
        // Shorten segment ci to end at the tool head (its end vertex is index 2*ci+1, since each seg = a,b pair).
        const vIdx = 2 * ci + 1;
        this._trailTipOrig = { x: pos.getX(vIdx), y: pos.getY(vIdx), z: pos.getZ(vIdx) };
        this._trailTipIdx = vIdx;
        pos.setXYZ(vIdx, qx, qy, qz);
        pos.needsUpdate = true;
        line.geometry.setDrawRange(0, 2 * (ci + 1));
    }

    _animTick() {
        if (!this._animOn || !this.active) { this._animRaf = null; return; }
        const segs = this._animSegs;
        if (segs && segs.length) {
            const now = (typeof performance !== 'undefined' ? performance.now() : 0);
            const dt = this._animLast ? Math.min(0.1, (now - this._animLast) / 1000) : 0;
            this._animLast = now;
            // Advance in REAL program time (feed-true): dt seconds → dt*1000 ms of program time,
            // scaled by _animSimSpeed (1 = real time). Each segment's ms ∝ length/feedrate, so the
            // tool moves at the programmed speed — slow probes crawl, rapids zip, like the engine.
            const total = this._animMs || 1;
            if (!this._animPaused) {
                this._animDist += dt * 1000 * (this._animSimSpeed || 1);
                if (this._animDist >= total) {       // reached the end → hold 2s (final datum/result visible), then loop (no beep — it loops forever)
                    this._animDist = total;
                    this._animPaused = true;
                    setTimeout(() => { this._animDist = 0; this._animPaused = false; this._animLast = 0; }, 2000);
                }
            }
            let d = Math.min(this._animDist, total);
            for (let i = 0; i < segs.length; i++) {
                const sg = segs[i];
                if (d <= sg.ms || i === segs.length - 1) {
                    const t = sg.ms > 0 ? Math.min(1, d / sg.ms) : 1;
                    this._animTool.position.set(sg.ax + (sg.bx - sg.ax) * t, sg.ay + (sg.by - sg.ay) * t, sg.az + (sg.bz - sg.az) * t);
                    this._applyPartRotation(sg.a1 + (sg.a2 - sg.a1) * t, sg.b1 + (sg.b2 - sg.b1) * t);
                    if (this._trailLine) this._trailLine.geometry.setDrawRange(0, 2 * i);   // bold the executed segments behind the tool
                    break;
                }
                d -= sg.ms;
            }
            this.render();
        }
        this._animRaf = requestAnimationFrame(() => this._animTick());
    }

    // Manual A-axis jog: spin the part by deltaDeg about the rotary axis (no program needed). Accumulates into
    // _jogA; programs still override the rotation during playback (the play loop calls _applyPartRotation each
    // frame). Re-applied after setStock so a stock rebuild keeps the jogged angle.
    rotaryJogA(deltaDeg) {
        this._jogA = (this._jogA || 0) + (Number(deltaDeg) || 0);
        this._applyPartRotation(this._jogA, 0);
        this.render();
    }

    // Spin the part group to the given rotary angles (degrees). A spins around its declared
    // Cartesian axis (getRotaryAxes), defaulting to X; B around its declared axis, if any.
    _applyPartRotation(a, b) {
        const pg = this._partGroup;
        if (!pg) return;
        const rax = this._rotaryAxes || {};
        const deg = Math.PI / 180;
        pg.rotation.set(0, 0, 0);
        pg.rotation[rax.a || 'x'] = (a || 0) * deg;
        if (rax.b) pg.rotation[rax.b] = (b || 0) * deg;
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

    _setHighlight(pass, axis) {
        // no-op since gizmo picking is disabled
    }

    // t along axisDir (unit) from lineOrigin to the point closest to the pointer ray
    _closestAxisT(ray, lineOrigin, axisDir) {
        const d = axisDir.dot(w0);
        const e = ray.direction.dot(w0);
        const denom = c - b * b; // a = axisDir·axisDir = 1
        if (Math.abs(denom) < 1e-9) return 0;
        return (b * e - c * d) / denom;
    }

    setSegments(parsed, fit = true) {
        this._segs = (parsed && parsed.segments) || [];
        this._passCount = Math.max(1, (parsed && parsed.stats && parsed.stats.passes) || 1);
        // one draggable start per pass (keep existing positions; new passes default to origin)
        while (this.starts.length < this._passCount) this.starts.push({ x: 0, y: 0, z: 0 });
        this.starts.length = this._passCount;
        this._ensureMarkers();
        this._rebuild();
        // fit re-frames the camera; skip it on live re-renders (e.g. wizard input changes) so the
        // user's orbit/zoom is preserved — just redraw the new path with the current camera.
        if (fit) this.fitAll(); else this.render();
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
        const probeable = !!(st && st.show && st.x > 0 && st.y > 0 && st.z > 0);   // a stock to collide a probe against
        const rotaryAxis = Object.values(getRotaryAxes())[0] || 'x';              // cylinder lies along this (matches setStock)
        const tipR = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().probes && Number.isFinite(window.ddcsGetSettings().probes.radius)) ? window.ddcsGetSettings().probes.radius : 0;   // probe tip radius → SURFACE collision (matches the engine)
        const CAP = 20; // fallback probe length when it never contacts the stock

        const byPass = [];
        for (const s of this._segs) { const p = s.pass | 0; (byPass[p] || (byPass[p] = [])).push(s); }

        const feedPos = [], rapidPos = [], retractPos = [], probeFastPos = [], probeSlowPos = [], jogPos = [];
        // The highest probe feed = fast approach; anything slower = the precise re-probe.
        let maxProbeFeed = 0;
        for (const s of this._segs) { if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed; }
        // Ordered world segments for the play animation, each with its real duration
        // (length / programmed feedrate) so the loop shows slow probes crawling and
        // rapids zipping — relative speeds match the program.
        const animSegs = [];
        const ROT_DEG_PER_MIN = 3600; // nominal rotary speed for sim timing of a rotary-only move (60°/s)
        const pushSeg = (ax, ay, az, bx, by, bz, rate, a1, b1, a2, b2, col) => {
            a1 = a1 || 0; b1 = b1 || 0; a2 = a2 || 0; b2 = b2 || 0;
            const len = Math.hypot(bx - ax, by - ay, bz - az);
            const da = Math.abs(a2 - a1) + Math.abs(b2 - b1);
            if (len < 1e-9 && da < 1e-9) return;   // truly stationary → skip
            // A rotary-only move has no XYZ length: time it by its angle so the spin actually plays.
            const ms = len >= 1e-9 ? (len / (rate > 0 ? rate : 600)) * 60000 : (da / ROT_DEG_PER_MIN) * 60000;
            animSegs.push({ ax, ay, az, bx, by, bz, ms, a1, b1, a2, b2, col: col != null ? col : 0xffe14d });
        };
        let bounds = null;
        const grow = (x, y, z) => { bounds = this._growBounds(bounds, x, y, z, x, y, z); };

        let prevEnd = null;
        for (let p = 0; p < this._passCount; p++) {
            const segs = byPass[p] || [];
            const mk = this.starts[p] || { x: 0, y: 0, z: 0 };
            // Route anchor: probe ops draw from the start MARKER (the incremental macro emanates from the real tool
            // position); mill/absolute programs draw at their own coords so moving the start does NOT drag the path.
            // t94/t107 — an AUTO reposition pass (anchorsAtPrev) draws its dog-leg from the RUNTIME END of the previous
            // pass (t107 machine-faithful, via _passEnds — post probe+retract+lift, incl the Z-trust lift), else the
            // static previous start (t94 fallback). NOT its own net-endpoint marker (that double-counts +cross). MANUAL /
            // pass-0 / non-corner fall back to self (mk). The marker SPRITE (_positionMarkers) relocates to the same end+cross.
            const off = this._anchorToStart ? (passAnchorFor(this.starts, this._passEnds, p) || mk) : { x: 0, y: 0, z: 0 };
            // A MANUAL reposition draws a dashed jog from the previous pass's end to this pass's start (the operator
            // physically moves there). An AUTO traverse does NOT — its auto-traverse move (the diagonal) IS the connecting
            // travel, so a jog line here is a PHANTOM (the dashed line that "shouldn't be there" in auto). Gate by source.
            // The manual jog BOWS UP in +Z — a pronounced 'rainbow' arc (the operator lifts, arcs over the stock, drops):
            // the 3D twin of the 2D canvas's upward-bow (toolpath2d). Sampled as a quadratic (control point lifted in +Z)
            // and pushed as a polyline — consecutive segment PAIRS — so BOTH the dashed route AND the animated trail arc.
            const jogSrc = (this._startSources && this._startSources[p]) || 'auto';
            if (prevEnd && jogSrc === 'manual') {
                const A = prevEnd, B = off;
                const chord = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
                const bow = Math.max(4, chord * 0.45);   // apex height in +Z, matching the 2D bow factor (len*0.45, min floor)
                const cz = (A.z + B.z) / 2 + bow;        // quadratic control point lifted above the chord midpoint
                const cxm = (A.x + B.x) / 2, cym = (A.y + B.y) / 2;
                const N = 16;
                let pa = A;
                for (let k = 1; k <= N; k++) {
                    const t = k / N, u = 1 - t, uu = u * u, ut2 = 2 * u * t, tt = t * t;
                    const pb = { x: uu * A.x + ut2 * cxm + tt * B.x, y: uu * A.y + ut2 * cym + tt * B.y, z: uu * A.z + ut2 * cz + tt * B.z };
                    jogPos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z); grow(pa.x, pa.y, pa.z); grow(pb.x, pb.y, pb.z);
                    pushSeg(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 6000, 0, 0, 0, 0, 0xff9a0d);
                    pa = pb;
                }
            }
            let cur = { x: 0, y: 0, z: 0 }; // pass-local, relative to the marker
            for (const s of segs) {
                const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
                const type = s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
                const start = cur;
                let end = { x: start.x + dx, y: start.y + dy, z: start.z + dz };

                // Probe collision with the stock — stop at the first material surface hit (shared with the
                // execution engine via probeGeometry, so the preview and the simulated run agree): outer box for
                // boss, box + inner cavity wall for a pocket, the round OD for a rotary cylinder.
                if (type === 'probe' && probeable) {
                    const Aw = { x: start.x + off.x, y: start.y + off.y, z: start.z + off.z };
                    const Bw = { x: end.x + off.x, y: end.y + off.y, z: end.z + off.z };
                    const tt = stockProbeStop(Aw, Bw, st, rotaryAxis, tipR);
                    if (tt != null) { end = { x: start.x + dx * tt, y: start.y + dy * tt, z: start.z + dz * tt }; }
                }

                const ax = start.x + off.x, ay = start.y + off.y, az = start.z + off.z;
                const bx = end.x + off.x, by = end.y + off.y, bz = end.z + off.z;
                grow(ax, ay, az); grow(bx, by, bz);
                const slowProbe = type === 'probe' && (s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed;
                const arr = type === 'rapid' ? rapidPos
                    : type === 'retract' ? retractPos
                    : type === 'probe' ? (slowProbe ? probeSlowPos : probeFastPos)
                    : feedPos;
                // trail colour = the route move-type colour, so the bold executed trail isn't always amber
                const col = type === 'rapid' ? PATH_TYPES.rapid.color : type === 'retract' ? PATH_TYPES.retract.color   // t317 — trail colours from the ONE palette
                    : type === 'probe' ? (slowProbe ? PATH_TYPES.probeSlow.color : PATH_TYPES.probeFast.color) : PATH_TYPES.feed.color;
                arr.push(ax, ay, az, bx, by, bz);
                pushSeg(ax, ay, az, bx, by, bz, (type === 'rapid' || type === 'retract') ? 6000 : (s.feed > 0 ? s.feed : 600), s.a1, s.b1, s.a2, s.b2, col);
                cur = end;
            }
            prevEnd = { x: cur.x + off.x, y: cur.y + off.y, z: cur.z + off.z };
        }

        // Ordered segments + total program time for the play animation
        this._animSegs = animSegs;
        this._animMs = animSegs.reduce((t, s) => t + s.ms, 0);
        this._rotaryAxes = getRotaryAxes(); // which Cartesian axis each rotary axis (a/b) spins around

        // Cuts: blue→cyan gradient by depth across the whole scene
        let feedCol = null;
        if (feedPos.length) {
            const zMin = bounds ? bounds.minZ : 0, zRange = bounds ? (bounds.maxZ - bounds.minZ) || 1 : 1;
            const cLow = new THREE.Color(FEED_LOW), cHigh = new THREE.Color(FEED_HIGH), tmp = new THREE.Color();   // t317 — feed gradient endpoints from the ONE palette
            feedCol = [];
            for (let i = 0; i < feedPos.length; i += 3) { tmp.copy(cLow).lerp(cHigh, (feedPos[i + 2] - zMin) / zRange); feedCol.push(tmp.r, tmp.g, tmp.b); }
        }
        // Colours match the wizard visualiser
        this.lineGroups.feed = this._addLine(feedPos, { vertexColors: feedCol });
        this.lineGroups.rapid = this._addLine(rapidPos, { color: PATH_TYPES.rapid.color, opacity: 0.6 });   // t317 — colours from the ONE palette (opacity = 3D line-group base, a 3D render detail)
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.lineGroups.retract = this._addLine(retractPos, { color: PATH_TYPES.retract.color, opacity: 0.85 });
        this.lineGroups.probe = this._addLine(probeFastPos, { color: PATH_TYPES.probeFast.color, dotted: true });
        this.lineGroups.probeSlow = this._addLine(probeSlowPos, { color: PATH_TYPES.probeSlow.color });
        this.lineGroups.jog = this._addLine(jogPos, { color: PATH_TYPES.jog.color, opacity: 0.95, dashed: true });

        // Ordered "executed trail" overlay: the whole route as one bold line, in travel order, revealed up to
        // the tool head via setDrawRange while playing (see _animTick / _dimRoute). The type-grouped lines above
        // are the faint route underneath. Amber matches the tool marker.
        if (this._trailLine) { this.pathGroup.remove(this._trailLine); this._trailLine.geometry.dispose(); this._trailLine.material.dispose(); this._trailLine = null; }
        // New geometry → the old tip indices/orig are stale; clear them, and drop _trailOn so a rebuild during
        // play re-arms the trail (re-dims the route + un-hides the bold line) on the next setToolPosition.
        this._trailTipIdx = null; this._trailTipOrig = null; this._trailOn = false; this._trailFat = null;
        if (animSegs.length) {
            const tp = [], tc = [], C = new THREE.Color();
            for (const s of animSegs) {
                tp.push(s.ax, s.ay, s.az, s.bx, s.by, s.bz);
                C.set(s.col != null ? s.col : 0xffe14d);
                tc.push(C.r, C.g, C.b, C.r, C.g, C.b);   // bold trail coloured per move-type (probe blue, rapid yellow, …)
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
            g.setDrawRange(0, 0);
            const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 6 }); mat.depthTest = false;   // 2× bolder; linewidth best-effort (ANGLE caps at 1px → see _trailTube for true thickness)
            const line = new THREE.LineSegments(g, mat); line.renderOrder = 22; line.visible = false;
            this.pathGroup.add(line);
            this._trailLine = line;
            // Fat copies: children of the trail line, sharing g + mat → they inherit its draw-range, tip edits,
            // per-vertex colours and visibility. _layoutTrailFat() offsets them ±right/±up for a thick line.
            this._trailFat = [];
            for (let k = 0; k < 4; k++) { const c = new THREE.LineSegments(g, mat); c.renderOrder = 21; line.add(c); this._trailFat.push(c); }
            this._layoutTrailFat();
        }

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
        } else if (opt.dashed || opt.dotted) {
            const op = opt.opacity != null ? opt.opacity : 1;
            const dashSize = opt.dotted ? 0.6 : 3, gapSize = opt.dotted ? 1.4 : 2;   // dotted = tiny dashes
            mat = new THREE.LineDashedMaterial({ color: opt.color, transparent: op < 1, opacity: op, dashSize, gapSize });
        } else {
            const op = opt.opacity != null ? opt.opacity : 1;
            mat = new THREE.LineBasicMaterial({ color: opt.color, transparent: op < 1, opacity: op });
        }
        mat.depthTest = false;            // draw the toolpath on top of the gizmo / stock
        const lines = new THREE.LineSegments(g, mat);
        lines.renderOrder = 20;           // above the gizmo (11–13); the anim tool (25) stays on top
        if (opt.dashed || opt.dotted) lines.computeLineDistances();
        this.pathGroup.add(lines);
        return lines;
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

        // Rescale the floor grid to roughly match the part footprint. Anchor it to the stock bottom
        // (the table) so the stock always rests on the grid — otherwise a deep move (e.g. Z-first probe
        // in the corner wizard) drags b.minZ below the stock bottom and the stock appears to float.
        // Floor grid + axis labels FOLLOW THE MACHINE ENVELOPE when it's shown (centre + footprint + floor);
        // otherwise they track the part/stock footprint.
        const m = this._machine;
        const useMch = m && m.show && m.x && m.y && m.z;
        // PART-frame layout (the axis lines mark part-zero and ride the part frame → always part-local coords).
        // Each axis line spans only ITS OWN extent (pHalfX/pHalfY) — not the larger span — so the shorter axis
        // doesn't overshoot (the green-line-outward bug). pSpan stays the overall span for grid/label sizing.
        const pSpan = Math.max(sx, sy, 10), pHalf = pSpan / 2;
        const pHalfX = Math.max(sx, 10) / 2, pHalfY = Math.max(sy, 10) / 2;
        // Floor = the stock's BOTTOM in part-local Z (datum-aware: 0 for a table-zero datum, -height for a top-zero
        // datum) so the stock always rests ON the grid/table; falls back to -height, then the data bounds.
        const pFloor = (this._stock && this._stock.show && this._stock.z > 0)
            ? (this._stockFloorZ != null ? this._stockFloorZ : -this._stock.z) : b.minZ;
        // GRID + edge labels live in the SCENE: linked to the ENVELOPE footprint in MACHINE coords (home at scene 0,
        // fixed) when the envelope is shown, else the part/stock footprint.
        let gCx = cx, gCy = cy, gFloor = pFloor, gW = Math.max(sx, 10), gH = Math.max(sy, 10);
        let gHalfX = pHalf, gHalfY = pHalf, gSpan = pSpan;
        if (useMch) {
            gCx = m.x / 2; gCy = m.y / 2;                       // envelope centre (MACHINE coords)
            gW = Math.abs(m.x); gH = Math.abs(m.y);
            gHalfX = Math.abs(m.x) / 2; gHalfY = Math.abs(m.y) / 2; gSpan = Math.max(Math.abs(m.x), Math.abs(m.y));
            gFloor = Math.min(0, m.z);                          // machine table — FIXED; the part rides the WCS (_partShift)
        }
        // The grid/table OVERHANGS the envelope (or stock) footprint by a few cm so it isn't flush with the machine
        // walls — like a real table extending past the travel limits. Labels stay at the true coordinate extent
        // (gHalfX/gHalfY below); only the floor/table is enlarged.
        const GRID_OVERHANG = 30;   // ~3 cm each side
        const tW = gW + GRID_OVERHANG * 2, tH = gH + GRID_OVERHANG * 2;
        this._gridParams = { cx: gCx, cy: gCy, floor: gFloor, w: tW, h: tH };
        this._layoutGrid(gCx, gCy, gFloor, tW, tH);
        if (this._gridLabels) {
            const off = gSpan * 0.07, L = this._gridLabels;
            // +X / +Y at the +scene end (true coordinate directions); labels at the centre of each envelope/grid edge.
            // Scale is applied per-frame in _scaleMarkers (constant on-screen size, independent of zoom).
            L.xp.position.set(gCx + gHalfX + off, gCy, gFloor); L.xn.position.set(gCx - gHalfX - off, gCy, gFloor);
            L.yp.position.set(gCx, gCy + gHalfY + off, gFloor); L.yn.position.set(gCx, gCy - gHalfY - off, gFloor);
        }
        // Axis lines mark PART-ZERO — part-local (they ride the part frame, which offsets them to +workOrigin in
        // machine view): X red along y=0, Y green along x=0, over the part footprint at the part floor.
        if (this._axisLineX) { const px = this._axisLineX.geometry.attributes.position; px.setXYZ(0, -pHalfX, 0, pFloor); px.setXYZ(1, pHalfX, 0, pFloor); px.needsUpdate = true; }
        if (this._axisLineY) { const py = this._axisLineY.geometry.attributes.position; py.setXYZ(0, 0, -pHalfY, pFloor); py.setXYZ(1, 0, pHalfY, pFloor); py.needsUpdate = true; }
        // Z line: spans the ENVELOPE Z extent (its own travel) when the envelope is shown — so it matches the X/Y
        // lines and doesn't overshoot the real travel. Otherwise it rides the part frame: from the part floor up the
        // Z extent (sz), with a small min so a flat part still shows a stub. Min is tied to the Z extent, NOT the XY
        // span — else a wide footprint inflates the Z axis.
        if (this._axisLineZ) {
            const zBot = useMch ? Math.min(0, m.z) : pFloor;
            const zTop = useMch ? Math.max(0, m.z) : Math.max(pFloor + Math.max(sz, 10) * 0.3, b ? b.maxZ : 0);
            const pz = this._axisLineZ.geometry.attributes.position; pz.setXYZ(0, 0, 0, zBot); pz.setXYZ(1, 0, 0, zTop); pz.needsUpdate = true;
        }
        // Work-origin gizmo sits at the X/Y axis-line crossing (part-zero, at the datum floor Z) so it marks the WCS.
        if (this._originGizmo) this._originGizmo.position.set(0, 0, pFloor);

        this._applyCamera();
    }

    // A "nice" grid increment (1/2/5 × 10^n) targeting ~14 cells across the larger footprint — unless the user
    // pinned a fixed mm increment in Preview settings (_gridStep > 0).
    _niceGridStep(span) {
        if (this._gridStep > 0) return this._gridStep;
        const raw = (span || 100) / 14;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / pow;
        return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
    }

    // Rebuild the floor grid for a width×height footprint centred at (cx,cy) on the z=floor plane. Lines run at
    // multiples of the increment FROM THE ORIGIN (scene 0 → a line lands on each axis) and are CLIPPED to the
    // footprint, plus a border so the grid is always bounded. Geometry only rebuilds when the layout changes.
    _layoutGrid(cx, cy, floor, width, height) {
        if (!this.grid) return;
        const THREE = this.THREE;
        const step = this._niceGridStep(Math.max(width, height));
        this.grid.position.set(cx, cy, floor);
        // The grid IS the table: a solid surface fixed in the MACHINE frame, coincident with the grid lines and
        // sized to the same (overhung) footprint, so the stock visibly rests on it. (Replaces the old part-riding
        // bed — one floor, not two.) Shown whenever a stock or machine envelope is present.
        if (!this.tableMesh) {
            this.tableMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ color: 0x222a31, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
            this.tableMesh.renderOrder = -1;   // behind the stock / toolpath
            this.scene.add(this.tableMesh);
        }
        this.tableMesh.position.set(cx, cy, floor - 0.05);   // just under the grid lines (avoid z-fighting)
        this.tableMesh.scale.set(width, height, 1);
        this.tableMesh.visible = !!((this._machine && this._machine.show) || (this._stock && this._stock.show && this._stock.z > 0));
        const key = [cx, cy, floor, width, height, step].map((v) => Math.round(v * 100)).join('|');
        if (this._gridKey === key) return;
        this._gridKey = key;
        const hw = width / 2, hh = height / 2;
        const xMin = cx - hw, xMax = cx + hw, yMin = cy - hh, yMax = cy + hh;
        const pts = [];
        for (let k = Math.ceil(xMin / step - 1e-9); k <= Math.floor(xMax / step + 1e-9); k++) {
            const x = k * step - cx; pts.push(x, yMin - cy, 0, x, yMax - cy, 0);
        }
        for (let j = Math.ceil(yMin / step - 1e-9); j <= Math.floor(yMax / step + 1e-9); j++) {
            const y = j * step - cy; pts.push(xMin - cx, y, 0, xMax - cx, y, 0);
        }
        pts.push(-hw, -hh, 0, hw, -hh, 0, hw, -hh, 0, hw, hh, 0, hw, hh, 0, -hw, hh, 0, -hw, hh, 0, -hw, -hh, 0); // border
        const g = this.grid.geometry;
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
        g.computeBoundingSphere();
    }

    // Preview → grid spacing (mm; 0 = auto). Re-lays the grid in place (no camera change).
    setGridStep(step) {
        const s = Number(step) || 0;
        if (s === this._gridStep) return;
        this._gridStep = s; this._gridKey = null;
        const p = this._gridParams;
        if (p) { this._layoutGrid(p.cx, p.cy, p.floor, p.w, p.h); this.render(); }
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
        const m = this._machine, useMch = m && m.show && m.x && m.y && m.z;
        const sh = this.partFrame ? this.partFrame.shift : { x: 0, y: 0, z: 0 };   // part-frame offset (+WCS in machine view, else 0)
        const d = this._dataBounds;
        if (d) b = this._growBounds(b, d.minX + sh.x, d.minY + sh.y, d.minZ + sh.z, d.maxX + sh.x, d.maxY + sh.y, d.maxZ + sh.z);
        const s = this._stock;
        if (s && s.show && s.x > 0 && s.y > 0 && s.z > 0) b = this._growBounds(b, sh.x, sh.y, sh.z - s.z, sh.x + s.x, sh.y + s.y, sh.z);
        if (useMch) {
            // envelope corners in MACHINE coords (home at scene 0; the part rides +workOrigin)
            b = this._growBounds(b, Math.min(0, m.x), Math.min(0, m.y), Math.min(0, m.z), Math.max(0, m.x), Math.max(0, m.y), Math.max(0, m.z));
        }
        if (b) this.fit(b);
        this.render();
    }

    // Translucent stock block — WCS zero at the top, min XY corner: X[0..x] Y[0..y] Z[-z..0]
    setStock(stock) {
        const THREE = this.THREE;
        this._stock = stock || null;
        this._stockFloorZ = null;   // stock bottom in part-local Z (datum-aware) → the table/grid floor; set below
        // The stock lives in a part group so a rotary move can spin it about its own axis.
        if (!this._partGroup) { this._partGroup = new THREE.Group(); this.partFrame.add(this._partGroup); }   // stock rides the part frame
        const pg = this._partGroup;
        pg.rotation.set(0, 0, 0); // at rest; the play loop re-applies the angle each frame
        if (this.stockMesh) { pg.remove(this.stockMesh); this.stockMesh.geometry.dispose(); this.stockMesh.material.dispose(); this.stockMesh = null; }
        if (this.stockEdges) { pg.remove(this.stockEdges); this.stockEdges.geometry.dispose(); this.stockEdges.material.dispose(); this.stockEdges = null; }
        if (this._rotaryFixture) {   // dark chuck + tailstock "4th-axis" rig (purely visual) — rebuilt below for any shown stock when the rig is on
            pg.remove(this._rotaryFixture);
            this._rotaryFixture.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
            this._rotaryFixture = null;
        }
        if (stock && stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0) {
            const pocket = stock.shape === 'pocket';
            const fillCol = pocket ? 0x6a8fbe : 0x8fae6a;  // pocket = blue, boss = green
            const edgeCol = pocket ? 0x86b6ff : 0xa6d77c;
            let geo;
            const mat = new THREE.MeshLambertMaterial({ color: fillCol, transparent: true, opacity: this._stockOpacity(), depthWrite: false });   // SHADED (lit) stock; opacity per sim mode
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
            } else if (stock.shape === 'cylinder') {
                // Rotary cylinder — lies along the declared rotary axis (around X = horizontal
                // 4th axis, around Z = vertical table). Defaults to X (horizontal) when no rotary
                // axis is declared: the templates store length in X, and a 4th axis is typically
                // along X. Diameter = the smaller of the two cross-section dims.
                const axis = Object.values(getRotaryAxes())[0] || 'x';
                const dims = { x: stock.x, y: stock.y, z: stock.z };
                const cross = axis === 'x' ? [dims.y, dims.z] : axis === 'y' ? [dims.x, dims.z] : [dims.x, dims.y];
                const r = barRadius(stock, cross[0], cross[1]);   // SPATIAL-MODEL inc2: declared stock.diameter wins, else min(cross)/2
                geo = new THREE.CylinderGeometry(r, r, dims[axis], 48); // three.js cylinders run along Y
                if (axis === 'x') geo.rotateZ(Math.PI / 2);
                else if (axis === 'z') geo.rotateX(Math.PI / 2);
                mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
            } else {
                geo = new THREE.BoxGeometry(stock.x, stock.y, stock.z);
                mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
            }
            mesh.geometry = geo;
            mesh.material = mat;
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.55 }));
            edges.position.copy(mesh.position);
            // Pivot the part group on the stock centre, then offset the meshes into its local
            // space, so partGroup.rotation spins the stock about its own centre axis.
            const C = new THREE.Vector3(stock.x / 2, stock.y / 2, -stock.z / 2);
            // Datum = which point of the stock is part-zero (default front-left-top corner). Pin = place that datum
            // at a WCS offset (else the origin). pg.position = the stock centre in scene; the mesh stays centred on
            // it so a rotary move still spins about the part axis.
            // Datum = which BOX POINT of the stock is part-zero: a 3-char code [X][Y][Z], each n(min)/c(centre)/
            // p(max). Migrate the legacy XY-only fl/fr/bl/br/center (all top-Z). Dx/Dy/Dz = the datum's offset
            // from the stock's min corner, so pg.position places that point at the origin (or the WCS pin).
            const OLD_DATUM = { fl: 'nnp', fr: 'pnp', bl: 'npp', br: 'ppp', center: 'ccp' };
            let dcode = stock.datum || 'nnp';
            if (!/^[ncp]{3}$/.test(dcode)) dcode = OLD_DATUM[dcode] || 'nnp';
            const dfrac = { n: 0, c: 0.5, p: 1 };
            const D = [dfrac[dcode[0]] * stock.x, dfrac[dcode[1]] * stock.y, dfrac[dcode[2]] * stock.z];   // [Dx,Dy,Dz] from min corner (Dz: 0=bottom, z=top)
            // XY follows the datum (the stock's WCS-XY pin — for convenience). Z is the subtle one: an
            // incremental / start-anchored op (a probe) is operator-relative — it references the stock SURFACE, not
            // the datum (the datum is a mill/WCS-Z concept) — so present the stock TOP-AT-0 regardless of datum, so
            // render == collision == start marker == path. ABSOLUTE (mill) stays datum-aware: the datum-Z there is a
            // real feature (a bottom datum offsets the path up by the stock height for a precision height cut).
            // See docs/archive/probe-preview-frame-issues.md.
            const dzCol = this._anchorToStart ? stock.z : D[2];   // start-anchored → top-at-0; mill → datum-aware
            pg.position.set(stock.x / 2 - D[0], stock.y / 2 - D[1], stock.z / 2 - dzCol);
            this._stockFloorZ = pg.position.z - stock.z / 2;   // stock bottom → where the table/grid sits
            mesh.position.sub(C);
            edges.position.sub(C);
            this.stockMesh = mesh; pg.add(mesh);
            this.stockEdges = edges; pg.add(edges);
            // The 4th-axis rig (chuck + tailstock) is a SEPARATE op-specific overlay (opt-in, like ATC's magazine),
            // INDEPENDENT of the stock SHAPE — so it frames a round bar OR a rectangular part on the rotary axis
            // (e.g. the rotary clock clocks a flat on a box). pg origin is the stock centre, so place() aligns either way.
            if (this._showRotaryFixture) {
                const fAxis = Object.values(getRotaryAxes())[0] || 'x';
                const fd = { x: stock.x, y: stock.y, z: stock.z };
                const fCross = fAxis === 'x' ? [fd.y, fd.z] : fAxis === 'y' ? [fd.x, fd.z] : [fd.x, fd.y];
                // round bar = the inscribed Ø (min cross); a box = the larger cross so the chuck/jaws wrap the part.
                const fr = (stock.shape === 'cylinder' ? Math.min(fCross[0], fCross[1]) : Math.max(fCross[0], fCross[1])) / 2;
                // round bar → 3-jaw self-centring; rectangular part → 4-jaw independent on the flat faces (cu/cv).
                this._buildRotaryFixture(pg, fAxis, fr, fd[fAxis] / 2, { jaws: stock.shape === 'cylinder' ? 3 : 4, cu: fCross[0], cv: fCross[1] });
            }
            // The table the stock rests on is the GRID floor (a fixed machine-frame surface — see _layoutGrid), not a
            // per-stock bed. So nothing extra to draw here.
        }
        this.partFrame.update(this._partShift());   // stock pin / WCS may have changed → re-place op+stock at the stock's WCS
        if (this._jogA) this._applyPartRotation(this._jogA, 0);   // keep a manual A jog after a stock rebuild (set above to rest)
    }

    /**
     * A purely-visual rotary "4th-axis" rig framing a cylinder bar so it reads as a real lathe-style fixture:
     * a dark metallic CHUCK (disc + 3 jaws) gripping the LO end (axis −L) and a TAILSTOCK (body + live-centre
     * cone) supporting the HI end (axis +L). Built directly into the part group (pg-local origin = bar centre),
     * so it rides the datum/WCS and spins with the stock. `axis` = the rotary Cartesian axis ('x'|'y'|'z'),
     * `r` = bar radius, `L` = half the bar length along the axis. Does NOT affect probe collision.
     */
    _buildRotaryFixture(pg, axis, r, L, opts = {}) {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        // Orient a Y-aligned geometry to the bar axis the SAME way the cylinder stock is oriented.
        const orientToAxis = (geo) => { if (axis === 'x') geo.rotateZ(Math.PI / 2); else if (axis === 'z') geo.rotateX(Math.PI / 2); return geo; };
        // Send a Y-aligned cone's natural tip (+Y) to point along −axis (back AT the bar): x→−X, y→−Y, z→−Z.
        const aimConeAtBar = (geo) => { if (axis === 'x') geo.rotateZ(Math.PI / 2); else if (axis === 'y') geo.rotateZ(Math.PI); else geo.rotateX(-Math.PI / 2); return geo; };
        // (axisCoord, u, v) → pg-local Vector3, where u,v are the two cross-plane coords in the SAME order as the
        // cylinder's cross dims (x→[y,z], y→[x,z], z→[x,y]).
        const place = (a, u, v) => axis === 'x' ? new THREE.Vector3(a, u, v) : axis === 'y' ? new THREE.Vector3(u, a, v) : new THREE.Vector3(u, v, a);
        const chuckMat = () => new THREE.MeshLambertMaterial({ color: 0x5a626c, transparent: true, opacity: 0.9 });
        const jawMat = () => new THREE.MeshLambertMaterial({ color: 0x8a929c, transparent: true, opacity: 0.9 });

        // --- CHUCK at the LO end (axis −L): a dark disc just outside the bar end, + 3 jaws on its inner face ---
        const chuckDepth = r * 0.7;
        const disc = new THREE.Mesh(orientToAxis(new THREE.CylinderGeometry(r * 1.6, r * 1.6, chuckDepth, 32)), chuckMat());
        disc.position.copy(place(-L - chuckDepth / 2, 0, 0));
        grp.add(disc);
        const jawA = -L + r * 0.15;   // jaws sit on the chuck's inner face, reaching onto the bar end
        const axisVec = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
        // Jaw COUNT follows the part: a round bar → 3-jaw self-centring (120°); a rectangular part → 4-jaw
        // independent (90°), each jaw on a flat FACE (face half-widths cu/cv, not a single radius).
        const jaws = opts.jaws === 4 ? 4 : 3, cu = opts.cu || 2 * r, cv = opts.cv || 2 * r;
        for (let i = 0; i < jaws; i++) {
            const ang = (i * 2 * Math.PI) / jaws;
            const ru = jaws === 4 ? (i % 2 === 0 ? cu / 2 : cv / 2) * 0.98 : r * 0.92;   // 4-jaw rides each face; 3-jaw a circle
            const jaw = new THREE.Mesh(orientToAxis(new THREE.BoxGeometry(r * 0.5, r * 0.4, r * 0.3)), jawMat());
            jaw.position.copy(place(jawA, Math.cos(ang) * ru, Math.sin(ang) * ru));
            jaw.rotateOnWorldAxis(axisVec, ang);   // spin each jaw to face the centre → a symmetric array (not same-facing slabs)
            grp.add(jaw);
        }

        // --- TAILSTOCK at the HI end (axis +L): a live-centre CONE protruding toward the bar, body BEHIND it ---
        const coneLen = r * 0.9;
        const cone = new THREE.Mesh(aimConeAtBar(new THREE.ConeGeometry(r * 0.45, coneLen, 24)), jawMat());
        // Tip points toward −axis and lands ~at the bar end (axis = L). Cone is centred on its own length,
        // so its centre sits coneLen/2 OUTSIDE the bar end → tip at +L.
        cone.position.copy(place(L + coneLen / 2, 0, 0));
        grp.add(cone);
        const bodyLen = r * 0.8;
        const body = new THREE.Mesh(orientToAxis(new THREE.CylinderGeometry(r * 0.8, r * 0.8, bodyLen, 24)), chuckMat());
        // Body sits BEHIND the cone base (axis = L+coneLen) so the light live-centre cone protrudes from it instead
        // of being buried inside the dark body (which read as a grey cone-in-a-box before).
        body.position.copy(place(L + coneLen + bodyLen / 2, 0, 0));
        grp.add(body);

        this._rotaryFixture = grp;
        pg.add(grp);
    }

    /** Opt-in op-specific preview: show/hide the 4th-axis rig (chuck + tailstock) around a cylinder stock.
     *  Only the rotary probe wizards turn this on (mirrors setMagazine for ATC), so it never appears elsewhere. */
    setRotaryFixture(on) {
        on = !!on;
        this._showRotaryJog(on);   // rotary op → reveal the manual A± jog row (hidden for non-rotary ops)
        if (on === this._showRotaryFixture) return;
        this._showRotaryFixture = on;
        if (this._stock) this.setStock(this._stock);   // rebuild the stock so the rig appears/disappears
    }

    /** Show/hide the manual A-axis jog row in the jog pendant. Only rotary ops (which set the 4th-axis fixture)
     *  show it, so a non-rotary op never offers an A jog. The pendant wires it (setupJogPendant). */
    _showRotaryJog(on) {
        const row = this.jogPendant && this.jogPendant.querySelector('.jog-a-row');
        if (row) row.style.display = on ? '' : 'none';
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

    // The part-frame offset = machine coords of part-zero. The whole setup (op + stock) sits at the STOCK's WCS
    // (its "Sits at WCS" pin, looked up in the WCS table) when the machine envelope is shown; else 0 (part-zero at
    // scene 0, the per-op view). ONE source for op + stock so they never diverge. See machine-frame-sim-spec.
    _partShift() {
        const m = this._machine, s = this._stock;
        if (!(m && m.show && m.x && m.y && m.z)) return { x: 0, y: 0, z: 0 };
        // XY — the stock's WCS (G54 XY): the persistent fixture position.
        let x = 0, y = 0, wcsZ = 0;
        const pin = s && s.pin, wt = m.wcs && m.wcs.table;
        if (pin && pin !== 'origin' && Array.isArray(wt)) {
            const t = wt[parseInt(String(pin).replace(/[^0-9]/g, ''), 10) - 54];   // 'g54' → table[0]
            if (t) { x = Number(t.x) || 0; y = Number(t.y) || 0; wcsZ = Number(t.z) || 0; }
        } else {
            // No stock pinned to a WCS (e.g. an ATC/machine-frame preview: G53 tool changes, no real workpiece). Sit the
            // part frame at the ACTIVE WCS so a G53/machine move — which the engine offsets by the active wcsOffset —
            // CANCELS to raw machine coords on the FIXED envelope, aligned with the magazine (t163). XY only; Z stays per
            // the datum (absolute-machine-Z is deferred to P-B). Mirror wcsForViz's fallback chain EXACTLY (t173): the
            // active WCS TABLE row, else m.workOrigin (a partial/legacy profile — workOrigin set but no table — else the
            // engine offsets G53 by workOrigin while this returns 0 → the path drifts off the raw-machine magazine), else 0.
            const a = (Array.isArray(wt) && wt[(((m.wcs && m.wcs.active) || 1) - 1)]) || m.workOrigin;
            if (a) { x = Number(a.x) || 0; y = Number(a.y) || 0; }
        }
        // Z — the stock rests on the FIXED machine table; Z0 floats at the datum height (you re-zero Z per part, so
        // the stored WCS-Z is ignored — it's volatile). Real Z control is per-path code (offZ + the datum-Z offset),
        // not the sim placement. No stock → just the WCS-Z. (Absolute-machine-Z view is deferred to machine-frame fidelity.)
        const tableFloor = Math.min(0, m.z), stockShown = s && s.show && s.z > 0 && this._stockFloorZ != null;
        const z = stockShown ? tableFloor - this._stockFloorZ : wcsZ;
        return { x, y, z };
    }

    // Wireframe machine envelope (fixed machine coords; home at scene 0) + machine-zero axes. The PART frame carries
    // op/stock to the stock's WCS instead, so the envelope never moves.
    setMachine(machine) {
        const THREE = this.THREE;
        this._machine = machine || null;
        this.partFrame.update(this._partShift());   // op + stock ride the STOCK's WCS (machine view); else part-zero at scene 0
        if (this.machineBox) { this.scene.remove(this.machineBox); this.machineBox.geometry.dispose(); this.machineBox.material.dispose(); this.machineBox = null; }
        if (this.machineAxes) { this.scene.remove(this.machineAxes); if (this.machineAxes.geometry) this.machineAxes.geometry.dispose(); if (this.machineAxes.material) this.machineAxes.material.dispose(); this.machineAxes = null; }
        const sx = machine ? machine.x : 0, sy = machine ? machine.y : 0, sz = machine ? machine.z : 0;
        if (machine && machine.show && sx && sy && sz) {
            const src = new THREE.BoxGeometry(Math.abs(sx), Math.abs(sy), Math.abs(sz));   // |travel| — the sign is just the home direction
            const eg = new THREE.EdgesGeometry(src);
            src.dispose();
            const box = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6c7a8c, transparent: true, opacity: 0.4 }));
            const sh = this.partFrame.shift;   // part-zero offset (the stock's WCS) — home shows when it's separate
            // Envelope spans machine 0..travel (signed) in MACHINE coords — home stays at scene 0 (fixed); the PART
            // frame shifts to the stock's WCS instead, so the envelope never moves when the WCS changes.
            box.position.set(sx / 2, sy / 2, sz / 2);
            this.machineBox = box; this.scene.add(box);
            // Machine-zero (home) marker — ONLY when it is SEPARATE from part-zero (the part rides a non-zero WCS);
            // at the origin it would just duplicate the part-zero axes. Marks home at scene 0 (X red / Y green / Z blue).
            if (sh.x || sh.y || sh.z) {
                const axLen = (Math.min(Math.abs(sx), Math.abs(sy), Math.abs(sz)) * 0.3) || 40;
                const ax = new THREE.AxesHelper(axLen);
                ax.position.set(0, 0, 0);   // machine home at scene 0 (part-zero rides the part frame at +workOrigin)
                if (ax.material) { ax.material.transparent = true; ax.material.opacity = 0.85; ax.material.depthTest = false; }
                ax.renderOrder = 5;
                this.machineAxes = ax; this.scene.add(ax);
            }
        }
        if (this._magazine) this.setMagazine(this._magazine);   // re-place pockets when the envelope/WCS changes
        if (this._stock && this._stock.pin && this._stock.pin !== 'origin') this.setStock(this._stock);   // re-pin the stock to its WCS
    }

    /**
     * ATC magazine in 3D on the envelope: a tool stub + pocket ring + number at each pocket's MACHINE position.
     * The magazine is a FIXED machine object (pockets are absolute machine coords), so it rides the FIXED machine
     * frame at RAW machine coords — exactly like the envelope box + home (added straight to this.scene), NOT the
     * moving part frame / workOrigin (t163: dropping the old − workOrigin made the pockets drift off the envelope by
     * the WCS offset once a real non-zero WCS was pulled). pockets = [{x,y,z,dia,length,color,pocket,tool}]. [] / null clears.
     */
    setMagazine(pockets) {
        const THREE = this.THREE;
        if (this._magGroup) {
            this.scene.remove(this._magGroup);
            this._magGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose && mm.dispose()); });
            this._magGroup = null;
        }
        this._magazine = (pockets && pockets.length) ? pockets : null;
        if (!this._magazine) { this.render(); return; }
        const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
        const grp = new THREE.Group();
        this._magazine.forEach((p, i) => {
            const px = n(p.x, 0), py = n(p.y, 0), pz = n(p.z, 0);   // RAW machine coords — fixed machine frame, like the envelope (t163)
            const td = p.tool || { type: 'endmill', dia: n(p.dia, 6), length: Math.max(15, n(p.length, 30)) };
            const dia = n(td.dia, 6), len = Math.max(15, n(td.length, 30));
            const col = (p.color != null) ? p.color : 0xffab40;   // amber — distinct from stock + the cyan toolpath
            // Real tool: revolve its accurate half-profile (round ballnose, pointed V-bit) — tip at the pocket Z,
            // body extends up. Lathe revolves around Y, so rotate Y→Z for the Z-up scene.
            const pts = toolHalfProfile(td).map((q) => new THREE.Vector2(Math.max(0.001, q[0]), q[1]));
            const geo = new THREE.LatheGeometry(pts, 24); geo.rotateX(Math.PI / 2);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false }));
            mesh.position.set(px, py, pz - len);   // align tool TOPS at the pocket Z (holder reference); tips hang down by length
            grp.add(mesh);
            // Pocket bounding box: a wireframe slot enclosing the tool, marking the pocket extent on the envelope.
            const bw = Math.max(dia * 1.8, 14), bh = len;
            const bgeo = new THREE.BoxGeometry(bw, bw, bh);
            const box = new THREE.LineSegments(new THREE.EdgesGeometry(bgeo), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.5 }));
            box.position.set(px, py, pz - bh / 2); grp.add(box);
            bgeo.dispose();
            const sp = this._makeNumberSprite(p.pocket != null ? p.pocket : i + 1);
            sp.position.set(px, py, pz + 7); grp.add(sp);
        });
        this._magGroup = grp; this.scene.add(grp);
        this.render();
    }

    /**
     * ATC FIRMWARE push-station highlight (P-C.1a, t171): mark the TAUGHT fixed-station push region — push-start →
     * push-end (the swap stroke) → retreat — on the FIXED machine frame at RAW machine coords, exactly like the
     * magazine + envelope (the station #1320-1326 are MACHINE/G53 coords). This is the firmware method's declared
     * choreography (ATC_CHOREOGRAPHY.firmware); the already-animated G53 push travel lands here (post-P-A). Distinct
     * teal-green so it reads apart from the amber magazine / cyan path / yellow stock. region = { z, start{x,y},
     * end{x,y}, retreat{x,y} } (machine coords) or null to clear.
     */
    highlightStation(region, label) {
        const THREE = this.THREE;
        if (this._stationGroup) {
            this.scene.remove(this._stationGroup);
            this._stationGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
            this._stationGroup = null;
        }
        this._station = region || null;
        if (!region) { this.render(); return; }
        const col = 0x35ff9e, z = Number(region.z) || 0;
        const pts = ['start', 'end', 'retreat'].map((k) => region[k]).filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
        if (!pts.length) { this.render(); return; }
        const grp = new THREE.Group();
        // the push PATH (start → end → retreat) as a bold line at the station Z, on the fixed machine floor
        const lp = [];
        pts.forEach((p) => lp.push(Number(p.x), Number(p.y), z));
        const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
        const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthTest: false }));
        line.renderOrder = 16; grp.add(line);
        // a sphere marker at each taught point; the push-END (the swap stroke's end, index 1) is emphasised
        pts.forEach((p, i) => {
            const r = i === 1 ? 5 : 3.5;
            const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: i === 1 ? 0.9 : 0.55, depthTest: false }));
            m.position.set(Number(p.x), Number(p.y), z); m.renderOrder = 17; grp.add(m);
        });
        // label above the swap-stroke midpoint (start ↔ end)
        const a = pts[0], b = pts[1] || pts[0];
        const sp = this._makeTextSprite(label || 'PUSH STATION', '#35ff9e');
        sp.position.set((Number(a.x) + Number(b.x)) / 2, (Number(a.y) + Number(b.y)) / 2, z + 22); sp.renderOrder = 18; grp.add(sp);
        this._stationGroup = grp; this.scene.add(grp);
        this.render();
    }

    /**
     * ATC firmware tool-SWAP (P-C.1b, t175): the OLD (retired) tool left at the push STATION after a real tool change
     * (#1300 flipped) — a dimmed-grey copy of its real profile at the push-END (#1323/1324) on the FIXED machine frame
     * (machine coords, like the station highlight). The NEW tool is put on the spindle via setSimTool (rides the part
     * frame @ WCS — cross-frame, reusing P-A). Reuses the magazine tool builder. Pass null (tool or region) to clear.
     */
    showRetiredTool(tool, region) {
        const THREE = this.THREE;
        if (this._retiredTool) {
            this.scene.remove(this._retiredTool);
            this._retiredTool.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
            this._retiredTool = null;
        }
        if (!tool || !region || !region.end) { this.render(); return; }
        const td = { type: tool.type || 'endmill', dia: Number(tool.dia) || 6, length: Math.max(15, Number(tool.length) || 30) };
        const z = Number(region.z) || 0, ex = Number(region.end.x) || 0, ey = Number(region.end.y) || 0;
        const pts = toolHalfProfile(td).map((q) => new THREE.Vector2(Math.max(0.001, q[0]), q[1]));
        const geo = new THREE.LatheGeometry(pts, 24); geo.rotateX(Math.PI / 2);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9aa4b0, transparent: true, opacity: 0.5, depthWrite: false }));   // dimmed grey = retired
        mesh.position.set(ex, ey, z - td.length);   // tool top at the station Z, tip hangs down (holder reference, like a pocket)
        mesh.renderOrder = 16;
        this._retiredTool = mesh; this.scene.add(mesh);
        this.render();
    }

    /**
     * ATC FIXED-STATION DEVICES (P-C.2b, t179): model the M350 pneumatics at the push station on the FIXED machine
     * frame (raw machine coords, like the highlight/magazine/retired-tool). A PUSHER (a steel-blue piston whose rod
     * extends toward the push-END along the push direction) + a LOCATING PIN (an orange pin that rises to engage). Built
     * in a local frame where +X = the push direction (start→end), then rotated into place. `setStationDevice` animates
     * them on the pneumatic io_change (OUT_PUSHER / OUT_LOCATING_PIN). region = { z, start, end, retreat } or null clears.
     */
    setStationDevices(region) {
        const THREE = this.THREE;
        if (this._deviceGroup) {
            this.scene.remove(this._deviceGroup);
            this._deviceGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
            this._deviceGroup = null; this._pusherRod = null; this._locatingPin = null;
        }
        if (!region || !region.start || !region.end) { this.render(); return; }
        const z = Number(region.z) || 0, sx = Number(region.start.x) || 0, sy = Number(region.start.y) || 0, ex = Number(region.end.x) || 0, ey = Number(region.end.y) || 0;
        const grp = new THREE.Group();
        // PUSHER — a local frame at the push-start with +X = the push direction (start→end); the body sits behind the
        // start, the rod extends toward the end. Rotate the whole group so local +X points down the push axis.
        const theta = Math.atan2(ey - sy, ex - sx);
        const pg = new THREE.Group(); pg.position.set(sx, sy, z); pg.rotation.z = theta;
        const steel = new THREE.MeshBasicMaterial({ color: 0x5b8fc7, transparent: true, opacity: 0.8 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 14), steel); body.position.set(-13, 0, 0); pg.add(body);   // cylinder body, behind the start
        const rod = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9ec7f0, transparent: true, opacity: 0.9 }));
        rod.position.set(this._PUSH_IN = 6, 0, 0);   // retracted (just past the body); extended → this._PUSH_OUT
        this._PUSH_OUT = 44; pg.add(rod); this._pusherRod = rod;
        grp.add(pg);
        // LOCATING PIN — an orange vertical pin near the push-end; rises (engage) / drops (release). Cylinder along Y →
        // rotate to Z (scene up). Retracted low, engaged higher.
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 22, 14), new THREE.MeshBasicMaterial({ color: 0xffa733, transparent: true, opacity: 0.9 }));
        pin.geometry.rotateX(Math.PI / 2);   // along scene Z (vertical)
        this._PIN_DOWN = z - 14; this._PIN_UP = z + 2;
        pin.position.set(ex, ey, this._PIN_DOWN); this._locatingPin = pin; grp.add(pin);
        this._deviceGroup = grp; this.scene.add(grp);
        this.render();
    }

    /** Animate a station/spindle device on its io_change. name 'pusher' (OUT_PUSHER) / 'pin' (OUT_LOCATING_PIN) — the
     *  firmware-push station devices (P-C.2b); or 'collet' (OUT_SPINDLE_UNCLAMP/CLAMP) — the pick-place drawbar collet
     *  on the SPINDLE (P-C.3a). on = true → extend/engage/OPEN, false → retract/release/CLOSE. */
    setStationDevice(name, on) {
        if (name === 'pusher' && this._pusherRod) this._pusherRod.position.x = on ? this._PUSH_OUT : this._PUSH_IN;
        else if (name === 'pin' && this._locatingPin) this._locatingPin.position.z = on ? this._PIN_UP : this._PIN_DOWN;
        else if (name === 'collet') { this._colletOpen = !!on; this._applyColletState(); }
        else return;
        this.render();
    }

    /** FORK / DOCK stations (RapidChange, I4) — a fork the tool PLUNGES into at each dock position; the magnet grip has
     *  no I/O, so the plunge into the fork mechanically does the grab/release. docks = [{x,y,z}] on the FIXED machine
     *  frame (raw machine coords, like the magazine/station). Reuses the device-mesh pattern (setStationDevices). */
    setForkDock(docks) {
        const THREE = this.THREE;
        if (this._forkGroup) {
            this.scene.remove(this._forkGroup);
            this._forkGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
            this._forkGroup = null;
        }
        if (!Array.isArray(docks) || !docks.length) { this.render(); return; }
        const grp = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0x2fb3a3, transparent: true, opacity: 0.72 });   // teal — distinct from magenta setter / orange pin
        docks.forEach((d) => {
            const x = Number(d.x) || 0, y = Number(d.y) || 0, z = Number(d.z) || 0;
            const base = new THREE.Mesh(new THREE.BoxGeometry(26, 26, 4), mat); base.position.set(x, y, z - 2); grp.add(base);
            [-10, 10].forEach((dx) => { const prong = new THREE.Mesh(new THREE.BoxGeometry(4, 26, 18), mat); prong.position.set(x + dx, y, z + 9); grp.add(prong); });   // two prongs — the tool plunges between them
        });
        this._forkGroup = grp; this.scene.add(grp);
        this.render();
    }

    /** The spindle COLLET open/close (P-C.3a): OPEN (M154 drawbar release) → retract a touch + a cyan "released" tint;
     *  CLOSE (M155 lock) → rest + grey (gripping the shank). Re-applied after _buildAnimTool so a tool-swap rebuild of
     *  the assembly keeps the collet's current state. The collet rides the PART frame with the anim tool (cross-frame). */
    _applyColletState() {
        const c = this._animParts && this._animParts.collet;
        if (!c) return;
        c.position.z = this._colletOpen ? 5 : 0;   // released → the collet retracts up a touch (drawbar back)
        if (c.material && c.material.color) c.material.color.set(this._colletOpen ? 0x5fd3ff : 0x9aa6b2);   // cyan open / grey closed
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
        this._layoutTrailFat();
    }

    // Fat trail: 4 offset copies of the trail line (children of _trailLine → they share its geometry, draw-range,
    // tip edits, colours and visibility) nudged ±right/±up in SCREEN space, so the bold executed path renders a
    // few px thick on any GPU (GL linewidth is capped at 1px on ANGLE). Offsets recompute here so the thickness
    // stays ~constant on screen through zoom.
    _layoutTrailFat() {
        const fat = this._trailFat; if (!fat || !fat.length) return;
        const THREE = this.THREE, cam = this.camera;
        const h = (this.renderer && this.renderer.domElement.clientHeight) || 600;
        const fov = ((cam.fov || (this.persp && this.persp.fov) || 45) * Math.PI) / 180;
        const o = ((2 * this.radius * Math.tan(fov / 2)) / h) * 1.1;   // ≈1.1 px (world units at the target distance)
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
        const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
        fat[0].position.copy(right).multiplyScalar(o);
        fat[1].position.copy(right).multiplyScalar(-o);
        fat[2].position.copy(up).multiplyScalar(o);
        fat[3].position.copy(up).multiplyScalar(-o);
    }

    /** Centre-lock the camera on the tool. on → a rAF loop eases the orbit target onto the tool each frame. */
    setFollowCam(on) {
        this.followCam = !!on;
        if (this.followCam) { if (!this._followRaf) this._followTick(); }
    }
    setFollowLerp(v) { const n = +v; if (Number.isFinite(n)) this.followLerp = Math.max(0.01, Math.min(0.6, n)); }
    _followTick() {
        if (!this.followCam || !this.active) { this._followRaf = null; return; }
        if (this._animTool && this._animTool.visible) {
            const before = this.target.clone();
            // The tool rides the partFrame (shifted by +workOrigin to the WCS spot), so .position is its LOCAL coord;
            // lerping the world-space orbit target onto it centres on where the tool would be at machine origin (the
            // reported bug). Use the tool's WORLD position so the lock follows the actual spindle.
            this._animTool.updateWorldMatrix(true, false);
            const tw = this._animTool.getWorldPosition(this._followV3 || (this._followV3 = new THREE.Vector3()));
            this.target.lerp(tw, this.followLerp);
            if (this.target.distanceToSquared(before) > 1e-5) { this._applyCamera(); this.render(); }
        }
        this._followRaf = requestAnimationFrame(() => this._followTick());
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
            if (mode === 'gizmo') {
                if (typeof this.onStartChange === 'function') this.onStartChange(this.starts);
                if (this._syncJogPos) this._syncJogPos();   // refresh the precise X/Y/Z start fields after a drag
            }
            // A click (not a drag) on a marker/label selects it for the jog pendant.
            if (mode !== 'gizmo' && this._downMarker >= 0 && e &&
                Math.hypot(e.clientX - this._downX, e.clientY - this._downY) < 5) {
                this.selectStart(this._downMarker);
            }
            this._downMarker = -1;
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
                this.selectStart(g.pass);   // dragging a marker also selects it for the jog pendant
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
                // Click a numbered marker/label to select it for the jog pendant (applied on
                // pointer-up only if it was a click, not an orbit-drag).
                this._downMarker = (e.button === 0 && !e.shiftKey) ? this._pickMarker(e) : -1;
                this._downX = e.clientX; this._downY = e.clientY;
                // CAD-style: middle = pan, Shift+middle = orbit; left = orbit, right/Shift+left = pan
                if (e.button === 1) mode = e.shiftKey ? 'rot' : 'pan';
                else mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
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
            if (faceIdx !== -2) { // over the ViewCube — the whole square is clickable (near-miss snaps to nearest face)
                this._highlightCubeFace(faceIdx);
                el.style.cursor = 'pointer';
                this._setHighlight(null, null);
                return;
            }
            this._highlightCubeFace(-1);
            const g = this._pickGizmo(e);
            this._setHighlight(g ? g.pass : null, g ? g.axis : null);
            this._updateStockTip(e);   // "stock" tooltip when hovering the stock-WCS marker
        });
        el.addEventListener('pointerleave', () => { if (!mode) { this._setHighlight(null, null); this._highlightCubeFace(-1); } if (this._stockTip) this._stockTip.style.display = 'none'; });
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
            let zoomPoint = hit ? hit.point : null;
            if (!zoomPoint) {
                // No geometry under the cursor — intersect a camera-facing plane through the target so
                // zoom still tracks the cursor over empty space (always zoom toward the cursor).
                const THREE = this.THREE;
                const camDir = new THREE.Vector3();
                this.camera.getWorldDirection(camDir);
                const plane = new THREE.Plane(camDir, -camDir.dot(this.target));
                const p = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(plane, p)) zoomPoint = p;
            }
            if (zoomPoint) this.target.lerp(zoomPoint, 1 - next / old);
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
        
        // Keep the jog pendant overlaid at the bottom of the 3D box (same as the main viewer),
        // rather than dumping it at the bottom of the wizard form.
        if (this.jogPendant) container.appendChild(this.jogPendant);
        
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

    // SLICE 2 (WCS VISIBLE): a momentary GLOW pulse at a marker when its call fires in the sim timeline. kind 'wcs' →
    // the WCS origin gizmo (part-zero / stock datum); 'start' → the first spindle start marker. A soft additive sprite
    // (radial-gradient = a blurred halo of light), expanded + faded over ~0.7s. Self-contained (added → animated →
    // removed) so it never fights the per-frame _scaleMarkers sizing. No engine change — driven by onLineChange.
    _glowTexture() {
        if (this._glowTex) return this._glowTex;
        const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        if (!c) return null;
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.22, 'rgba(255,255,255,0.85)');
        grd.addColorStop(0.55, 'rgba(255,255,255,0.28)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
        this._glowTex = new this.THREE.CanvasTexture(c);
        return this._glowTex;
    }

    // A soft blurred additive GLOW pulse at a WORLD position (the shared primitive for the WCS/start flash + the probe
    // touch glow). Expands + fades over 0.7s, then disposes. Self-contained so it never fights _scaleMarkers.
    _glowAt(worldPos, color) {
        const THREE = this.THREE, tex = this._glowTexture();
        if (!worldPos || !THREE || !tex || !this.scene) return;
        const span = (this._stock && Math.max(this._stock.x || 0, this._stock.y || 0)) || 60;
        const r0 = Math.max(12, span * 0.26), r1 = r0 * 2.3;
        const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(worldPos); sprite.renderOrder = 999;
        this.scene.add(sprite);
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const t0 = now(), dur = 850;
        const tick = () => {
            const u = Math.min(1, (now() - t0) / dur);
            sprite.scale.set(r0 + (r1 - r0) * u, r0 + (r1 - r0) * u, 1);
            mat.opacity = u < 0.28 ? 1 : Math.max(0, 1 - (u - 0.28) / 0.72);   // HOLD bright, then fade (visible)
            this.render();
            if (u < 1) requestAnimationFrame(tick);
            else { this.scene.remove(sprite); mat.dispose(); }
        };
        requestAnimationFrame(tick);
    }

    // SLICE 2 — WCS/start flash: glow the WCS origin gizmo ('wcs', amber) or the first spindle start marker ('start', red).
    flashMarker(kind) {
        const anchor = kind === 'wcs' ? this._originGizmo : (this.spindleMarkers && this.spindleMarkers[0]);
        if (!anchor || !this.THREE) return;
        this._glowAt(anchor.getWorldPosition(new this.THREE.Vector3()), kind === 'wcs' ? 0xffe08a : 0xff7a6a);
    }

    // Keep the disc-fade clock in sync with the editor's speed button (1×/2×/5×/10×): discs fade in SIM time, not wall time.
    setSimSpeed(s) { this._simSpeed = s > 0 ? s : 1; }

    // SLICE 3 — reset the derived probe-WCS (run start / next loop). Live discs are released to fade out on their own.
    resetProbe() {
        this._probeVals = { x: 0, y: 0, z: 0 };
        this._probeAxes = {};
        this._probeContact = null;
        this._probeContacts = [];
        this._pendingDiscs = { x: [], y: [], z: [] };   // discs dropped SINCE THE LAST comp (per axis) — nudgeSurface moves them onto the wall
        this._datumWrite = {};   // the WCS-WRITE centre (#53/#56) per axis — cleared each run/loop (see markDatumWrite)
        this._updateDatum();   // hide the persistent line + datum
    }

    // DATUM follows the WCS-WRITE event, not the probe-contact walls. The engine runs the offset write #[#70+off]=#53/#56
    // (the middle CALCULUS output — the bisected centre); the preview signals THAT value here so the datum gizmo positions
    // OVER the feature centre, not at the last probed wall. SIM-ONLY overlay (the value is already computed — no macro write).
    // #53/#56 are in the SAME part-local frame as the contacts (worker-verified: #53/#56 == the contacts' midpoint == centre).
    markDatumWrite(axis, value) {
        if ('xyz'.indexOf(axis) < 0 || !Number.isFinite(value)) return;
        (this._datumWrite || (this._datumWrite = {}))[axis] = value;
        this._updateDatum();
    }

    // DISC-ON-SURFACE (inc2): a probe op's ENABLED radius-comp ran (createPreviewPanel keys off the declared radiuscomp result
    // var + feeds the SIGNED radius). Slide every disc dropped SINCE THE LAST comp on this axis onto the wall by `delta` =
    // ± the tip radius toward the probe direction. RELATIVE on purpose: the comp's committed result is in the engine's frame,
    // but the disc rides the part frame — a relative ±radius nudge is frame-invariant (the surface IS the contact ± radius).
    // fast + slow both. ENABLED comps only → the rotary fit's comp-OFF touches never call this → their discs stay raw.
    nudgeSurface(axis, delta) {
        if ('xyz'.indexOf(axis) < 0 || !Number.isFinite(delta)) return;
        const pend = (this._pendingDiscs || (this._pendingDiscs = { x: [], y: [], z: [] }))[axis] || [];
        for (const d of pend) d.position[axis] += delta;
        this._pendingDiscs[axis] = [];   // consumed — the next touch accumulates fresh (handles middle's two walls per axis)
        this.render();
    }

    // TRANSIENT-DISC model. A G31 finished on `axis` at feed `feed`. Record the contact, rebuild the DATUM (which also
    // re-centers the live discs on it), then drop a transient feed-sized DISC there in the perp plane. R2: a re-probe of
    // an already-determined axis = the macro looped (GOTO1) into a new sequence → reset the persistent layer + contacts.
    probeAxisTouched(axis, feed) {
        const tool = this._animTool, THREE = this.THREE;
        if (!tool || !THREE || 'xyz'.indexOf(axis) < 0) return;
        // NB: a re-probe of an already-determined axis is a REFINEMENT (the routine probes each axis twice — a fast
        // approach then a slow fine touch), NOT a new loop — so we just UPDATE the value + drop another disc (the slow
        // fine touch makes a SMALLER disc). No reset (resetting here lost the accumulated axes across the fast/slow passes).
        (this._probeVals || (this._probeVals = { x: 0, y: 0, z: 0 }))[axis] = tool.position[axis];
        (this._probeAxes || (this._probeAxes = {}))[axis] = true;
        this._probeContact = { x: tool.position.x, y: tool.position.y, z: tool.position.z };   // part-local (rides partFrame)
        (this._probeContacts || (this._probeContacts = [])).push({ ...this._probeContact });
        // The DATUM is NOT driven by probe contacts — it follows the WCS-WRITE event only (markDatumWrite). Here we record the
        // contact + drop its disc, and remember it in _pendingDiscs[axis] so a later ENABLED comp (nudgeSurface) slides it onto
        // the wall. A comp-OFF touch (the rotary fit) never fires nudgeSurface → its disc stays at the raw contact.
        const disc = this._probeDiscBurst(this._probeContact, axis, feed);
        if (disc) (this._pendingDiscs || (this._pendingDiscs = { x: [], y: [], z: [] }))[axis].push(disc);
    }

    // (B) The persistent DATUM (where the probed planes cross — GOLD, ≥2 axes) + AXIS LINE (the 2-plane intersection along
    // the un-probed axis — CYAN, exactly 2 axes), at the REAL datum: determined axes at their probed value, un-probed
    // axes at the MEAN of the contacts (so it sits AMONG the discs, not at one stale contact — the offset fix). Also
    // re-centers every live disc on this datum (each disc keeps its plane but slides to the crossing). Cleared next loop.
    _updateDatum() {
        const THREE = this.THREE, cs = this._probeContacts || [], dw = this._datumWrite || {};
        const pt = this._probeGizmo, line = this._probeLine;
        if (!THREE || !pt) return;
        const mean = (a) => (cs.length ? cs.reduce((s, c) => s + (c[a] || 0), 0) / cs.length : 0);
        // The WCS DATUM is driven SOLELY by the WCS-WRITE event (the middle calculus centre #53/#56) — NEVER the probe-contact
        // walls. A WRITTEN axis sits at its centre; an un-written axis (e.g. Z on an XY probe) at the contacts' mean (the probe
        // plane). So the datum appears ONLY once the WCS is written (≥2 axes), AT the centre — no flicker through the walls.
        const written = ['x', 'y', 'z'].filter((a) => dw[a] != null);
        const d = { x: dw.x != null ? dw.x : mean('x'), y: dw.y != null ? dw.y : mean('y'), z: dw.z != null ? dw.z : mean('z') };
        if (line) line.visible = false;   // AXIS LINE REMOVED (user) — only the DATUM point + the discs remain; the line never shows
        pt.visible = false;
        if (written.length >= 2) {
            pt.position.set(d.x, d.y, d.z);
            // rotate the XY `+` into the plane of the 2 PROBED axes (the 3rd is depth); all-3-written → XY plane, Z = depth.
            const plane = (written.length >= 3 ? ['x', 'y'] : written).slice().sort().join('');   // 'xy' | 'xz' | 'yz'
            pt.rotation.set(plane === 'xz' ? Math.PI / 2 : 0, plane === 'yz' ? Math.PI / 2 : 0, 0);
            pt.visible = true;
            this._pulseDatum();   // start the GLOW pulse (self-stops when the datum hides)
        }   // shows ONCE the WCS is written → at the centre, as a 2-axis crosshair
        this.render();
    }

    // GLOW — pulse the datum crosshair's (additive) opacity while it's visible, so the red `+` breathes/glows. One rAF loop
    // at a time (_datumPulseOn); it self-stops the moment the datum hides (resetProbe / next loop). Render-only.
    _pulseDatum() {
        if (this._datumPulseOn) return;
        const mat = this._probeCross && this._probeCross.material;
        if (!mat) return;
        this._datumPulseOn = true;
        const glow = this._datumGlow;
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const t0 = now();
        const tick = () => {
            if (!this._probeGizmo || !this._probeGizmo.visible) { this._datumPulseOn = false; mat.opacity = 1; if (glow) { glow.material.opacity = 1; glow.scale.set(5.5, 5.5, 1); } this.render(); return; }
            const u = 0.5 + 0.5 * Math.sin((now() - t0) / 1000 * 4.6);   // 0↔1 breath
            mat.opacity = 0.8 + 0.2 * u;                                  // sharp `+` stays bright
            if (glow) { glow.material.opacity = 0.55 + 0.45 * u; const s = 5.0 + 1.4 * u; glow.scale.set(s, s, 1); }   // halo breathes brighter + bigger = a hard glow
            this.render();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // Feed → disc radius in PX: SLOWER/fine probe (small feed) → SMALLER disc, FASTER/rough → bigger (clamped). User's request.
    _burstRadiusPx(feed) {
        const f = feed > 0 ? feed : this._probeBurstRefFeed;
        return this._probeBurstBasePx * Math.max(0.6, Math.min(1.8, Math.sqrt(f / this._probeBurstRefFeed)));
    }

    // (A) A TRANSIENT SOLID additive disc (no blur) in the plane PERP to `axis`, IMMOBILE at the probe contact `localPos`
    // (rides the part frame — SAME frame as the line/datum, so they register; that's the X/Y-offset fix). Radius is
    // FEED-SCALED + CONSTANT-SCREEN. LOW opacity; pulses 3× and fades over _probeDiscFadeMs of SIM time (speed button).
    _probeDiscBurst(localPos, axis, feed) {
        const THREE = this.THREE;
        if (!localPos || !THREE || !this.partFrame) return;
        const px = this._burstRadiusPx(feed);
        const flashes = (feed > 0 && feed < this._probeBurstRefFeed * 0.5) ? 4 : 3;   // SLOW/fine touch (low feed) flashes 4×, fast 3× (user)
        const normal = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        const mat = new THREE.MeshBasicMaterial({ color: this._lineColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
        disc.position.set(localPos.x, localPos.y, localPos.z);   // FIXED at the contact (part-local) — never moved
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);   // perp to the probed axis
        disc.renderOrder = 11;
        this.partFrame.add(disc);
        const wv = new THREE.Vector3();
        const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        let last = now(), prog = 0;
        const tick = () => {
            const t = now(), dt = t - last; last = t;
            prog = Math.min(1, prog + (dt * (this._simSpeed || 1)) / (this._probeDiscFadeMs || 9000));   // fade in SIM time
            const u = prog;
            const pulse = Math.abs(Math.sin(u * flashes * Math.PI));         // 3× fast / 4× slow (see `flashes`)
            const fade = u < 0.75 ? 1 : Math.max(0, 1 - (u - 0.75) / 0.25);
            mat.opacity = (0.03 + 0.05 * pulse) * fade;                      // LOWER opacity (user); SOLID, never dark until the end
            const s = Math.max(1e-4, px * this._worldPerPx(disc.getWorldPosition(wv)));   // constant-screen, feed-scaled
            disc.scale.set(s, s, 1);
            this.render();
            if (u < 1) requestAnimationFrame(tick);
            else { this.partFrame.group.remove(disc); disc.geometry.dispose(); mat.dispose(); }
        };
        requestAnimationFrame(tick);
        return disc;   // so probeAxisTouched can track it for nudgeSurface (disc-on-surface, inc2)
    }

    // Hover tooltip for the STOCK-WCS marker (the yellow origin square = settings.stock's saved WCS). Projects the
    // gizmo to screen; shows "stock" when the cursor is near it. Replaces the old persistent floating label.
    _updateStockTip(e) {
        const tip = this._stockTip, og = this._originGizmo;
        if (!tip || !og || !this.container) return;
        const v = og.getWorldPosition(this._ogV3 || (this._ogV3 = new this.THREE.Vector3())).clone().project(this.camera);
        const rect = this.container.getBoundingClientRect();
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const near = v.z < 1 && Math.hypot((e.clientX - rect.left) - sx, (e.clientY - rect.top) - sy) < 20;
        if (near) { tip.style.left = sx + 'px'; tip.style.top = sy + 'px'; tip.style.display = 'block'; }
        else if (tip.style.display !== 'none') tip.style.display = 'none';
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
