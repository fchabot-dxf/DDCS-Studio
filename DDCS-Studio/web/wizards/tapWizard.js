/**
 * wizards/tapWizard.js — TAPPING (thread a hole). The wizard's only implementation is `tapStack(params)` — a single Tap
 * leaf placed on the stock, framed by the standard program start/end. The pitch-locked feed is DERIVED in the Tap atom
 * (F = RPM × pitch), so the form's shown feed can never drift from the emit. The floating-holder cycle runs on every DDCS
 * post; the rigid (G84-style) variant is gated upstream on a declared encoder/servo spindle + the Expert post.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';

/** Tap params → [ ProgStart, WCS, PlaceOnStock{ Tap }, ProgEnd ]. rpm passed to the frame = the LOW tap rpm (not the router default). */
export function tapStack(params = {}) {
    const rpm = num(params.rpm, 400);
    const tap = newBlock('tap');
    tap.params = {
        x: num(params.x, 0), y: num(params.y, 0),
        depth: num(params.depth, 10), rpm, pitch: num(params.pitch, 1.0),
        dwell: num(params.dwell, 0.3), clearance: num(params.clearance, 5),
        rigid: !!params.rigid,
    };
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    const bbox = { minX: tap.params.x, maxX: tap.params.x, minY: tap.params.y, maxY: tap.params.y };
    // frame at the tap rpm (a router default would spin dangerously fast into the thread). optIn:true = absolute x/y
    // placement (the text twin's precedent) — the tapped hole stays where the user put it unless stock-attached.
    return [makeStart({ ...params, rpm }), wcs, makePlace({ ...params, optIn: true }, bbox, tap), makeEnd(params)];
}

export class TapWizard {
    generate(params) {
        recordOp('tap', params);
        return emitMapped(tapStack(params), activeDialectOpts()).text;
    }
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
