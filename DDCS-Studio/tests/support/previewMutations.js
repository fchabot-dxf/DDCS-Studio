/**
 * tests/support/previewMutations.js — t2463 (BACKLOG #61, ARC A / L1: THE MUTATION MANIFEST). The gate
 * (`dragRenderTruth.js`, t2461) proves itself against DECLARED DATA instead of hand-rolled per-defect
 * archaeology (locate a fix commit → revert on disk → run → restore → repeat, one-shot, never re-checked).
 * Mirrors `blocks/dataOps/equivalence.js`'s own shape: a small module of inert data, read by one runner.
 *
 * ⛔ THE ONE HARD CONSTRAINT — every mutation applies IN-FLIGHT (via Playwright `page.route()` rewriting the
 * served response body), NEVER on the filesystem. Two seats share this repo concurrently (CLAUDE.md rule 3);
 * a crashed run that leaves a source file mutated on disk is a corrupted commit waiting for the OTHER seat to
 * `git add -A`. t2461 mutated real files and restored them byte-identical — it worked, once, by hand. That is
 * exactly the shape this manifest exists to retire.
 *
 * Each entry: `{ id, defect, files, drag, minTrackedPx?, maxSnapbackPx? }` — `files` is a list of
 * `{ path, find, replace }` byte-mutations applied to the SERVED file at `path` (the find string must appear
 * EXACTLY once in the current source — the runner asserts this, so a mutation silently matching zero or many
 * times is itself a caught error, not a false pass). `drag` is what `dragHandleRenderTruth` needs to reproduce
 * the defect on a real op/handle. An entry with no `files` (synthetic, no historical fix commit — declares
 * `synthetic: true` instead) still fits the same runner, same shape.
 */

// ── Entry 1 — pocket pk_size (rect handle) snap-back on release. BACKLOG #46, fix ab59b869 (t2447). PROVEN RED
// at t2461 via a disk revert; this is the same mutation expressed in-flight, never touching disk. ──────────────
const T2447_FEATURECANVAS = {
    path: '/viz/featureCanvas.js',
    find: `            this._suppressFitOnCommit = true;
            if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);
            this._suppressFitOnCommit = false;`,
    replace: `            if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);`,
};
const T2447_FEATURECANVAS_REFIT = {
    path: '/viz/featureCanvas.js',
    find: `if (!this._tf || (!this._userAdjusted && !this.active && !this._suppressFitOnCommit)) this._tf = this._fit(spec, VW, VH);`,
    replace: `if (!this._tf || (!this._userAdjusted && !this.active)) this._tf = this._fit(spec, VW, VH);`,
};
const T2447_PANELTYPES = {
    path: '/wizards/ops/panelTypes.js',
    find: `    const onDragEnd = () => {
        if (!_host) return;
        const toFlush = [];
        _host.querySelectorAll('[data-param]').forEach((f) => {
            const committed = f.dataset.ddcsCommitted;
            if (committed !== undefined && committed !== String(f.value)) toFlush.push([f.dataset.param, f.value]);
        });
        for (const [name, val] of toFlush) _writeParam(name, val);
    };`,
    replace: `    const onDragEnd = () => {
        if (!_host) return;
        _host.querySelectorAll('[data-param]').forEach((f) => {
            const committed = f.dataset.ddcsCommitted;
            if (committed !== undefined && committed !== String(f.value)) _writeParam(f.dataset.param, f.value);
        });
    };`,
};
const T2447_FILES = [T2447_FEATURECANVAS, T2447_FEATURECANVAS_REFIT, T2447_PANELTYPES];

