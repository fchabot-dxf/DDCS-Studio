/**
 * ui/setupSheet.js — THE SETUP SHEET (t850). A print-ready single job page.
 *
 * NORTH STAR (declare-never-infer): everything on this sheet is ALREADY DECLARED somewhere — the sheet
 * READS each source, it never re-derives. One source per section:
 *   ops        → window.ddcsGetBlockProgram()   (filter type==='op'; opType / label / params)
 *   tools      → getTool(num)  + the op→tool resolution precedence (mirrors wizards/views/userOpView.js)
 *   WCS        → settings.machine.wcs {active, table} + placementDeclared() + wcsOffsetAt()  (the one frame map)
 *   stock      → settings.stock {show, x,y,z, datum, pin}  (show===false / no dims → not declared)
 *   time       → window.ddcsTimeEstimate() (t844) — total + secondsForLines(perLine, ddcsLinesForOp(id)) per op
 *   pre-flight → checkEnvelope(gcode, settings) (t838) — the verdict badge state
 *   safe-Z     → settings.machine.safeZMargin
 *   machine    → getMachine() (this workspace's ONE machine) + CONTROLLER_PROFILES[controllerId].name
 *
 * HONESTY: a tool with no library row shows its TYPED Ø + "typed Ø (no tool-table entry)", never an invented
 * name. Undeclared stock / WCS render an explicit "not declared" row — never a silent omission.
 *
 * STYLE: on-screen a themed modal frame (#setupSheetOverlay) wrapping a white "paper" sheet (theme-independent,
 * legible in both themes). The Print button = window.print(); the @media print CSS (styles.css) strips the scrim
 * + chrome and fills the page black-on-white.
 */
import { getTool } from '../wizards/toolPicker.js';
import { estimateProgram, secondsForLines, fmtDuration } from '../engine/timeEstimate.js';
import { checkEnvelope, placementDeclared } from '../engine/envelopeCheck.js';
import { wcsOffsetAt } from '../viz/sceneFrame.js';
import { getMachine } from '../data/workspaceMachine.js';   // t1217 — the workspace's ONE machine record (the profile library is retired)
import { fileSavedStem } from '../data/backup.js';   // t2145 — the workspace's name is its last-saved .ddcs file's name; no separate field
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { flipForSetup } from '../wizards/ops/transform.js';   // t879 — the two-sided FLIP declaration (per-setup page + instruction)
import { flattenOps } from '../blocks/programModel.js';   // t1928 — the ONE declared enumeration: every real op, one level through a multi_step import wrapper

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (v) => { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(v == null ? '' : v); };

// datum code humanization — the SAME [X][Y][Z] n/c/p mapping the stock editor's datumName() uses (one meaning, two readers).
const _XW = { n: 'left', c: '', p: 'right' }, _YW = { n: 'front', c: '', p: 'back' }, _ZW = { n: 'bottom', c: '', p: 'top' };
function datumName(code) {
    if (!code || !/^[ncp]{3}$/.test(code)) code = 'nnp';
    const w = [_ZW[code[2]], _YW[code[1]], _XW[code[0]]].filter(Boolean).join(' ');
    return w ? w[0].toUpperCase() + w.slice(1) : 'Centre';
}
// stock.pin → the "sits at" label (the stock editor's se_pin options: Program zero / G54…G59).
const pinLabel = (p) => (!p || p === 'origin') ? 'Program zero' : String(p).toUpperCase();

// The op→tool resolution — a faithful mirror of wizards/views/userOpView.js:266-276 (table-first precedence). The op
// carries only a NUMBER (params.toolNum) + an optional free-typed fallback Ø (params.toolDia); dia + tip derive from the
// library, nothing is COPIED onto the op. Returns null when the op references no tool at all.
function resolveOpTool(params) {
    const opToolDia = Number(params.toolDia);
    const hasNum = params.toolNum !== '' && params.toolNum != null;
    const tbl = hasNum ? getTool(params.toolNum) : null;
    const tdia = tbl ? Number(tbl.dia) : NaN;
    const dia = (tdia > 0) ? tdia : ((opToolDia > 0) ? opToolDia : NaN);
    if (tbl && Number.isFinite(dia)) return { num: params.toolNum, name: tbl.name || '', dia, type: tbl.type || 'endmill', typedOnly: false };
    if (opToolDia > 0) return { num: null, name: '', dia: opToolDia, type: 'endmill', typedOnly: true };
    return null;
}

