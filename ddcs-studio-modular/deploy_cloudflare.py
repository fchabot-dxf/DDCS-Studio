import subprocess
import sys
import os
import shutil

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Validate required env vars
for var in ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"):
    if not os.environ.get(var):
        print(f"Error: {var} is not set. Add it to .env or set it as an environment variable.")
        exit(1)

PROJECT_NAME = "ddcsexpertstudio"

# Source of truth: always deploy output/ (never src/) so standalone HTML and generated .nc files are included.

# prefer looking in PATH (wrangler or wrangler.cmd on Windows)
WRANGLER_CMD = shutil.which("wrangler") or shutil.which("wrangler.cmd")
if WRANGLER_CMD is None:
    # fall back to known npm global path for current user
    WRANGLER_CMD = os.path.expandvars(r"%USERPROFILE%\AppData\Roaming\npm\wrangler.cmd")

# verify cli exists
try:
    subprocess.run([WRANGLER_CMD, "--version"], check=True, capture_output=True)
except Exception:
    print("wrangler CLI could not be found. Install it with: npm install -g wrangler")
    exit(1)

# Build standalone HTML before deploying
workspace_dir = os.path.dirname(__file__) or "."
print("Building standalone bundle...")
build_result = subprocess.run(["npm", "run", "build"], cwd=workspace_dir, shell=True)
if build_result.returncode != 0:
    print(f"Build failed (exit code {build_result.returncode}). Aborting deploy.")
    sys.exit(build_result.returncode)

print("Build complete.")

# Create a clean temp deploy folder with standalone + a minimal index.html redirect
import tempfile
deploy_dir = tempfile.mkdtemp(prefix='ddcs_deploy_')
standalone = os.path.join(workspace_dir, "output", "ddcs-studio-standalone.html")
shutil.copy2(standalone, os.path.join(deploy_dir, "ddcs-studio-standalone.html"))
with open(os.path.join(deploy_dir, "index.html"), 'w') as f:
    f.write('<meta http-equiv="refresh" content="0;url=ddcs-studio-standalone.html">')
print(f"Prepared deploy folder: {deploy_dir}")

# Deploy the clean temp folder
result = subprocess.run([
    WRANGLER_CMD, "pages", "deploy", deploy_dir, "--project-name", PROJECT_NAME
], cwd=workspace_dir)

# Clean up temp deploy folder
shutil.rmtree(deploy_dir, ignore_errors=True)

if result.returncode == 0:
    print("Deployment complete.")
    sys.exit(0)

print(f"Deployment failed (exit code {result.returncode}).")
sys.exit(result.returncode)
