/**
 * blocks/fromWizard.js — "view as blocks": a STUDIO wizard's params → its equivalent primitive-block stack.
 *
 * The structural composition bridge (the north-star). Drill already proved the kernels are shared
 * (drillWizard = array(bore), byte-identical); this maps the higher-level wizards onto the same atoms so a
 * STUDIO op can be opened AS its block stack. The emitted CUTTING PASSES match the wizard (same clearing.js
 * kernels); the wizard's hand-rolled framing (section comments, the circle raster arc-finish, the
 * smaller-than-tool single-plunge fallback) is wizard chrome and is NOT reproduced — see pocketToBlocks notes.
 */
import { newBlock } from './blockModel.js';
import { num } from '../wizards/ops/util.js';

/** A Region reporter pill at the tool-CENTRE boundary (inset by the tool radius r), matching the wizard so the
 *  passes line up. Rect: corner (ox+r,oy+r) sized W−2r×H−2r. Circle: centre (ox,oy), diameter dia−2r
 *  (regionDesc reads `w` as the circle diameter). */
function insetRegion(params, r) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const region = newBlock('region');
    if ((params.shape || 'rect') === 'circle') {
        region.params = { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) - 2 * r };
    } else {
        region.params = { shape: 'rect', x: ox + r, y: oy + r, w: num(params.w, 80) - 2 * r, h: num(params.h, 60) - 2 * r };
    }
    return region;
}

/**
 * PocketWizard params → [ StepDown{ StepOver(Region) [+ Wall(Region)] } ].
 *   strategy: raster → 'parallel' (+ a Wall finish pass);  spiral/concentric → 'concentric' (rings reach the wall).
 * Geometry matches the wizard for raster-rect / concentric-rect / concentric-circle. KNOWN DIVERGENCE: the
 * wizard's raster-CIRCLE wall finish is a crisp G3 arc; the Wall atom traces the faceted circleContour polygon.
 */
export function pocketToBlocks(params = {}) {
    const shape = params.shape || 'rect';
    const tool = Math.max(0.1, num(params.toolDia, 6)), r = tool / 2;
    const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
    const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
    const raster = (params.strategy || 'spiral') === 'raster';
    const region = insetRegion(params, r);

    const over = newBlock('stepover');
    over.params = { region, stepover: so, strategy: raster ? 'parallel' : 'concentric', direction: 'bothways', z: 'z', feed, plunge, clearance: clr };

    const down = newBlock('stepdown');
    down.params = { to: num(params.depth, 4), by: num(params.stepdown, 1.5) };
    down.children = [over];

    if (raster) {   // raster leaves the wall un-finished → add a contour pass (matches the wizard's rect wall)
        const wall = newBlock('wall');
        wall.params = { region, z: 'z', feed, plunge, clearance: clr };
        down.children.push(wall);
    }
    return [down];
}