// ── Entry 4 — the Wizard View pane sized its two-pane-vs-stacked layout off the WINDOW, never its own width.
// BACKLOG #58, fix 84def5d1 (t2423) — a BUNDLED commit (#52+#58+#59+flaky-trend+a sizer note); this reverts
// ONLY #58's own hunk (container-type: inline-size + the @container wrapper), not the unrelated #52/#59 work
// the same commit also carries. ──────────────────────────────────────────────────────────────────────────────
const T2423_STYLES_CONTAINMENT = {
    path: '/styles.css',
    find: `#blocks-app .blk-formpane { container-type: inline-size; flex:1; height:100%; max-height:100%; overflow:auto; background:var(--screen); }`,
    replace: `#blocks-app .blk-formpane { flex:1; height:100%; max-height:100%; overflow:auto; background:var(--screen); }`,
};
// The @container-gated block, found by its own distinctive first+last rule (the block moved verbatim inside
// the wrapper at t2423 — unwrapping means deleting the `@container (...) {` opening and its matching `}`,
// leaving the 12 rules unconditional again exactly as they were pre-t2423).
const T2423_STYLES_UNWRAP = {
    path: '/styles.css',
    // t2481 — extended to also carry BACKLOG #68's own rules (added inside this SAME @container block, right
    // after .wiz-viz3d), so unwrapping the block still matches the on-disk file exactly once. This mutation's
    // own claim (pane-sizes-from-window, BACKLOG #58) is unaffected either way — it exercises .wiz-2pane, not
    // .ui-split-horiz — the #68 lines just have to ride along so the find-string stays a byte-exact match.
    find: `@container (max-width: 860px) {
    #blk_wiz_user .wiz-2pane { flex-direction: column; height: auto; }
    #blk_wiz_user .wiz-2pane > .wiz-controls { order: 2 !important; flex: 0 0 auto; overflow: visible; width: 100%; padding: 0; }
    #blk_wiz_user .wiz-2pane > .wiz-visual { order: 1 !important; flex: 0 0 auto; min-height: 0; }
    #blk_wiz_user .wiz-2pane > .wiz-splitter { display: none; }
    #blk_wiz_user .wiz-2pane > .wiz-visual > .viz-container { flex: 0 0 auto; min-height: 0; }
    #blk_wiz_user .wiz-2pane .wiz-visual .viz-split { flex-direction: column; }
    #blk_wiz_user .wiz-2pane .wiz-visual .viz-split > .viz-container { flex: 0 0 auto; min-height: 0; }
    #blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane] > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) / 2); }
    #blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane="preview3d"] > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) * var(--pane-ratio, 0.5)); }
    #blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane="layout2d"]  > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) * (1 - var(--pane-ratio, 0.5))); }
    #blk_wiz_user .wiz-2pane .wiz-visual .viz-split.has-collapsed-pane > [data-viz-pane]:not([data-collapsed="1"]) > .wiz-pane-body { height: var(--viz-stack-h, 400px) !important; }
    #blk_wiz_user .wiz-2pane .wiz-visual .wiz-viz3d { flex: 1 1 auto; height: auto !important; min-height: 0; }
    /* t2481 (BACKLOG #68) — a DECLARED horizontal split (drill's own \`split_horizontal\`, t2341) had only the
       ≤860px @media stacking rule above (line ~2702-2704, keyed to the WINDOW), never this @container one —
       so a narrow #blk-formpane inside a wide window left \`.ui-split-pane1\`'s fixed 360px column wider than
       its own narrow flex container, starving \`.ui-split-pane2\` (flex-basis:0, nothing left to grow into) to
       a genuine computed width:0. Same fix shape as t2423's own #blk_wiz_user .wiz-2pane rules just above,
       mirroring the ALREADY-STACKED @media version verbatim — the SAME 860px figure, now asked of the pane. */
    #blk_wiz_user .ui-split-horiz { flex-direction: column; height: auto; }
    #blk_wiz_user .ui-split-horiz > .ui-split-pane1 { flex: 0 0 auto; order: 2; }
    #blk_wiz_user .ui-split-horiz > .ui-split-pane2 { flex: 0 0 auto; order: 1; min-height: 0; }
}`,
    replace: `#blk_wiz_user .wiz-2pane { flex-direction: column; height: auto; }
#blk_wiz_user .wiz-2pane > .wiz-controls { order: 2 !important; flex: 0 0 auto; overflow: visible; width: 100%; padding: 0; }
#blk_wiz_user .wiz-2pane > .wiz-visual { order: 1 !important; flex: 0 0 auto; min-height: 0; }
#blk_wiz_user .wiz-2pane > .wiz-splitter { display: none; }
#blk_wiz_user .wiz-2pane > .wiz-visual > .viz-container { flex: 0 0 auto; min-height: 0; }
#blk_wiz_user .wiz-2pane .wiz-visual .viz-split { flex-direction: column; }
#blk_wiz_user .wiz-2pane .wiz-visual .viz-split > .viz-container { flex: 0 0 auto; min-height: 0; }
#blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane] > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) / 2); }
#blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane="preview3d"] > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) * var(--pane-ratio, 0.5)); }
#blk_wiz_user .wiz-2pane .wiz-visual [data-viz-pane="layout2d"]  > .wiz-pane-body { height: calc(var(--viz-stack-h, 400px) * (1 - var(--pane-ratio, 0.5))); }
#blk_wiz_user .wiz-2pane .wiz-visual .viz-split.has-collapsed-pane > [data-viz-pane]:not([data-collapsed="1"]) > .wiz-pane-body { height: var(--viz-stack-h, 400px) !important; }
#blk_wiz_user .wiz-2pane .wiz-visual .wiz-viz3d { flex: 1 1 auto; height: auto !important; min-height: 0; }
#blk_wiz_user .ui-split-horiz { flex-direction: column; height: auto; }
#blk_wiz_user .ui-split-horiz > .ui-split-pane1 { flex: 0 0 auto; order: 2; }
#blk_wiz_user .ui-split-horiz > .ui-split-pane2 { flex: 0 0 auto; order: 1; min-height: 0; }`,
};

