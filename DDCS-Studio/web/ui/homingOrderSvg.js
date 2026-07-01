/**
 * ui/homingOrderSvg.js — the shared 3-axis isometric graphic for the homing sequence picker.
 * One source of truth for the Blockly custom field and the wizard FORM pickers.
 */
const SVGNS = 'http://www.w3.org/2000/svg';
export const HO = { SPAN_X: 100, SPAN_Y: 90 };

// Axis label positions (X, Y in SVG coords)
const POS = {
    z: { cx: 50, cy: 15, lx: 50, ly: 50 },
    x: { cx: 85, cy: 75, lx: 50, ly: 50 },
    y: { cx: 15, cy: 75, lx: 50, ly: 50 },
    a: { cx: 85, cy: 30, lx: 65, cy2: 45 }, // A curved arrow roughly around X
    b: { cx: 15, cy: 30, lx: 35, cy2: 45 }  // B curved arrow roughly around Y
};

/** Build the axis diagram into `parent` (an SVG <g> or <svg>). Returns { hitTargets, badges, textLabels }. */
export function buildHomingSequence(parent, configuredAxes) {
    const hitTargets = {}, badges = {}, textLabels = {}, bgShapes = {};
    
    // Draw the structural lines (the isometric axes)
    const mkLine = (x1, y1, x2, y2, isDashed) => {
        const l = document.createElementNS(SVGNS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', '#4a5568'); l.setAttribute('stroke-width', '2');
        l.setAttribute('stroke-linecap', 'round');
        if (isDashed) l.setAttribute('stroke-dasharray', '2 3');
        l.style.pointerEvents = 'none';
        parent.appendChild(l);
    };

    // Draw solid lines for configured axes, dashed for unconfigured
    ['z', 'x', 'y'].forEach(ax => {
        const p = POS[ax];
        mkLine(p.lx, p.ly, p.cx, p.cy, !configuredAxes.includes(ax));
    });

    ['a', 'b'].forEach(ax => {
        if (!configuredAxes.includes(ax)) return; 
        const p = POS[ax];
        mkLine(p.lx, p.cy2, p.cx, p.cy, true);
    });

    // Draw the nodes (circles)
    const axesList = ['z', 'x', 'y', 'a', 'b'].filter(a => configuredAxes.includes(a));
    
    axesList.forEach(ax => {
        const p = POS[ax];
        const g = document.createElementNS(SVGNS, 'g');
        g.style.cursor = 'pointer';
        
        // Background circle (hit target)
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('cx', p.cx); circle.setAttribute('cy', p.cy);
        circle.setAttribute('r', '13');
        circle.setAttribute('data-axis', ax);
        g.appendChild(circle);
        bgShapes[ax] = circle;

        // Axis Label (X, Y, Z, A, B)
        const text = document.createElementNS(SVGNS, 'text');
        text.setAttribute('x', p.cx); text.setAttribute('y', p.cy + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '600');
        text.setAttribute('font-family', 'sans-serif');
        text.style.pointerEvents = 'none';
        text.textContent = ax.toUpperCase();
        g.appendChild(text);
        textLabels[ax] = text;

        // Sequence badge (small circle on the top right of the node)
        const badgeG = document.createElementNS(SVGNS, 'g');
        badgeG.style.pointerEvents = 'none';
        badgeG.style.opacity = '0';
        
        const badgeCircle = document.createElementNS(SVGNS, 'circle');
        badgeCircle.setAttribute('cx', p.cx + 9); badgeCircle.setAttribute('cy', p.cy - 9);
        badgeCircle.setAttribute('r', '6');
        badgeCircle.setAttribute('fill', '#00e5ff');
        badgeG.appendChild(badgeCircle);
        
        const badgeText = document.createElementNS(SVGNS, 'text');
        badgeText.setAttribute('x', p.cx + 9); badgeText.setAttribute('y', p.cy - 6);
        badgeText.setAttribute('text-anchor', 'middle');
        badgeText.setAttribute('font-size', '9');
        badgeText.setAttribute('font-weight', '700');
        badgeText.setAttribute('fill', '#0b0f14');
        badgeText.setAttribute('font-family', 'sans-serif');
        badgeG.appendChild(badgeText);
        
        g.appendChild(badgeG);
        badges[ax] = { g: badgeG, text: badgeText };
        hitTargets[ax] = circle;

        parent.appendChild(g);
    });

    return { hitTargets, badges, textLabels, bgShapes };
}

/** 
 * Tint the selected nodes and update their sequence badges.
 * `sequence` is an array of axes, e.g., ['z', 'x', 'y']
 */
export function paintHomingSequence(ui, sequence, colour) {
    const { bgShapes, textLabels, badges } = ui;
    const seqMap = {};
    sequence.forEach((ax, idx) => { seqMap[ax] = idx + 1; });

    for (const ax in bgShapes) {
        const order = seqMap[ax];
        const on = order != null;
        
        const circle = bgShapes[ax];
        circle.setAttribute('fill', on ? colour : 'rgba(170,190,210,0.10)');
        circle.setAttribute('stroke', on ? colour : 'rgba(170,190,210,0.30)');
        circle.setAttribute('stroke-width', '1.5');
        
        const text = textLabels[ax];
        text.setAttribute('fill', on ? '#0b0f14' : 'rgba(255,255,255,0.7)');
        
        const badge = badges[ax];
        badge.g.style.opacity = on ? '1' : '0';
        if (on) badge.text.textContent = String(order);
    }
}

/** Process a click event on the SVG. Returns the axis that was clicked, or null. */
export function axisFromEvent(ui, e) {
    for (const ax in ui.bgShapes) {
        const r = ui.bgShapes[ax].getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return ax;
    }
    return null;
}