// The tool list, DEDUPED in order of use: a real tool folds by T#, a typed-only Ø folds by its diameter.
function toolList(ops) {
    const seen = new Map();
    const add = (t) => { if (!t) return; const key = t.typedOnly ? ('D' + t.dia) : ('T' + t.num); if (!seen.has(key)) seen.set(key, t); };
    for (const op of ops) {
        add(resolveOpTool(op.params || {}));
        const p = op.params || {};
        if (Number(p.restDia) > 0) add(resolveOpTool({ toolNum: p.restTool, toolDia: p.restDia }));   // t871 — the REST (2nd, smaller) tool picks up for free
    }
    return [...seen.values()];
}

// A size summary from the op's declared geometry params (shape-aware; degrades gracefully for any op).
function sizeStr(p) {
    if (p.shape === 'circle' || p.shape === 'polygon') return 'Ø' + fmtN(p.dia) + (p.shape === 'polygon' && p.sides ? ' (' + p.sides + '-gon)' : '');
    if (p.w != null && p.w !== '' && p.h != null && p.h !== '') return fmtN(p.w) + '×' + fmtN(p.h);
    return '';
}
// The at-a-glance key params per op TYPE (declared param names → a compact human string). A generic fallback covers
// user / unknown ops so the row is never blank.
function opKeyParams(op) {
    const p = op.params || {}, t = op.opType || '';
    const depth = (p.depth != null && p.depth !== '') ? ' · depth ' + fmtN(p.depth) : '';
    if (/pocket/.test(t)) return ([p.shape, sizeStr(p)].filter(Boolean).join(' ') + depth + (p.strategy ? ' · ' + p.strategy : '')).trim();
    if (/drill/.test(t)) return (p.pattern || 'single') + depth + (p.peck ? ' · peck ' + fmtN(p.peck) : '');
    if (/contour/.test(t)) return ([p.shape, sizeStr(p)].filter(Boolean).join(' ') + (p.side ? ' · ' + p.side : '') + depth).trim();
    if (/surfacing/.test(t)) return (sizeStr(p) + depth + (p.strategy ? ' · ' + p.strategy : '')).trim();
    if (/slot/.test(t)) return '(' + fmtN(p.ax) + ',' + fmtN(p.ay) + ')→(' + fmtN(p.bx) + ',' + fmtN(p.by) + ')' + (p.width != null && p.width !== '' ? ' · w' + fmtN(p.width) : '') + depth;
    if (/bore/.test(t)) return ((p.holeDia != null && p.holeDia !== '' ? 'Ø' + fmtN(p.holeDia) : '') + (p.pattern && p.pattern !== 'single' ? ' · ' + p.pattern : '') + depth).trim();
    if (/text/.test(t)) return (p.text ? '“' + p.text + '”' : '') + depth;
    const bits = [];
    if (p.shape) bits.push(p.shape);
    const sz = sizeStr(p); if (sz) bits.push(sz);
    if (p.depth != null && p.depth !== '') bits.push('depth ' + fmtN(p.depth));
    return bits.join(' · ') || '—';
}

// Per-op time from the SAME cached estimate the editor hover chip reads (one source): sum the op's projected lines.
function opTime(op, est) {
    try {
        if (!est || !est.perLine || !window.ddcsLinesForOp) return null;
        const s = secondsForLines(est.perLine, window.ddcsLinesForOp(op.id) || []);
        return s > 0 ? s : null;
    } catch (_) { return null; }
}

