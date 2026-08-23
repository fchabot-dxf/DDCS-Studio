/**
 * ui/wizardManagerPanel.js — BAR ARRANGEMENT: a simple TREE that designs the wizard bar (distinct from
 * ui/wizardManager.js, which owns wizard LIFECYCLE — Rename/Duplicate/Export/Delete/Fork/Import; t1617's own
 * header always said so, and t2196 is the turn that stopped this file's rows from also carrying Edit/Export/
 * Delete, a boundary that had leaked back in).
 *
 * The bar has three SECTIONS (left · centre · right), each holding dropdowns, each holding wizards. This panel
 * renders that tree (blocks/wizardLibrary.getLibrary, includeHidden + includeEmpty) and lets the user design it
 * without touching code: add / delete / rename a dropdown, move a dropdown between sections, and show/hide,
 * rename, re-group, re-order any wizard (built-ins included), import a shared `.wiz`, or reset to factory.
 * Every edit persists through the library layer (the bar layout in `ddcs_wizard_layout`, user ops in
 * `ddcs_user_ops`) and is pushed LIVE to the bar (ddcsRefreshWizardBar).
 *
 * Built like ioTable.renderIoTable: a `rerender()` closure rebuilds the tree in place after each mutation.
 *
 * t2196 — MOUNTED IN ITS OWN SMALL PANEL now, not a Settings sub-tab (the fifth "Wizard bar" sub-tab under Look
 * and feel is retired — bar layout still IS appearance, but a 400+-line tree buried the tab's own theme/setup-
 * health controls). `openWizardBarManager()` opens the SAME `renderWizardLibrary(container)` this file always
 * exported — ONE tree, ONE implementation, reached from a single "Wizard bar — Open" row in Appearance via the
 * SAME return-path stack (ui/navReturn.js) the Workspace tab's own manager doors use (t2192): closing this
 * panel returns to Settings, on Appearance, on every exit.
 */
import {
    getLibrary, setEntryOverride, setGroupOverride, resetLayout,
    importWizard,
    createGroup, deleteGroup, SECTIONS,
    entryHasOverride, clearEntryOverride,   // t1107 — per-wizard Restore to factory
} from '../blocks/wizardLibrary.js';
import { ICON_REGISTRY, entryIconHtml } from './wizIcons.js';
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)
import { renderLibraryShelf } from './libraryShelf.js';
import { hasLastValues, clearLastValues } from '../data/wizardLastValues.js';   // t1437 — the per-wizard "forget what I last used"
import { popReturn } from './navReturn.js';   // t2196 — the return path (Settings' Appearance tab → here → back)
// Authoring custom ops lives in Blocks → Dev mode (the one authoring path); this panel only DESIGNS the bar.
// t2196 — lifecycle (Edit / Export .wiz / Delete) moved to ui/wizardManager.js; this file no longer needs
// deleteWizard/exportWizard/writeLibraryFile/hasFSA/UIUtils, all orphaned by that move.

const SECTION_LABEL = { left: 'LEFT', center: 'CENTRE', right: 'RIGHT' };

// ── small DOM helpers ────────────────────────────────────────────────────────────────────────────────────────
function mkBtn(text, onClick, opts = {}) {
    const b = document.createElement('button');
    b.className = 'toolbar-btn';
    b.textContent = text;
    b.style.cssText = `padding:4px 10px; font-size:12px;${opts.danger ? ' color:var(--danger);' : ''}`;
    if (opts.title) b.title = opts.title;
    b.addEventListener('click', onClick);
    return b;
}
function mkArrow(glyph, disabled, onClick, title) {
    const b = document.createElement('button');
    b.className = 'toolbar-btn';
    b.textContent = glyph;
    b.title = title;
    b.disabled = !!disabled;
    b.style.cssText = 'padding:2px 7px; font-size:12px; align-self:center;';
    if (!disabled) b.addEventListener('click', onClick);
    return b;
}

