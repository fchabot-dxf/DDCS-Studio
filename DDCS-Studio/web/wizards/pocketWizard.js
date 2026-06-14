/**
 * wizards/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `pocketStack(params)` →
 * [ StepDown{ StepOver(Region) [+ Wall(Region)] } ]. The Region is the tool-CENTRE boundary (inset by the
 * tool radius) so the FINISHED pocket matches the size you type. Strategy raster → parallel rows + a Wall
 * finish; spiral → concentric rings (which reach the wall). A pocket smaller than the tool falls back to a
 * single centre plunge (peck). Form and Blocks view are two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { num } from './ops/util.js';

/** Pocket params → its block stack. The one source of truth for both displays. */
export function pocketStack(params = {}) {
    const shape = params.shape || 'rect';
    const tool = Math.max(0.1, num(params.toolDia, 6)), r = tool / 2;
    const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
    const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const raster = (params.strategy || 'spiral') === 'raster';
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);

    // tool-centre region (inset by the tool radius) + too-small detection
    let region = newBlock('region'), tooSmall, cx, cy;
    if (shape === 'circle') {
        const Rc = num(params.dia, 50) / 2 - r; tooSmall = Rc <= 0; cx = ox; cy = oy;
        region.params = { shape: 'circle', x: ox, y: oy, w: 2 * Rc };
    } else {
        const w = num(params.w, 80), h = num(params.h, 60), iw = w - 2 * r, ih = h - 2 * r;
        tooSmall = iw <= 0 || ih <= 0; cx = ox + w / 2; cy = oy + h / 2;
        region.params = { shape: 'rect', x: ox + r, y: oy + r, w: iw, h: ih };
    }

    if (tooSmall) {   // pocket smaller than the tool → a single centre plunge, pecking to depth
        const hole = newBlock('drill');
        hole.params = { x: cx, y: cy, depth, peck: by, feed: plunge, clearance: clr };
        return [hole];
    }

    const over = newBlock('stepover');
    over.params = { region, stepover: so, strategy: raster ? 'parallel' : 'concentric', direction: 'bothways', z: 'z', feed, plunge, clearance: clr };
    const down = newBlock('stepdown');
    down.params = { to: depth, by };
    down.children = [over];
    if (raster) {   // raster leaves the wall un-finished → a contour pass (arc for circles, polygon for rect)
        const wall = newBlock('wall');
        wall.params = { region, z: 'z', feed, plunge, clearance: clr };
        down.children.push(wall);
    }
    return [down];
}

export class PocketWizard {
    generate(params) {
        const shape = params.shape || 'rect';
        const head = shape === 'rect' ? `${num(params.w, 80)} × ${num(params.h, 60)} mm` : `Ø${num(params.dia, 50)} mm`;
        const title = `( Pocket - ${shape} ${head} - DDCS Studio )`;
        return emitMapped(pocketStack(params), { ...params, title }).text;
    }
}