// t879 — TWO-SIDED SETUP GROUPS. Ops nest inside `setup` containers; collect the op blocks (recursively — an op may sit
// directly under a setup or deeper). No `setup` blocks → null (the single-page path stays byte-identical).
function collectOps(blocks, out) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        if (b.type === 'op') out.push(b);
        if (b.children) collectOps(b.children, out);
    }
    return out;
}
function setupGroups(raw) {
    const setups = (raw || []).filter((b) => b && b.type === 'setup');
    if (!setups.length) return null;   // no two-sided structure → the classic single Operations section
    return setups.map((s) => ({
        id: s.id,
        title: (s.params && s.params.title) || 'Setup',
        index: Number((s.params && s.params.index) || 0),
        ops: collectOps(s.children || [], []),
        flip: flipForSetup(raw, Number((s.params && s.params.index) || 0)),
    }));
}
// The flip INSTRUCTION for a setup, stated from the declaration (plain wording, taste-level pending the user). The t879
// "not yet re-shown flipped" caveat is RETIRED at t881 — the sim now flips the stock + carries the carve field.
function flipInstruction(flip) {
    const axis = (flip && flip.params && String(flip.params.axis).toUpperCase() === 'Y') ? 'Y' : 'X';
    const about = axis === 'X' ? 'the X axis (front ↔ back)' : 'the Y axis (left ↔ right)';
    return `<div class="ss-row ss-flip"><b>Flip the part about ${about}.</b> Keep the registered edge against the fence, then re-zero (or probe) the new top face as this setup's WCS.</div>`;
}
// t881 — PER-SETUP PREFLIGHT (a REPORTING split over the ONE existing whole-program trace: the emitted text already carries
// the baked side-2 mirror, so the single checkEnvelope sees the mirrored side-2 coords). Bucket each violation onto its
// owning setup via the projection map: proj.map[line-1][0] = the top-level ancestor block id (a `setup` is top-level). →
// { index → [violations] }. Empty when no projection / no setups.
export function violationsBySetup(verdict, groups) {
    const bySetup = new Map();
    const proj = (window.ddcsGetProjection && window.ddcsGetProjection()) || null;
    if (!verdict || !groups || !proj || !proj.map) return bySetup;
    for (const v of (verdict.violations || [])) {
        if (v.line == null) continue;   // t1323 — a whole-program breach (travel-extent) belongs to no setup; the footer verdict carries it
        const anc = proj.map[(v.line | 0) - 1];
        const topId = anc && anc[0];
        const g = groups.find((grp) => grp.id === topId);
        if (g) { if (!bySetup.has(g.index)) bySetup.set(g.index, []); bySetup.get(g.index).push(v); }
    }
    return bySetup;
}
// The per-setup pre-flight rows: name each violation (line, axis, overshoot) on this setup's page — or a green line.
export function setupPreflightHTML(list) {
    if (!list || !list.length) return `<div class="ss-row ss-verdict-green">✓ this setup fits the envelope</div>`;
    const hasFlagged = list.some((v) => v.kind === 'through-stock' || v.kind === 'no-spindle');   // t937/t947 — a non-envelope kind softens the envelope-specific header
    return `<div class="ss-row ss-verdict-red">✕ ${list.length} move${list.length === 1 ? '' : 's'} ${hasFlagged ? 'flagged' : 'outside the envelope'}:</div>`
        + list.slice(0, 8).map((v) => v.kind === 'no-spindle'
            ? `<div class="ss-row ss-muted">line ${esc(v.line)} · cuts with the spindle OFF (no M3)</div>`
            : v.kind === 'through-stock'
            ? `<div class="ss-row ss-muted">line ${esc(v.line)} · crosses the stock</div>`
            : `<div class="ss-row ss-muted">line ${esc(v.line)} · ${esc(v.axis)} · ${fmtN(v.overshoot)} mm over</div>`).join('');
}
// The Operations table for a set of ops (shared by the single-page + per-setup paths). Returns the table + its subtotal.
function opsTable(ops, est) {
    if (!ops.length) return `<div class="ss-row ss-undeclared">No operations in this setup.</div>`;
    const rows = ops.map((op, i) => {
        const secs = opTime(op, est);
        return `<tr><td>${i + 1}</td><td>${esc(op.label || op.opType || 'operation')}</td><td>${esc(opKeyParams(op))}</td><td>${secs != null ? esc(fmtDuration(secs)) : '—'}</td></tr>`;
    }).join('');
    return `<table class="ss-table"><thead><tr><th>#</th><th>Operation</th><th>Key params</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`;
}
// t879 — the per-setup time split (the estimate splits for free: sum each setup's own ops). null with no setup structure.
export function setupTimeSplit() {
    const raw = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const groups = setupGroups(raw);
    if (!groups) return null;
    const est = (window.ddcsTimeEstimate && window.ddcsTimeEstimate()) || null;
    return groups.map((g) => ({ index: g.index, title: g.title, seconds: g.ops.reduce((a, op) => a + (opTime(op, est) || 0), 0) }));
}