// ── wizbar icon PICKER (Track A — docs/archive/RICH-WIDGETS-AND-ICONS.md) ───────────────────────────────────────────────
// A curated emoji set; the pick writes `iconOverride` (setEntryOverride id,{icon}); a custom op renders it via the
// existing emoji path in commandDeck (wizItemIcon → e.icon). "⌀ Default" clears the override (back to ✦). A picker,
// not an editor — drawing a custom icon graphic is the separate iconEditor (CAM builder).
const ICON_CHOICES = ['🔧', '🔩', '🪛', '🪚', '⚙', '🧲', '📐', '📏', '🎯', '⊕', '⌖', '🧭', '🕒', '🛡', '📋', '🧪', '💬', '🔥', '✎', '✦', '⭐', '🚩', '⚡', '🧰', '🔨', '🗜', '📦', '🕳', '🔲', '🪙', '🧮', '📌'];

function openIconPicker(anchor, current, onPick) {
    document.querySelector('.wizicon-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'wizicon-pop';
    pop.style.cssText = 'position:fixed; z-index:1300; background:var(--panel); color:var(--text-main); border:1px solid var(--border); border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.5); padding:8px; display:grid; grid-template-columns:repeat(8,30px); gap:4px;';
    const cell = (label, val, title, span, isHtml) => {
        const b = document.createElement('button');
        b.type = 'button'; b.title = title || '';
        if (isHtml) b.innerHTML = label; else b.textContent = label;
        b.style.cssText = `font-size:17px; line-height:1; height:30px; display:flex; align-items:center; justify-content:center; ${span ? `grid-column:span ${span}; font-size:12px;` : 'width:30px;'} border:1px solid ${String(val) === String(current) ? 'var(--accent)' : 'transparent'}; border-radius:6px; background:transparent; color:inherit; cursor:pointer;`;
        b.addEventListener('click', () => { pop.remove(); onPick(val); });
        return b;
    };
    pop.appendChild(cell('⌀ Default', null, 'Clear the icon (back to the default ✦)', 8));
    ICON_CHOICES.forEach((e) => pop.appendChild(cell(e, e, e)));
    // built-in line-art glyphs — `ic:<id>`, rendered as SVG; pick one to give any wizard a crisp vector icon
    Object.keys(ICON_REGISTRY).forEach((id) => pop.appendChild(cell(ICON_REGISTRY[id], 'ic:' + id, id + ' (line-art)', null, true)));
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.min(r.bottom + 4, window.innerHeight - pop.offsetHeight - 8) + 'px';
    const close = (ev) => { if (!pop.contains(ev.target) && ev.target !== anchor) { pop.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
}

// ── mutations (reassign contiguous order to avoid the implicit-index pitfall) ───────────────────────────────────
function moveItem(items, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((e) => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ids.forEach((id, k) => setEntryOverride(id, { order: k }));   // contiguous within the dropdown
}
function moveGroupInSection(sectionGroups, gi, dir) {
    const j = gi + dir;
    if (j < 0 || j >= sectionGroups.length) return;
    const ids = sectionGroups.map((g) => g.id);
    [ids[gi], ids[j]] = [ids[j], ids[gi]];
    ids.forEach((id, k) => setGroupOverride(id, { order: k }));   // contiguous within the section
}
function moveGroupToSection(group, section, lib) {
    if (section === group.section) return;
    const maxOrder = lib.groups.filter((g) => g.section === section && g.id !== group.id).reduce((m, g) => Math.max(m, g.order), -1);
    setGroupOverride(group.id, { section, order: maxOrder + 1 });   // append to the end of the target section
}
function regroup(entry, newGroup) {
    if (!newGroup || newGroup === entry.group) return;
    const target = getLibrary({ includeHidden: true, includeEmpty: true }).groups.find((g) => g.id === newGroup);
    const maxOrder = target ? target.items.reduce((m, e) => Math.max(m, e.order), -1) : -1;
    setEntryOverride(entry.id, { group: newGroup, order: maxOrder + 1 });   // append to the end of the target dropdown
}

let _importInput = null;
function importWizardFile(onDone) {
    if (!_importInput) {
        _importInput = document.createElement('input');
        _importInput.type = 'file';
        _importInput.accept = '.wiz,.json';
        _importInput.style.display = 'none';
        document.body.appendChild(_importInput);
    }
    const input = _importInput;
    input.onchange = () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        const r = new FileReader();
        r.onload = (e) => {
            try {
                const def = importWizard(e.target.result || '');
                if (!def) { dlgNotice('That isn’t a valid .wiz file.'); return; }
                // t1275 — SAY what did and did not come across. A wizard file carries data; the author's code hooks
                // do not travel, and a silent loss is the thing the ruling forbids.
                if (def.importNote) dlgNotice(`“${def.label || def.opType}” imported. ${def.importNote}`);
                onDone();
            } catch (err) { dlgNotice('Import failed: ' + (err && err.message || err)); }
        };
        r.readAsText(f);
    };
    input.click();
}

// ── the tree ────────────────────────────────────────────────────────────────────────────────────────────────────
export function renderWizardLibrary(container) {
    if (!container) return;
    const rerender = () => renderWizardLibrary(container);
    const apply = () => { rerender(); if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar(); };

    container.innerHTML = '';
    const lib = getLibrary({ includeHidden: true, includeEmpty: true });
    const allGroups = lib.groups;

    // header: intro + new dropdown + import + reset
    const head = document.createElement('div');
    head.className = 'settings-section';
    head.innerHTML = `<div class="settings-section-title">WIZARD LIBRARY — DESIGN THE BAR</div>
        <div class="settings-hint">The bar has three sections (left · centre · right), each holding dropdowns, each holding wizards.
        Add or delete a dropdown, move it between sections, and show/hide · rename · re-group · re-order any wizard (built-ins too).
        Fork a built-in into an editable copy, or import a shared <code>.wiz</code> from your library folder below. Changes apply to the bar instantly.</div>`;

    const nd = document.createElement('div');
    nd.className = 'settings-row'; nd.style.marginTop = '10px';
    const ndName = document.createElement('input');
    ndName.type = 'text'; ndName.placeholder = 'New dropdown name';
    ndName.style.cssText = 'flex:0 0 auto; width:170px; padding:5px 8px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:13px;';
    const ndSect = document.createElement('select');
    ndSect.style.cssText = 'flex:0 0 auto; padding:4px 6px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:12px;';
    SECTIONS.forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = SECTION_LABEL[s]; if (s === 'center') o.selected = true; ndSect.appendChild(o); });
    nd.append(ndName, ndSect, mkBtn('+ Add dropdown', () => {
        const nm = ndName.value.trim(); if (!nm) { ndName.focus(); return; }
        createGroup(nm, ndSect.value); ndName.value = ''; apply();
    }, { title: 'Create a new dropdown in the chosen section' }));
    head.appendChild(nd);

    const actions = document.createElement('div');
    actions.className = 'settings-row'; actions.style.marginTop = '8px';
    actions.appendChild(mkBtn('⬆ Import a file…', () => importWizardFile(apply), { title: 'Load a .wiz file from anywhere on disk (the shelf below is the folder you keep them in)' }));
    actions.appendChild(mkBtn('↺ Reset to factory', async () => {
        if (await dlgConfirm('Reset the whole bar layout (sections, dropdowns, names, visibility, order, icons) to factory defaults?\nYour custom .wiz operations are kept.', { danger: true, okLabel: 'Reset' })) { resetLayout(); apply(); }
    }, { title: 'Discard all bar customisation (keeps your custom operations)' }));
    head.appendChild(actions);
    container.appendChild(head);

    // t1247 — THE .wiz SHELF. The user ruled that the wizard library IS the wizard surface, so the shared-source shelf
    // lives here rather than in a separate importer screen: your ops and the ones you can import are one page.
    const shelf = document.createElement('div');
    shelf.className = 'settings-section';
    shelf.innerHTML = '<div class="settings-section-title">SHARED WIZARDS (.wiz) — YOUR LIBRARY FOLDER</div>'
        + '<div class="settings-hint">A <code>.wiz</code> is a wizard&rsquo;s SOURCE, not a baked copy: importing one installs it live on your bar, editable in Blocks like any operation you wrote. Export writes here too.</div>'
        + '<div id="wiz_library_shelf" style="margin-top:10px"></div>';
    container.appendChild(shelf);
    renderLibraryShelf(shelf.querySelector('#wiz_library_shelf'), {
        kindKey: 'wiz',
        describe: (e) => {
            const op = (e.obj && e.obj.op) || {};
            const n = ((op.bindings || []).length);
            return `${op.opType ? 'operation' : 'wizard'} · ${n} field${n === 1 ? '' : 's'}`;
        },
        emptyHint: 'Export one of your own operations above and it will appear here.',
        onImport: async (e) => {
            const def = importWizard(e.text);   // parse → createUserOp → registerUserOp: LIVE, exactly like a local op
            if (!def) { dlgNotice(`“${e.name}” is not a wizard file this version understands.`); return; }
            dlgNotice(`“${def.label || def.opType}” is on your bar now — open it, or edit it in Blocks like any operation you authored.${def.importNote ? ' ' + def.importNote : ''}`);
            apply();
        },
    });

    // one block per SECTION → its dropdowns → their wizards
    for (const section of SECTIONS) {
        const groups = allGroups.filter((g) => g.section === section);

        const secEl = document.createElement('div');
        secEl.className = 'settings-section';
        const secHdr = document.createElement('div');
        secHdr.className = 'settings-section-title';
        secHdr.textContent = `${SECTION_LABEL[section]} SECTION`;
        secHdr.style.cssText = 'color:var(--accent); margin-bottom:6px;';
        secEl.appendChild(secHdr);

        if (!groups.length) {
            const hint = document.createElement('div');
            hint.className = 'settings-hint';
            hint.textContent = 'No dropdowns here — add one above, or move a dropdown into this section.';
            hint.style.cssText += '; opacity:.6; padding:2px 0 2px 12px;';
            secEl.appendChild(hint);
        }

        groups.forEach((group, gi) => {
            const grpEl = document.createElement('div');
            grpEl.dataset.group = group.id;
            grpEl.style.cssText = 'margin:6px 0 8px 12px; border-left:2px solid var(--border); padding-left:10px;';

            const gh = document.createElement('div');
            gh.style.cssText = 'display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:4px;';
            const gName = document.createElement('input');
            gName.type = 'text'; gName.value = group.label; gName.title = 'Rename this dropdown';
            gName.style.cssText = 'flex:0 0 auto; width:150px; font-size:12px; font-weight:700; letter-spacing:0.4px; color:var(--text-main); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:4px 7px;';
            gName.addEventListener('change', () => { setGroupOverride(group.id, { label: gName.value.trim() || group.id }); apply(); });
            gh.appendChild(gName);

            const gSect = document.createElement('select');
            gSect.title = 'Move this dropdown to a section';
            gSect.style.cssText = 'flex:0 0 auto; padding:4px 6px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:11px;';
            SECTIONS.forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = SECTION_LABEL[s]; if (s === group.section) o.selected = true; gSect.appendChild(o); });
            gSect.addEventListener('change', () => { moveGroupToSection(group, gSect.value, lib); apply(); });
            gh.appendChild(gSect);

            gh.appendChild(mkArrow('▲', gi === 0, () => { moveGroupInSection(groups, gi, -1); apply(); }, 'Move dropdown up'));
            gh.appendChild(mkArrow('▼', gi === groups.length - 1, () => { moveGroupInSection(groups, gi, +1); apply(); }, 'Move dropdown down'));
            if (group.custom) {
                gh.appendChild(mkBtn('🗑 Delete', async () => {
                    if (await dlgConfirm(`Delete the “${group.label}” dropdown? Its wizards return to their default dropdowns.`, { danger: true, okLabel: 'Delete' })) { deleteGroup(group.id); apply(); }
                }, { danger: true, title: 'Delete this dropdown (its wizards revert to their defaults)' }));
            }
            grpEl.appendChild(gh);

            if (!group.items.length) {
                const e = document.createElement('div'); e.className = 'settings-hint';
                e.textContent = 'empty — move a wizard here via its dropdown selector';
                e.style.cssText += '; opacity:.55; padding:1px 0 3px;';
                grpEl.appendChild(e);
            }
            group.items.forEach((entry, ei) => grpEl.appendChild(renderRow(entry, group, ei, allGroups, apply)));

            secEl.appendChild(grpEl);
        });

        container.appendChild(secEl);
    }
}

