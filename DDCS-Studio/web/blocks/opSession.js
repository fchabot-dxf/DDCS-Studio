/**
 * blocks/opSession.js — the active wizard SESSION + program mutations + reverse-sync.
 *
 * The wizard session: build the active op's block stack (buildActiveOpStack), preview it into the Blocks model
 * (previewActiveOp), and commit it AS the program — a program is always exactly one op (t1916/t1918/t1920's own
 * ruling), so a commit REPLACES whatever was there (commitActiveOp; see `loadOpAsProgram`'s own doc comment for
 * the deleted accumulation machinery this replaced). Mutations on the committed stack: replaceOp (edit the
 * SAME op in place) / deleteOp / duplicateOp / commitDecodedCode / mergeOpBlocks.
 * RECONCILERS reverse-sync an edited block stack back to STUDIO form fields (reconcileActiveOp) — reading the
 * DECLARED params off the structured block model (declaration, NOT the banned motion-inference).
 *
 * Imports the BUILDERS leaf (opBuilders) + the region helpers; talks to the program via window hooks
 * (ddcsGetBlockProgram / ddcsLoadBlockStack). Nothing imports back into the builders, so there's no cycle.
 */
import { getLastOp, recordOp } from './opRecord.js';
import { num, r3 } from '../wizards/ops/util.js';
import { parseGcodeToStack } from './gcodeToStack.js';                       // decode a non-builder op's G-code → blocks (commitDecodedCode)
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };
import { builderOf, makeOp, _framed, _builderAtoms } from './opBuilders.js';   // the BUILDERS leaf (federated resolver)
import { flattenBlocks, listUserOps } from './userOps.js';   // ONE pre-order walk shared with devMode (group writeback indexes it); listUserOps → seed knob _expose from a data-op's bindings
import { matches } from './dataOps/deriveBindings.js';   // t1640 — the shared match predicate (assign-var OR op-param), so the knob seed covers both bind modes
import { FN } from './blockly/bridge.js';   // t391 — the Blockly field name (uppercased) for the _expose knob key
import { resolveMethod } from '../wizards/atcModel.js';   // fix B: resolve method (incl. legacy mode/magType) for the declared-param reconcile fallback
import { methodRampForCycle } from '../wizards/drillWizard.js';   // t1387 — the DECLARED inverse of cycleForMethod: the merged hole block has no leaf TYPE to read method/ramp off
import { pocketWallOffsetFromInset } from '../wizards/ops/pocketfill.js';   // t1406 — the DECLARED inverse of pocketInsetMm: the re-pointed fill carries `inset`, not `wallOffset`
import { slotFromRasterParams } from '../wizards/ops/slot.js';   // t1500 — the DECLARED inverse of slotRasterParams: the re-pointed slot carries an atom, not a `slot` leaf
// find() recurses into block children (incl. op-containers), so reconcilers locate their inner blocks
// (e.g. a 'stepdown') whether or not the op is wrapped in an op-container.
const find = (prog, type) => {
    for (const b of (prog || [])) {
        if (!b) continue;
        if (b.type === type) return b;
        if (b.children) { const f = find(b.children, type); if (f) return f; }
    }
    return null;
};

// ── reverse sync: edited block stack → STUDIO form fields ──────────────────────────────────────────────
// Read the (possibly edited) block objects and return { formFieldId: value }. The inverse of each builder,
// co-located with it. Numeric/geometry params reconcile cleanly here; derived (stepover) and inset (pocket)
// params are intentionally left out for now. Only ops listed here reverse-sync.
// Read a STUDIO form field as a number (for un-deriving block values like stepover ← stepover% × toolØ).
// During replayReconcile (wizard CLOSED — the chip/Blocks surfaces have no form open) the form-only values must
// come from the op's STORED params, not the live DOM (which would read defaults and over-report). `_replayParams`
// holds those stored params; the field id strips its op prefix (sf_toolDia → toolDia) to look them up.
let _replayParams = null;
const formNum = (id, d) => {
    if (_replayParams) { const v = _replayParams[id.replace(/^[a-z]+_/, '')]; return v == null ? d : num(v, d); }
    if (typeof document === 'undefined') return d;
    const e = document.getElementById(id);
    return e ? num(e.value, d) : d;
};

// The PlaceOnStock wrapper carries the placement intent; its params are the exact inverse of makePlace
// (offX ← originX, etc.), so reading them back is correct whatever coordinates the wrapped geometry is built in.
// `offX`/`offY` name THIS op's offset fields — follow-datum ops use originX/Y; opt-in slot/text use offX/Y.
function placeFields(prog, prefix, offX, offY) {
    const pb = find(prog, 'placeonstock');
    if (!pb || !pb.params) return {};
    const p = pb.params;
    return {
        [prefix + 'stockAttach']: p.stockAttach || '',
        [prefix + 'pathDatum']: p.pathDatum || '',
        [prefix + offX]: num(p.offX, 0),
        [prefix + offY]: num(p.offY, 0),
        [prefix + 'offZ']: num(p.offZ, 0),
    };
}