// ── Entry 3 — the flyout-lands-in-a-corner defect class. NO fix commit exists to derive this from (checked:
// grepped WORK-LOG for "flyout"+"corner" together, found only this turn's own t2459 measurement naming it as
// one of the owner's 5 real defects this week — no turn number, no commit). SYNTHETIC, by design: mutates
// `dropdownPopup.js`'s own trigger-relative positioning (the ONE place a field popup computes WHERE it opens,
// shared by pickerField.js/optionsEditorField.js) to ignore the trigger entirely and pin at the viewport
// origin — representing the defect CLASS (a flyout's position stops tracking its trigger) rather than
// reproducing one specific historical regression. ──────────────────────────────────────────────────────────
const SYNTHETIC_FLYOUT_CORNER = {
    path: '/blocks/blockly/dropdownPopup.js',
    find: `    const x = r.left, y = r.top + r.height + 4;`,
    replace: `    const x = 0, y = 0;`,
};

// ── Entry 5 — t2465 (BACKLOG #61 / L2, THE PRESENCE PRIMITIVE's own acceptance seed). `dragRenderTruth.js`/the
// manifest's first 4 entries all assume a handle EXISTS to measure a position on — this proves the SEPARATE,
// smaller claim: does a declared affordance render AT ALL. CONFIRMED LIVE before declaring anything (per the
// dispatch's own explicit instruction — a declaration written from a guess is worse than none): pocket's own
// `pocketPreviewGeometry` (web/blocks/dataOps/pocketData.js) pushes TWO handles for shape:'rect' (the default
// seed this manifest already uses) — `pk_pos` (always) and `pk_size` (this branch specifically). Mutates the
// `pk_size` push into a no-op, so the resize affordance silently stops rendering while `pk_pos` stays — a
// genuine element-ABSENCE mutation, structurally distinct from every geometry mutation above (nothing here
// touches WHERE a handle renders, only WHETHER one does at all). NOT a seed for BACKLOG #62 itself (the
// missing-pane-sizer report) — that defect has no confirmed-live selector/mechanism to mutate from; this is a
// different, independently-confirmed affordance chosen specifically because #62 could not be seeded blind. ──
const T2465_POCKET_SIZE_HANDLE_REMOVED = {
    path: '/blocks/dataOps/pocketData.js',
    find: `        handles.push({ type: 'rect', id: 'pk_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size });`,
    replace: `        /* t2465 mutation: pk_size intentionally not pushed */`,
};

