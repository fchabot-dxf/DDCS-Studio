/**
 * blocks/blockly/stackBridge.js — convert a Blockly workspace ⇄ our {type,params,children} block stack.
 *
 * The bridge that lets Blockly be the EDITOR while our proven engine stays the truth: the workspace is read
 * into a stack and run through emitMapped (one emit path, shared with the STUDIO wizards); and a STUDIO op's
 * stack is written into the workspace for "open as blocks". block.type === op type, so it's a 1:1 walk.
 */
import { BLOCKS } from '../../wizards/ops/index.js';
import { FN, fieldKind, fieldsOf, isWrap, getBlockly, OP_BLOCKS } from './bridge.js';

const HAS_CUSTOM_OP = {};
OP_BLOCKS.forEach(b => HAS_CUSTOM_OP[b.type] = true);

// ── workspace → stack ────────────────────────────────────────────────────────
/** One block (NOT its next sibling) → a record { id, type, params, children? }. */
/** t1317 — is this value ABSENT (no value at all), as opposed to an explicit zero? */
const isAbsent = (v) => v === undefined || v === null || v === '';
/** …and does this atom DECLARE that this field may be absent? (wizards/ops/*.js `absentable`) */
const absentable = (def, f) => !!(def && Array.isArray(def.absentable) && def.absentable.includes(f));

