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
#blk_wiz_user .wiz-2pane .wiz-visual .wiz-viz3d { flex: 1 1 auto; height: auto !important; min-height: 0; }`,
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
];
