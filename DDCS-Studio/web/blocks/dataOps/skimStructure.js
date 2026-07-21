/**
 * blocks/dataOps/skimStructure.js — the DECLARED "Skim Z-mode" structural patch (t986) for a cutting twin.
 *
 * A cutting twin seeds its FROZEN template from <op>Stack(<DEFAULTS>) = the NORMAL stack (placeonstock wraps the
 * cutting body). Skim is a STRUCTURAL fork (whole-op G91 relative to the jog): progstart drops its absolute clearance
 * + the placeonstock wrapper becomes a `skim` wrapper (relativizes the body). A bound socket can't switch a block
 * TYPE, so this postInstantiate hook (runs at BUILD, like spindleHeadPatch) restructures the instantiated stack when
 * zMode==='skim' — swap placeonstock→skim (keeping its children) + set progstart.skim — producing EXACTLY the built-in
 * surfacingStack(skim) shape (parallel indices: skim sits where placeonstock did, wcs kept). Normal → a no-op (byte-
 * identical). Compose AFTER spindleHeadPatch. See wizards/ops/skim.js + data/rotateProgram.relativizeProgram.
 */
import { newBlock } from '../blockEmitter.js';
import { flattenBlocks } from '../userOps.js';
import { num } from '../../wizards/ops/util.js';

/** Replace the first `placeonstock` in a children array with a `skim` block wrapping its children. Returns true when done. */
function swapPlaceToSkim(nodes, clearance) {
    if (!Array.isArray(nodes)) return false;
    for (let i = 0; i < nodes.length; i++) {
        const b = nodes[i];
        if (!b) continue;
        if (b.type === 'placeonstock') {
            const skim = newBlock('skim');
            skim.params = { clearance };
            skim.children = b.children || [];   // keep the (socket-filled) cutting body — the skim atom relativizes it
            nodes[i] = skim;
            return true;
        }
        if (b.children && swapPlaceToSkim(b.children, clearance)) return true;
        if (b.uiChildren && swapPlaceToSkim(b.uiChildren, clearance)) return true;
    }
    return false;
}

/** postInstantiate: when zMode==='skim', restructure the instantiated stack into the Skim shape (progstart drops its
 *  absolute clearance; placeonstock→skim wrapping the same body). Normal / absent zMode → the stack is untouched
 *  (byte-identical). Mutates + returns the stack (the postInstantiate contract). */
export function applySkimStructure(stack, resolved) {
    if (!resolved || resolved.zMode !== 'skim') return stack;
    for (const b of flattenBlocks(stack)) {
        if (b && b.type === 'progstart' && b.params) b.params.skim = true;   // drop the absolute pre-G91 clearance (crash guard)
    }
    const clr = num(resolved.clearance, 5);
    for (const root of stack) {
        if (root && root.children) swapPlaceToSkim(root.children, clr);
    }
    return stack;
}
