// t2091 (P5c) — pairwise clustering of every distinct 6-digit hex colour in styles.css, at a stated
// Euclidean RGB distance threshold. Comment-aware (reuses the strip logic). Reports clusters with >1 member
// and the count-weighted "canonical" choice (most-used member) for each.
import fs from 'node:fs';
const text = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf-8');

let stripped = '';
let inComment = false;
for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inComment) {
        if (c === '*' && text[i + 1] === '/') { inComment = false; stripped += '  '; i++; continue; }
        stripped += (c === '\n') ? '\n' : ' ';
        continue;
    }
    if (c === '/' && text[i + 1] === '*') { inComment = true; stripped += '  '; i++; continue; }
    stripped += c;
}

const THRESHOLD = process.argv[2] ? +process.argv[2] : 8;
const hexRe = /#([0-9a-fA-F]{6})\b/g; // 6-digit only, for clean RGB math
const counts = {};
let m;
while ((m = hexRe.exec(stripped))) {
    const hex = m[1].toLowerCase();
    counts[hex] = (counts[hex] || 0) + 1;
}

const toRgb = (hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
const dist = (a, b) => {
    const [r1, g1, b1] = toRgb(a), [r2, g2, b2] = toRgb(b);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

// STAR clustering, seeded by usage count descending (not insertion order): the canonical is always the
// most-used remaining colour, and every OTHER member of its cluster is verified directly within threshold
// of THAT canonical -- no transitive chaining (a naive "absorb anything within threshold of any existing
// member" greedy walk can chain A-B-C where dist(A,C) exceeds the threshold; this avoids that entirely).
const hexes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
const visited = new Set();
const clusters = [];
for (const h of hexes) {
    if (visited.has(h)) continue;
    const cluster = [h];
    visited.add(h);
    for (const other of hexes) {
        if (visited.has(other)) continue;
        if (dist(h, other) <= THRESHOLD) { cluster.push(other); visited.add(other); }
    }
    if (cluster.length > 1) clusters.push(cluster);
}

console.log(`threshold: Euclidean RGB distance <= ${THRESHOLD}`);
console.log(`distinct 6-digit hex colours: ${hexes.length}`);
console.log(`clusters found (size > 1): ${clusters.length}`);
let totalCollapsedAway = 0;
for (const cluster of clusters) {
    // cluster[0] IS the canonical (the seed, guaranteed most-used since hexes was sorted by count first,
    // and every other member is directly within threshold of THIS specific value -- no transitive chaining).
    const canonical = cluster[0];
    const members = cluster.slice(1);
    totalCollapsedAway += cluster.length - 1;
    console.log(`  canonical #${canonical} (×${counts[canonical]})  <-  ` + members.map((h) => `#${h}(×${counts[h]}, d=${dist(canonical, h).toFixed(2)})`).join(', '));
}
console.log(`\ntotal colours collapsed away (members - clusters): ${totalCollapsedAway}`);
