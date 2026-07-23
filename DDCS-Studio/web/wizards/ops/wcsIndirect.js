/**
 * wizards/ops/wcsIndirect.js — the probe-family WCS-write atoms (F1/E1, corner pilot).
 *
 * The probe wizards write a probed value into the WCS table. On DDCS Expert that is the dump-grounded INDIRECT idiom
 * (compute the table base into #70, then `#[#70]`/`#[#73]` writes — SAVE_WCS_XY_AUTO.nc); on V4.1/DM500 it is a G92
 * datum. These two atoms route that per active post while keeping Expert BYTE-IDENTICAL to the old hand-emitted literals:
 *
 *   wcsbaseinto — the base-address compute (Expert dialect.wcsBaseInto; posts with no WCS table → [], G92 needs no base).
 *   wcswrite    — one WCS-axis write. Expert → dialect.wcsWriteIndirect (the #[#70]/#73 form); other posts → the post's
 *                 setWorkOffset (G92). Handles a LITERAL value (X/Y) or a radius-comped TRIGGER (Z, via rawAxis) and an
 *                 Expert-only value with no cross-post equivalent (the #883 dual-gantry sync → honest comment off-Expert).
 */
import { num } from './util.js';

export const wcsBaseIntoBlock = {
    type: 'wcsbaseinto', label: 'WCS Base', kind: 'leaf', category: 'Coordinates',
    defaults: { wcs: 'active', base: '#70', bare: false }, fields: ['wcs', 'base', 'bare'],
    scratch: [[70, 70]],   // t1085 — the WCS base address var. NB the dialect that IMPLEMENTS wcsBaseInto declares the rest of its own family (Expert #70-#72)
    emit: (p, dx, dy, dialect) => {
        if (dialect && typeof dialect.wcsBaseInto === 'function') return dialect.wcsBaseInto(p.wcs || 'active', { bare: !!p.bare });
        return [];   // no WCS table on this post (G92 datum) → no base compute
    },
};

export const wcsWriteBlock = {
    type: 'wcswrite', label: 'WCS Write', kind: 'leaf', category: 'Coordinates',
    defaults: { axis: 'X', wcs: '#578', offset: 0, addrVar: '', addrNote: '', value: '', note: '', rawAxis: '', radius: '#6', compDir: '-', offComment: '', direct: false },
    fields: ['axis', 'wcs', 'offset', 'addrVar', 'addrNote', 'value', 'note', 'rawAxis', 'radius', 'compDir', 'offComment', 'direct'],
    scratch: [[6, 6], [70, 70]],   // t1085 — READS the tool-radius var (#6) and the base address (#70) the paired wcsbaseinto set
    emit: (p, dx, dy, dialect) => {
        // resolve the value: a radius-comped TRIGGER (rawAxis, per post) or the given literal
        let value = p.value;
        if (p.rawAxis && dialect && typeof dialect.probeTrigVar === 'function') {
            const trig = dialect.probeTrigVar(p.rawAxis);
            value = trig ? `[${trig}${p.compDir === '-' ? '-' : '+'}${p.radius || '#6'}]` : null;   // no trigger → degrade
        }
        const degrade = (why) => [`( ${p.note || 'WCS write'} — ${why} )`];
        // Expert (register-write idiom): the byte-identical indirect form
        if (dialect && typeof dialect.wcsWriteIndirect === 'function') {
            if (value == null) return degrade('no probe-trigger readback on this controller');
            return dialect.wcsWriteIndirect({ offset: num(p.offset, 0), addrVar: p.addrVar, value, note: p.note, addrNote: p.addrNote, direct: !!p.direct });
        }
        // Non-Expert: an Expert-only value with no cross-post equivalent (the #883 sync) → honest comment, no G92 guess
        if (p.offComment) return [`( ${p.offComment} )`];
        if (value == null) return degrade('no probe-trigger readback on this controller');
        return dialect.setWorkOffset(p.wcs || '#578', p.axis || 'X', value);
    },
};
