import os
import re

app_dir = r"C:\Users\danse\APPS\ddcs-studio-project"
index_path = os.path.join(app_dir, r"DDCS-Studio\web\index.html")
out_dir = os.path.join(app_dir, r"ddcs-vscode-extension\web")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "extension_index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract from <!-- Wizard overlay --> to the end of the body
wizard_match = re.search(r'(<!-- Wizard overlay -->.*?)</body>', content, re.DOTALL)
wizard_html = wizard_match.group(1) if wizard_match else "<!-- Failed to find wizard overlay -->"

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DDCS VS Code Extension</title>
    
    <!-- Shared app styles -->
    <link rel="stylesheet" href="../../DDCS-Studio/web/styles.css">
    
    <!-- Extension specific overrides -->
    <link rel="stylesheet" href="extension_styles.css">
    
    <!-- Shared three.js for 3D viz -->
    <script defer src="../../DDCS-Studio/web/assets/vendor/three.min.js"></script>
</head>
<body data-theme="studio" style="background: transparent;">

    <!-- Extension Header (No App switcher, no Dock) -->
    <header class="app-header" style="height: 40px; border-bottom: 1px solid var(--border-color);">
        <span style="font-family: 'Arial Black', sans-serif; font-style: italic; color: var(--accent-blue); padding-left: 15px;">DDCS WIZARDS</span>
        <button onclick="window.openWiz('corner')" style="margin-left:20px;">Test Corner Wiz</button>
    </header>

    <main style="padding: 20px;">
        <p>The wizards will take over the screen when opened.</p>
    </main>

{wizard_html}

</body>
</html>
"""

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html_template)

# Also create the blank CSS file
css_path = os.path.join(out_dir, "extension_styles.css")
with open(css_path, 'w', encoding='utf-8') as f:
    f.write("/* Extension-specific CSS overrides */\nbody { padding: 0; margin: 0; }\n")

print("Successfully generated extension_index.html and extension_styles.css")