function renderRow(entry, group, ei, allGroups, apply) {
    const items = group.items;
    const row = document.createElement('div');
    row.dataset.entry = entry.id;
    row.style.cssText = 'display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:6px 8px; margin:5px 0; border:1px solid var(--border); border-radius:7px; background:var(--panel);';

    // visibility
    const vis = document.createElement('label');
    vis.className = 'ddcs-switch';
    vis.title = entry.visible ? 'Visible in the bar — click to hide' : 'Hidden — click to show';
    vis.innerHTML = '<input type="checkbox"><span class="ddcs-slider"></span>';
    const cb = vis.querySelector('input');
    cb.checked = entry.visible;
    cb.addEventListener('change', () => { setEntryOverride(entry.id, { visible: cb.checked }); apply(); });
    row.appendChild(vis);

    // rename
    const name = document.createElement('input');
    name.type = 'text'; name.value = entry.label; name.title = 'Rename (the name shown in the bar)';
    name.style.cssText = 'flex:1 1 130px; min-width:110px; padding:5px 8px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:13px;';
    if (!entry.visible) name.style.opacity = '0.5';
    name.addEventListener('change', () => { const v = name.value.trim(); if (v) { setEntryOverride(entry.id, { label: v }); apply(); } else { name.value = entry.label; } });
    row.appendChild(name);

    // kind badge
    const badge = document.createElement('span');
    badge.textContent = entry.kind === 'user' ? 'CUSTOM' : 'BUILT-IN';
    badge.style.cssText = `flex:0 0 auto; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; color:#fff; background:${entry.kind === 'user' ? '#3a6b7b' : '#6b7b3a'};`;
    row.appendChild(badge);

    // regroup — every dropdown across all sections, by label, grouped by section
    const grp = document.createElement('select');
    grp.title = 'Move to another dropdown';
    grp.style.cssText = 'flex:0 0 auto; max-width:130px; padding:4px 6px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:12px;';
    for (const section of SECTIONS) {
        const inSec = allGroups.filter((g) => g.section === section);
        if (!inSec.length) continue;
        const og = document.createElement('optgroup'); og.label = SECTION_LABEL[section];
        for (const g of inSec) {
            const o = document.createElement('option'); o.value = g.id; o.textContent = g.label;
            if (g.id === entry.group) o.selected = true;
            og.appendChild(o);
        }
        grp.appendChild(og);
    }
    grp.addEventListener('change', () => { regroup(entry, grp.value); apply(); });
    row.appendChild(grp);

    // reorder within dropdown
    row.appendChild(mkArrow('▲', ei === 0, () => { moveItem(items, ei, -1); apply(); }, 'Move up'));
    row.appendChild(mkArrow('▼', ei === items.length - 1, () => { moveItem(items, ei, +1); apply(); }, 'Move down'));

    // icon — EVERY wizard (built-in + custom) can be re-iconed (an emoji or an ic:<id> line-art); the override wins on the bar.
    const iconBtn = mkBtn('', () => {
        openIconPicker(iconBtn, entry.iconOverride || '', (val) => { setEntryOverride(entry.id, { icon: val }); apply(); });
    }, { title: 'Choose this wizard’s bar icon' });
    iconBtn.innerHTML = entryIconHtml(entry) || '✦';
    iconBtn.classList.add('wizicon-btn');
    iconBtn.style.cssText += ' font-size:15px; min-width:32px; padding:4px 6px;';
    row.appendChild(iconBtn);
    /**
     * ── t1437 — PER-WIZARD "RESET VALUES" (the ruled reset) ───────────────────────────────────────────────────────
     *
     * Forgets what THIS wizard was last inserted with, so its form opens on the shipped defaults again. Shown ONLY
     * when a record exists — the same rule the Restore-default button beside it follows, and the same reason: a
     * button with nothing to do is a button that teaches the user nothing.
     *
     * IT IS A SEPARATE BUTTON, NOT A CLAUSE ADDED TO "↺ Restore default", and the two reasons are worth stating.
     * (a) That button reverts a wizard's NAME / ORDER / ICON and its factory twin — bar customisation. Remembered
     *     values are an unrelated concern, and folding them in would mean putting your icon back also throws away
     *     your feeds and speeds, which nothing on the button says.
     * (b) It only exists on BUILT-INS (the `else` arm below). Custom ops remember their values too, so a clause
     *     there would have left half the wizards with no way to forget.
     *
     * THE PRESET ROW IS UNTOUCHED, deliberately: a preset is a NAMED thing the user saved and can pick again; this
     * is the unnamed fallback the form opens on. They ride separate backup rows for the same reason.
     *
     * ⚠ A WIZARD CAN OWN TWO KEYS, and this was measured rather than assumed. Most built-ins here declare an
     * `opensAs` TWIN (Pocket's bar entry opens `user_pocket_data`, not `pocket`), so the bar gesture records under
     * the TWIN's type — while `openWiz('pocket')` still reaches the built-in view and records under its own. They
     * are ONE wizard to the operator, so the row offers one button that answers for both: shown when EITHER has a
     * record, and it forgets both. Keying on `opensAs` alone would leave a stale record with no way to reach it.
     */
    const valuesTypes = [entry.type, entry.opensAs].filter(Boolean);
    if (valuesTypes.some(hasLastValues)) {
        row.appendChild(mkBtn('↺ Reset values', async () => {
            if (await dlgConfirm(`Forget the values “${entry.label}” was last used with?\nIts form will open on the shipped defaults again. Your saved presets for it are kept.`, { okLabel: 'Reset values' })) {
                valuesTypes.forEach(clearLastValues);
                apply();
            }
        }, { title: 'Forget this wizard’s last-used values — its form opens on the shipped defaults again (saved presets are kept)' }));
    }
    // t2196 — Edit / Export .wiz / Delete are LIFECYCLE, not bar arrangement, and moved OUT: they are
    // ui/wizardManager.js's own job (t1617's own header already said so — the boundary was declared, then
    // leaked here). This panel keeps only what actually arranges the bar: on/off, rename, group, order, icon,
    // reset values. Reach the manager for anything else — this row's visibility toggle and rename above still
    // work on a custom op exactly as they do on a built-in.
    if (entry.kind !== 'user') {
        // t1107 — a per-BUILT-IN "Restore default": shown ONLY when THIS built-in is actually customized — a layout override
        // (rename/reorder/regroup/re-icon/hide) OR a diverged opensAs twin (its form/pendant param blocks were edited). Reverts
        // JUST this one to factory (its layout override + its factory twin), leaving every other wizard + custom op untouched.
        // Distinct from the blanket ↺ Reset to factory (whole-bar). A pristine built-in shows nothing.
        const twinDiverged = !!(entry.opensAs && window.ddcsUserOpDivergedFromFactory && window.ddcsUserOpDivergedFromFactory(entry.opensAs));
        if (entryHasOverride(entry.id) || twinDiverged) {
            row.appendChild(mkBtn('↺ Restore default', async () => {
                if (await dlgConfirm(`Restore “${entry.label}” to its factory default?\nThis reverts its name / order / icon and its edited form + pendant fields for this one wizard. Other wizards and your custom ops are untouched.`, { danger: true, okLabel: 'Restore' })) {
                    clearEntryOverride(entry.id);                                             // (a) its layout override
                    if (entry.opensAs && window.ddcsReseedUserOp) window.ddcsReseedUserOp(entry.opensAs);   // (b) its factory twin, immediately
                    apply();                                                                  // (c) re-render manager + bar
                }
            }, { danger: true, title: 'Revert this one built-in wizard to factory (layout + twin); leaves others untouched' }));
        }
    }
    return row;
}