function toRecord(b) {
    if (b.type === 'op' || b.type.endsWith('_op')) {         // op CONTAINER — opType/requires/params ride in `data`
        let meta = {};
        try { meta = JSON.parse(b.data || '{}'); } catch (_) { /* keep {} */ }
        const params = { ...(meta.params || {}) };
        
        if (b.type === 'corner_op') {
            params.corner = b.getFieldValue('CORNER') || 'FL';
            params.probeSeq = b.getFieldValue('PROBESEQ') || 'YX';
            params.wcs = b.getFieldValue('WCS') || 'active';
            params.probeZ = b.getFieldValue('PROBEZ') === 'TRUE';
            params.syncA = b.getFieldValue('SYNCA') === 'TRUE';
            params.slave = b.getFieldValue('SLAVE') || '3';
            params.qStop = b.getFieldValue('QSTOP') === 'TRUE';
        } else if (b.type === 'edge_op') {
            params.axis = b.getFieldValue('AXIS') || 'X';
            params.dir = b.getFieldValue('AXISDIR') || 'pos';
            params.wcs = b.getFieldValue('WCS') || 'active';
            params.syncA = b.getFieldValue('SYNCA') === 'TRUE';
            params.slave = b.getFieldValue('SLAVE') || '3';
            params.qStop = b.getFieldValue('QSTOP') === 'TRUE';
        } else if (b.type === 'middle_op') {
            params.featureType = b.getFieldValue('FEATURETYPE') || 'pocket';
            params.axis = b.getFieldValue('AXIS') || 'X';
            params.dir1 = b.getFieldValue('DIR1') || 'pos';
            params.twoAxis = b.getFieldValue('TWOAXIS') === 'TRUE';
            params.dir2 = b.getFieldValue('DIR2') || 'pos';
            params.wcs = b.getFieldValue('WCS') || 'active';
            params.probeZ = b.getFieldValue('PROBEZ') === 'TRUE';
            params.syncA = b.getFieldValue('SYNCA') === 'TRUE';
            params.slave = b.getFieldValue('SLAVE') || '3';
            params.qStop = b.getFieldValue('QSTOP') === 'TRUE';
        } else if (b.type === 'circular_op') {
            params.featureType = b.getFieldValue('FEATURETYPE') || 'bore';
            params.wcs = b.getFieldValue('WCS') || 'active';
            params.qStop = b.getFieldValue('QSTOP') === 'TRUE';
        } else if (b.type === 'atc_change_op') {
            params.mode = b.getFieldValue('MODE') || 'auto';
            params.waitSpindle = b.getFieldValue('WAITSPINDLE') === 'TRUE';
            params.dustCover = b.getFieldValue('DUSTCOVER') === 'TRUE';
            params.confirm = b.getFieldValue('CONFIRM') === 'TRUE';
        } else if (b.type === 'atc_test_op') {
            params.mode = b.getFieldValue('MODE') || 'current';
            params.waitSpindle = b.getFieldValue('WAITSPINDLE') === 'TRUE';
            params.dustCover = b.getFieldValue('DUSTCOVER') === 'TRUE';
        } else if (b.type === 'atc_check_op') {
            params.waitSpindle = b.getFieldValue('WAITSPINDLE') === 'TRUE';
            params.dustCover = b.getFieldValue('DUSTCOVER') === 'TRUE';
        } else if (b.type === 'wcs_op') {
            params.sys = b.getFieldValue('SYS') || '0';
            params.axisX = b.getFieldValue('AXISX') === 'TRUE';
            params.axisY = b.getFieldValue('AXISY') === 'TRUE';
            params.axisZ = b.getFieldValue('AXISZ') === 'TRUE';
            params.sync = b.getFieldValue('SYNC') === 'TRUE';
            params.slave = b.getFieldValue('SLAVE') || 'A';
        } else if (b.type === 'comm_op') {
            params.type = b.getFieldValue('TYPE') || 'popup';
            if (params.type === 'popup') params.popupMode = b.getFieldValue('MODE');
            if (params.type === 'status') {
                params.statusMode = b.getFieldValue('MODE');
                params.statusColor = b.getFieldValue('COLOR');
            }
        }

        const gcodeInput = b.getInput('GCODE'), doInput = b.getInput('DO');
        const firstGcode = (gcodeInput && gcodeInput.connection && gcodeInput.connection.targetBlock()) || 
                           (doInput && doInput.connection && doInput.connection.targetBlock());
        const simInput = b.getInput('SIM');
        const firstSim = simInput && simInput.connection && simInput.connection.targetBlock();
        return {
            id: b.id, type: 'op', opType: meta.opType, label: b.getFieldValue('LABEL') || meta.label,
            requires: meta.requires || [], params: params, children: firstGcode ? chain(firstGcode) : [],
            simChildren: firstSim ? chain(firstSim) : [],
            collapsed: b.isCollapsed() || undefined,
        };
    }
    const def = BLOCKS[b.type];
    if (!def) return { id: b.id, type: b.type, params: {} };
    const r = { id: b.id, type: b.type, params: {} };
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f), name = FN(f);
        if (k === 'value' || k === 'region' || k === 'boolean') {           // input_value socket
            const inp = b.getInput(name), tgt = inp && inp.connection && inp.connection.targetBlock();
            if (tgt && tgt.isShadow()) r.params[f] = Number(tgt.getFieldValue('NUM'));   // shadow number
            else if (tgt) r.params[f] = toRecord(tgt);                       // a plugged reporter → nested record
            // t1317 — an EMPTY socket on an absentable field is ABSENCE, not the default: the record carries no value
            // and the emit writes no word, which is what the op said in the first place.
            else if (absentable(def, f)) { /* leave params[f] undefined */ }
            else r.params[f] = def.defaults[f];                             // empty socket → the op default
        } else if (k === 'checkbox') r.params[f] = b.getFieldValue(name) === 'TRUE';
        else r.params[f] = b.getFieldValue(name);                           // dropdown / text field
    }
    // Non-field params (snapshots like PlaceOnStock's stock dims + bbox) ride in `data` — restore them WITHOUT
    // clobbering live field values, so editing the block keeps the context emit needs.
    if (b.data) { try { const d = JSON.parse(b.data); if (d._expose) r._expose = d._expose; for (const k in d) if (k !== '_expose' && !(k in r.params)) r.params[k] = d[k]; } catch (_) { /* keep fields */ } }
    if (def.kind === 'user_root') {
        const pInp = b.getInput('PRESENTATION'), pBlk = pInp && pInp.connection && pInp.connection.targetBlock();
        const eInp = b.getInput('EXECUTION'), eBlk = eInp && eInp.connection && eInp.connection.targetBlock();
        r.uiChildren = pBlk ? chain(pBlk) : [];
        r.children = eBlk ? chain(eBlk) : [];
    } else if (def.kind === 'param_group' || def.kind === 'section' || def.kind === 'opunit' || def.kind === 'cam_table') {   // t130 — section round-trips its DO mouth → children, like param_group; t1069 — opunit too; t1093 — cam_table (its cam_field rows)
        const doInput = b.getInput('DO'), first = doInput && doInput.connection && doInput.connection.targetBlock();
        if (first) r.children = chain(first);
    } else if (isWrap(def)) {
        const doInput = b.getInput('DO'), first = doInput && doInput.connection && doInput.connection.targetBlock();
        if (first) r.children = chain(first);
    }
    if (b.isCollapsed && b.isCollapsed()) r.collapsed = true;
    return r;
}

