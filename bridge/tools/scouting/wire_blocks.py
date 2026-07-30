import os

app_dir = r"C:\Users\danse\APPS\ddcs-studio-project"
index_path = os.path.join(app_dir, r"ddcs-vscode-extension\web\extension_index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Block JSON Definitions
block_defs = """
      {
        "type": "corner_op",
        "message0": "⬡ %1 Corner %2 Seq %3",
        "args0": [
          {"type": "field_label_serializable", "name": "LABEL", "text": "Corner Probe"},
          {"type": "field_dropdown", "name": "CORNER", "options": [["FL","FL"],["FR","FR"],["BL","BL"],["BR","BR"]]},
          {"type": "field_dropdown", "name": "PROBESEQ", "options": [["XY","XY"],["YX","YX"]]}
        ],
        "message1": "%1",
        "args1": [{"type": "input_statement", "name": "DO"}],
        "previousStatement": null, "nextStatement": null, "colour": 210
      },
      {
        "type": "middle_op",
        "message0": "⬡ %1 Type %2 Axis %3 Dir %4",
        "args0": [
          {"type": "field_label_serializable", "name": "LABEL", "text": "Middle Probe"},
          {"type": "field_dropdown", "name": "FEATURETYPE", "options": [["pocket","pocket"],["boss","boss"]]},
          {"type": "field_dropdown", "name": "AXIS", "options": [["X","X"],["Y","Y"],["Z","Z"]]},
          {"type": "field_dropdown", "name": "DIR1", "options": [["pos","pos"],["neg","neg"]]}
        ],
        "message1": "%1",
        "args1": [{"type": "input_statement", "name": "DO"}],
        "previousStatement": null, "nextStatement": null, "colour": 210
      },
      {
        "type": "edge_op",
        "message0": "⬡ %1 Axis %2 Dir %3",
        "args0": [
          {"type": "field_label_serializable", "name": "LABEL", "text": "Edge Probe"},
          {"type": "field_dropdown", "name": "AXIS", "options": [["X","X"],["Y","Y"],["Z","Z"]]},
          {"type": "field_dropdown", "name": "AXISDIR", "options": [["pos","pos"],["neg","neg"]]}
        ],
        "message1": "%1",
        "args1": [{"type": "input_statement", "name": "DO"}],
        "previousStatement": null, "nextStatement": null, "colour": 210
      },
"""

content = content.replace("B.defineBlocksWithJsonArray([", "B.defineBlocksWithJsonArray([" + block_defs)

# 2. Update insertWiz
new_insertWiz = """
        window.insertWiz = () => {
            const activePanel = document.querySelector('.wiz-box [id^="wiz_"][style*="block"]');
            const pre = document.querySelector('.wiz-body[style*="block"] pre:not(:empty)') || 
                        document.querySelector('#wizard pre:not(:empty)');
                        
            if (pre && window.vscode) {
                // 1. Send text to editor
                window.vscode.postMessage({
                    command: 'insertCode',
                    text: pre.textContent + '\\n'
                });
                
                // 2. Add block to Blockly canvas!
                if (activePanel && window.__spike && window.__spike.ws) {
                    const ws = window.__spike.ws;
                    const wizId = activePanel.id; // e.g., 'wiz_corner'
                    let blockType = '';
                    let fieldsToSet = {};
                    
                    if (wizId === 'wiz_corner') {
                        blockType = 'corner_op';
                        fieldsToSet['CORNER'] = document.getElementById('c_corner')?.value || 'FL';
                        fieldsToSet['PROBESEQ'] = document.getElementById('c_probe_seq')?.value || 'YX';
                    } else if (wizId === 'wiz_middle') {
                        blockType = 'middle_op';
                        fieldsToSet['FEATURETYPE'] = document.getElementById('m_type')?.value || 'pocket';
                        fieldsToSet['AXIS'] = document.getElementById('m_axis')?.value || 'X';
                        fieldsToSet['DIR1'] = document.getElementById('m_dir')?.value || 'pos';
                    } else if (wizId === 'wiz_edge') {
                        blockType = 'edge_op';
                        fieldsToSet['AXIS'] = document.getElementById('p_axis')?.value || 'X';
                        fieldsToSet['AXISDIR'] = document.getElementById('p_dir')?.value || 'pos';
                    }
                    
                    if (blockType) {
                        const block = ws.newBlock(blockType);
                        for (const [key, val] of Object.entries(fieldsToSet)) {
                            block.setFieldValue(val, key);
                        }
                        block.initSvg();
                        block.render();
                        
                        // Place it nicely on the workspace
                        const topBlocks = ws.getTopBlocks();
                        let y = 30;
                        if (topBlocks.length > 1) {
                            const lastBlock = topBlocks[topBlocks.length - 2];
                            y = lastBlock.getRelativeToSurfaceXY().y + lastBlock.getHeightWidth().height + 20;
                        }
                        block.moveBy(150, y);
                    }
                }
                
                window.closeWiz();
            }
        };
"""

# Replace the old insertWiz function
import re
content = re.sub(r'window\.insertWiz = \(\) => \{.*?\n        \};', new_insertWiz.strip(), content, flags=re.DOTALL)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully wired Wizards to Blockly Blocks!")