/** Build the print-ready sheet's inner HTML, reading every value from its declared source. */
export function buildSheetHTML() {
    const S = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    const machine = S.machine || {};
    const stock = S.stock;
    const raw = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const groups = setupGroups(raw);   // t879 — per-setup pages when the stack declares setup boundaries; else null (single page)
    const ops = groups ? groups.flatMap((g) => g.ops) : flattenOps(raw);   // all ops → Tools + the whole-program estimate
    const editor = document.getElementById('editor');
    const prog = editor ? editor.value : '';
    let est = (window.ddcsTimeEstimate && window.ddcsTimeEstimate()) || null;
    if (!est) { try { est = estimateProgram(prog, { rapidRate: machine.rapidRate || 6000, toolChangeSec: machine.toolChangeSec }); } catch (_) { est = null; } }
    let verdict = null;
    try { verdict = checkEnvelope(prog, S); } catch (_) { verdict = null; }
    const ap = getMachine();   // t1217 — { controllerId, kind, … } for THIS workspace
    const ctrl = (CONTROLLER_PROFILES[ap.controllerId] || {}).name || ap.controllerId || '';
    // t2145 (BACKLOG F2) — no separate machine-name field; the workspace's name is its last-saved .ddcs stem.
    const apName = fileSavedStem();
    const jobName = (window.ddcsProjectName && window.ddcsProjectName()) || 'Untitled job';
    let dateStr; try { dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { dateStr = ''; }

    // STOCK — declared when it is shown AND has all three positive dimensions.
    const stockDeclared = stock && stock.show !== false && Number(stock.x) > 0 && Number(stock.y) > 0 && Number(stock.z) > 0;
    const stockHTML = stockDeclared
        ? `<div class="ss-row"><b>${fmtN(stock.x)} × ${fmtN(stock.y)} × ${fmtN(stock.z)} mm</b></div>`
          + `<div class="ss-row">Datum: ${esc(datumName(stock.datum))} &nbsp;·&nbsp; Sits at: ${esc(pinLabel(stock.pin))}</div>`
        : `<div class="ss-row ss-undeclared">Stock not declared — set the block up in the Workpiece editor.</div>`;

    // WCS — always name the active offset word; show the numeric offset only when placement is declared (a WCS table).
    const active = Number((machine.wcs && machine.wcs.active) || 1);
    const gword = 'G' + (53 + active);
    let wcsHTML = `<div class="ss-row">Active: <b>${esc(gword)}</b></div>`;
    if (placementDeclared(machine)) {
        const wo = wcsOffsetAt(machine, active) || { x: 0, y: 0, z: 0 };
        wcsHTML += `<div class="ss-row">Offset from machine home: X${fmtN(wo.x)} &nbsp; Y${fmtN(wo.y)} &nbsp; Z${fmtN(wo.z)} mm</div>`;
    } else {
        wcsHTML += `<div class="ss-row ss-undeclared">WCS offset not declared — Pull from controller or enter the table.</div>`;
    }

    // TOOLS — deduped in order of use; a typed-only Ø is named honestly (no invented name).
    const tools = toolList(ops);
    const toolsHTML = tools.length
        ? `<table class="ss-table"><thead><tr><th>T#</th><th>Name</th><th>Ø&nbsp;mm</th><th>Tip</th></tr></thead><tbody>`
          + tools.map((t) => t.typedOnly
              ? `<tr><td>—</td><td class="ss-muted">typed Ø (no tool-table entry)</td><td>${fmtN(t.dia)}</td><td>—</td></tr>`
              : `<tr><td>T${esc(t.num)}</td><td>${esc(t.name || '(unnamed)')}</td><td>${fmtN(t.dia)}</td><td>${esc(t.type || 'endmill')}</td></tr>`
          ).join('') + `</tbody></table>`
        : `<div class="ss-row ss-undeclared">No tools referenced by the program.</div>`;

    // OPERATIONS — order, name, key params, time. t879: when the stack declares setups, render ONE section per setup
    // (a page break between them), each stating its flip instruction + its own time subtotal. No setups → the classic
    // single Operations section (byte-identical to a pre-t879 program).
    let opsSection;
    if (groups) {
        const bySetup = violationsBySetup(verdict, groups);   // t881 — the per-setup preflight split (over the one whole-program trace)
        opsSection = groups.map((g, gi) => {
            const secs = g.ops.reduce((a, op) => a + (opTime(op, est) || 0), 0);
            return `<section class="ss-setup"${gi > 0 ? ' style="page-break-before:always"' : ''}>`
                + `<h3>${esc(g.title)}${g.index ? ' <span class="ss-muted">· setup ' + g.index + '</span>' : ''}</h3>`
                + (g.flip ? flipInstruction(g.flip) : '')
                + opsTable(g.ops, est)
                + `<div class="ss-row ss-muted">Setup run time: ${secs > 0 ? esc(fmtDuration(secs)) : '—'}</div>`
                + setupPreflightHTML(bySetup.get(g.index))
                + `</section>`;
        }).join('');
    } else {
        const opsHTML = ops.length ? opsTable(ops, est) : `<div class="ss-row ss-undeclared">No operations in the program.</div>`;
        opsSection = `<section><h3>Operations</h3>${opsHTML}</section>`;
    }

    // FOOTER — total time, the pre-flight verdict state, the safe-Z margin.
    const total = (est && est.seconds) ? fmtDuration(est.seconds) : '—';
    const vTxt = verdict ? ({ green: '✓ fits envelope', amber: '⚠ can’t verify', red: `✕ ${verdict.violations.length} outside envelope` }[verdict.status] || verdict.status) : '—';
    const vClass = verdict ? verdict.status : 'none';
    const safez = (machine.safeZMargin != null && machine.safeZMargin !== '') ? machine.safeZMargin : '—';
    const footHTML = `<div class="ss-foot">`
        + `<span>Total run time: <b>${esc(total)}</b></span>`
        + `<span>Pre-flight: <b class="ss-verdict ss-verdict-${esc(vClass)}">${esc(vTxt)}</b></span>`
        + `<span>Safe-Z margin: <b>${esc(String(safez))} mm below home</b></span>`
        + `</div>`;

    return `<div class="ss-title" contenteditable="true" spellcheck="false" title="Click to edit job name">${esc(jobName)}</div>`
        + `<div class="ss-sub" contenteditable="true" spellcheck="false" title="Click to edit notes/details">${esc(dateStr)} · ${esc(apName || 'Not saved')}${ctrl ? ' · ' + esc(ctrl) : ''}</div>`
        + `<section><h3>Stock</h3>${stockHTML}</section>`
        + `<section><h3>Work coordinate system</h3>${wcsHTML}</section>`
        + `<section><h3>Tools</h3>${toolsHTML}</section>`
        + opsSection
        + footHTML;
}

/** Open the Setup Sheet modal (a themed frame around the white paper sheet) with a Print button. */
export function openSetupSheet() {
    document.getElementById('setupSheetOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'setupSheetOverlay';
    ov.className = 'setup-sheet-overlay';
    ov.innerHTML = `<div class="setup-sheet-modal modal-card" role="dialog" aria-label="Setup sheet">`
        + `<div class="setup-sheet-chrome">`
        + `<span class="setup-sheet-chrome-title">Setup sheet</span>`
        + `<span><button type="button" id="setupSheetPrint" class="setup-sheet-btn">🖨 Print</button>`
        + `<button type="button" id="setupSheetClose" class="setup-sheet-btn setup-sheet-btn-close" aria-label="Close">✕</button></span>`
        + `</div>`
        + `<div class="setup-sheet-page" id="setupSheetPage">${buildSheetHTML()}</div>`
        + `</div>`;
    document.body.appendChild(ov);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    ov.querySelector('#setupSheetClose').addEventListener('click', close);
    ov.querySelector('#setupSheetPrint').addEventListener('click', () => window.print());
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    return ov;
}

if (typeof window !== 'undefined') window.openSetupSheet = openSetupSheet;
