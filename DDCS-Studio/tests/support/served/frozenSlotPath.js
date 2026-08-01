/**
 * tests/support/served/frozenSlotPath.js — THE FROZEN LITERAL SLOT KERNEL (t1496). TEST-ONLY. NEVER SHIPPED.
 *
 * Served at `/_test/frozenSlotPath.js` by the mem-server and reachable from nothing else. This is a VERBATIM copy of
 * `slotPath` and everything it reaches, as they emit TODAY — before the slot capability arc's purpose is cashed and
 * the kernel's clearing is re-pointed through the parametric raster atom.
 *
 * ── WHY IT EXISTS: THE VACUITY TRAP, the same one t1385 closed for drill and t1406 for the pocket ─────────────────
 * Every bridge in the re-point asserts "the literal slot and the parametric atom cut the same passes". The moment
 * `slotPath` is re-pointed, a bridge that built its literal side by CALLING `slotPath` would compare the parametric
 * emit TO ITSELF and pass while proving nothing. So the reference lands BEFORE the re-point, never after — a
 * reference captured afterwards freezes the new behaviour and the baseline is lost for good.
 *
 * ⚠ IT IS AN EXTRACTION, NOT A TRANSCRIPTION. Every declaration below was pulled verbatim out of the shipping
 * sources by a script (the `export` keyword stripped, nothing else touched), because a hand-copied baseline that
 * drifts by one character is worse than no baseline at all — it proves the wrong thing confidently. Its faithfulness
 * is then ASSERTED against the live kernel across a config sweep in `slot-frozen-reference-1496.spec.js`, so this
 * file cannot quietly stop being a copy.
 *
 * ⚠ THE LITERAL KERNEL IS **NOT** RETIRING. `SLOT_RASTER_GAP` holds two named EVIDENCE gates after the arc closed
 * (t1494): a DIALLED bearing needs COS/SIN of a runtime angle — trig, unverified here, V13 decides — and a slot
 * HELIX entry still wants the true-arc form the atom does not have. Those arms stay literal permanently, exactly as
 * `pocketfill`'s non-rect and rest arms did (t1464). So this freeze is not a bridge held until an atom dies; it is
 * the independent baseline for a boundary that is now permanent, which is the longer job rather than the shorter.
 *
 * SOURCES, and the order they are reached in:
 *   wizards/ops/util.js      num · r3
 *   wizards/ops/toolFit.js   toolTooLarge · toolFitRefusal · refusalLines   (the too-small law — t1444)
 *   wizards/clearing.js      depthLevels · levelEntry · entryOrPlunge       (the descent the slot asks for)
 *   wizards/ops/slot.js      slotMaxToolDia · slotTooSmall · slotToolRefusal · slotPath
 */

// ── from wizards/ops/util.js ───────────────────────────────────────────────────────────────────────────
const UTIL = (() => {
    /** wizards/ops/util.js — shared numeric atoms for the op-block kernels. */
    function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

    const r3 = (n) => Math.round(n * 1000) / 1000;
    return { num, r3 };
})();

// ── from wizards/ops/toolFit.js ────────────────────────────────────────────────────────────────────────
const FIT = (() => {
    const { num, r3 } = UTIL;
    /** A micron. Below any machine's resolution, above float noise — see the ruling note above. */
    const FIT_EPS = 0.001;

    /**
     * THE REGISTER THE FAMILY REFUSES THROUGH. `#1505` is the controller's error flag and the whole parametric family
     * already writes it (`surfaceraster`'s zero-stepover and collapsed-inset guards, `wallfinish`'s, the skim frame read).
     * It is named here rather than re-typed because the ENGINE now reads it back — an executed `#1505` write is what tells
     * a preview it is looking at a refusal and not at an empty program — so the emitters and the detector have to mean the
     * same register by construction, not by two files happening to agree.
     */
    const REFUSE_VAR = 1505;

    /** Does this tool STRICTLY exceed what the feature can hold? (Equal is not too large — the user's ruling.) */
    function toolTooLarge(maxToolDia, toolDia) {
        return num(toolDia, 0) > num(maxToolDia, 0) + FIT_EPS;
    }

    /**
     * The operator's sentence when the tool cannot fit, or '' when it can.
     *
     * The wording is the user's own — *"the 12.7mm tool cannot fit the 6.35mm slot"* — and it leads with the CONSEQUENCE
     * ("No toolpath") because that is the thing the operator is looking at and failing to explain. `feature` is the noun
     * the wizard calls its own hole in the world ('slot', 'pocket'), so one sentence serves every consumer.
     */
    function toolFitRefusal(maxToolDia, toolDia, feature) {
        return toolTooLarge(maxToolDia, toolDia)
            ? `No toolpath — the ${r3(num(toolDia, 0))}mm tool cannot fit the ${r3(num(maxToolDia, 0))}mm ${feature}`
            : '';
    }

    /**
     * A refusal, in the family's emitted form: set the error flag, carry the reason as the line's own comment.
     *
     * ⚠ IT EMITS NO MOTION AND THAT IS THE ENTIRE POINT. The alternative shape — emit the path and let a runtime guard
     * jump over it — is what the surfacing atom does for a condition only the MACHINE can evaluate (a dialled stepover).
     * This condition is known at BUILD time, so a program carrying the unreachable path would put a wrong toolpath in the
     * file and in every preview that draws it, guarded by a branch no reader can see. Nothing is safer for being present
     * and skipped.
     */
    function refusalLines(why) {
        return [`#${REFUSE_VAR}=1   ;ERROR: ${why}`];
    }
    return { toolTooLarge, toolFitRefusal, refusalLines };
})();

