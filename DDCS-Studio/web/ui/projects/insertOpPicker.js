/**
 * ui/projects/insertOpPicker.js — BACKLOG #37, "INSERT OP FROM PROJECT" (the preset successor). From inside the
 * current job, browse every saved PROJECT in this workspace, see each one's OPS individually, pick ONE, and it
 * is inserted into the current program with its saved params — the same op stack format the current program
 * already uses (blocks/opSession.js's insertOpFromRecord). PROJECTS STAY THE ONLY STORE OF VALUES: this is a
 * READ of one project from inside another, one storage concept with a new gesture over it — a one-op project
 * then behaves exactly as a preset did, and so does any op in any past job.
 *
 * ENTRY POINT (owner-ruled): the quick menu's Project section only — see ui/headerPost.js's 'projInsert' row.
 *
 * THE NAMED HAZARD — an op whose TYPE is not registered in THIS workspace (a user_* op whose custom def lives
 * only in the project's ORIGIN workspace's own ddcs_user_ops storage): a project's .mjson carries opType+params
 * only (see blocks/programFile.js's serializeProject — `stack` is the live op-container array, never a def), so
 * an unregistered type can never be rebuilt here. Confirmed against the codebase's OWN precedent for exactly this
 * situation — data/stackToSlot.js and data/subStackToSlot.js already fail this same gap with "op def not found …
 * deleted or is not registered on this machine" rather than guessing — so the row is GREYED with that reason
 * visible, never silently dropped and never a guessed substitute.
 *
 * NO per-op thumbnails (BACKLOG #37 — the text summary carries it this turn): opType (friendly label), a cheap
 * one-line params summary (ui/projects/insertOpSummary.js), and the op's own attached comment (t2289 — the same
 * note the Blocks canvas shows) when it has one.
 */
import * as store from './projectStore.js';
import { builderOf, opLabelOf } from '../../blocks/opBuilders.js';
import { insertOpFromRecord } from '../../blocks/opSession.js';
import { summarizeOpParams } from './insertOpSummary.js';
import { toast } from '../gateway/util.js';
import { dlgNotice } from '../dialog.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A project's saved `stack` holds top-level op containers ({type:'op', opType, params, comment?, …}) plus, for a
// multi-op import, one 'multi_step' wrapper whose OWN children are further op containers (programModel.js's
// groupConsecutiveOps) — expand exactly that one level so those steps are pickable too, same as any other op.
function opsOf(stack) {
    const out = [];
    for (const b of (stack || [])) {
        if (!b || b.type !== 'op') continue;
        if (b.opType === 'multi_step' && Array.isArray(b.children)) {
            for (const step of b.children) if (step && step.type === 'op') out.push(step);
        } else out.push(b);
    }
    return out;
}

let _ov = null;

export async function openInsertOpPicker() {
    if (_ov) { _ov.remove(); _ov = null; }
    const ov = document.createElement('div');
    ov.id = 'iopOverlay';
    ov.className = 'wsm-overlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="wsm-modal modal-card">
        <div class="wsm-head"><span class="wsm-title">Insert op from project</span><button type="button" class="wsm-x" aria-label="Close">✕</button></div>
        <div class="wsm-body"><section id="iopList"></section></div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    ov.__expanded = new Set();
    const close = () => { ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.app-dialog')) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wsm-x').addEventListener('click', close);
    ov.querySelector('.wsm-body').addEventListener('click', (e) => onClick(ov, e));

    await render(ov);
    return ov;
}

async function render(ov) {
    const host = ov.querySelector('#iopList');
    const entries = (await store.exportAllEntries()).filter((e) => e.type === 'project').sort((a, b) => a.path.localeCompare(b.path));
    if (!entries.length) {
        host.innerHTML = '<div class="wsm-empty">No saved projects in this workspace yet — save one first (the Project section\'s own Save as…), then its ops are pickable here.</div>';
        return;
    }
    host.innerHTML = `<div class="wizm-list wizm-scroll">${entries.map((e) => rowFor(ov, e)).join('')}</div>`;
}

function rowFor(ov, entry) {
    const ops = opsOf(entry.data && entry.data.stack);
    const open = ov.__expanded.has(entry.path);
    const name = entry.data && entry.data.name || entry.path;
    const head = `<div class="wizm-row" data-projrow="${esc(entry.path)}">
        <span class="wizm-ico">${open ? '📂' : '📁'}</span>
        <button type="button" class="wizm-name" style="all:unset; cursor:pointer; flex:1 1 32%; min-width:0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" data-iop="toggle" data-path="${esc(entry.path)}" title="${esc(entry.path)}">${esc(name)}</button>
        <span class="wizm-when">${ops.length} op${ops.length === 1 ? '' : 's'}</span>
    </div>`;
    if (!open) return head;
    const opsHtml = ops.length
        ? ops.map((op) => opRow(entry.path, op)).join('')
        : '<div class="wsm-empty" style="padding:6px 10px 6px 34px;">No ops in this project.</div>';
    return head + `<div class="iop-ops">${opsHtml}</div>`;
}

function opRow(projPath, op) {
    const ok = !!builderOf(op.opType);
    const label = opLabelOf(op.opType);
    const summary = summarizeOpParams(op.opType, op.params);
    const note = op.comment ? esc(op.comment) : '';
    const reason = ok ? '' : `Not available in this workspace — "${esc(label)}" is a custom op whose definition is not registered here.`;
    return `<div class="wizm-row iop-op-row${ok ? '' : ' iop-op-row-disabled'}" data-opid="${esc(op.id || '')}" data-projpath="${esc(projPath)}" ${ok ? '' : 'aria-disabled="true"'} title="${ok ? '' : reason}">
        <span class="wizm-ico">${ok ? '⚙' : '🚫'}</span>
        <span class="wizm-name" style="flex:1 1 32%; min-width:0; white-space:normal; overflow:visible; text-overflow:clip;">
            <b>${esc(label)}</b>
            ${summary ? `<span style="color:var(--text-dim); font-weight:400;"> — ${esc(summary)}</span>` : ''}
            ${note ? `<div style="font-size:11px; color:var(--text-dim); font-style:italic;">“${note}”</div>` : ''}
            ${!ok ? `<div style="font-size:11px; color:var(--danger, #ef4444);">${reason}</div>` : ''}
        </span>
        ${ok ? `<span class="wizm-acts"><button type="button" class="wizm-act" data-iop="insert" data-projpath="${esc(projPath)}" data-opid="${esc(op.id || '')}">＋ Insert</button></span>` : ''}
    </div>`;
}

async function onClick(ov, e) {
    const t = e.target.closest('[data-iop]');
    if (!t) return;
    const act = t.dataset.iop;
    if (act === 'toggle') {
        const path = t.dataset.path;
        if (ov.__expanded.has(path)) ov.__expanded.delete(path); else ov.__expanded.add(path);
        await render(ov);
        return;
    }
    if (act === 'insert') {
        const { projpath, opid } = t.dataset;
        const entry = (await store.exportAllEntries()).find((e) => e.type === 'project' && e.path === projpath);
        const op = entry && opsOf(entry.data && entry.data.stack).find((o) => o.id === opid);
        if (!op) { dlgNotice('That op could not be found — the project may have changed.'); return; }
        const done = insertOpFromRecord(op);
        if (done) toast(`Inserted "${opLabelOf(op.opType)}" into the current program.`);
        else dlgNotice(`Could not insert "${opLabelOf(op.opType)}" — its op type has no builder registered in this workspace.`, { title: 'Insert failed' });
        // t2361 (BACKLOG #37) — the list stays OPEN: picking several ops is just picking again, no re-open needed.
    }
}
