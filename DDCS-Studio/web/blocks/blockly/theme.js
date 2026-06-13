/**
 * blocks/blockly/theme.js — the DDCS Blockly theme: our --cat signature colours + dark "screen" chrome,
 * on top of the Classic base. Paired with the `geras` renderer at inject time (classic/engineering look,
 * per the renderer decision). One block-style per category so a block's colour = its category, matching
 * the hand-rolled tab. Requires window.Blockly (the vendored UMD) to be loaded first.
 */
const CAT = {
  shapes: '#3b82f6', move: '#14b8a6', machine: '#64748b', ops: '#22c55e',
  modify: '#a855f7', control: '#f59e0b', math: '#84cc16', variables: '#06b6d4', markup: '#94a3b8',
};

export function ddcsTheme(Blockly) {
  const blockStyles = {};
  for (const k in CAT) blockStyles[k + '_style'] = { colourPrimary: CAT[k] };
  // native Blockly blocks (logic/loops/math/variables) → map onto our category colours
  Object.assign(blockStyles, {
    logic_blocks: { colourPrimary: CAT.control }, loop_blocks: { colourPrimary: CAT.control },
    math_blocks: { colourPrimary: CAT.math }, variable_blocks: { colourPrimary: CAT.variables },
    text_blocks: { colourPrimary: CAT.markup },
  });
  const categoryStyles = {};
  for (const k in CAT) categoryStyles[k + '_cat'] = { colour: CAT[k] };
  return Blockly.Theme.defineTheme('ddcs', {
    base: Blockly.Themes.Classic,
    blockStyles, categoryStyles,
    componentStyles: {
      workspaceBackgroundColour: '#0d1117', toolboxBackgroundColour: '#161d28',
      toolboxForegroundColour: '#cbd5e1', flyoutBackgroundColour: '#11171f',
      flyoutForegroundColour: '#8b97a6', flyoutOpacity: 1, scrollbarColour: '#39465a',
      insertionMarkerColour: '#2dd4bf', insertionMarkerOpacity: 0.5,
      cursorColour: '#2dd4bf', selectedGlowColour: '#2dd4bf',
    },
    fontStyle: { family: 'ui-sans-serif, system-ui, Segoe UI, sans-serif', size: 11 },
  });
}
