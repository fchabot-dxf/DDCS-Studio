// svg-map-generator.js
// Usage: node svg-map-generator.js <input-svg> <output-md>
// Example: node svg-map-generator.js ../src/assets/middleViz.svg ../docs/middleViz_map.md
//
// This script parses the SVG file and outputs a Markdown map of the group hierarchy.
// The first four parent group levels are colored differently using HTML in Markdown.

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

// Font colors for the first 4 levels
const LEVEL_COLORS = [
  '#d32f2f', // Level 1 - Red
  '#1976d2', // Level 2 - Blue
  '#388e3c', // Level 3 - Green
  '#fbc02d', // Level 4 - Yellow
];

function colorize(text, level) {
  if (level < LEVEL_COLORS.length) {
    return `<span style=\"color:${LEVEL_COLORS[level]}\">${text}</span>`;
  }
  return text;
}

function mapGroups(node, level = 0) {
  let out = '';
  if (node.nodeType === 1 && node.tagName === 'g') {
    const id = node.getAttribute('id');
    if (id) {
      out += `${'  '.repeat(level)}- ${colorize(id, level)}\n`;
    }
    // Recurse into children
    for (let i = 0; i < node.childNodes.length; i++) {
      out += mapGroups(node.childNodes[i], level + 1);
    }
  } else if (node.childNodes) {
    // Recurse into children for non-group containers (e.g. <svg>)
    for (let i = 0; i < node.childNodes.length; i++) {
      out += mapGroups(node.childNodes[i], level);
    }
  }
  return out;
}

function main() {
  const [,, inputSvg, outputMd] = process.argv;
  if (!inputSvg || !outputMd) {
    console.error('Usage: node svg-map-generator.js <input-svg> <output-md>');
    process.exit(1);
  }
  const svgContent = fs.readFileSync(inputSvg, 'utf8');
  const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
  const svg = doc.getElementsByTagName('svg')[0];
  const map = mapGroups(svg);
  const header = '# SVG Group Hierarchy Map\n\n';
  fs.writeFileSync(outputMd, header + map);
  console.log(`SVG map written to ${outputMd}`);
}

main();
