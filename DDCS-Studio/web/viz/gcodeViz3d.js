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
import { PartFrame, partZeroShift } from './sceneFrame.js';
import { getRotaryAxes } from '../ui/settingsPanel.js';
import { stockProbeStop, barRadius } from '../engine/probeGeometry.js';
import { switchTypeOf } from '../engine/switchTypes.js';   // t512 — the DECLARED switch-type render glyph ('sensor-face' vs 'plunger'), so optical/hall draw non-contact (not the hardcoded 'proximity' string)
import { projectWorkpiece } from '../engine/workpiece.js';   // render declared features[] at their PHYSICAL pos on the datum-placed stock (Face 2; byte-identical to the legacy 25% inset for a derived pocket)
import { HeightmapCarve } from '../engine/stockRemoval.js';   // t680 — MATERIAL REMOVAL E1: the heightmap carve map (behind a CarveMap seam)
import { passAnchorFor } from '../engine/passAnchor.js';   // t94/t107 — an AUTO reposition pass's ROUTE (+ its probe-collision Aw/Bw) draws from the RUNTIME END of the previous pass (t107 machine-faithful, via _passEnds), else the static previous START (t94), not its own net-endpoint marker
import { markerWorldOf } from './markerWorld.js';   // t301 Seam C — the ONE per-pass marker-world fn the Layout ALSO reads, so the 3D ruby + the Layout handle can't diverge
import { PATH_TYPES, PATH_STATE, TOUCH_PULSE } from './pathStyle.js';   // t317/t319 — the ONE declared path-visual palette + the touch-pulse token, shared with the 2D + the legend (t331 — FEED_LOW/HIGH gradient removed)
import { displayOf } from './displayPrefs.js';   // t738 — the ONE declared preview-visibility registry ({visible,alpha} per element)

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
        this._probeDiscFadeMs = TOUCH_PULSE.fadeMs;                     // t319 — disc lifetime = the ONE declared touch-pulse fade (16s sim, SAME both previews); scaled by the live sim speed
        this._probeBurstRefFeed = 250;    // t331 — the feed pivot for the disc-size scale; the disc RADIUS now reads TOUCH_PULSE.px3D (was a rogue base=200), interpolating fast→slow by feed (slow re-probe = BIGGER)
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
        ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 16; ctx.lineJoin = 'round';
        ctx.beginPath();
        if (emits) { ctx.fillRect(20, 20, 88, 88); }   // AUTO / emitting = FILLED SQUARE ■ (a drag writes a macro var)
        else { ctx.arc(64, 64, 42, 0, Math.PI * 2); ctx.stroke(); }   // t722 P2a — MANUAL / Start = a HOLLOW RING ○ (the comment always promised it; it fills solid no longer) — a jog PREVIEW, never emitted
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
        const off = this._probeXYOff();   // t363 — map each min-XY marker onto the datum-placed stock (physical − datum)
        // t652 — a machine-frame op's Start is ALREADY in machine coords; the markers ride the part frame (offset by the WCS
        // shift), so CANCEL that shift for a machine-frame op — exactly how the tool (:586) and the route (:823) already do it.
        // Without this the Start marker double-shifts by the work origin (user-reported: G54 Y-500 pushed it outside the envelope).
        const sh = this._toolMachineFrame ? this.partFrame.shift : { x: 0, y: 0, z: 0 };
        for (let p = 0; p < this.spindleMarkers.length; p++) {
            const s = this._markerWorld(p);
            this.spindleMarkers[p].position.set(s.x - off.x - sh.x, s.y - off.y - sh.y, s.z - sh.z);
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
            const src = (this._startSources && this._startSources[p]) || 'auto';
            // t293 — ONE glyph language: AUTO reposition (machine drives there) = a CYAN SQUARE ■; MANUAL jog / the operator
            // Start = an AMBER ring ○. Shape + colour agree (matches the 2D toolpath + the Layout). Pass-0 is ALWAYS the
            // operator's first jog (the Start) → manual; every later pass follows its reposition SOURCE.
            const manual = p === 0 || src === 'manual';
            // t722 P2a — the sim-only manual JOG glyph (the hollow ring) is a PREVIEW → always semi-transparent (ghostly); the
            // emitting AUTO square reads more solid (a real programmed reposition). Selection boosts both.
            glyph.material.opacity = manual ? (sel ? 0.8 : 0.42) : (sel ? 1 : 0.5);
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
        // START MARKER — SCENE-RELATIVE, not constant-screen (t684 d2): a small fraction of the stock diagonal, clamped, so
        // it never dwarfs a small stock nor vanishes on a big one. The glyph sprite is 9 world-units at group scale 1.
        const st = this._stock || {};
        const diag = Math.hypot(Number(st.x) || 0, Number(st.y) || 0, Number(st.z) || 0) || 100;
        const glyphWorld = Math.min(60, Math.max(2.5, diag * 0.045));
        for (const m of this.spindleMarkers) m.scale.setScalar(glyphWorld / 9);
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
    // t738 — stock opacity COMPOSES the registry alpha (BASE) with the probe-mode scale: probe dims the stock to ~0.16
    // of the old 0.72 so the probe path reads through it. Default registry stock alpha 0.72 → 0.72 / 0.16 unchanged.
    _stockOpacity() { return displayOf('stock').alpha * (this._simMode === 'probe' ? (0.16 / 0.72) : 1); }
    setSimMode(mode) { if (mode === this._simMode) return; this._simMode = mode; if (this.stockMesh && this.stockMesh.material) { this.stockMesh.material.opacity = this._stockOpacity(); this.render(); } }

    /** t738 — apply the ONE declared visibility registry (displayPrefs) across every 3D element: `.visible` per element +
     *  the BASE opacity (the probe-mode / play scales in _stockOpacity + _dimRoute multiply this base). Called after every
     *  rebuild (setGcode) and LIVE on a modal change. Colours stay in pathStyle; this owns visible + alpha. */
    applyDisplay() {
        const vis = (id) => displayOf(id).visible, alp = (id) => displayOf(id).alpha;
        const base = (o, a) => { if (o && o.material) { o.material.transparent = true; o.material.opacity = a; if (o.material.__op0 != null) o.material.__op0 = a; } };   // store the base so _dimRoute composes
        const show = (o, on) => { if (o) o.visible = on; };
        // stock box (+ edges) — hidden anyway while the carve grid stands in for it; opacity via _stockOpacity (probe scale)
        show(this.stockMesh, vis('stock') && !this._carveMesh); if (this.stockMesh) base(this.stockMesh, this._stockOpacity());
        show(this.stockEdges, vis('stock') && !this._carveMesh);
        show(this._carveMesh, vis('carve')); if (this._carveMesh) base(this._carveMesh, alp('carve'));
        // toolpath line groups — cut=feed · rapid=rapid+retract+jog (travel family) · probe=probe+probeSlow
        const lg = this.lineGroups || {};
        show(lg.feed, vis('cut')); base(lg.feed, alp('cut'));
        show(lg.rapid, vis('rapid')); base(lg.rapid, alp('rapid'));
        show(lg.retract, vis('rapid')); show(lg.jog, vis('rapid'));
        show(lg.probe, vis('probe')); base(lg.probe, alp('probe'));
        show(lg.probeSlow, vis('probe')); base(lg.probeSlow, alp('probe'));
        // tool + head (spindle/collet) — the moving cutter assembly parts
        const ap = this._animParts || {};
        show(ap.tool, vis('tool')); base(ap.tool, alp('tool')); show(ap.ruby, vis('tool'));
        show(ap.spindle, vis('head')); base(ap.spindle, alp('head')); show(ap.collet, vis('head')); base(ap.collet, alp('head'));
        // machine envelope — the box is CREATED by setMachine gated on this registry; toggle/alpha live here
        if (this.machineBox) { this.machineBox.visible = vis('envelope'); base(this.machineBox, alp('envelope')); }
        else if (vis('envelope') && this._machine) this.setMachine(this._machine);   // OFF→ON needs a (re)create
        // grid · axes · markers
        show(this.grid, vis('grid')); base(this.grid, alp('grid'));
        for (const ax of [this._axisLineX, this._axisLineY, this._axisLineZ, this._originGizmo]) { show(ax, vis('axes')); base(ax, alp('axes')); }
        for (const mk of (this.spindleMarkers || [])) show(mk, vis('markers'));
        if (this._posChip) { if (!vis('poschip')) this._posChip.visible = false; else if (this._posChip.visible) this._posChip.material.opacity = alp('poschip') * this._posChipGate(); }   // t746 — the readout toggle/alpha
        this.render();
    }

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
            if (this._posChip && this._posChip.visible && !this._posChipRaf) this._posChipFade();   // t746 — fade the position readout ~1s after stop
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
                o.material.transparent = true; o.material.opacity = (o.material.__op0 != null ? o.material.__op0 : 1) * PATH_STATE.future.alpha;   // t313/t317/t738 — untraveled guide = the registry BASE (__op0) × the ONE palette's future state (0.8): the play dim COMPOSES onto the display alpha, not an absolute 0.8 that would drop it
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
        const doff = this._probeXYOff();   // t363 — map the live tool onto the datum-placed stock (physical − datum)
        // t497 — MACHINE-FRAME tool (homing): the tool homes in raw MACHINE coords (no workpiece), so it must NOT ride the
        // stock-floor part-frame shift — else with a stock shown it renders ~stockFloor too LOW (near the envelope bottom)
        // = the "plunge" the operator watches while the engine + emit are correct. Subtract the part-frame shift so the
        // animTool's WORLD position lands at the raw machine coord (= engine.pos). The STOCK still rides the shifted frame
        // (right for cutting ops). Off (default) → the normal part-frame tool.
        const sh = this._toolMachineFrame ? this.partFrame.shift : { x: 0, y: 0, z: 0 };
        this._lastToolPos = pos;
        this._animTool.position.set((pos.x || 0) + o.x - doff.x - sh.x, (pos.y || 0) + o.y - doff.y - sh.y, (pos.z || 0) + o.z - sh.z);
        // Engine-driven trail: bold the executed route up to the tool head (option B — what you see is the path
        // the engine actually ran). Enable trail mode lazily; setAnimate(false)/ddcsStopPreview restores it.
        if (this._trailLine && this._animSegs && this._animSegs.length) {
            if (!this._trailOn) this._dimRoute(true);
            this._updateTrailTip(this._animTool.position);
        }
        this._updatePosChip(pos);   // t746 — the position readout rides the head with these WORK coords (the SAME source as the DRO)
        this.render();
    }

    /** t746 — THE POSITION READOUT (poschip): a fixed-screen-size sprite riding the tool head with the live WORK coords (the
     *  SAME onPositionChange pos the DRO shows → DRO-equal). Motion-gated (fades ~1s after stop). Toggle + alpha from the ONE
     *  registry. A sprite (sizeAttenuation:false → constant screen size), added to the scene, placed at the tool's WORLD pos. */
    _ensurePosChip() {
        if (this._posChip) return;
        const THREE = this.THREE;
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 104;
        const tex = new THREE.CanvasTexture(cv);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }));
        // t780 (user) — ALWAYS-ON-TOP: renderOrder above every scene object incl. the spindle/collet meshes (whose
        // depthWrite would otherwise paint over a lower-order sprite in the transparent pass), and a SCREEN-SPACE side
        // offset via sprite.center so the chip sits BESIDE the spindle body, never inside it (center x < 0 shifts the
        // rendered quad right of its 3D anchor by |x|·width — screen-space, so it holds at any zoom).
        sp.renderOrder = 100; sp.visible = false; sp.scale.set(0.17, 0.069, 1);   // ~constant screen size (3 lines)
        sp.center.set(-0.18, 0.5);
        this._posChip = sp; this._posChipCv = cv; this._posChipTex = tex;
        this.scene.add(sp);
    }
    _drawPosChipTex(x, y, z, wcs) {
        const cv = this._posChipCv, c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.fillStyle = 'rgba(10,14,20,0.85)'; c.fillRect(0, 0, cv.width, cv.height);
        c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, cv.width - 3, cv.height - 3);
        let wc = '#6fd3ff';   // t780 (user) — the chip speaks WORK coords, so it wears the declared work-frame token
        try { wc = (getComputedStyle(document.documentElement).getPropertyValue('--coord-work') || wc).trim() || wc; } catch (_) { /* headless */ }
        c.fillStyle = wc; c.font = 'bold 30px monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
        c.fillText('X ' + x.toFixed(3), 14, 22); c.fillText('Y ' + y.toFixed(3), 14, 52); c.fillText('Z ' + z.toFixed(3), 14, 82);   // t780 (user) — the Z line (DRO-equal work Z)
        if (wcs) { c.globalAlpha = 0.75; c.font = 'bold 22px monospace'; c.textAlign = 'right'; c.fillText(wcs, cv.width - 12, 22); c.globalAlpha = 1; }   // t780 (user) — the chip STATES its frame (the active WCS)
        this._posChipTex.needsUpdate = true;
    }
    _updatePosChip(pos) {
        if (!displayOf('poschip').visible) { if (this._posChip) this._posChip.visible = false; return; }
        this._ensurePosChip();
        this._posChipVal = { x: Number(pos.x) || 0, y: Number(pos.y) || 0, z: Number(pos.z) || 0, wcs: pos.wcs || '' };
        this._posChipMoveMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this._drawPosChipTex(this._posChipVal.x, this._posChipVal.y, this._posChipVal.z, this._posChipVal.wcs);
        const t = this._animTool;
        if (t) { t.updateWorldMatrix(true, false); const w = t.getWorldPosition(new this.THREE.Vector3()); this._posChip.position.set(w.x, w.y, w.z + 24); }   // ride the head, lifted clear of the cut
        this._posChip.material.opacity = displayOf('poschip').alpha;
        this._posChip.visible = true;
        if (!this._posChipRaf) this._posChipFade();
    }
    _posChipGate() { const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); return Math.max(0, Math.min(1, 1 - (now - (this._posChipMoveMs || 0) - 700) / 350)); }   // 1 while moving → 0 ~1s after stop
    _posChipFade() {
        if (!this._posChip) { this._posChipRaf = 0; return; }
        const g = this._posChipGate();
        if (this._animOn) { this._posChipRaf = requestAnimationFrame(() => this._posChipFade()); return; }   // still playing → the tick refreshes it
        this._posChip.material.opacity = displayOf('poschip').alpha * g;
        if (g > 0.02) { this.render(); this._posChipRaf = requestAnimationFrame(() => this._posChipFade()); }
        else { this._posChip.visible = false; this._posChipRaf = 0; this.render(); }
    }

    /** t497 — render the live tool in the MACHINE frame (raw machine coords), ignoring the stock-floor part-frame shift.
     *  For the HOMING preview: the tool homes in machine coords with no workpiece, so it must draw at the envelope top,
     *  not stock-floor-shifted to the bottom. Cutting ops leave this off (the tool rides the stock-placed part frame). */
    setToolMachineFrame(on) {
        on = !!on;
        if (on === !!this._toolMachineFrame) return;
        this._toolMachineFrame = on;
        // Re-place the tool in the new frame NOW (before any run) so the STATIC pre-play tool also sits at the machine
        // frame — else the built tool renders at the stock-shifted spot (local 0 → world = partShift) until the engine's
        // first move. Build it if needed + place at the last pos (default machine-0/home).
        if (on) { this._ensureAnimTool(); this.setToolPosition(this._lastToolPos || { x: 0, y: 0, z: 0 }); }
        else if (this._animTool) this.setToolPosition(this._lastToolPos || { x: 0, y: 0, z: 0 });
    }

    // t497 — re-place a MACHINE-FRAME tool after the part-frame shift changes (setStock/setMachine), so its world position
    // re-compensates for the new shift and stays at raw machine coords (else it drifts to the stock-shifted spot).
    _reapplyMachineTool() {
        if (this._toolMachineFrame && this._animTool) this.setToolPosition(this._lastToolPos || { x: 0, y: 0, z: 0 });
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
            // t540 — MACHINE-FRAME tool (homing): the absolute route is normalized-from-0, then POSITIONED at `off`. For
            // homing, anchor `off` to the draggable Start (mk) in RAW machine coords — minus the part-frame shift, exactly
            // like the live tool at ~line 588 — so the drawn seek path EMANATES FROM the Start and coincides with the
            // animated tool (which rides engine.pos, seeded at the Start via initialPos). A Start drag re-traces (new deltas)
            // + repositions the route here. Cutting ops (toolMachineFrame off) keep the normal part-frame off (unchanged).
            const machTool = !!this._toolMachineFrame;
            // t674 — a SEATED op (alignment) anchors its DRAWN route to the Start even when a final absolute/G53 park sets
            // stats.absolute (which turns _anchorToStart OFF). Without this the whole trace drew from the origin while the
            // animation (engine.pos, seeded at the Start) sat correctly at A. _seatAtStart makes the trace match the seat.
            const rawOff = machTool ? (this.starts[p] || { x: 0, y: 0, z: 0 })
                : ((this._anchorToStart || this._seatAtStart) ? (passAnchorFor(this.starts, this._passEnds, p) || mk) : { x: 0, y: 0, z: 0 });
            const dOff = this._probeXYOff();   // t363 — map the whole route onto the datum-placed stock (physical − datum)
            const sh = machTool ? this.partFrame.shift : { x: 0, y: 0, z: 0 };   // t540 — homing route sits at raw machine coords (like the tool), not the stock-floor-shifted part frame
            const off = { x: rawOff.x - dOff.x - sh.x, y: rawOff.y - dOff.y - sh.y, z: rawOff.z - sh.z };
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
                    pushSeg(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, 6000, 0, 0, 0, 0, PATH_TYPES.jog.color);   // t331 — the animated jog-arc trail reads the ONE token (was a rogue 0xff9a0d hardcode) so the deep-orange edit hits it too
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

        // Colours match the wizard visualiser — t331: FLAT feed/cut (the Z-depth gradient was removed; ramps/plunges are absorbed into the feed colour, human t330)
        this.lineGroups.feed = this._addLine(feedPos, { color: PATH_TYPES.feed.color });
        this.lineGroups.rapid = this._addLine(rapidPos, { color: PATH_TYPES.rapid.color, opacity: 0.6 });   // t317 — colours from the ONE palette (opacity = 3D line-group base, a 3D render detail)
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.lineGroups.retract = this._addLine(retractPos, { color: PATH_TYPES.retract.color, opacity: 0.85 });
        this.lineGroups.probe = this._addLine(probeFastPos, { color: PATH_TYPES.probeFast.color, dashed: true });   // t331 (human t330) — probe DASHED (was dotted), matching the 2D token dash [5,4]
        this.lineGroups.probeSlow = this._addLine(probeSlowPos, { color: PATH_TYPES.probeSlow.color, dashed: true });   // t331 — dashed to match the fast probe
        if (this.lineGroups.probeSlow) this.lineGroups.probeSlow.renderOrder = 21;   // t319 — the WHITE slow probe renders OVER the fast blue (renderOrder 20) at the collinear re-probe overlap
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
    fitAll(wide = false) {
        let b = null;
        const m = this._machine, useMch = m && m.show && m.x && m.y && m.z;
        const sh = this.partFrame ? this.partFrame.shift : { x: 0, y: 0, z: 0 };   // part-frame offset (+WCS in machine view, else 0)
        const d = this._dataBounds;
        const s = this._stock, hasStock = !!(s && s.show && s.x > 0 && s.y > 0 && s.z > 0);
        if (d) {
            // t780 (user) — a safe-Z/G53 retract to the MACHINE TOP stretches the data bounds into a tall thin column
            // (z→+775 on an −800 machine) and blows the "work" framing. With a stock to anchor the work, clamp the fit's
            // Z contribution to the work region (stock top + a clearance margin scaled to the XY span); the retract line
            // still DRAWS — it just no longer drives the camera. No stock → nothing to anchor, keep the full bounds.
            const zCap = hasStock ? sh.z + 0.35 * Math.max(d.maxX - d.minX, d.maxY - d.minY, 50) : Infinity;
            b = this._growBounds(b, d.minX + sh.x, d.minY + sh.y, d.minZ + sh.z, d.maxX + sh.x, d.maxY + sh.y, Math.min(d.maxZ + sh.z, zCap));
        }
        if (hasStock) b = this._growBounds(b, sh.x, sh.y, sh.z - s.z, sh.x + s.x, sh.y + s.y, sh.z);
        // t780 (user) — THE WORK DRIVES THE DEFAULT FIT: on a big declared machine the envelope framing shrank the
        // stock/toolpath to a speck, so the envelope stays DRAWN as context but joins the fit ONLY when asked (wide —
        // dbl-click cycles it) or when there is nothing else to frame. Machine ops (homing/ATC) span the envelope with
        // their own data bounds, so their framing is unchanged by construction.
        const wantWide = !!(useMch && (wide || !b));
        if (wantWide) {
            // envelope corners in MACHINE coords (home at scene 0; the part rides +workOrigin)
            b = this._growBounds(b, Math.min(0, m.x), Math.min(0, m.y), Math.min(0, m.z), Math.max(0, m.x), Math.max(0, m.y), Math.max(0, m.z));
        }
        this._fitWide = wantWide;
        if (b) this.fit(b);
        this.render();
    }

    // Translucent stock block — WCS zero at the top, min XY corner: X[0..x] Y[0..y] Z[-z..0]
    // t363 — the datum's offset from the stock's MIN-XY corner: [Dx,Dy,Dz], each = dfrac(n=0/c=0.5/p=1) × the dim. The ONE
    // source both setStock (to place the stock's datum corner at part-zero) AND the probe geometry (to derive corner − datum)
    // read — so the stock, the probe path/tool/markers, and FACE-2 features all map onto the SAME part-zero frame.
    _datumFrac(stock) {
        const OLD = { fl: 'nnp', fr: 'pnp', bl: 'npp', br: 'ppp', center: 'ccp' };
        let c = (stock && stock.datum) || 'nnp';
        if (!/^[ncp]{3}$/.test(c)) c = OLD[c] || 'nnp';
        const f = { n: 0, c: 0.5, p: 1 };
        return [f[c[0]] * (stock ? stock.x : 0), f[c[1]] * (stock ? stock.y : 0), f[c[2]] * (stock ? stock.z : 0)];
    }
    // t363 — the XY datum offset that maps the PROBE geometry (markers/tool/path, authored in the stock MIN-XY frame) onto
    // the datum-placed stock: SUBTRACT it so a physical point renders at (physical − datum) relative to part-zero. Probe ops
    // only (start-anchored); a mill/absolute path is already in part-zero coords → zero. Preview-only; the EMIT is untouched.
    _probeXYOff() {
        if (!this._anchorToStart || !this._stock) return { x: 0, y: 0 };
        const D = this._datumFrac(this._stock);
        return { x: D[0], y: D[1] };
    }

    setStock(stock) {
        const THREE = this.THREE;
        this._stock = stock || null;
        this._stockFloorZ = null;   // stock bottom in part-local Z (datum-aware) → the table/grid floor; set below
        this._pocketFloors = [];    // DECLARED pocket-depth floors: [{x,y,depth,floorZ}] (floorZ in the pg frame; stock top = z/2) — for the depth assertion
        this._stockTopZ = null;     // the stock top in the pg frame (= z/2) → floor-Z == top − depth
        // The stock lives in a part group so a rotary move can spin it about its own axis.
        if (!this._partGroup) { this._partGroup = new THREE.Group(); this.partFrame.add(this._partGroup); }   // stock rides the part frame
        const pg = this._partGroup;
        pg.rotation.set(0, 0, 0); // at rest; the play loop re-applies the angle each frame
        // dispose the stock mesh + any pocket-floor plug children (shared material — dispose only their geometries)
        if (this.stockMesh) { this.stockMesh.traverse((o) => { if (o !== this.stockMesh && o.geometry) o.geometry.dispose(); }); pg.remove(this.stockMesh); this.stockMesh.geometry.dispose(); this.stockMesh.material.dispose(); this.stockMesh = null; }
        if (this.stockEdges) { pg.remove(this.stockEdges); this.stockEdges.geometry.dispose(); this.stockEdges.material.dispose(); this.stockEdges = null; }
        // t419 E4 — the 4th-axis rig (chuck + tailstock) is a DECOUPLED sim-device now: its lifecycle moved OUT of setStock into
        // setRotaryRig (mirrors setMagazine), re-derived from the new stock at the END of setStock (still a CHILD of _partGroup).
        if (stock && stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0) {
            // M2 — INSIDE cavities come from the workpiece features[] (declared, or a derived legacy pocket), rendered at
            // their datum-relative offset. A legacy pocket derives the SAME centred 25% cavity → byte-identical.
            const cavities = projectWorkpiece(stock).features.filter((f) => f.side === 'inside' && f.shape !== 'round' && f.size);
            const pocket = cavities.length > 0;
            const fillCol = pocket ? 0x6a8fbe : 0x8fae6a;  // pocket = blue, boss = green
            const edgeCol = pocket ? 0x86b6ff : 0xa6d77c;
            let geo;
            const mat = new THREE.MeshLambertMaterial({ color: fillCol, transparent: true, opacity: this._stockOpacity(), depthWrite: false });   // SHADED (lit) stock; opacity per sim mode
            const mesh = new THREE.Mesh();
            if (pocket) {
                // DECLARED POCKET DEPTH — think FUSION EXTRUSION CUTS: the stock is a SOLID body and each feature is a box
                // (footprint × depth, at its XYZ) BOOLEAN-SUBTRACTED from it → a CONFINED recess, solid everywhere else, with
                // NO stock-spanning plane. Built as ONE clean MANIFOLD surface (a translucent stock shows any INTERNAL face,
                // so a slab/plug stack fails): the boundary = the top cap (outer minus every footprint) · full-height outer
                // walls · per-pocket walls 0→−depth · a floor quad AT THE POCKET FOOTPRINT ONLY at −depth · the bottom (minus
                // through footprints). Honors per-feature XY + depth + multiple/multi-Z. A full/undeclared depth (≥ Z) stays a
                // through-cut. (Rect cavities only — round bores aren't 3D-rendered yet.)
                geo = this._pocketRecessGeometry(stock, cavities);
                mat.side = THREE.DoubleSide;   // render the whole confined boundary robustly under translucency (winding-agnostic)
                mesh.position.set(0, 0, 0);    // geometry is authored in [0,X]×[0,Y]×[−Z,0]; the −C offset below centres it on the pivot
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
            const D = this._datumFrac(stock);   // [Dx,Dy,Dz] from min corner (Dz: 0=bottom, z=top) — the ONE datum-offset source (t363)
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
            // t680 — MATERIAL REMOVAL: when carving is ON (a box/pocket stock, not a rotary cylinder), the DISPLACED
            // HEIGHTMAP GRID replaces the translucent box (the recesses are subsumed by the pre-seed). Built here as a
            // child of pg so it inherits the same datum / WCS / rotary placement as the box.
            if (this._carveOn && stock.shape !== 'cylinder') this._buildCarve(stock, cavities);
            // The table the stock rests on is the GRID floor (a fixed machine-frame surface — see _layoutGrid), not a
            // per-stock bed. So nothing extra to draw here.
        }
        this.partFrame.update(this._partShift());   // stock pin / WCS may have changed → re-place op+stock at the stock's WCS
        this._reapplyMachineTool();   // t497 — the shift changed → re-compensate a machine-frame (homing) tool so it stays at machine coords
        if (this._jogA) this._applyPartRotation(this._jogA, 0);   // keep a manual A jog after a stock rebuild (set above to rest)
        // t419 E4 — RE-DERIVE the rig (a decoupled sim-device) from the possibly-changed stock; a CHILD of _partGroup (built
        // AFTER the A-jog re-apply → inherits the spin + the datum/WCS placement). Only when the rig is on (setStock's no-render
        // contract for the stock modal — _showRotaryFixture is false there — stays intact).
        if (this._showRotaryFixture) this.setRotaryRig(this._rotaryRigSpec());
    }

    // ── t680 — MATERIAL REMOVAL (E1). The heightmap carve: a displaced grid + skirt replaces the box, live + end-state. ──
    setCarve(on) { on = !!on; if (on === !!this._carveOn) return; this._carveOn = on; if (!on) this._disposeCarve(); if (this._stock) this.setStock(this._stock); }   // rebuild → (un)swaps the box for the grid

    _disposeCarve() {
        if (this._carveMesh) { this._partGroup && this._partGroup.remove(this._carveMesh); this._carveMesh.geometry.dispose(); this._carveMesh.material.dispose(); this._carveMesh = null; }
        this._carve = null; this._carveSkirtTop = null; this._carveNtop = 0; this._carveMeshMode = null;
    }

    /** Seed the carve map from the stock + its DECLARED recesses, build the SMOOTH grid (the live default), and HIDE the box. */
    _buildCarve(stock, cavities) {
        this._disposeCarve();
        const feats = (() => { try { return projectWorkpiece(stock).features.filter((f) => f.side === 'inside'); } catch (e) { return []; } })();
        this._carve = new HeightmapCarve(stock, feats);
        // hide the translucent box + edges — the grid IS the stock now
        if (this.stockMesh) this.stockMesh.visible = false;
        if (this.stockEdges) this.stockEdges.visible = false;
        this._carveColor = (cavities && cavities.length) ? 0x6a8fbe : 0x8fae6a;
        this._rebuildCarveMesh('smooth');   // live default; the settled END-STATE swaps to 'crisp' (vertical walls)
    }

    /** (Re)build the carve mesh in the given mode: 'smooth' (interpolated grid, in-place-remeshable — LIVE) or 'crisp'
     *  (flat tiles + TRUE vertical wall faces — the settled END-STATE, t682). Disposes the previous mesh. */
    _rebuildCarveMesh(mode) {
        const c = this._carve; if (!c) return;
        if (this._carveMesh) { this._partGroup.remove(this._carveMesh); this._carveMesh.geometry.dispose(); this._carveMesh.material.dispose(); this._carveMesh = null; }
        this._carveMeshMode = mode;
        this._carveMesh = (mode === 'crisp') ? this._buildCrispCarveMesh(c, this._carveColor) : this._buildSmoothCarveMesh(c, this._carveColor);
        if (this._carveMesh) this._partGroup.add(this._carveMesh);
    }

    /** Trimmed flat tiles + TRUE VERTICAL wall curtains that follow the ANALYTIC CONTOUR — a MARCHING-TRIANGLES trace of the
     *  floor iso-contour (t730). The crisp floor hc[] gives the discrete Z levels; the AA field h[] carries the sub-cell edge
     *  (coverage 0.5 ⇒ the analytic edge sits at the half-depth iso, and the round tool cap curves that iso at ~toolR near an
     *  internal corner). So each 2-level cell splits along the interpolated contour: floor tile at the low level, top tile at
     *  the high level, and a vertical curtain (rim+floor share XY) between them — diagonals render STRAIGHT, internal corners
     *  ARC at ~toolR, straight runs stay crisp. Records `_carveMaxWall` (tallest curtain) for the assert. Rebuilt whole. */
    _buildCrispCarveMesh(c, color) {
        const THREE = this.THREE;
        const nx = c.nx, ny = c.ny, dx = c.dx, dy = c.dy, X = c.X, Y = c.Y, Z = c.Z, ox = -X / 2, oy = -Y / 2, topZ = Z / 2, botZ = -Z / 2;
        const hcAt = (i, j) => c.hc[c.idx(i, j)], hAt = (i, j) => c.h[c.idx(i, j)];   // crisp level (discrete) + AA height (sub-cell edge)
        const vx = (i) => i * dx + ox, vy = (j) => j * dy + oy;                       // grid VERTEX world XY (dx=X/(nx-1))
        const verts = [], idx = [];
        const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => { const b0 = verts.length / 3; verts.push(ax, ay, az, bx, by, bz, cx, cy, cz); idx.push(b0, b0 + 1, b0 + 2); };
        const flatTri = (p, q, r, z) => pushTri(p.x, p.y, z, q.x, q.y, z, r.x, r.y, z);
        const flatQuad = (p, q, r, s, z) => { flatTri(p, q, r, z); flatTri(p, r, s, z); };
        let maxWall = 0;
        const curtain = (p, q, zHi, zLo) => { const d = zHi - zLo; if (d > maxWall) maxWall = d; const b0 = verts.length / 3; verts.push(p.x, p.y, zHi, q.x, q.y, zHi, q.x, q.y, zLo, p.x, p.y, zLo); idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };   // VERTICAL (rim+floor share XY)
        // the contour crossing on edge P→Q: the analytic edge sits at the AA half-depth iso (coverage 0.5), interpolated on
        // h[]. Symmetric in P,Q → the crossing on a SHARED edge matches from both cells (a continuous, seamless contour).
        const cross = (P, Q) => { const iso = (P.hc + Q.hc) / 2, den = Q.h - P.h; let t = Math.abs(den) < 1e-9 ? 0.5 : (iso - P.h) / den; t = t < 0 ? 0 : t > 1 ? 1 : t; return { x: P.x + t * (Q.x - P.x), y: P.y + t * (Q.y - P.y) }; };
        let junctions = 0;
        // Marching TRIANGLES on the 4-corner cell (2 tris, shared NW-SE diagonal): 3 cases per tri, NO saddle ambiguity.
        const procTri = (A, B, C) => {
            const la = A.hc, lb = B.hc, lc = C.hc;
            if (la === lb && lb === lc) { flatTri(A, B, C, la + topZ); return; }              // 1 level → flat tile, no wall
            const hiL = Math.max(la, lb, lc), loL = Math.min(la, lb, lc), midL = la + lb + lc - hiL - loL;
            if (midL !== hiL && midL !== loL) { flatTri(A, B, C, hiL + topZ); junctions++; return; }   // 3 distinct levels (rare triple-point) → flat at shallowest
            const zHi = hiL + topZ, zLo = loL + topZ, isLo = (P) => P.hc === loL;
            const los = [A, B, C].filter(isLo), his = [A, B, C].filter((P) => !isLo(P));
            if (los.length === 1) {   // one cut corner: a floor triangle + a top quad, curtain between
                const a = los[0], b = his[0], d = his[1], pab = cross(a, b), pad = cross(a, d);
                flatTri(a, pab, pad, zLo); flatQuad(pab, b, d, pad, zHi); curtain(pab, pad, zHi, zLo);
            } else {                  // two cut corners: a top triangle + a floor quad, curtain between
                const cc = his[0], a = los[0], b = los[1], pca = cross(cc, a), pcb = cross(cc, b);
                flatTri(cc, pca, pcb, zHi); flatQuad(pca, a, b, pcb, zLo); curtain(pca, pcb, zHi, zLo);
            }
        };
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
            const SW = { x: vx(i), y: vy(j), hc: hcAt(i, j), h: hAt(i, j) }, SE = { x: vx(i + 1), y: vy(j), hc: hcAt(i + 1, j), h: hAt(i + 1, j) };
            const NW = { x: vx(i), y: vy(j + 1), hc: hcAt(i, j + 1), h: hAt(i, j + 1) }, NE = { x: vx(i + 1), y: vy(j + 1), hc: hcAt(i + 1, j + 1), h: hAt(i + 1, j + 1) };
            procTri(SW, NW, SE); procTri(SE, NW, NE);   // shared NW-SE diagonal → matched crossings across the split
        }
        // perimeter skirt (vertical, vertex-based) + bottom — the stock boundary, unchanged from the box outline
        const zc = (i, j) => hcAt(i, j) + topZ;
        const skirt = (i0, j0, i1, j1) => { const b0 = verts.length / 3; verts.push(vx(i0), vy(j0), zc(i0, j0), vx(i1), vy(j1), zc(i1, j1), vx(i1), vy(j1), botZ, vx(i0), vy(j0), botZ); idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };
        for (let i = 0; i < nx - 1; i++) { skirt(i, 0, i + 1, 0); skirt(i, ny - 1, i + 1, ny - 1); }
        for (let j = 0; j < ny - 1; j++) { skirt(0, j, 0, j + 1); skirt(nx - 1, j, nx - 1, j + 1); }
        flatQuad({ x: ox, y: oy }, { x: ox + X, y: oy }, { x: ox + X, y: oy + Y }, { x: ox, y: oy + Y }, botZ);   // bottom
        const g = new THREE.BufferGeometry();
        g.setIndex(idx);
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g.computeVertexNormals();
        this._carveMaxWall = maxWall; this._carveSkirtTop = null; this._carveNtop = 0; this._carveTriCount = idx.length / 3; this._carveTriJunctions = junctions;
        const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85, depthWrite: true, side: THREE.DoubleSide, flatShading: true });   // flat-shade → crisp rims, no smeared normals
        return new THREE.Mesh(g, mat);
    }

    /** Build the SMOOTH grid geometry (interpolated top surface + skirt walls + bottom) in pg-local — the LIVE mesh (fast in-place Z remesh). */
    _buildSmoothCarveMesh(c, color) {
        const THREE = this.THREE;
        const nx = c.nx, ny = c.ny, dx = c.dx, dy = c.dy, X = c.X, Y = c.Y, Z = c.Z, ox = -X / 2, oy = -Y / 2, topZ = Z / 2, botZ = -Z / 2;
        const zAt = (k) => c.h[k] + topZ;
        const verts = [], idx = [], skirtTop = [];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) verts.push(i * dx + ox, j * dy + oy, zAt(c.idx(i, j)));
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, d, b, b, d, e); }
        const wall = (cells, flip) => { for (let t = 0; t < cells.length - 1; t++) {
            const c0 = cells[t], c1 = cells[t + 1], k0 = c.idx(c0.i, c0.j), k1 = c.idx(c1.i, c1.j);
            const x0 = c0.i * dx + ox, y0 = c0.j * dy + oy, x1 = c1.i * dx + ox, y1 = c1.j * dy + oy, base = verts.length / 3;
            verts.push(x0, y0, zAt(k0), x1, y1, zAt(k1), x0, y0, botZ, x1, y1, botZ);
            skirtTop.push({ vi: base, k: k0 }, { vi: base + 1, k: k1 });
            if (flip) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); else idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        } };
        const bot = [], top = [], left = [], right = [];
        for (let i = 0; i < nx; i++) { bot.push({ i, j: 0 }); top.push({ i, j: ny - 1 }); }
        for (let j = 0; j < ny; j++) { left.push({ i: 0, j }); right.push({ i: nx - 1, j }); }
        wall(bot, true); wall(top, false); wall(left, false); wall(right, true);
        const bb = verts.length / 3; verts.push(ox, oy, botZ, X + ox, oy, botZ, ox, Y + oy, botZ, X + ox, Y + oy, botZ);
        idx.push(bb, bb + 2, bb + 1, bb + 1, bb + 2, bb + 3);
        const g = new THREE.BufferGeometry();
        g.setIndex(idx);
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g.computeVertexNormals();
        this._carveSkirtTop = skirtTop; this._carveNtop = nx * ny;
        const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85, depthWrite: true, side: THREE.DoubleSide });   // (C) denser, not a brick
        return new THREE.Mesh(g, mat);
    }

    /** Map a G-code/part-frame point to STOCK-LOCAL (top=0): part-zero sits at the datum point of the stock. */
    _toStockLocal(x, y, z) { const D = this._datumFrac(this._stock || {}), Z = (this._carve && this._carve.Z) || 0; return { x: (x || 0) + D[0], y: (y || 0) + D[1], z: (z || 0) + (D[2] - Z) }; }

    /** Carve one G-code/part-frame segment (live or end-state). toolR = tool radius mm; tip = flat|ball profile. Marks dirty. */
    carveSeg(seg, toolR, tip) {
        if (!this._carve || !seg) return;
        const cls = seg.type || (seg.probe ? 'probe' : seg.rapid ? 'rapid' : 'feed');
        this._carve.carveSegment(this._toStockLocal(seg.x1, seg.y1, seg.z1), this._toStockLocal(seg.x2, seg.y2, seg.z2), toolR, cls, tip || 'flat');
    }

    /** Carve a per-frame swept sub-step from the live engine (prev→pos, G-code/part coords), cut class only. */
    carveStep(prev, pos, toolR, tip) { if (!this._carve || !prev || !pos) return; this._carve.carveSegment(this._toStockLocal(prev.x, prev.y, prev.z), this._toStockLocal(pos.x, pos.y, pos.z), toolR, 'feed', tip || 'flat'); }

    /** Reseed the carve to PRISTINE (full stock + declared recesses) + the SMOOTH mesh — the live progressive carve starts here. */
    carveReseed() {
        if (!this._carve || !this._stock) return;
        const feats = (() => { try { return projectWorkpiece(this._stock).features.filter((f) => f.side === 'inside'); } catch (e) { return []; } })();
        this._carve.reseed(this._stock, feats);
        if (this._carveMeshMode !== 'smooth') this._rebuildCarveMesh('smooth'); else this._remeshCarve();
    }
    carveDirty() { return !!(this._carve && this._carve.dirty); }

    /** Instant settled END-STATE: reseed + carve ALL segments once + build the CRISP vertical-wall mesh. segs = parsed.segments; tip = flat|ball. */
    carveEndState(segs, toolR, tip) {
        if (!this._carve || !this._stock) return;
        const feats = (() => { try { return projectWorkpiece(this._stock).features.filter((f) => f.side === 'inside'); } catch (e) { return []; } })();
        this._carve.reseed(this._stock, feats);
        for (const s of (segs || [])) this.carveSeg(s, toolR, tip);
        this._rebuildCarveMesh('crisp'); this.render();
    }

    /** Settle the LIVE carve into the CRISP vertical-wall mesh (playback stopped) — no reseed, just re-mesh the final heights (t682). */
    carveFinalize() { if (!this._carve) return; this._rebuildCarveMesh('crisp'); this.render(); }

    /** Update the SMOOTH grid mesh Z in-place from the carve heights (throttled; LIVE only). Returns the ms cost (degrade watch). */
    _remeshCarve() {
        const c = this._carve, mesh = this._carveMesh; if (!c || !mesh || this._carveMeshMode !== 'smooth') return 0;
        const now = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => 0;
        const t0 = now();
        const pos = mesh.geometry.attributes.position, topZ = c.Z / 2;
        for (let k = 0; k < this._carveNtop; k++) pos.setZ(k, c.h[k] + topZ);
        for (const st of (this._carveSkirtTop || [])) pos.setZ(st.vi, c.h[st.k] + topZ);
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        c.dirty = false;
        this.render();
        return now() - t0;
    }

    /** Build ONE clean MANIFOLD surface for a stock with declared pocket cuts (the Fusion extrusion-cut model): the boundary
     *  of (the solid box − each footprint×depth box). No INTERNAL faces → a translucent render shows only the confined recess,
     *  never a stock-spanning plane. Authored in [0,X]×[0,Y]×[−Z,0]. Sets _pocketFloors / _stockTopZ / _pocketWallDepthZ.
     *  A full/undeclared depth (≥ Z) is a through-cut (top + bottom open, no floor). DoubleSide is used → winding-agnostic. */
    _pocketRecessGeometry(stock, cavities) {
        const THREE = this.THREE;
        const X = stock.x, Y = stock.y, Z = stock.z;
        const clampD = (f) => { const d0 = Number(f.depth); return Math.max(0, Math.min(Number.isFinite(d0) ? d0 : Z, Z)); };
        const feats = cavities.map((f) => ({ x: f.pos.x, y: f.pos.y, hx: Math.max(0.05, f.size.x / 2), hy: Math.max(0.05, f.size.y / 2), d: clampD(f) }));
        const recessed = feats.filter((f) => f.d > 0 && f.d < Z);
        const through = feats.filter((f) => f.d >= Z);
        this._stockTopZ = Z / 2;
        this._pocketWallDepthZ = recessed.length ? Math.max(...recessed.map((f) => f.d)) : Z;   // the cavity wall Z-extent (== depth; full-Z only when through)
        this._pocketFloors = recessed.map((f) => ({ x: f.x, y: f.y, depth: f.d, floorZ: Z / 2 - f.d }));   // floorZ = top(Z/2) − depth

        const pos = [];
        const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
        const rect = (f) => ({ x0: f.x - f.hx, x1: f.x + f.hx, y0: f.y - f.hy, y1: f.y + f.hy });
        // CAPS — outer minus holes, triangulated by ShapeGeometry (lifted to z). TOP: every footprint open; BOTTOM: through only.
        const capShape = (holes) => {
            const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(X, 0); s.lineTo(X, Y); s.lineTo(0, Y); s.lineTo(0, 0);
            for (const f of holes) { const r = rect(f); const p = new THREE.Path(); p.moveTo(r.x0, r.y0); p.lineTo(r.x1, r.y0); p.lineTo(r.x1, r.y1); p.lineTo(r.x0, r.y1); p.lineTo(r.x0, r.y0); s.holes.push(p); }
            return s;
        };
        const pushCap = (holes, z) => { const g = new THREE.ShapeGeometry(capShape(holes)).toNonIndexed(); const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) pos.push(p[i], p[i + 1], z); g.dispose(); };
        pushCap(feats, 0);        // TOP cap (z=0)
        pushCap(through, -Z);     // BOTTOM cap (z=−Z) — solid under recessed pockets
        // OUTER 4 walls (full height 0 → −Z)
        quad([0, 0, 0], [X, 0, 0], [X, 0, -Z], [0, 0, -Z]);
        quad([X, Y, 0], [0, Y, 0], [0, Y, -Z], [X, Y, -Z]);
        quad([X, 0, 0], [X, Y, 0], [X, Y, -Z], [X, 0, -Z]);
        quad([0, Y, 0], [0, 0, 0], [0, 0, -Z], [0, Y, -Z]);
        // PER pocket — 4 inner walls (0 → −depth) + a floor quad AT THE FOOTPRINT (recessed only; through = no floor)
        for (const f of feats) {
            const r = rect(f), wz = -f.d;
            quad([r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y0, wz], [r.x0, r.y0, wz]);
            quad([r.x1, r.y1, 0], [r.x0, r.y1, 0], [r.x0, r.y1, wz], [r.x1, r.y1, wz]);
            quad([r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x1, r.y1, wz], [r.x1, r.y0, wz]);
            quad([r.x0, r.y1, 0], [r.x0, r.y0, 0], [r.x0, r.y0, wz], [r.x0, r.y1, wz]);
            if (f.d < Z) quad([r.x0, r.y0, wz], [r.x1, r.y0, wz], [r.x1, r.y1, wz], [r.x0, r.y1, wz]);   // floor at −depth (footprint ONLY — no stock-spanning plane)
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        return geo;
    }

    /** t419 E4 — the rig SPEC derived from the current stock (the byte-identical extract of the old inline setStock logic):
     *  {axis, r, L, jaws, cu, cv}. round bar → the inscribed Ø (min cross) + 3-jaw; a box → the larger cross + 4-jaw. null = no bar. */
    _rotaryRigSpec() {
        const stock = this._stock;
        if (!stock || !(stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0)) return null;
        const axis = Object.values(getRotaryAxes())[0] || 'x';
        const fd = { x: stock.x, y: stock.y, z: stock.z };
        const cross = axis === 'x' ? [fd.y, fd.z] : axis === 'y' ? [fd.x, fd.z] : [fd.x, fd.y];
        const r = (stock.shape === 'cylinder' ? Math.min(cross[0], cross[1]) : Math.max(cross[0], cross[1])) / 2;
        return { axis, r, L: fd[axis] / 2, jaws: stock.shape === 'cylinder' ? 3 : 4, cu: cross[0], cv: cross[1] };
    }

    /** t419 E4 — the DECOUPLED rotary rig sim-device (mirrors setMagazine's dispose/guard/build shape) — BUT the rig group
     *  is a CHILD of _partGroup (NOT this.scene like the magazine), so it inherits the part SPIN (_applyPartRotation) + the
     *  datum/WCS placement (pg.position). spec (from _rotaryRigSpec) → build; null → just dispose. Sim-only (no emit). */
    setRotaryRig(spec) {
        if (this._rotaryFixture) {
            if (this._partGroup) this._partGroup.remove(this._rotaryFixture);
            this._rotaryFixture.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose && mm.dispose()); });
            this._rotaryFixture = null;
        }
        if (!spec || !this._partGroup) return;
        this._buildRotaryFixture(this._partGroup, spec.axis, spec.r, spec.L, { jaws: spec.jaws, cu: spec.cu, cv: spec.cv });   // adds to _partGroup + sets this._rotaryFixture
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
        this._showRotaryJog(on);   // rotary op → reveal the manual A± jog row (hidden for non-rotary ops) — UI, orthogonal to the mesh
        if (on === this._showRotaryFixture) return;
        this._showRotaryFixture = on;
        this.setRotaryRig(on ? this._rotaryRigSpec() : null);   // t419 E4 — just the rig (a decoupled sim-device), NOT a full setStock rebuild
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

    // The part-frame offset = machine coords of part-zero — THE declared frame source (sceneFrame.partZeroShift), read by
    // every renderer so the 3D group, the 2D pin, the layout, and the DRO can't drift (t582 ONE FRAME SOURCE). The viz
    // supplies its stock-floor depth (_stockFloorZ, the datum-aware stock bottom in part-local Z) for the table/grid Z.
    _partShift() { return partZeroShift(this._machine, this._stock, this._stockFloorZ); }

    // Wireframe machine envelope (fixed machine coords; home at scene 0) + machine-zero axes. The PART frame carries
    // op/stock to the stock's WCS instead, so the envelope never moves.
    // t540 — a machine-frame op forces the envelope box regardless of settings.machine.show (set by the panel's
    // setForceMachine, via the Homing wizard's previewMachine). Re-draws the box with the current machine.
    setForceMachineBox(on) { this._forceMachineBox = !!on; this.setMachine(this._machine); }

    setMachine(machine) {
        const THREE = this.THREE;
        this._machine = machine || null;
        this.partFrame.update(this._partShift());   // op + stock ride the STOCK's WCS (machine view); else part-zero at scene 0
        this._reapplyMachineTool();   // t497 — the shift changed → re-compensate a machine-frame (homing) tool so it stays at machine coords
        if (this.machineBox) { this.scene.remove(this.machineBox); this.machineBox.geometry.dispose(); this.machineBox.material.dispose(); this.machineBox = null; }
        if (this.machineAxes) { this.scene.remove(this.machineAxes); if (this.machineAxes.geometry) this.machineAxes.geometry.dispose(); if (this.machineAxes.material) this.machineAxes.material.dispose(); this.machineAxes = null; }
        const sx = machine ? machine.x : 0, sy = machine ? machine.y : 0, sz = machine ? machine.z : 0;
        // t738 — ENVELOPE EVERYWHERE: the DECLARED machine box (valid sx/sy/sz) draws whenever the visibility registry says
        // so (default-ON), a faint backdrop in EVERY preview — NOT gated on settings.machine.show any more (that toggle folds
        // into the modal's `envelope` element, Phase 2). A machine-frame op (homing / forceMachine ATC) still FORCES it. No
        // declared envelope (sx/sy/sz falsy) → nothing drawn. The `anchor ? null` suppression is dropped at the panel (the box
        // and the G53 start-anchor are separable — the anchor handling stays as-is).
        if (machine && (displayOf('envelope').visible || this._forceMachineBox) && sx && sy && sz) {
            const src = new THREE.BoxGeometry(Math.abs(sx), Math.abs(sy), Math.abs(sz));   // |travel| — the sign is just the home direction
            const eg = new THREE.EdgesGeometry(src);
            src.dispose();
            const box = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6c7a8c, transparent: true, opacity: displayOf('envelope').alpha }));
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

    /**
     * HOME/LIMIT SWITCH DEVICES (Homing H4, t487) — a switch body at each FITTED home-end edge on the FIXED machine
     * frame (raw machine coords, home at scene 0, like the magazine/station/fork). Styled per the switchType (H2):
     *   • mechanical → a plunger/lever whose tip reaches the envelope edge (the axis CONTACTS it); plunges + lights on trip.
     *   • proximity  → a sensor face set back OUTSIDE the edge + a translucent standoff GAP reaching inward by Sn (the
     *                  non-contact trigger zone, NEVER touched); lights on trip, no movement.
     * `setLimitSwitchDevice` animates 'made' on the io_change trip (wired in createPreviewPanel, like the ATC devices).
     * edges = [{ edge, axis, side, x, y, z, dir, switchType, standoff }] (machine coords) or null/[] to clear.
     */
    setLimitSwitchDevices(edges) {
        const THREE = this.THREE;
        if (this._limitGroup) {
            this.scene.remove(this._limitGroup);
            this._limitGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
            this._limitGroup = null;
        }
        this._limitDevices = {};
        // t538 — the ONLY caller path (homingView → previewLimitSwitches → panel.setLimitSwitches → this) was removed, so this
        // is now dormant (no switch-device meshes are drawn — the human's request). Intact/uninvoked; re-enable = restore a caller.
        if (!Array.isArray(edges) || !edges.length) { this.render(); return; }
        // Box dims with `along` down the switch axis, `cross` on the other two; offset a point `dist` along ±axis.
        const dims = (axis, along, cross) => axis === 'x' ? [along, cross, cross] : axis === 'y' ? [cross, along, cross] : [cross, cross, along];
        const shift = (base, axis, dir, dist) => { const p = { ...base }; p[axis] += dir * dist; return p; };
        const grp = new THREE.Group();
        for (const e of edges) {
            const axis = e.axis, dir = e.dir || 1, base = { x: Number(e.x) || 0, y: Number(e.y) || 0, z: Number(e.z) || 0 };
            const g = new THREE.Group();
            let dev;
            const LIT = 0xff2e2e;   // vivid red when a switch is MADE (both types) — reads clearly at envelope scale
            // t512 — the glyph is DECLARED by the switch type's `render` field ('sensor-face' = non-contact | 'plunger' = contact),
            // NOT the hardcoded 'proximity' string: mechanical → plunger; proximity/optical/hall (all non-contact) → the sensor face.
            const nonContact = switchTypeOf(e.switchType).render === 'sensor-face';
            if (nonContact) {
                const col = 0x39c0d8;   // cyan sensor face
                const face = new THREE.Mesh(new THREE.BoxGeometry(...dims(axis, 5, 28)), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
                const fp = shift(base, axis, -dir, 3);   // the face sits just OUTSIDE the edge (never crosses in)
                face.position.set(fp.x, fp.y, fp.z); g.add(face);
                // the standoff GAP: a translucent zone from the edge inward by Sn — the trigger distance, never contacted
                const gap = Math.max(3, Number(e.standoff) || 3);
                const gm = new THREE.Mesh(new THREE.BoxGeometry(...dims(axis, gap, 20)), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false }));
                const gp = shift(base, axis, dir, gap / 2);
                gm.position.set(gp.x, gp.y, gp.z); g.add(gm);
                dev = { group: g, indicator: face, kind: e.switchType || 'proximity', edgePos: base, axis, dir, restCol: col, litCol: LIT, made: false };   // t512 — the actual non-contact type (optical/hall/proximity); never 'mechanical' → never plunges
            } else {
                const bodyCol = 0x8a94a6;
                const body = new THREE.Mesh(new THREE.BoxGeometry(...dims(axis, 9, 26)), new THREE.MeshBasicMaterial({ color: bodyCol, transparent: true, opacity: 0.85 }));
                const bp = shift(base, axis, -dir, 7);   // the switch body sits OUTSIDE the edge
                body.position.set(bp.x, bp.y, bp.z); g.add(body);
                // the plunger reaches IN to the edge (contact); rest = tip at the edge, made = depressed a touch
                const plunger = new THREE.Mesh(new THREE.BoxGeometry(...dims(axis, 10, 9)), new THREE.MeshBasicMaterial({ color: 0xffb033, transparent: true, opacity: 0.98 }));
                const rest = shift(base, axis, -dir, 4);
                plunger.position.set(rest.x, rest.y, rest.z); g.add(plunger);
                dev = { group: g, indicator: plunger, plunger, kind: 'mechanical', edgePos: base, axis, dir, restCol: 0xffb033, litCol: LIT, made: false };
            }
            grp.add(g);
            this._limitDevices[e.edge] = dev;
        }
        this._limitGroup = grp; this.scene.add(grp);
        this.render();
    }

    /** Animate a home/limit switch device on its io_change trip: 'made' → light (all types) + PLUNGE (mechanical/contact
     *  only, the axis pressed it); released → rest colour + plunger back out. Non-contact types (proximity/optical/hall)
     *  never move. H4, t487; t512 — the contact test is `kind === 'mechanical'` (the declared plunger glyph), not per-type. */
    setLimitSwitchDevice(edge, made) {
        const d = this._limitDevices && this._limitDevices[edge];
        if (!d) return;
        d.made = !!made;
        if (d.indicator && d.indicator.material) d.indicator.material.color.setHex(made ? d.litCol : d.restCol);
        if (d.kind === 'mechanical' && d.plunger) {
            const p = { ...d.edgePos }; p[d.axis] += -d.dir * (made ? 6 : 4);   // rest tip near the edge (4); depressed toward the body (6) when made
            d.plunger.position.set(p.x, p.y, p.z);
        }
        this.render();
    }

    /** Read a switch device's state for tests/tools: its home-edge machine position, whether it's 'made', its kind. */
    getLimitSwitch(edge) {
        const d = this._limitDevices && this._limitDevices[edge];
        return d ? { x: d.edgePos.x, y: d.edgePos.y, z: d.edgePos.z, axis: d.axis, made: d.made, kind: d.kind } : null;
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
                const doff = this._probeXYOff();   // t363 — convert the dragged (datum-relative) gizmo back to the min-XY start
                s.x = this._dragStart0.x + this._dragDir.x * delta + doff.x;
                s.y = this._dragStart0.y + this._dragDir.y * delta + doff.y;
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
        // t780 (user) — dbl-click cycles the fit: WORK (stock+toolpath, the default) ↔ WIDE (the machine envelope).
        el.addEventListener('dblclick', (e) => { e.preventDefault(); this.fitAll(!this._fitWide); });
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
                const doff = this._probeXYOff();   // t363 — the gizmo renders at (start − datum); drag in that frame, convert back on set
                this._dragStart0 = new THREE.Vector3(s.x - doff.x, s.y - doff.y, s.z);
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

    // Feed → disc radius in PX. t319: SLOW/fine probe (small feed) → BIGGER disc, FAST/rough → smaller (FLIPPED to match
    // the 2D pulse's slow=bigger; the sqrt(ref/f) inverts the old sqrt(f/ref)).
    _burstRadiusPx(feed) {
        // t331 — read the ONE token's px3D endpoints (no rogue base). clamp(√(ref/f), .6, 1.8) ∈ [.6 fast .. 1.8 slow] → t ∈ [0,1]
        // → interpolate px3D.fast (a fast probe) → px3D.slow (a slow re-probe). Monotonic: a slower probe (lower feed) is BIGGER.
        const f = feed > 0 ? feed : this._probeBurstRefFeed;
        const s = Math.max(0.6, Math.min(1.8, Math.sqrt(this._probeBurstRefFeed / f)));
        const t = (s - 0.6) / 1.2;
        return TOUCH_PULSE.px3D.fast + t * (TOUCH_PULSE.px3D.slow - TOUCH_PULSE.px3D.fast);
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
        const mat = new THREE.MeshBasicMaterial({ color: TOUCH_PULSE.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide });   // t319 — the declared WHITE touch-pulse (was the cyan _lineColor)
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
