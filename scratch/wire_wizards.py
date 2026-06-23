import os
import re

app_dir = r"C:\Users\danse\APPS\ddcs-studio-project"
index_path = os.path.join(app_dir, r"ddcs-vscode-extension\web\extension_index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

injection = """
    <!-- Include the real Wizard Logic -->
    <script src="../../DDCS-Studio/web/gcodeParser.js"></script>
    <script src="../../DDCS-Studio/web/wizardManager.js"></script>

    <!-- Wire the wizards to the VS Code API -->
    <script>
        // Override the insertWiz function to send to VS Code
        window.insertWiz = () => {
            const pre = document.querySelector('.wiz-body[style*="block"] pre:not(:empty)') || 
                        document.querySelector('#wizard pre:not(:empty)');
            if (pre && window.vscode) {
                window.vscode.postMessage({
                    command: 'insertCode',
                    text: pre.textContent + '\\n'
                });
                // Optional: show a small visual feedback
                const origBg = pre.style.backgroundColor;
                pre.style.backgroundColor = '#1e4620';
                setTimeout(() => pre.style.backgroundColor = origBg, 200);
            }
        };

        // Dynamically add a massive "Insert Code" button under every code preview
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.preview-block').forEach(block => {
                const btn = document.createElement('button');
                btn.innerHTML = '<b>INSERT INTO EDITOR TAB</b>';
                btn.style.marginTop = '15px';
                btn.style.width = '100%';
                btn.style.padding = '15px';
                btn.style.background = '#007acc';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '14px';
                btn.onclick = window.insertWiz;
                
                // Add hover effect
                btn.onmouseover = () => btn.style.background = '#005999';
                btn.onmouseout = () => btn.style.background = '#007acc';

                block.appendChild(btn);
            });
            
            // Auto-open a wizard for testing purposes if none is open
            if (window.openWiz) {
                window.openWiz('corner');
            }
        });
    </script>
</body>
"""

content = content.replace("</body>", injection)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected wizard scripts into extension_index.html")