/** A block + the statement chain below it (next-connected siblings) → an array of records. */
function chain(block) {
    const out = [];
    for (let b = block; b; b = b.getNextBlock()) out.push(toRecord(b));
    return out;
}

/** Workspace → the program stack (top-level statement blocks, in order; floating reporters ignored). */
export function workspaceToStack(ws) {
    const tops = ws.getTopBlocks(true).filter((b) => { const d = BLOCKS[b.type]; return !d || d.kind !== 'reporter'; });
    return tops.flatMap((t) => chain(t));
}

// ── stack → workspace ────────────────────────────────────────────────────────
// We load via Blockly's serialization API rather than newBlock()+initSvg()+render(). In Blockly v11 the
// latter creates valid block MODELS but never drives the render queue, so the blocks exist (G-code emits)
// yet are never drawn or positioned — the "code is there but I can't see the blocks" bug. serialization.load
// flushes the render queue correctly. So: stack → Blockly JSON state → load.

/** One record → a Blockly serialization-JSON block node (fields + value/region sockets + DO children). */
function recToJson(rec) {
    if (rec.type === 'op') {
        const type = HAS_CUSTOM_OP[rec.opType + '_op'] ? (rec.opType + '_op') : 'op';
        const node = {
            type: type, id: rec.id,
            fields: { LABEL: rec.label || rec.opType || 'op' },
            data: JSON.stringify({ opType: rec.opType, params: rec.params || {} })
        };

        if (type === 'corner_op') {
            node.fields.CORNER = rec.params.corner || 'FL';
            node.fields.PROBESEQ = rec.params.probeSeq || 'YX';
            node.fields.WCS = rec.params.wcs || 'active';
            node.fields.PROBEZ = rec.params.probeZ ? 'TRUE' : 'FALSE';
            node.fields.SYNCA = rec.params.syncA ? 'TRUE' : 'FALSE';
            node.fields.SLAVE = rec.params.slave || '3';
            node.fields.QSTOP = rec.params.qStop ? 'TRUE' : 'FALSE';
        } else if (type === 'edge_op') {
            node.fields.AXIS = rec.params.axis || 'X';
            node.fields.AXISDIR = rec.params.dir || 'pos';
            node.fields.WCS = rec.params.wcs || 'active';
            node.fields.SYNCA = rec.params.syncA ? 'TRUE' : 'FALSE';
            node.fields.SLAVE = rec.params.slave || '3';
            node.fields.QSTOP = rec.params.qStop ? 'TRUE' : 'FALSE';
        } else if (type === 'middle_op') {
            node.fields.FEATURETYPE = rec.params.featureType || 'pocket';
            node.fields.AXIS = rec.params.axis || 'X';
            node.fields.DIR1 = rec.params.dir1 || 'pos';
            node.fields.TWOAXIS = rec.params.twoAxis ? 'TRUE' : 'FALSE';
            node.fields.DIR2 = rec.params.dir2 || 'pos';
            node.fields.WCS = rec.params.wcs || 'active';
            node.fields.PROBEZ = rec.params.probeZ ? 'TRUE' : 'FALSE';
            node.fields.SYNCA = rec.params.syncA ? 'TRUE' : 'FALSE';
            node.fields.SLAVE = rec.params.slave || '3';
            node.fields.QSTOP = rec.params.qStop ? 'TRUE' : 'FALSE';
        } else if (type === 'circular_op') {
            node.fields.FEATURETYPE = rec.params.featureType || 'bore';
            node.fields.WCS = rec.params.wcs || 'active';
            node.fields.QSTOP = rec.params.qStop ? 'TRUE' : 'FALSE';
        } else if (type === 'atc_change_op') {
            node.fields.MODE = rec.params.mode || 'auto';
            node.fields.WAITSPINDLE = (rec.params.waitSpindle !== false) ? 'TRUE' : 'FALSE';
            node.fields.DUSTCOVER = rec.params.dustCover ? 'TRUE' : 'FALSE';
            node.fields.CONFIRM = rec.params.confirm ? 'TRUE' : 'FALSE';
        } else if (type === 'atc_test_op') {
            node.fields.MODE = rec.params.mode || 'current';
            node.fields.WAITSPINDLE = (rec.params.waitSpindle !== false) ? 'TRUE' : 'FALSE';
            node.fields.DUSTCOVER = rec.params.dustCover ? 'TRUE' : 'FALSE';
        } else if (type === 'atc_check_op') {
            node.fields.WAITSPINDLE = (rec.params.waitSpindle !== false) ? 'TRUE' : 'FALSE';
            node.fields.DUSTCOVER = rec.params.dustCover ? 'TRUE' : 'FALSE';
        } else if (type === 'wcs_op') {
            node.fields.SYS = rec.params.sys || '0';
            node.fields.AXISX = (rec.params.axisX !== false) ? 'TRUE' : 'FALSE';
            node.fields.AXISY = (rec.params.axisY !== false) ? 'TRUE' : 'FALSE';
            node.fields.AXISZ = (rec.params.axisZ !== false) ? 'TRUE' : 'FALSE';
            node.fields.SYNC = rec.params.sync ? 'TRUE' : 'FALSE';
            node.fields.SLAVE = rec.params.slave || 'A';
        } else if (type === 'comm_op') {
            node.fields.TYPE = rec.params.type || 'popup';
            node.fields.MODE = (rec.params.type === 'status') ? (rec.params.statusMode || 1) : (rec.params.popupMode || 1);
            node.fields.COLOR = rec.params.statusColor || -1;
        }

        const inputs = {};
        if (rec.children && rec.children.length) inputs.GCODE = { block: chainToJson(rec.children) };
        if (rec.simChildren && rec.simChildren.length) inputs.SIM = { block: chainToJson(rec.simChildren) };
        if (Object.keys(inputs).length) node.inputs = inputs;
        if (rec.collapsed) node.collapsed = true;
        return node;
    }
    // Preserve the model id (op blocks already do, above) so the loaded workspace block keeps the SAME id the emit
    // map + projected-code panel use — otherwise leaf atoms get fresh Blockly ids on load and the panel's per-line
    // ancestry doesn't match the workspace until a reproject realigns it (breaks click-selection + hover highlight).
    const def = BLOCKS[rec.type], node = { type: rec.type, id: rec.id };
    if (!def) return node;
    const fields = {}, inputs = {};
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f), name = FN(f), v = rec.params[f];
        if (k === 'value' || k === 'region' || k === 'boolean') {
            if (v && typeof v === 'object' && v.type) inputs[name] = { block: recToJson(v) };   // nested reporter
            // a #var / [expr] string in a numeric socket → a Variable reporter pill (a math_number shadow would
            // collapse `#18` to Number()||0 = 0, silently losing the ref); a plain number → the shadow.
            else if (k === 'value' && typeof v === 'string' && /[#[]/.test(v)) inputs[name] = { block: { type: 'variable', fields: { NAME: v } } };
            // t1317 — AN ABSENT ABSENTABLE FIELD GETS NO SOCKET CONTENT AT ALL. A shadow here would make the canvas
            // say zero where the program said nothing, and hand back a word the op never wrote. An explicit 0 still
            // gets its shadow below, because zero and absence are different facts and each must round-trip as itself.
            else if (k === 'value' && isAbsent(v) && absentable(def, f)) { /* leave the socket EMPTY */ }
            else if (k === 'value') inputs[name] = { shadow: { type: 'math_number', fields: { NUM: Number(v) || 0 } } };
            // empty region/boolean socket → leave unset
        // t1319 — AN ABSENT CHOICE TAKES THE ATOM'S DEFAULT, and only a choice. A checkbox or a dropdown has no "no
        // value" state: the emit reads them as a boolean or a string, so writing false / '' onto the canvas is not
        // an omission, it is a DIFFERENT INSTRUCTION — which is how a program came back from Blocks with its
        // `progend` tail switched off and the spindle left running.
        //
        // Numeric sockets deliberately keep today's behaviour: for several atoms the EMIT'S OWN FALLBACK differs
        // from the declared default (progstart's rpm falls back to 0 = no spindle line, while its default is 12000),
        // so applying the default there would ADD lines the program never had. Where a number's absence is meaningful
        // the atom declares it `absentable` (t1317) and the socket stays empty.
        } else if (k === 'checkbox') fields[name] = !!(isAbsent(v) ? def.defaults[f] : v);
        // t1520 — …AND A TEXT FIELD'S EMPTY STRING IS A VALUE, not an omission. `isAbsent` folds '' in with undefined,
        // which is right for a dropdown (it has no empty state, so '' can only mean "nothing was said") but wrong for a
        // free-text field, where '' is representable and MEANT: comm declares an empty operator message, and the canvas
        // was handing back the `message` atom's own default — the program came home saying "check setup" where the op
        // had deliberately said nothing. Only a genuinely missing value (undefined/null) takes the default here.
        else if (k === 'text') fields[name] = String((v === undefined || v === null ? def.defaults[f] : v) ?? '');
        else fields[name] = String((isAbsent(v) ? def.defaults[f] : v) ?? '');
    }
    // Non-field params (snapshots like PlaceOnStock's stock dims + bbox) → `data`, so they survive a block edit.
    const fset = new Set(fieldsOf(def)), extra = {};
    for (const k in (rec.params || {})) { const v = rec.params[k]; if (!fset.has(k) && v !== undefined && (v === null || typeof v !== 'object')) extra[k] = v; }
    // The authoring EXPOSE/PNAME/WIDGET state rides `data._expose` (NOT params — it's dev-only, never emitted), so a
    // ticked knob survives a round-trip → the live form persists across a reprojection (#13). devMode reads it in augment.
    if (rec._expose) extra._expose = rec._expose;
    if (Object.keys(extra).length) node.data = JSON.stringify(extra);
    if (def.kind === 'user_root') {
        if (rec.uiChildren && rec.uiChildren.length) inputs.PRESENTATION = { block: chainToJson(rec.uiChildren) };
        if (rec.children && rec.children.length) inputs.EXECUTION = { block: chainToJson(rec.children) };
    } else if (def.kind === 'param_group' || def.kind === 'section' || def.kind === 'opunit' || def.kind === 'cam_table') {   // t130 — section writes its children into the DO mouth; t1069 — opunit too; t1093 — cam_table (its cam_field rows)
        if (rec.children && rec.children.length) inputs.DO = { block: chainToJson(rec.children) };
    } else if (isWrap(def) && rec.children && rec.children.length) inputs.DO = { block: chainToJson(rec.children) };
    if (Object.keys(fields).length) node.fields = fields;
    if (Object.keys(inputs).length) node.inputs = inputs;
    if (rec.collapsed) node.collapsed = true;
    return node;
}