// ── THE PANEL (t2196) ───────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the wizard-bar tree in its own small panel. `opts.returnToken` — a token from ui/navReturn.js's
 *  pushReturn(); when given, closing this panel (✕ / Esc / backdrop — all one `close()`) pops it and reopens
 *  whoever pushed it (Settings' Appearance tab). Uses the shared, previously-zero-consumer modal base
 *  (.modal-scrim/.modal-card/.modal-head/.modal-body, styles.css's own P5a declaration) rather than a new
 *  bespoke shell — the SAME question BACKLOG 16 asks of every other modal in the app, answered here for free. */
export function openWizardBarManager(opts = {}) {
    if (_ov) { _ov.remove(); _ov = null; }
    const returnToken = opts.returnToken;
    const ov = document.createElement('div');
    ov.id = 'wizbarOverlay';
    ov.className = 'modal-scrim';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal-card">
        <div class="modal-head"><span>Wizard bar</span><button type="button" class="wizbar-x" aria-label="Close">✕</button></div>
        <div class="modal-body"><div id="wizbarTree"></div></div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const close = () => {
        ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true);
        if (returnToken != null) popReturn(returnToken);
    };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.app-dialog')) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wizbar-x').addEventListener('click', close);
    renderWizardLibrary(ov.querySelector('#wizbarTree'));
    return ov;
}

if (typeof window !== 'undefined') {
    window.openWizardBarManager = openWizardBarManager;
}