// ── from wizards/ops/helix.js ──────────────────────────────────────────────────────────────────────────
const HELIX = (() => {
    const { num, r3 } = UTIL;
    /** Ordered descending helix points (x,y,z), work coords. */
    function helixPoints(p) {
        const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.radius, 10);
        const depth = num(p.depth, 10), pitch = Math.max(0.2, num(p.pitch, 2)), seg = Math.max(8, Math.round(num(p.seg, 24)));
        const a0 = num(p.startAngle, 0) * Math.PI / 180, n = Math.round(Math.max(1, depth / pitch) * seg), pts = [];
        for (let k = 1; k <= n; k++) {
            const a = a0 + k * 2 * Math.PI / seg;
            pts.push({ x: r3(cx + R * Math.cos(a)), y: r3(cy + R * Math.sin(a)), z: r3(-depth * k / n) });
        }
        return pts;
    }
    return { helixPoints };
})();

// ── from wizards/clearing.js ───────────────────────────────────────────────────────────────────────────
const CLR = (() => {
    const { helixPoints } = HELIX;
    const r3 = (n) => Math.round(n * 1000) / 1000;

    const num = (v, d) => { const n = Number(v); return isFinite(n) ? n : d; };

    /** Depth levels for a stepdown: [sd, 2·sd, …, depth] (always finishing exactly at depth). */
    function depthLevels(depth, stepdown) {
        const D = Math.max(0, depth), sd = Math.max(0.05, stepdown), out = [];
        for (let d = sd; ; d += sd) { out.push(Math.min(d, D)); if (d >= D) break; }
        return out;
    }

    /** t804 — DEPTH ENTRY: the per-level descent to the cut Z `z`, by mode. Returns { ok, lines?, why? }. When ok, the caller
     *  kernel emits `lines` in place of its straight plunge; else it falls back to the plunge (byte-identical) — the honest
     *  degrade. Every entry rapids to (x0,y0), drops to the previous cleared floor (prevZ), descends `drop = prevZ − z`, and
     *  ENDS at (x0,y0,z) so the kernel proceeds unchanged. `plunge` is handled inline by the caller (not routed here).
     *   ramp  — descend TOWARD the region centre (cx,cy) at ≤ rampAngle°, then return to the start at z. Greys (ok:false +
     *           why) when the run to centre is shorter than the descent needs (drop / tan(angle)) — the greyed-ramp case.
     *   helix — a linearized descending helix (helixPoints) of radius helixR (the caller clamps it to fit) at (cx,cy),
     *           pitch = mm per rev, then a G1 to the start at z. */
    function levelEntry(mode, o) {
        const { x0, y0, cx, cy, z, prevZ, feed } = o, drop = prevZ - z;
        if (!(drop > 1e-6)) return { ok: false };   // no descent this level → let the kernel plunge (defensive)
        if (mode === 'ramp') {
            const ang = Math.min(45, Math.max(0.5, num(o.rampAngle, 3))), run = drop / Math.tan(ang * Math.PI / 180);
            let mx, my;
            if (o.runX != null && o.runY != null) {
                // t842 — a DECLARED run vector: a SLOT ramps along its LENGTH, a CONTOUR along its FIRST SEGMENT (toward-centre
                // is geometrically wrong for those). `runLen` = the run available that way; too short → degrade with the why.
                const rl = Math.hypot(o.runX, o.runY) || 1, avail = num(o.runLen, rl);
                if (!(avail >= run)) return { ok: false, why: `ramp ${r3(ang)}deg needs ${r3(run)}mm along the run, have ${r3(avail)}mm -> plunge` };
                mx = x0 + run * o.runX / rl; my = y0 + run * o.runY / rl;
            } else {
                // toward the region CENTRE (pocket/surfacing area-fill) — unchanged, byte-identical
                const toC = Math.hypot(cx - x0, cy - y0);
                if (!(toC >= run)) return { ok: false, why: `ramp ${r3(ang)}deg needs ${r3(run)}mm, first move ${r3(toC)}mm -> plunge` };
                const t = run / toC; mx = x0 + t * (cx - x0); my = y0 + t * (cy - y0);
            }
            return { ok: true, lines: [`G0 X${r3(x0)} Y${r3(y0)}`, `G0 Z${r3(prevZ)}`, `G1 X${r3(mx)} Y${r3(my)} Z${r3(z)} F${feed}   ( ramp )`, `G1 X${r3(x0)} Y${r3(y0)} F${feed}`] };
        }
        if (mode === 'helix') {
            // t842 — honest fit: when the op declares a max helix radius it can hold (a narrow slot), a helix that needs more
            // room degrades to the plunge with a why (the ramp precedent). Absent maxHelixR (pocket/surfacing) → unchanged.
            if (o.maxHelixR != null && !(o.maxHelixR >= 0.2)) return { ok: false, why: `helix needs room the geometry lacks -> plunge` };
            const cap = o.maxHelixR != null ? Math.min(num(o.helixR, 3), o.maxHelixR) : num(o.helixR, 3);
            const R = Math.max(0.2, cap), pitch = Math.max(0.1, num(o.helixPitch, 1));
            const pts = helixPoints({ cx, cy, radius: R, depth: drop, pitch, seg: 24 });   // p.z ∈ (0,−drop] → world prevZ+p.z ∈ [prevZ, z]
            const L = [`G0 X${r3(cx + R)} Y${r3(cy)}`, `G0 Z${r3(prevZ)}`];
            for (const p of pts) L.push(`G1 X${r3(p.x)} Y${r3(p.y)} Z${r3(prevZ + p.z)} F${feed}`);
            L.push(`G1 X${r3(x0)} Y${r3(y0)} Z${r3(z)} F${feed}   ( helix )`);
            return { ok: true, lines: L };
        }
        return { ok: false };
    }

    /** t804 — a kernel's first descent at (x0,y0): the level-entry (ramp/helix) when `ctx.entry` asks for it AND it fits, else
     *  the kernel's exact `plungeLines` (so PLUNGE — the default — stays byte-for-byte). A ramp that can't fit degrades to the
     *  plunge with a `( why )` comment (the honest greyed-ramp case). ctx carries {entry, cx, cy, z, prevZ, rampAngle, helixR, helixPitch, feed}. */
    function entryOrPlunge(ctx, x0, y0, plungeLines) {
        if (ctx && ctx.entry && ctx.entry !== 'plunge') {
            const e = levelEntry(ctx.entry, { x0, y0, cx: ctx.cx, cy: ctx.cy, z: ctx.z, prevZ: ctx.prevZ, rampAngle: ctx.rampAngle, helixR: ctx.helixR, helixPitch: ctx.helixPitch, feed: ctx.feed, runX: ctx.runX, runY: ctx.runY, runLen: ctx.runLen, maxHelixR: ctx.maxHelixR });
            if (e && e.ok) return e.lines;
            if (e && e.why) return [`( ${e.why} )`, ...plungeLines];
        }
        return plungeLines;
    }
    return { depthLevels, levelEntry, entryOrPlunge };
})();

