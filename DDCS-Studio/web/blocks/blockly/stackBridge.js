/**
 * blocks/blockly/stackBridge.js — convert a Blockly workspace ⇄ our {type,params,children} block stack.
 *
 * The bridge that lets Blockly be the EDITOR while our proven engine stays the truth: the workspace is read
 * into a stack and run through emitMapped (one emit path, shared with the STUDIO wizards); and a STUDIO op's
 * stack is written into the workspace for "open as blocks". block.type === op type, so it's a 1:1 walk.
 */
import { BLOCKS } from '../../wizards/ops/index.js';
import { FN, fieldKind, fieldsOf, isWrap } from './bridge.js';

// ── workspace → stack ────────────────────────────────────────────────────────
/** One block (NOT its next sibling) → a record { id, type, params, children? }. */
function toRecord(b) {
    const def = BLOCKS[b.type];
    if (!def) return { id: b.id, type: b.type, params: {} };
    const r = { id: b.id, type: b.type, params: {} };
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f), name = FN(f);
        if (k === 'value' || k === 'region' || k === 'boolean') {           // input_value socket
            const inp = b.getInput(name), tgt = inp && inp.connection && inp.connection.targetBlock();
            if (tgt && tgt.isShadow()) r.params[f] = Number(tgt.getFieldValue('NUM'));   // shadow number
            else if (tgt) r.params[f] = toRecord(tgt);                       // a plugged reporter → nested record
            else r.params[f] = def.defaults[f];                             // empty socket → the op default
        } else if (k === 'checkbox') r.params[f] = b.getFieldValue(name) === 'TRUE';
        else r.params[f] = b.getFieldValue(name);                           // dropdown / text field
    }
    if (isWrap(def)) {
        const doInput = b.getInput('DO'), first = doInput && doInput.connection && doInput.connection.targetBlock();
        r.children = first ? chain(first) : [];
    }
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
/** Build one Blockly block from a record (fields + value sockets + DO children); returns the block. */
function build(ws, rec) {
    const def = BLOCKS[rec.type], b = ws.newBlock(rec.type);
    if (def) {
        for (const f of fieldsOf(def)) {
            const k = fieldKind(def, f), name = FN(f), v = rec.params[f];
            if (k === 'value' || k === 'region' || k === 'boolean') {
                const inp = b.getInput(name);
                if (v && typeof v === 'object' && v.type) {                  // a nested reporter record
                    const child = build(ws, v); inp.connection.connect(child.outputConnection);
                } else if (k === 'value') {                                  // a number → math_number shadow
                    const sh = ws.newBlock('math_number'); sh.setFieldValue(String(Number(v) || 0), 'NUM');
                    sh.setShadow(true); if (sh.initSvg) sh.initSvg();
                    inp.connection.connect(sh.outputConnection);
                }
            } else if (k === 'checkbox') b.setFieldValue(v ? 'TRUE' : 'FALSE', name);
            else b.setFieldValue(String(v ?? ''), name);
        }
        if (isWrap(def) && rec.children && rec.children.length) {
            const doInput = b.getInput('DO');
            let prev = null;
            for (const c of rec.children) {
                const cb = build(ws, c);
                if (prev) prev.nextConnection.connect(cb.previousConnection);
                else doInput.connection.connect(cb.previousConnection);
                prev = cb;
            }
        }
    }
    if (b.initSvg) b.initSvg();
    return b;
}

/** Render a program stack into the workspace as one connected column (replaces its contents). */
export function stackToWorkspace(stack, ws) {
    ws.clear();
    let prev = null;
    (stack || []).forEach((rec) => {
        const b = build(ws, rec);
        if (prev) prev.nextConnection.connect(b.previousConnection);
        else b.moveBy(24, 24);
        prev = b;
    });
    if (ws.render) ws.render();
}