// ── Entry 6 — t2481 (BACKLOG #61 / L3, THE REACHABILITY PRIMITIVE's own acceptance seed; also BACKLOG #68's
// permanent guard). Reverts the @container fix in-flight (web/styles.css) so drill's own tree-rendered
// `.ui-split-horiz` split goes back to computing `.ui-split-pane2` at width:0 inside a narrow #blk-formpane —
// landing the `dr_pos` handle past the viewport edge with no scroll mechanism to reach it (document.scrollWidth
// === window.innerWidth). Unlike every entry above, this ALSO reproduces RED against the CURRENT, unmutated
// tree with no route at all before the fix landed — this seed additionally proves the guard catches the SAME
// regression class if the @container rules are ever deleted/renamed. ──────────────────────────────────────────
const T2481_STYLES_DRILL_SPLIT_UNFIX = {
    path: '/styles.css',
    find: `    #blk_wiz_user .ui-split-horiz { flex-direction: column; height: auto; }
    #blk_wiz_user .ui-split-horiz > .ui-split-pane1 { flex: 0 0 auto; order: 2; }
    #blk_wiz_user .ui-split-horiz > .ui-split-pane2 { flex: 0 0 auto; order: 1; min-height: 0; }`,
    replace: ``,
};

// ── Entry 7 — t2563 (BACKLOG #64/#65's own permanent guard). Reverts the refit-on-drop position-preservation
// fix: the roomy refit-on-drop (t732) computes a genuinely NEW `scale` to accommodate the full current extent
// — a scale change alone, applied to the SAME (already-correct, never-stale — measured directly this turn,
// correcting the OLD comment's own staleness claim) world position, moves its SCREEN position, which is what
// dragHandleRenderTruth actually measures. The fix solves `cxw`/`cyw` (keeping the new `scale`) so the just-
// released handle's own screen position is preserved exactly; this mutation strips that correction back to the
// bare `this._tf = this._fit(...)` call, reproducing #64/#65's own snap-back exactly. ─────────────────────────
const T2563_FEATURECANVAS_REFIT_ON_DROP = {
    path: '/viz/featureCanvas.js',
    find: `                const p2 = this._placement || { x: 0, y: 0 };
                const hNow = (this.spec.handles || []).find((x) => String(x.id) === String(id));
                const hx = hNow ? hNow.x + (p2.x || 0) : null, hy = hNow ? hNow.y + (p2.y || 0) : null;
                const edgeDist = (s) => Math.min(s.x, this._vw - s.x, s.y, this._vh - s.y);
                const preScreen = hNow ? this._S(hx, hy) : null;
                const preEdgeDist = preScreen ? edgeDist(preScreen) : 0;
                this._tf = this._fit(this.spec, this._vw, this._vh, true);
                if (hNow && preScreen) {
                    const t = this._tf;
                    const naturalScreen = this._S(hx, hy);
                    if (edgeDist(naturalScreen) < preEdgeDist) {
                        t.cxw = hx - (preScreen.x - t.cx) / t.scale;
                        t.cyw = hy - (t.cy - preScreen.y) / t.scale;
                    }
                }`,
    replace: `                this._tf = this._fit(this.spec, this._vw, this._vh, true);`,
};

