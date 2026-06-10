const fs = require('fs');

const files = [
  'src/assets/cornerViz.svg',
  'src/assets/middleViz.svg',
  'src/assets/edgeViz.svg',
  'src/assets/alignViz.svg'
];

const PROTECTED_RE = /(probepath|retractpath|jogpath)/i;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`${file}: missing, skipped`);
    continue;
  }

  let text = fs.readFileSync(file, 'utf8');
  const tagRe = /<\/?[^>]+?>/g;
  const groupStack = [];
  const idMap = new Map();

  let match;
  while ((match = tagRe.exec(text)) !== null) {
    const tag = match[0];

    if (/^<\//.test(tag)) {
      const closeName = (tag.match(/^<\/\s*([\w:-]+)/) || [])[1];
      if (closeName && closeName.toLowerCase() === 'g') {
        groupStack.pop();
      }
      continue;
    }

    const openName = (tag.match(/^<\s*([\w:-]+)/) || [])[1];
    if (!openName) continue;
    const isSelfClosing = /\/>$/.test(tag);

    const idMatch = tag.match(/\bid\s*=\s*"([^"]+)"/);
    const idVal = idMatch ? idMatch[1] : null;

    const scopeParent = [...groupStack].reverse().find((groupId) => /miniprobe|_wcs$/i.test(groupId));

    if (idVal && scopeParent && !idVal.startsWith(`${scopeParent}_`) && !PROTECTED_RE.test(idVal)) {
      // Prefix with parent id while preserving original id tail for readability.
      let candidate = `${scopeParent}_${idVal}`;
      let idx = 2;
      while (text.includes(`id="${candidate}"`) || [...idMap.values()].includes(candidate)) {
        candidate = `${scopeParent}_${idVal}_${idx++}`;
      }
      idMap.set(idVal, candidate);
    }

    if (openName.toLowerCase() === 'g' && idVal && !isSelfClosing) {
      groupStack.push(idVal);
    }
  }

  if (idMap.size === 0) {
    console.log(`${file}: no scoped IDs needed prefixing`);
    continue;
  }

  for (const [oldId, newId] of idMap.entries()) {
    const esc = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\bid\\s*=\\s*"${esc}"`, 'g'), `id="${newId}"`);
    text = text.replace(new RegExp(`\\bserif:id\\s*=\\s*"${esc}"`, 'g'), `serif:id="${newId}"`);
    text = text.replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${newId})`);
    text = text.replace(new RegExp(`(["'])#${esc}(["'])`, 'g'), `$1#${newId}$2`);
  }

  fs.writeFileSync(file, text, 'utf8');
  console.log(`${file}: prefixed ${idMap.size} scoped id(s)`);
}
