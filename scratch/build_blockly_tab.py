import os
import re

app_dir = r"C:\Users\danse\APPS\ddcs-studio-project"
spike_path = os.path.join(app_dir, r"DDCS-Studio\web\blocks\blockly-spike.html")
index_path = os.path.join(app_dir, r"ddcs-vscode-extension\web\extension_index.html")

# Read spike
with open(spike_path, 'r', encoding='utf-8') as f:
    spike_content = f.read()

# Read current extension_index (for wizards)
with open(index_path, 'r', encoding='utf-8') as f:
    ext_content = f.read()

# Extract wizards HTML
wiz_match = re.search(r'(<!-- Wizard overlay -->.*?)(?=<!-- Include the real Wizard Logic -->)', ext_content, re.DOTALL)
wizards_html = wiz_match.group(1) if wiz_match else ""

# Extract wizard scripts
script_match = re.search(r'(<!-- Include the real Wizard Logic -->.*?</body>)', ext_content, re.DOTALL)
wizards_scripts = script_match.group(1).replace("</body>", "") if script_match else ""

# Build new HTML
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>DDCS VS Code Extension</title>
    
    <!-- Shared app styles -->
    <link rel="stylesheet" href="../../DDCS-Studio/web/styles.css">
    
    <!-- Blockly library -->
    <script src="../../DDCS-Studio/web/vendor/blockly/blockly.min.js"></script>
    
    <!-- Extension specific overrides -->
    <link rel="stylesheet" href="extension_styles.css">
    
    <!-- Shared three.js for 3D viz -->
    <script defer src="../../DDCS-Studio/web/assets/vendor/three.min.js"></script>
    
    <style>
        /* Blockly spike base styles */
        :root {{ --bg:#0d1117; --panel:#161d28; --line:#26303d; --ink:#e6edf3; --muted:#8b97a6; --accent:#2dd4bf;
                --cat-machine:#64748b; --cat-move:#14b8a6; --cat-ops:#22c55e; --cat-control:#f59e0b;
                --cat-math:#84cc16; --cat-modify:#a855f7; }}
        html, body {{ margin:0; height:100%; overflow: hidden; background:var(--bg); color:var(--ink);
                    font:13px/1.4 ui-sans-serif,system-ui,Segoe UI,sans-serif; }}
        .wrap {{ display:flex; flex-direction:column; height:100%; }}
        
        /* The Wizard Bar */
        .wizard-bar {{ display:flex; align-items:center; gap:12px; padding:8px 14px; background:var(--panel);
                 border-bottom:1px solid var(--line); }}
        .wizard-bar h1 {{ font-size:14px; margin:0; letter-spacing:.04em; color: var(--accent-blue); font-style: italic; }}
        .wizard-bar button {{ padding: 6px 12px; background: #26303d; border: 1px solid #39465a; color: #cbd5e1; border-radius: 4px; cursor: pointer; }}
        .wizard-bar button:hover {{ background: var(--accent-blue); color: white; border-color: var(--accent-blue); }}
        
        /* The Blockly Canvas */
        .main {{ display:grid; grid-template-columns:1fr; flex:1; min-height:0; position: relative; }}
        #ws {{ position:absolute; top:0; left:0; right:0; bottom:0; }}
        
        /* Modals for wizards */
        #wizard {{ position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; }}
        #wizard .wiz-box {{ max-height: 90vh; overflow-y: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    </style>
</head>
<body>
  <div class="wrap">
    <!-- WIZARD BAR -->
    <header class="wizard-bar">
      <h1>DDCS STUDIO</h1>
      <button onclick="window.openWiz('corner')">Corner</button>
      <button onclick="window.openWiz('edge')">Edge</button>
      <button onclick="window.openWiz('middle')">Middle</button>
      <button onclick="window.openWiz('alignment')">Alignment</button>
    </header>
    
    <!-- BLOCKLY CANVAS -->
    <div class="main">
      <div id="ws"></div>
    </div>
  </div>

  <!-- THE WIZARDS (Hidden by default) -->
  {wizards_html}

  <!-- BLOCKLY INITIALIZATION -->
  <script>
  {re.search(r'<script>(.*?)</script>', spike_content, re.DOTALL).group(1) if re.search(r'<script>(.*?)</script>', spike_content, re.DOTALL) else ""}
  </script>

  <!-- WIZARD LOGIC & VS CODE BRIDGE -->
  {wizards_scripts}
  
  <script>
    // Add a close button to the wizards so we can dismiss the modal
    document.addEventListener('DOMContentLoaded', () => {{
        const wizBox = document.querySelector('.wiz-box');
        if (wizBox) {{
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕ Close Wizard';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '10px';
            closeBtn.style.right = '10px';
            closeBtn.style.padding = '5px 10px';
            closeBtn.style.background = '#e11d48';
            closeBtn.style.color = 'white';
            closeBtn.style.border = 'none';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = window.closeWiz;
            wizBox.style.position = 'relative';
            wizBox.appendChild(closeBtn);
        }}
    }});
  </script>
</body>
</html>
"""

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully built the new Blockly Tab layout with Wizard overlay!")