export const PREVIEW_MUTATIONS = [
    {
        id: 'pk-size-snapback',
        defect: 'pocket pk_size (rect handle) snaps back post-release — BACKLOG #46, fix ab59b869 (t2447)',
        files: T2447_FILES,
        op: 'pocket',
        seed: { type: 'pocket', shape: 'rect', dx: 40, dy: 25, steps: 8, settleMs: 400 },
        proven: 'PROVEN RED at t2461 (disk revert); must stay red under the in-flight equivalent',
    },
    {
        id: 'sf-pos-snapback',
        defect: 'surfacing sf_pos (point/move handle) — SAME fix ab59b869 (t2447), the bug\'s own original screenshot subject',
        files: T2447_FILES,
        op: 'surfacing',
        seed: { type: 'surfacing', dx: -150, dy: 100, steps: 12, settleMs: 500 },
        proven: 'RESOLVED at t2465: reproduces RED deterministically (3/3 at t2463, 4/4 isolated + 1/1 under contention at t2465) — the t2461-vs-t2463 divergence closes in t2463\'s favour, see WORK-LOG t2465',
    },
    {
        id: 'flyout-corner-synthetic',
        defect: 'a field popup ignores its trigger and opens pinned at the viewport corner — no fix commit exists; synthetic, representing the defect CLASS',
        files: [SYNTHETIC_FLYOUT_CORNER],
        synthetic: true,
        op: 'tool-picker-popup',
        proven: 'the whole point of this design — untestable by t2461\'s own per-commit method',
    },
    {
        id: 'pane-sizes-from-window',
        defect: 'the Wizard View pane keys two-pane-vs-stacked off the WINDOW width instead of its own — BACKLOG #58, fix 84def5d1 (t2423), ONE hunk of a bundled commit',
        files: [T2423_STYLES_CONTAINMENT, T2423_STYLES_UNWRAP],
        op: 'wizard-view-pane',
        proven: 'a real revert seed, isolated from the bundled commit\'s unrelated #52/#59 work',
    },
    {
        id: 'pocket-size-handle-presence',
        kind: 'presence',
        defect: 'the L2 acceptance seed — pocket\'s pk_size (resize) handle silently stops rendering while pk_pos stays; a PRESENCE claim, not a position one — no historical fix commit, a confirmed-live affordance chosen specifically because BACKLOG #62 could not be seeded blind',
        files: [T2465_POCKET_SIZE_HANDLE_REMOVED],
        op: 'pocket',
        seed: { type: 'pocket', shape: 'rect' },
        affordance: { containerSelector: 'svg.feature-canvas', selectors: ['.fc-handle[data-hid="pk_pos"]', '.fc-handle[data-hid="pk_size"]'] },
        proven: 'the presence primitive\'s own acceptance test — proves L2 by breaking it, exactly as L1 required',
    },
    {
        id: 'drill-split-pane-unreachable',
        kind: 'reachability',
        defect: 'drill\'s tree-rendered .ui-split-horiz split starves .ui-split-pane2 to width:0 inside a narrow #blk-formpane, landing dr_pos past the viewport edge — BACKLOG #68, fix (t2481, @container rules mirroring t2423)',
        files: [T2481_STYLES_DRILL_SPLIT_UNFIX],
        op: 'drill',
        affordance: { containerSelector: '#blk_wiz_user', selectors: ['.fc-handle[data-hid="dr_pos"]'] },
        proven: 'the reachability primitive\'s own acceptance test — proves L3 by reverting BACKLOG #68\'s own fix, exactly as L1/L2 required',
    },
    {
        id: 'simstart-refit-snapback',
        defect: 'alignment/rotaryClock\'s own noSnap sim-start marker (__simstart0) snaps back on release — BACKLOG #64/#65, fix t2563 (the refit-on-drop\'s own scale change relocating the just-released handle)',
        files: [T2563_FEATURECANVAS_REFIT_ON_DROP],
        op: 'alignment',
        // t2563 — pure +X (dx60,dy0), not #65's own "bigger diagonal" (dx90,dy60): BOTH are real bug vectors,
        // but "bigger diagonal" is the single MOST EXTREME drag in #65's own table, and its own residual after
        // the fix (~20px, down from ~45px pre-fix — see BACKLOG #65's own t2563 account) is a real, DECLARED,
        // bounded gap entangled with the separate pan-feedback arc (t2559/t2561, deliberately out of scope this
        // turn) — NOT within `assertDragRenderFaithful`'s own default 5px tolerance, so it would fail this
        // runner's CLEAN phase for a reason unrelated to whether THIS fix works. Pure +X shows a clean, strong
        // signal both ways: BUGGY = a clear ~20px loss (RED, comfortably past the 5px tolerance); FIXED = a
        // +7.4px margin (GREEN, comfortably past it the other way) — the reliable seed for a permanent gate.
        seed: { dx: 60, dy: 0, steps: 10, settleMs: 400 },
        proven: 'PROVEN RED at t2563 via the same 4-condition kill-switch that isolated the root; 4 of #65\'s own 5 vectors settle at 0px residual once fixed, this one (pure +X) among them — the 5th (bigger diagonal) is DECLARED, not silently dropped, see BACKLOG #65\'s own t2563 account',
    },
];
