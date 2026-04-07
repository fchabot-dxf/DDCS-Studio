import subprocess
import sys
import os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Set your Cloudflare account and project info
os.environ["CLOUDFLARE_ACCOUNT_ID"] = "014e18b89793d634a95538e7910dce19"
os.environ["CLOUDFLARE_API_TOKEN"] = "GtQE0nONp5MxnTRUgngrM_APaZkWoOSkj6nvemyk"
PROJECT_NAME = "fredericchabot"

# Check if wrangler is installed
WRANGLER_CMD = r"C:\Users\danse\AppData\Roaming\npm\wrangler.cmd"
try:
    subprocess.run([WRANGLER_CMD, "--version"], check=True, capture_output=True)
except subprocess.CalledProcessError:
    print("wrangler CLI could not be found. Install it with: npm install -g wrangler")
    exit(1)

# Deploy the fredericchabot/ folder
result = subprocess.run([
    WRANGLER_CMD, "pages", "deploy", "fredericchabot", "--project-name", PROJECT_NAME
])

print("Deployment complete." if result.returncode == 0 else f"Deployment failed (exit code {result.returncode}).")

# Securely set your Cloudflare API token and account ID using environment variables or a .env file.
# Example (PowerShell):
# $env:CLOUDFLARE_API_TOKEN = "your_actual_token"
# $env:CLOUDFLARE_ACCOUNT_ID = "your_actual_account_id"
# Remove hardcoded values from this script for security.