/** A list of records → the first node, with `next` linking the statement chain (siblings). */
function chainToJson(records) {
    let head = null, tail = null;
    for (const c of (records || [])) {
        const j = recToJson(c);
        if (head) tail.next = { block: j }; else head = j;
        tail = j;
    }
    return head;
}

// Merge each atom's DEFAULTS under its params (recursively), so a curated stack that omits a value field gets the
// atom's sensible default — exactly like buildToolbox's per-block flyout shadows (def.defaults), NOT recToJson's
// bare Number(v)||0 = 0 (which would turn an absent feed into F0). Op records carry their own params, untouched.
function recWithDefaults(rec) {
    if (!rec || rec.type === 'op') return rec;
    const def = BLOCKS[rec.type];
    // t1317 — …EXCEPT the absentable ones. Filling those is what gave a palette entry phantom axis words: the flyout
    // block for `G0 X#120` would arrive carrying Y0 Z0 because the merge helpfully supplied them.
    const base = {};
    if (def) for (const k in def.defaults) if (!absentable(def, k)) base[k] = def.defaults[k];
    const out = { ...rec, params: def ? { ...base, ...(rec.params || {}) } : (rec.params || {}) };
    if (rec.children) out.children = rec.children.map(recWithDefaults);
    return out;
}

/** A curated stack → a single draggable FLYOUT block (head + next-chain, shadows on its value sockets) so a whole
 *  pattern drags in as one unit. Used by the learner-library toolbox groups (Snippets / Complete Programs). */
export function stackToFlyoutBlock(stack) {
    const head = chainToJson((stack || []).map(recWithDefaults));
    return head ? { kind: 'block', ...head } : null;
}

/** Render a program stack into the workspace as one connected column (replaces its contents). */
export function stackToWorkspace(stack, ws) {
    const B = getBlockly();
    const head = chainToJson(stack || []);
    if (!head) { ws.clear(); return; }
    head.x = 24; head.y = 24;
    B.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [head] } }, ws);   // clears + renders
}