const RECONCILERS = {
    surfacing(prog) {
        const down = find(prog, 'stepdown'), over = down && down.children && down.children[0], rg = over && over.params && over.params.region;
        if (!down || !over || !rg || !rg.params) return null;
        const tool = formNum('sf_toolDia', 12), wb = find(prog, 'wcs');   // un-derive stepover% from the absolute StepOver value
        return Object.assign({
            sf_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            sf_originX: rg.params.x, sf_originY: rg.params.y, sf_w: rg.params.w, sf_h: rg.params.h,
            sf_depth: down.params.to, sf_stepdown: down.params.by,
            sf_strategy: over.params.strategy === 'parallel' ? 'raster' : 'spiral',
            sf_stepoverPct: tool > 0 ? r3((num(over.params.stepover, 0) / tool) * 100) : undefined,
            sf_feed: over.params.feed, sf_plunge: over.params.plunge, sf_clearance: over.params.clearance,
        }, placeFields(prog, 'sf_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper, not the region
    },
    slot(prog) {
        /**
         * ── t1500 — THE RE-POINTED ARM READS FIRST, and it is a DIFFERENT SHAPE (pocket's t1406 lesson, one op along)
         *
         * On the eligible arm the clearing is ONE `surfaceraster` and there is no `slot` block anywhere in the
         * program. The reader below opens with `find(prog,'slot')`, so left alone it would DECLINE outright and an
         * edited parametric slot would silently fail to reconcile — t1387's named failure mode: a reader that
         * identifies an arm by a block that moved. Swept in the act that moves it, not after.
         *
         * The geometry comes back through `slotFromRasterParams`, the declared ALGEBRAIC INVERSE of the same one
         * source that built the atom — not by measuring the emitted path.
         */
        const sr = find(prog, 'surfaceraster');
        if (sr && sr.params) {
            const q = slotFromRasterParams(sr.params), wb0 = find(prog, 'wcs');
            const f0 = {
                sl_wcs: (wb0 && wb0.params && wb0.params.wcs) || 'active',
                sl_ax: q.x0, sl_ay: q.y0, sl_bx: q.x1, sl_by: q.y1, sl_width: q.width,
                sl_toolDia: q.tool, sl_stepoverPct: q.stepoverPct, sl_depth: q.depth, sl_stepdown: q.stepdown,
                sl_entry: q.entry, sl_rampAngle: q.rampAngle,
                sl_feed: q.feed, sl_plunge: q.plunge, sl_clearance: q.clearance,
                sl_pattern: 'single',   // the arm is single-slot by its own gate — a pattern keeps the literal kernel
            };
            return Object.assign(f0, placeFields(prog, 'sl_', 'offX', 'offY'));
        }
        const s = find(prog, 'slot');
        if (!s || !s.params) return null;
        const p = s.params, wb = find(prog, 'wcs');
        const f = {
            sl_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            sl_ax: p.x0, sl_ay: p.y0, sl_bx: p.x1, sl_by: p.y1, sl_width: p.width,
            sl_toolDia: p.tool, sl_stepoverPct: p.stepoverPct, sl_depth: p.depth, sl_stepdown: p.stepdown,
            sl_feed: p.feed, sl_plunge: p.plunge, sl_clearance: p.clearance,
        };
        // REPEAT (array): if the slot is wrapped in an Array, reverse-sync the pattern fields too (else it's single).
        const arr = find(prog, 'array');
        if (arr && arr.params) {
            const a = arr.params;
            f.sl_pattern = a.pattern; f.sl_skip = a.skip || '';
            if (a.pattern === 'circle') { f.sl_dia = a.dia; f.sl_count = a.count; f.sl_startAngle = a.startAngle; }
            else if (a.pattern === 'line') { f.sl_lcount = a.count; f.sl_spacing = a.spacing; f.sl_angle = a.angle; }
            else if (a.pattern === 'rect') { f.sl_w = a.w; f.sl_h = a.h; f.sl_nx = a.nx; f.sl_ny = a.ny; }
            else { f.sl_cols = a.cols; f.sl_rows = a.rows; f.sl_dx = a.dx; f.sl_dy = a.dy; }
        } else { f.sl_pattern = 'single'; }
        return Object.assign(f, placeFields(prog, 'sl_', 'offX', 'offY'));   // opt-in placement: A↔B stays absolute, offset/anchors ride the wrapper
    },
    pocket(prog) {
        /**
         * ── t1406 — THE RE-POINTED ARM READS FIRST, and it is a DIFFERENT SHAPE, not a variant of the old one ──────
         *
         * On the rect/eligible arm the clearing is ONE `surfaceraster` that owns its own depth loop; there is no
         * `pocketfill` and (on spiral) no `stepdown` at all. The old reader below opens with `find(prog,'stepdown')`,
         * so on the RASTER arm it would have found the WALL's stepdown and then failed to find a pocketfill — and on
         * spiral it would have declined outright. Either way an edited parametric pocket would silently fail to
         * reconcile, which is the failure mode t1387 named: a reader that identifies an arm by a block that moved.
         *
         * TWO VALUES ARE READ BACK THROUGH A DECLARED INVERSE rather than off the block, because the atom has no
         * socket for them: `shape` is 'rect' by the arm's own predicate (nothing else reaches this stack), and
         * `wallOffset` comes from `pocketWallOffsetFromInset` — the algebraic inverse of the one function that
         * computed the inset. That is reading a declaration backwards, not inferring intent from output.
         */
        const sr = find(prog, 'surfaceraster');
        if (sr && sr.params) {
            const s = sr.params, wb0 = find(prog, 'wcs');
            /**
             * t1433 — THE CADENCE MOVED WITH THE WALL, and this reader is swept IN THE SAME ACT (t1387's rule).
             *
             * It used to read `find(prog, 'stepdown')` — the WALL's own depth walk, the only StepDown left on the
             * re-pointed arm. That block is gone now: the wall is one `wallfinish` carrying its own loop. Left alone,
             * this would have silently fallen back to the raster atom's `confirmEvery`, which is the same NUMBER
             * today (both are seeded from the one form field) and would have gone quietly wrong the moment they were
             * allowed to differ. Reading the block that actually holds the value is the only version that stays true.
             */
            const wall = find(prog, 'wallfinish');   // present on the raster arm only (the wall's own depth walk)
            const f0 = {
                p_wcs: (wb0 && wb0.params && wb0.params.wcs) || 'active',
                p_shape: 'rect', p_toolDia: s.toolDia,
                p_wallOffset: pocketWallOffsetFromInset(s.toolDia, s.inset),
                p_depth: s.depth, p_stepdown: s.stepdown,
                p_strategy: s.strategy === 'parallel' ? 'raster' : 'spiral',
                p_stepoverPct: s.stepoverPct, p_entry: s.entry,
                p_rampAngle: s.rampAngle, p_helixDia: s.helixDia, p_helixPitch: s.helixPitch,
                p_feed: s.feed, p_plunge: s.plunge, p_clearance: s.clearance,
                p_confirmEvery: wall && wall.params ? wall.params.confirmEvery : s.confirmEvery,
                p_originX: s.x, p_originY: s.y, p_w: s.w, p_h: s.h,
            };
            return Object.assign(f0, placeFields(prog, 'p_', 'originX', 'originY'));
        }
        const down = find(prog, 'stepdown');
        // t1391 — the too-small fallback has no `stepdown` (it is a single plunge, not a depth walk), so this declines on
        // that arm and always has. The re-point of that arm from the literal `drill` leaf to `holecycle` does not change
        // that: the arm is identified by the ABSENCE of the depth loop, never by the hole leaf's type. Swept as a tenant
        // reader in the same act rather than left to be discovered.
        if (!down || !Array.isArray(down.children)) return null;   // too-small fallback → no reverse (no depth loop to read)
        // The FLAT pocketfill atom (E0 region-pill→flat reframe, mirroring contourfill): the TYPED geometry + the tool/
        // wallOffset ride the block directly (no Region socket), so read the flat dims straight — the atom applies the
        // inset internally. stepoverPct is now carried as-is (no un-deriving from the absolute stepover).
        const pf = down.children.find((b) => b.type === 'pocketfill'), p = pf && pf.params;
        if (!pf || !p) return null;
        const wb = find(prog, 'wcs');
        const f = {
            p_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            p_shape: p.shape, p_toolDia: p.toolDia, p_wallOffset: p.wallOffset,
            p_depth: down.params.to, p_stepdown: down.params.by,
            p_strategy: p.strategy === 'parallel' ? 'raster' : 'spiral',
            p_stepoverPct: p.stepoverPct,
            p_feed: p.feed, p_plunge: p.plunge, p_clearance: p.clearance,
        };
        f.p_originX = p.originX; f.p_originY = p.originY;
        if (p.shape === 'circle') { f.p_dia = p.dia; }
        else if (p.shape === 'polygon') { f.p_dia = p.dia; f.p_sides = p.sides; }
        else { f.p_w = p.w; f.p_h = p.h; }   // rect + ellipse
        return Object.assign(f, placeFields(prog, 'p_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper
    },
    contour(prog) {
        const down = find(prog, 'stepdown');
        if (!down || !Array.isArray(down.children)) return null;
        // The FLAT contourfill atom (region-pill→flat reframe): geometry rides the block directly, no Region socket.
        const c = down.children.find((b) => b.type === 'contourfill'), p = c && c.params;
        if (!c || !p) return null;
        // The geometry IS the TRUE profile boundary (the atom applies the side offset), so read the flat dims straight.
        const wb = find(prog, 'wcs');
        const f = {
            ct_wcs: (wb && wb.params && wb.params.wcs) || 'active',
            ct_shape: p.shape, ct_side: p.side || 'outside', ct_toolDia: p.tool,
            ct_depth: down.params.to, ct_stepdown: down.params.by,
            ct_feed: p.feed, ct_plunge: p.plunge, ct_clearance: p.clearance,
        };
        f.ct_originX = p.x; f.ct_originY = p.y;
        if (p.shape === 'circle') { f.ct_dia = p.dia; }
        else if (p.shape === 'polygon') { f.ct_dia = p.dia; f.ct_sides = p.sides; }
        else { f.ct_w = p.w; f.ct_h = p.h; }   // rect + ellipse
        return Object.assign(f, placeFields(prog, 'ct_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper
    },
    /**
     * t1387 — READS THE MERGED BLOCK, and this was a REAL REGRESSION the switch caused, not a stale assertion.
     *
     * This reconciler opened with `find(prog, 'array')` and returned `null` when there was none. After t1385 there IS
     * none — the pattern lives in `holecycle` — so it returned null, which the caller reads as "not a drill op, nothing
     * to reverse-sync". The visible symptom: editing the PlaceOnStock anchor in Blocks no longer flowed back to the open
     * wizard form. Attributed rather than assumed: the whole file passes at 15d155ca (the commit before the switch) and
     * three tests fail at 7b3915ea, so the switch is the cause and this is a product FIX.
     *
     * The pattern half and the cut half now sit on ONE block, so `p` and `h` are the same params object. The method/ramp
     * pair no longer has a block TYPE to read it off (a `bore` leaf used to mean helical), so it comes from the declared
     * inverse in drillWizard — one two-way pair, one place.
     */
    drill(prog) {
        const hc = find(prog, 'holecycle');
        if (!hc || !hc.params) return null;
        const p = hc.params, wb = find(prog, 'wcs');
        const f = { d_pattern: p.pattern, d_originX: p.x0, d_originY: p.y0, d_skip: p.skip || '', d_wcs: (wb && wb.params && wb.params.wcs) || 'active' };
        if (p.pattern === 'circle') { f.d_dia = p.dia; f.d_count = p.count; f.d_startAngle = p.startAngle; }
        else if (p.pattern === 'line') { f.d_lcount = p.count; f.d_spacing = p.spacing; f.d_angle = p.angle; }
        else if (p.pattern === 'rect') { f.d_w = p.w; f.d_h = p.h; f.d_nx = p.nx; f.d_ny = p.ny; }
        else { f.d_cols = p.cols; f.d_rows = p.rows; f.d_dx = p.dx; f.d_dy = p.dy; }
        const { method, ramp } = methodRampForCycle(p.cycle);
        f.d_method = method;
        f.d_depth = p.depth; f.d_feed = p.feed; f.d_clearance = p.clearance;
        // BOTH cut sets ride back, because the merged block carries both (drillStack writes both whatever the method), so
        // switching method in the form must not find the other set blanked — the same reason the builder carries both.
        if (method === 'helical') { f.d_holeDia = p.holeDia; f.d_toolDia = p.toolDia; f.d_pitch = p.pitch; f.d_ramp = ramp; }
        else f.d_peck = p.peck;
        return Object.assign(f, placeFields(prog, 'd_', 'originX', 'originY'));   // offset + anchors ride the PlaceOnStock wrapper, not the hole block
    },
    middle(prog) {
        // Reverse-sync the middle (pocket/boss centre) op from its block stack. Read the identity fields that are
        // UNAMBIGUOUS in the stack: circular ← the #58=ABS[..] diameter assign (circular-only); 2-axis ← the
        // 2axis_ comment; the primary axis ← that comment (XtoY/YtoX) or, single-axis, the WCS-write offset
        // (#[#70+0]=X / +1=Y); dir2 ← the comment; WCS ← active (#71=#578) vs the #70 literal. featureType,
        // approach and dir1 aren't structurally distinguishable, so they're left to the form's current value.
        const all = [];
        (function walk(arr) { for (const b of (arr || [])) { if (!b) continue; all.push(b); if (b.children) walk(b.children); } })(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        // E3 (F1) — the WCS base + writes are now the wcsbaseinto / wcswrite atoms (not raw assigns). Read them from there.
        const wcsWrites = all.filter((b) => b.type === 'wcswrite' && b.params && b.params.direct);   // the DIRECT #[#70+off] writes
        if (!asn('#53') || !wcsWrites.length) return null;   // not a middle op
        const cm = all.find((b) => b.type === 'comment' && b.params && /^2axis_/.test(b.params.text || ''));
        const twoAxis = !!cm || all.some((b) => b.type === 'assign' && b.params && b.params.var === '#56' && /\[#54\+#55\]/.test(b.params.value || ''));
        const m = cm && /^2axis_(XtoY|YtoX)_(pos|neg)$/.exec(cm.params.text);
        const axis = m ? (m[1] === 'XtoY' ? 'X' : 'Y')
                       : (Number(wcsWrites[0].params.offset) === 0 ? 'X' : 'Y');   // single-axis: the write offset is the axis
        const circular = all.some((b) => b.type === 'assign' && b.params && b.params.var === '#58' && /ABS\[#51-#52\]/.test(b.params.value || ''));
        const baseAtom = all.find((b) => b.type === 'wcsbaseinto');   // the base atom carries the wcs directly ('active' / G54..G59)
        const wcs = (baseAtom && baseAtom.params && baseAtom.params.wcs) || 'active';
        const f = { m_circular: circular, m_both: twoAxis, m_axis: axis, m_wcs: wcs };
        if (m) f.m_dir2 = m[2];
        // INC3: the per-traverse toggles + Diag travel, recoverable from the BOSS structure — the in-axis traverse is a
        // jog ("opposite wall" REPOSITION) vs an auto cross-over; the trans-axis is a jog ("...perpendicular walls"
        // REPOSITION) vs an auto-traverse (#21). featureType/dir1 stay the form's current value (not distinguishable).
        const cmts = all.filter((b) => b.type === 'comment').map((b) => (b.params && b.params.text) || '');
        const isBoss = cmts.some((t) => /REPOSITION/i.test(t)) || !!asn('#19') || !!asn('#21');
        if (isBoss) {
            f.m_inaxis = cmts.some((t) => /opposite wall/i.test(t)) ? 'manual' : 'auto';
            if (twoAxis) f.m_transaxis = cmts.some((t) => /jog[^]*perpendicular/i.test(t)) ? 'manual' : 'auto';
            const d21 = asn('#21'); if (d21 && d21.params && d21.params.value != null) f.m_diag_travel = String(d21.params.value);
            const d22 = asn('#22'); if (d22 && d22.params && d22.params.value != null) f.m_diag_primary = String(d22.params.value);   // B-TRANS (b): the diagonal's X target round-trips like #21

            // the in-axis cross-over TRAVERSE distance round-trips from #19/#20 (declared, user-set — recover it like #21)
            const c19 = asn('#19'); if (c19 && c19.params && c19.params.value != null) f.m_crossX = String(c19.params.value);
            const c20 = asn('#20'); if (c20 && c20.params && c20.params.value != null) f.m_crossY = String(c20.params.value);
        }
        return f;
    },
    // ── ATC reconcilers ──────────────────────────────────────────────────────────────────────────────────
    // Read the editable form fields back from each ATC op's (possibly block-edited) stack. The identity fields
    // are recoverable from named #vars / atom presence; structural-only params (the magazine, which comes from
    // Settings → Tool table, the probe feeds that live in Settings) are left to the form's current value.
    atc_warmup(prog) {
        const all = flat(prog);
        // rpm1/rpm2 ← the two non-zero Spindle blocks in order; time1/time2 ← the two Dwell blocks in order.
        const rpms = all.filter((b) => b.type === 'spindle' && b.params && num(b.params.rpm, 0) > 0);
        const dwells = all.filter((b) => b.type === 'dwell' && b.params);
        if (rpms.length < 2 || dwells.length < 2) return null;   // not a warmup op
        return {
            atc_warmup_rpm1: num(rpms[0].params.rpm, 6000), atc_warmup_time1: num(dwells[0].params.sec, 30),
            atc_warmup_rpm2: num(rpms[1].params.rpm, 12000), atc_warmup_time2: num(dwells[1].params.sec, 30),
        };
    },
    atc_check(prog) {
        const all = flat(prog);
        const tol = all.find((b) => b.type === 'assign' && b.params && b.params.var === '#20');
        if (!tol) return null;   // not a tool-check op
        return { atc_check_tol: num(tol.params.value, 0.5) };
    },
    atc_change(prog) {
        const all = flat(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        const hasMcode = (c) => all.some((b) => b.type === 'mcode' && num(b.params.code, 0) === c);
        const rawHas = (re) => all.some((b) => b.type === 'raw' && re.test((b.params && b.params.text) || ''));
        const fixedFrom = (tgt) => { const tv = String((tgt && tgt.params.value) || '').trim(); return /^#/.test(tv) ? 0 : Math.round(num(tv, 0)); };

        // FIRMWARE: raw O10102 push station (G53 Z#1306 + the #1320-1326 stations).
        if (rawHas(/O10102/) || rawHas(/Z#1306/)) {
            return { atc_change_method: 'firmware', atc_change_orient: hasMcode(19) };
        }
        // MANUAL: park XYZ in #1/#2/#3.
        if (all.some((b) => b.type === 'comment' && /Manual Tool Change/.test((b.params && b.params.text) || ''))) {
            const x = asn('#1'), y = asn('#2'), z = asn('#3');
            if (!x || !y || !z) return null;
            return { atc_change_method: 'manual', atc_change_x: num(x.params.value, 100), atc_change_y: num(y.params.value, 100), atc_change_z: num(z.params.value, 0) };
        }
        // M6: delegate to the controller (an M6 atom + change-position #103/#104; no #100 target table).
        if (hasMcode(6) && !asn('#100')) {
            const zc = asn('#102');
            // fixedT is carried on the M6 note (T<n>) when a literal tool was chosen, else 0 (from program).
            const m6 = all.find((b) => b.type === 'mcode' && num(b.params.code, 0) === 6);
            const mt = /\bT(\d+)\b/.exec((m6 && m6.params.note) || '');
            const f = { atc_change_method: 'm6', atc_change_fixedt: mt ? Math.round(num(mt[1], 0)) : 0 };
            if (zc) f.atc_change_zclear = num(zc.params.value, 0);
            return f;
        }
        // GENERIC / DISK: ASSUMED magazine pick & place (#100 target table).
        const tgt = asn('#100'), zc = asn('#102');
        if (!tgt) {
            // DECLARE-NOT-INFER fallback (fix B): a method-agnostic emit — the T# M6 call OR the new inline tncProgram
            // RAW body — carries no #100/O10102 to reverse-parse. Read the DECLARED method/callMacro off the op-container
            // (resolveMethod covers legacy mode/magType ops). For fixedT (the one editable field) A1 lets a Blocks EDIT
            // of the RAW `T# M6` word WIN (T present → n, bare M6 → 0); else the declared value (the inline body has no
            // T# M6 line). dp is null only when there's no op-container in the program (a raw leaf-parse) → keep null.
            const dp = declaredOpParams(prog, 'atc_change');
            if (!dp) return null;
            const callRaw = all.find((b) => b.type === 'raw' && /^(T\d+\s+)?M6$/.test(((b.params && b.params.text) || '').trim()));
            let ft;
            if (callRaw) { const m = /^T(\d+)\s+M6$/.exec((callRaw.params.text || '').trim()); ft = m ? Math.round(num(m[1], 0)) : 0; }
            else ft = Math.round(num(dp.fixedT, 0));
            return { atc_change_method: resolveMethod(dp), atc_change_fixedt: ft, atc_change_callmacro: dp.callMacro !== false };
        }
        const disk = all.some((b) => b.type === 'comment' && /DISK \/ CAROUSEL/.test((b.params && b.params.text) || ''));
        const f = {
            atc_change_method: disk ? 'disk' : 'generic', atc_change_fixedt: fixedFrom(tgt),
            atc_change_m300: hasMcode(300),
            atc_change_cover: hasMcode(162),
            atc_change_confirm: all.some((b) => b.type === 'confirm'),
        };
        if (zc) f.atc_change_zclear = num(zc.params.value, 0);
        return f;
    },
    atc_test(prog) {
        const all = flat(prog);
        const asn = (v) => all.find((b) => b.type === 'assign' && b.params && b.params.var === v);
        const pockets = all.some((b) => b.type === 'comment' && /Pocket Dry-Run/.test((b.params && b.params.text) || ''));
        if (pockets) {
            const zc = asn('#102');
            // first ← the first "Pocket N — T#" comment index; count ← how many such stops; descend ← a Pocket-Z move present.
            const stops = all.map((b) => b.type === 'comment' && /^Pocket (\d+) /.exec((b.params && b.params.text) || '')).filter(Boolean);
            const f = {
                atc_test_mode: 'pockets',
                atc_test_descend: all.some((b) => b.type === 'assign' && b.params && b.params.var === '#112'),
            };
            if (zc) f.atc_test_zclear = num(zc.params.value, 0);
            if (stops.length) { f.atc_test_first = num(stops[0][1], 1); f.atc_test_count = stops.length; }
            return f;
        }
        const cyc = asn('#101');
        if (!cyc) return null;   // not a drawbar test
        const dw = all.find((b) => b.type === 'dwell' && b.params);
        const f = { atc_test_mode: 'drawbar', atc_test_cycles: num(cyc.params.value, 10) };
        if (dw) f.atc_test_dwell = Math.round(num(dw.params.sec, 0.5) * 1000);   // dwell atom is seconds; field is ms
        return f;
    },
    atc_table(prog) {
        const all = flat(prog);
        const isTable = all.some((b) => b.type === 'comment' && /Write Tool Table to controller/.test((b.params && b.params.text) || ''));
        if (!isTable) return null;
        // The two include-checkboxes ← the presence of each section header comment.
        return {
            atc_table_lengths: all.some((b) => b.type === 'comment' && /TOOL LENGTHS/.test((b.params && b.params.text) || '')),
            atc_table_pockets: all.some((b) => b.type === 'comment' && /POCKET POSITIONS/.test((b.params && b.params.text) || '')),
        };
    },
    // atc_length has NO editable form fields (all params come from Settings → Probes/ATC), so there is nothing to
    // reverse-sync; it round-trips via params (the builder is the single source). Registered so the audit shows it
    // is wired; returns an empty field set (a structural no-op in pullFromBlocks).
    atc_length() { return {}; },
};

// Flatten a block program (incl. op-container + flow-block children) to a single ordered list — ATC reconcilers
// read named #vars / atom presence out of it. (The middle reconciler walks inline; this is the shared form.)
function flat(prog) {
    const out = [];
    (function walk(arr) { for (const b of (arr || [])) { if (!b) continue; out.push(b); if (b.children) walk(b.children); } })(prog);
    return out;
}

/** DECLARE-NOT-INFER seam (fix B): the DECLARED params of the (first) op of `opType` in a block program. Every
 *  op-container carries them (makeOp), so a reconciler whose emit is declaration-driven (method-agnostic — nothing
 *  to reverse-parse) reads the op's OWN declared params instead of inferring from emit-shape. Reusable by any future
 *  declared-param reconciler as more wizards port to declaration-driven emits (declare the pattern once). */
function declaredOpParams(prog, opType) {
    const op = flat(prog).find((b) => b && b.type === 'op' && b.opType === opType);
    return (op && op.params) || null;
}

let loadedSig = null, shownOp = null;
const sig = (op) => (op ? `${op.type}:${JSON.stringify(op.params)}` : null);

/** Does the active op have a block stack we can show? */
export function hasActiveOpStack() {
    const op = getLastOp();
    return !!(op && builderOf(op.type));
}

/**
 * The active op as { blocks, bare }, or null when there's nothing NEW to show — no op, an op with no
 * stack builder yet (probe family still in progress), or the same op already loaded (so re-opening the
 * Blocks tab doesn't clobber block-side edits). Loading a changed op refreshes the view.
 */
export function buildActiveOpStack() {
    const op = getLastOp(), s = sig(op);
    if (!op || !builderOf(op.type)) { shownOp = null; return null; }
    shownOp = op.type;                      // remember what the Blocks tab is showing (for reverse sync)
    if (s === loadedSig) return null;       // already loaded → don't clobber block-side edits
    loadedSig = s;
    const framed = _framed(op.type, op.params);   // unwrap a self-wrapping builder (homing) so the op isn't double-wrapped
    const start = framed.find((b) => b && b.type === 'progstart');
    const end = framed.find((b) => b && b.type === 'progend');
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    seedKnobExpose(op.type, bare);   // t391 — a data-op's BOUND params show as PRE-TICKED knobs in the Blocks tab (a binding IS a knob)
    const opC = makeOp(op.type, op.params, bare);   // wrap so the Blocks view shows the op as one group (round-trips)
    return { blocks: (start && end) ? [start, opC, end] : [opC] };
}

// t391 (human "do knob, it helps me troubleshoot to use Blocks") — SEED `_expose` on a USER op's value-bound atoms so the
// Blocks tab renders them PRE-TICKED as knobs (a form binding IS a knob — same record). Maps each VALUE binding to its atom by
// BLOCK IDENTITY (bindingSpecs.match — an assign var OR, t1640, an op-param `{type}` match, robust across prune state) or the
// frozen blockIndex (legacy ops); sets the atom's `_expose` = { VALUE: { p:param, w:'number' } }, which round-trips via
// stackBridge (record._expose → block.data) → devMode's augment/restoreExpose ticks the EXPOSE checkbox. ONLY plain-number
// sockets (a `#var`/expression is skipped — not a knob). Display/provenance-only: no emit change (the _expose rides
// block.data, never the G-code). Built-in ops / non-user → no-op.
function seedKnobExpose(opType, bare) {
    if (!opType || !String(opType).startsWith('user_')) return;
    const def = listUserOps().find((d) => d.opType === opType);
    if (!def) return;
    const specs = def.bindingSpecs
        ? def.bindingSpecs.filter((s) => s && s.match && s.key)
        : (def.bindings || []).filter((b) => b && b.blockIndex != null && b.key != null).map((b) => ({ param: b.param, blockIndex: b.blockIndex, key: b.key }));
    if (!specs.length) return;
    const flat = flattenBlocks(bare);
    for (const s of specs) {
        const rec = s.match ? flat.find((r) => matches(r, s.match)) : flat[s.blockIndex];
        if (!rec || !rec.params || typeof rec.params[s.key] !== 'number') continue;   // only a plain-number socket is an exposable knob
        (rec._expose = rec._expose || {})[FN(s.key)] = { p: s.param, w: 'number' };
    }
}

/** Seed the Blocks model from the active wizard op — a PREVIEW (not committed into the program), used when the tab
 *  opens onto an empty model. Builds the op's stack and loads it so it renders; a no-op when there's nothing portable
 *  to show or the same op is already loaded. (blocksApp calls this; it lived only as a call site before — restored.) */
export function previewActiveOp() {
    const r = buildActiveOpStack();
    if (r && r.blocks && typeof window !== 'undefined' && window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(r.blocks);
    return r;
}

/**
 * Commit the active (just-generated) op AS the program — REPLACING whatever was there. t1916/t1918/t1920's own
 * ruling: a Studio program is always exactly one op (with multi-step work living INSIDE that one op, or, for an
 * imported multi-op file, wrapped as one `multi_step` op's own steps — programModel.js's own surviving concern,
 * untouched here). Returns false for an op with no block builder (probe/ATC families still text-only) so the
 * caller can fall back to a plain text insert. Goes through the window program hook (no import cycle):
 * ddcsLoadBlockStack (set the stack; editor re-projects).
 *
 * t1920 — DELETED the accumulation machinery this function used to need: the old `appendIntoProgram` read the
 * CURRENT program and, if non-empty, spliced the new op's bare blocks in before the shared Program End (renumbering
 * its labels via `offsetLabels`/`maxLabelNum` and de-duplicating terminators via `normalizeEnds` — a probe/snippet
 * op is free to carry its own error-handler M30, and concatenating two such ops without this collided both labels
 * and terminators). None of that machinery has a live case left to serve once a program can never hold more than
 * one op — deleting it removes the entire t1828/t1830 bug class structurally (there is no second op to collide
 * with), not just the symptom a test happened to check. Proven in `blocks-accumulate-1920.spec.js` (rewritten from
 * the retired `blocks-accumulate.spec.js`, which asserted the OLD accumulate contract) and
 * `multi-op-progend-1828.spec.js` (rewritten to assert REPLACE).
 */
function loadOpAsProgram(bare, framed) {
    if (!bare || !bare.length) return false;
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(framed || bare);
    loadedSig = null;   // the program changed → next Blocks open re-renders it
    return true;
}

/** t1942 — the bare op record `commitActiveOp` (Replace) and `addActiveOp` (Add) BOTH need, built once so
 *  neither re-derives the other's own logic. Returns null for an op with no block builder yet (the caller falls
 *  back to a plain text insert, same as `commitActiveOp` always has). */
export function buildActiveOpRecord() {
    const op = getLastOp();
    if (!op || !builderOf(op.type)) return null;
    const framed = _framed(op.type, op.params);                        // [progstart, …op…, progend] (homing unwrapped)
    const start = framed.find((b) => b && b.type === 'progstart');
    const end = framed.find((b) => b && b.type === 'progend');
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const opC = makeOp(op.type, op.params, bare);                      // wrap: keep the op record; emit gates per post
    return { opC, start, end };
}

export function commitActiveOp() {
    const r = buildActiveOpRecord();
    if (!r) return false;
    const { opC, start, end } = r;
    return loadOpAsProgram([opC], (start && end) ? [start, opC, end] : [opC]);
}

/** t1942 — ADD the active op as a further operation in the CURRENT program (the human's own Add-to-program
 *  ruling), via `addOperation` (t1940, `programModel.js`) — never a second composition mechanism. Same
 *  no-builder fallback as `commitActiveOp`. Returns false (not a thrown error) if the program hook is missing
 *  or `addOperation` refuses, so the caller's own fallback path (plain text insert) still applies. */
export function addActiveOp() {
    const r = buildActiveOpRecord();
    if (!r) return false;
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    if (typeof window === 'undefined' || !window.ddcsAddOperation) return false;
    const added = window.ddcsAddOperation(cur, r.opC);
    if (!added || !added.length) return false;
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(added);
    loadedSig = null;
    return true;
}

/**
 * EDIT path — re-derive a top-level op from new params and replace it IN PLACE (same op id, stable identity).
 * params are the single source of truth; the op's blocks are just rebuilt from them (no snapshot/inference).
 * Returns false if `opId` isn't a top-level op in the current program.
 */
export function replaceOp(opId, params) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    // t1958 — findOpById/replaceOpById reach an op wherever it lives (top-level or nested in a multi_step's
    // children); a plain findIndex here would silently fail to commit an edit the wizard just opened correctly.
    const op = (typeof window !== 'undefined' && window.ddcsFindOpById) ? window.ddcsFindOpById(cur, opId) : cur.find((b) => b && b.type === 'op' && b.id === opId);
    if (!op) return false;
    const opType = op.opType;
    if (!builderOf(opType)) return false;
    const framed = _framed(opType, params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const opC = makeOp(opType, params, bare);
    opC.id = opId;                                                     // keep the same id so views/selection stay stable
    const next = (typeof window !== 'undefined' && window.ddcsReplaceOpById) ? window.ddcsReplaceOpById(cur, opId, opC) : (() => {
        const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
        return idx < 0 ? null : [...cur.slice(0, idx), opC, ...cur.slice(idx + 1)];
    })();
    if (!next) return false;
    recordOp(opType, params);                                          // update the lastOp snapshot so preview syncs
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/** Remove a top-level op from the program (right-click → Delete). */
export function deleteOp(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/** Duplicate a top-level op (right-click → Duplicate) — fresh blocks/id from the same params, inserted after it. */
export function duplicateOp(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const src = cur[idx];
    if (!builderOf(src.opType)) return false;
    const framed = _framed(src.opType, src.params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const copy = makeOp(src.opType, src.params, bare);                 // fresh id
    const next = [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

const _isLooseTop = (b) => b && b.type !== 'op' && b.type !== 'progstart' && b.type !== 'progend';

/**
 * #headline — wrap a CONTIGUOUS run of LOOSE top-level atoms (a hand-built run with no op wrapper) into ONE editable
 * `group` op, so the editor's line→op map finds it (`findOpInStack` matches `type==='op'`) → the hover ✎ chip appears
 * and clicking it edits the run as a form. The group is a generic op-like container: editable IN PLACE, NOT a
 * registered/reusable wizard. Atoms already inside an op (a real drill, etc.) are left alone; program framing is
 * preserved. The group's children ARE the loose atoms, so emit walks them = byte-identical G-code (no builder needed).
 *
 * `ids` (the in-context "Group" gesture's contiguous run, from looseRunIds) restricts the wrap to exactly that run —
 * each loose run groups independently. Omitted (the legacy/auto path) → wraps EVERY loose top-level atom program-wide.
 * Returns the new op's id, or null if there were no loose atoms to wrap.
 */
export function groupLooseAtoms(label, ids) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idSet = Array.isArray(ids) && ids.length ? new Set(ids) : null;
    const inRun = (b) => _isLooseTop(b) && (!idSet || idSet.has(b.id));
    const loose = cur.filter(inRun);
    if (!loose.length) return null;
    // SPAN the program's ADJACENT framing into the group (parity with built-in ops, whose stacks include
    // progstart/progend → so their forms can expose spindle rpm / clearance / retractZ). The run-finder
    // (looseRunAtLine) still excludes framing — only the WRAP pulls it in, so the editor gesture is undisturbed.
    // Framing keeps its relative position (progstart first, progend last) so emit stays byte-identical. NO guardrail:
    // for a MULTI-op program the user prunes start/end out of the group themselves (per the advisor).
    const firstIdx = cur.indexOf(loose[0]), lastIdx = cur.indexOf(loose[loose.length - 1]);
    const start = (firstIdx > 0 && cur[firstIdx - 1] && cur[firstIdx - 1].type === 'progstart') ? cur[firstIdx - 1] : null;
    const end = (lastIdx < cur.length - 1 && cur[lastIdx + 1] && cur[lastIdx + 1].type === 'progend') ? cur[lastIdx + 1] : null;
    const members = [...(start ? [start] : []), ...loose, ...(end ? [end] : [])];
    const memberIds = new Set(members.map((b) => b.id));
    const op = makeOp('group', {}, members);                           // children = framing + loose atoms (emit = same G-code)
    op.label = label || 'Hand-built';
    const next = [];
    let placed = false;
    for (const b of cur) {
        if (memberIds.has(b.id)) { if (!placed) { next.push(op); placed = true; } continue; }   // first member slot → the group
        next.push(b);
    }
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return op.id;
}

/**
 * Increment 2 — write a GROUP's form edits back into its STORED children. `edits` = [{ blockIndex, key, value }],
 * where blockIndex indexes flattenBlocks(group.children) — the SAME pre-order deriveGroupDef's bindings use. A group
 * has NO builder (its children ARE the program), so we mutate the bound child params IN PLACE (surgical — the form is
 * a pure view, never a regenerate) on a COPY, then reload with the same op id so identity/selection stay stable.
 * Returns false if `groupId` isn't a top-level group op.
 */
export function setGroupChildParams(groupId, edits) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.opType === 'group' && b.id === groupId);
    if (idx < 0) return false;
    const grp = JSON.parse(JSON.stringify(cur[idx]));                  // copy so we never mutate the live model in place
    const flat = flattenBlocks(grp.children);
    for (const e of (edits || [])) {
        const rec = flat[e && e.blockIndex];
        if (rec && rec.params && e.key != null) rec.params[e.key] = e.value;
    }
    const next = [...cur.slice(0, idx), grp, ...cur.slice(idx + 1)];
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

/**
 * For ops with no block builder yet (corner / alignment / ATC / comms): DECODE their generated G-code into blocks
 * (the active dialect's recognizers turn probe / IF-GOTO / WCS into proper blocks; the rest become leaf/raw) and
 * load them AS the program (t1920 — replaces, doesn't accumulate; see `loadOpAsProgram`'s own doc comment) so
 * the decoded op shows in Blocks instead of being lost. Not parametric like a real builder, but it round-trips.
 */
export function commitDecodedCode(code) {
    if (!code || !code.trim()) return false;
    let bare; try { bare = parseGcodeToStack(code, dialectOpts()); } catch (_) { return false; }
    return loadOpAsProgram(bare, null);
}

/**
 * Reverse sync — the form fields that reflect the current (edited) block stack, or null if the shown op
 * has no reconciler or the stack doesn't match its shape. The caller sets the fields + re-runs the wizard.
 */
export function reconcileActiveOp() {
    if (!shownOp || !RECONCILERS[shownOp]) return null;
    const prog = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? window.ddcsGetBlockProgram() : null;
    if (!prog || !prog.length) return null;
    const fields = RECONCILERS[shownOp](prog);
    return fields ? { type: shownOp, fields } : null;
}

/**
 * Replay the DECLARED Replace path for ONE op, wizard-CLOSED — the single rebuild the three diff surfaces
 * (glow / chip / Merge-Replace notice, via opGlow) share. Reconciles the op's (possibly block-edited) stack back to
 * params — the reconciler reads the edited blocks, and its form-only values (toolØ, wallOffset) come from the op's
 * STORED params, not the DOM — then rebuilds with BUILDERS. The reconciled fields override their params; everything
 * untouched (toolØ, rpm, head, …) stays from stored state. Returns the rebuilt bare atoms = what a form Replace
 * would regenerate, or null if the op has no reconciler / its shape doesn't match (caller falls back, fail-safe).
 * So "edited" can mean exactly "Replace would lose something" — a surfaced edit reconciles + reproduces; an
 * injection / unrepresentable residue does not. Declaration via the reconcilers, never motion-inference.
 */
// Memo by the op OBJECT (its identity is the stack signature: ddcsLoadBlockStack replaces the program with fresh
// objects on every edit, so a changed stack ⇒ a new key ⇒ a miss; an unchanged op ⇒ a hit). Dedupes the three
// surface calls (isOpBlockEdited + editedLines + editedRanges) for the same op in one render pass. Caches null too.
const _replayCache = new WeakMap();
export function replayReconcile(opId) {
    const prog = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
    if (!op || !op.opType || !RECONCILERS[op.opType] || !builderOf(op.opType)) return null;
    if (_replayCache.has(op)) return _replayCache.get(op);
    let fields;
    _replayParams = op.params || {};                                  // stored-state sourcing (wizard closed)
    try { fields = RECONCILERS[op.opType]([op]); } finally { _replayParams = null; }   // scope find() to THIS op's subtree
    let rebuilt = null;
    if (fields) {
        const overrides = {};
        for (const k in fields) { if (fields[k] !== undefined) overrides[k.replace(/^[a-z]+_/, '')] = fields[k]; }   // sf_depth → depth
        rebuilt = _builderAtoms(op.opType, { ...op.params, ...overrides });
    }
    _replayCache.set(op, rebuilt);
    return rebuilt;
}

/**
 * Perform a True AST Merge for block-edited ops.
 * It takes the old form-generated blocks (base), the user's hand-edited blocks (edited),
 * and the newly generated form blocks (target). It finds the custom injections in `edited`
 * and splices them perfectly into `target`.
 */
function mergeArrays(base, edited, target) {
    const getStructKey = (b) => {
        let k = b.type;
        if (b.type === 'assign') k += ':' + (b.params?.var || '');
        if (b.type === 'op') k += ':' + (b.opType || '');
        return k;
    };
    
    const mergeParams = (bParams, eParams, tParams) => {
        if (!bParams) bParams = {};
        if (!eParams) eParams = {};
        if (!tParams) tParams = {};
        
        const merged = { ...tParams };
        for (const k in eParams) {
            if (JSON.stringify(eParams[k]) !== JSON.stringify(bParams[k])) {
                if (JSON.stringify(tParams[k]) === JSON.stringify(bParams[k])) {
                    // Form didn't change it, so user's Blocks edit wins
                    merged[k] = eParams[k];
                }
            }
        }
        return merged;
    };

    const bKeys = base.map(getStructKey);
    const eKeys = edited.map(getStructKey);
    
    // 1. Structure match base and edited
    const L1 = Array.from({length: base.length + 1}, () => new Array(edited.length + 1).fill(0));
    for (let i = 1; i <= base.length; i++) {
        for (let j = 1; j <= edited.length; j++) {
            if (bKeys[i-1] === eKeys[j-1]) L1[i][j] = L1[i-1][j-1] + 1;
            else L1[i][j] = Math.max(L1[i-1][j], L1[i][j-1]);
        }
    }
    
    let i = base.length, j = edited.length;
    const alignedBE = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && bKeys[i-1] === eKeys[j-1]) {
            alignedBE.unshift({ bIdx: i-1, eIdx: j-1 });
            i--; j--;
        } else if (j > 0 && (i === 0 || L1[i][j-1] >= L1[i-1][j])) {
            alignedBE.unshift({ bIdx: null, eIdx: j-1 });
            j--;
        } else if (i > 0 && (j === 0 || L1[i][j-1] < L1[i-1][j])) {
            alignedBE.unshift({ bIdx: i-1, eIdx: null });
            i--;
        }
    }
    
    // 2. Structure match base and target
    const tKeys = target.map(getStructKey);
    const L2 = Array.from({length: base.length + 1}, () => new Array(target.length + 1).fill(0));
    for (let x = 1; x <= base.length; x++) {
        for (let y = 1; y <= target.length; y++) {
            if (bKeys[x-1] === tKeys[y-1]) {
                L2[x][y] = L2[x-1][y-1] + 1;
            } else {
                L2[x][y] = Math.max(L2[x-1][y], L2[x][y-1]);
            }
        }
    }
    let x = base.length, y = target.length;
    const bToT = [];
    const mappedT = new Set();
    while (x > 0 || y > 0) {
        if (x > 0 && y > 0 && bKeys[x-1] === tKeys[y-1]) {
            bToT[x-1] = y-1;
            mappedT.add(y-1);
            x--; y--;
        } else if (y > 0 && (x === 0 || L2[x][y-1] >= L2[x-1][y])) {
            y--;
        } else if (x > 0 && (y === 0 || L2[x][y-1] < L2[x-1][y])) {
            x--;
        }
    }
    
    // 3. Reconstruct target
    const result = [];
    let nextTargetIdx = 0;
    
    for (const a of alignedBE) {
        if (a.bIdx !== null && a.eIdx !== null) {
            const tIdx = bToT[a.bIdx];
            if (tIdx !== undefined) {
                while (nextTargetIdx < tIdx) {
                    if (!mappedT.has(nextTargetIdx)) result.push({ ...target[nextTargetIdx] });
                    nextTargetIdx++;
                }
                const tBlock = { ...target[tIdx] };
                if (tBlock.params || base[a.bIdx].params || edited[a.eIdx].params) {
                    tBlock.params = mergeParams(base[a.bIdx].params, edited[a.eIdx].params, target[tIdx].params);
                }
                if (edited[a.eIdx].children || target[tIdx].children) {
                    tBlock.children = mergeArrays(base[a.bIdx].children || [], edited[a.eIdx].children || [], target[tIdx].children || []);
                }
                if (edited[a.eIdx].id) tBlock.id = edited[a.eIdx].id;
                result.push(tBlock);
                nextTargetIdx = tIdx + 1;
            }
        } else if (a.bIdx !== null && a.eIdx === null) {
            const tIdx = bToT[a.bIdx];
            if (tIdx !== undefined) {
                mappedT.add(tIdx);
                nextTargetIdx = tIdx + 1;
            }
        } else if (a.bIdx === null && a.eIdx !== null) {
            result.push(edited[a.eIdx]);
        }
    }
    while (nextTargetIdx < target.length) {
        if (!mappedT.has(nextTargetIdx)) result.push({ ...target[nextTargetIdx] });
        nextTargetIdx++;
    }
    
    return result;
}

export function mergeOpBlocks(opId, newParams) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    const op = cur[idx];
    if (!op || !op.opType || !builderOf(op.opType)) return false;

    // The user's manually edited blocks
    const editedBlocks = op.children;

    // The "base" pristine blocks from the old params + the "target" fresh blocks from the new params.
    // _builderAtoms unwraps a self-wrapping builder (homing) so base/target align with op.children (else the merge
    // mis-aligns every homing atom as an injection).
    const oldPristine = _builderAtoms(op.opType, op.params);
    const targetBlocks = _builderAtoms(op.opType, newParams);
    
    // Perform the 3-way merge
    const mergedBlocks = mergeArrays(oldPristine, editedBlocks, targetBlocks);
    
    // Apply the merged AST back to the program model
    const opC = makeOp(op.opType, newParams, mergedBlocks);
    opC.id = opId;
    const next = [...cur.slice(0, idx), opC, ...cur.slice(idx + 1)];
    recordOp(op.opType, newParams);
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
    return true;
}