// ── from wizards/ops/slot.js ───────────────────────────────────────────────────────────────────────────
const SLOT = (() => {
    const { num, r3 } = UTIL;
    const { toolTooLarge, toolFitRefusal, refusalLines } = FIT;
    const { depthLevels, entryOrPlunge } = CLR;
    /**
     * t1444 — THE SLOT'S OWN SPAN, DECLARED: a slot offers the tool exactly its WIDTH, and nothing else about a slot
     * constrains the tool (its LENGTH is travel, not clearance — a slot shorter than the tool is still a legal plunge-
     * and-move, and the zero-length degenerate already has its own arm). So the boundary is one comparison, and both the
     * predicate and the sentence read this one number.
     */
    const slotMaxToolDia = (p = {}) => num(p.width, num(p.tool, num(p.toolDia, 6)));

    /** Is this slot strictly narrower than its tool → refuse everywhere? (Exactly tool-width is ALLOWED — the ruling.) */
    const slotTooSmall = (p = {}) => toolTooLarge(slotMaxToolDia(p), num(p.tool, num(p.toolDia, 6)));

    /** The operator sentence for a slot the tool cannot fit, or '' — one wording for emit, preview, twin and CAM pack. */
    const slotToolRefusal = (p = {}) => toolFitRefusal(slotMaxToolDia(p), num(p.tool, num(p.toolDia, 6)), 'slot');

    /** Slot toolpath: clearance preamble + zig-zag offset passes stepping down (+ zero-length single-plunge guard). */
    function slotPath(p) {
        const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 60), y1 = num(p.y1, 0);
        const tool = Math.max(0.1, num(p.tool, 6));
        /**
         * ── t1444 — THE CLAMP THAT HID THE DEFECT, REPLACED BY A REFUSAL (user-ruled) ─────────────────────────────────
         *
         * This line was `Math.max(tool, num(p.width, tool))`. A 6.35mm slot asked of a 12.7mm tool came out as a **12.7mm
         * slot** — the wrong number repaired into a plausible one before anything could notice it was wrong, which is why
         * it survived: the program was clean, the preview confident, and the channel twice the width that was typed.
         * A strictly-smaller slot now refuses with no motion (`slotTooSmall` is the one boundary, shared with the twin and
         * the CAM pack); EXACTLY tool-width keeps the single centreline pass it has always emitted, byte-identical.
         */
        const width = num(p.width, tool);
        const refusal = slotToolRefusal({ ...p, tool, width });
        if (refusal) return refusalLines(refusal);
        const so = Math.max(0.2, tool * num(p.stepoverPct, 40) / 100);
        const depth = num(p.depth, 4);
        const clr = num(p.clearance, 5), feed = num(p.feed, 2000), plunge = num(p.plunge, 150);
        const levels = depthLevels(depth, num(p.stepdown, 1.5));
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
        const L = [];   // program-level clearance is provided by the enclosing program (emitMapped header)

        if (len < 1e-6) {     // A == B → just a plunged hole
            L.push('( zero-length slot — single plunge )');
            for (const d of levels) L.push(`G0 X${r3(x0)} Y${r3(y0)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
            return L;
        }

        const nx = -dy / len, ny = dx / len;        // perpendicular (left of A→B)
        const band = Math.max(0, width - tool);     // width the tool centre must sweep
        const offs = [];
        if (band < 1e-6) offs.push(0);
        else { const half = band / 2; for (let o = -half; o < half - 1e-6; o += so) offs.push(o); offs.push(half); }

        // t842 — DEPTH ENTRY: ramp runs along the slot LENGTH (the pass direction, not toward-centre); a helix must fit the
        // slot WIDTH (helix + tool ≤ width/2) — a tool-width slot degrades to plunge with a why. Plunge (default) = byte-identical.
        const entry = p.entry || 'plunge';
        const wantR = num(p.helixDia, 0) > 0 ? num(p.helixDia, 0) / 2 : tool / 2;
        const helixMaxR = width / 2 - tool / 2, helixR = Math.max(0.2, Math.min(wantR, helixMaxR));
        let prevD = 0;
        for (const d of levels) {
            const z = -d;
            L.push(`( level Z${r3(z)} )`);
            let dir = 1, first = true;
            for (const o of offs) {
                let sx = x0 + nx * o, sy = y0 + ny * o, ex = x1 + nx * o, ey = y1 + ny * o;
                if (dir < 0) { [sx, ex] = [ex, sx];[sy, ey] = [ey, sy]; }
                if (first) {
                    const ctx = { entry, z, prevZ: -prevD, rampAngle: num(p.rampAngle, 3), feed,
                        runX: ex - sx, runY: ey - sy, runLen: len,                                   // ramp along the pass (the slot length)
                        helixR, helixPitch: num(p.helixPitch, 1), maxHelixR: helixMaxR,
                        cx: sx + helixR * (ex - sx) / len, cy: sy + helixR * (ey - sy) / len };       // helix centred R into the slot (stays inside)
                    L.push(...entryOrPlunge(ctx, sx, sy, [`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`]));
                    first = false;
                }
                else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);   // step across to the next pass
                L.push(`G1 X${r3(ex)} Y${r3(ey)} F${feed}`);
                dir = -dir;
            }
            L.push(`G0 Z${clr}`);
            prevD = d;
        }
        return L;
    }
    return { slotMaxToolDia, slotTooSmall, slotToolRefusal, slotPath };
})();

export const frozenSlotPath = SLOT.slotPath;
export const frozenSlotTooSmall = SLOT.slotTooSmall;
export const frozenSlotToolRefusal = SLOT.slotToolRefusal;
