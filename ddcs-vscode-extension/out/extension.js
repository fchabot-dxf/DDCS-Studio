"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const cp = require("child_process");
const http = require("http");
const DdcsEditorProvider_1 = require("./DdcsEditorProvider");
let gatewayProcess;
let gatewayPort = 8765; // updated from the backend's `DDCS_PORT=…` stdout line (it may fall back off 8765)
function activate(context) {
    console.log('DDCS Studio Prototype is now active!');
    // Spawn the headless Python backend
    const backendPath = path.join(context.extensionPath, 'backend', 'headless_gateway.py');
    gatewayProcess = cp.spawn('python', [backendPath], { cwd: context.extensionPath });
    gatewayProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        // The backend prints `DDCS_PORT=<n>` once it has picked (or discovered) its port.
        const m = text.match(/DDCS_PORT=(\d+)/);
        if (m) {
            gatewayPort = parseInt(m[1], 10);
        }
        console.log(`[Gateway] ${text.trim()}`);
    });
    gatewayProcess.stderr?.on('data', (data) => console.error(`[Gateway Error] ${data.toString().trim()}`));
    let isGatewayReady = false;
    // Register the custom editor provider (it reads the live gateway port for the webview transport)
    context.subscriptions.push(DdcsEditorProvider_1.DdcsEditorProvider.register(context, () => gatewayPort));
    // Live machine-connection indicator in the Status Bar. The extension HOST polls the gateway
    // directly (it owns the port) and renders a native workbench item — read-only, no machine writes.
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'ddcs.openWizard';
    statusBar.text = '$(sync~spin) DDCS: starting…';
    statusBar.tooltip = 'Starting the DDCS gateway…';
    statusBar.show();
    context.subscriptions.push(statusBar);
    updateStatusBar(statusBar); // immediate first paint
    const pollStatus = setInterval(() => updateStatusBar(statusBar), 3000);
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(pollStatus)));
    let disposable = vscode.commands.registerCommand('ddcs.openWizard', async () => {
        // Wait for gateway
        if (!isGatewayReady) {
            const ready = await waitForGateway();
            if (!ready) {
                vscode.window.showErrorMessage("Could not connect to the DDCS Gateway backend.");
                return;
            }
            isGatewayReady = true;
        }
        // Instead of opening a webview directly, create an untitled .nc file.
        // VS Code will automatically use our Custom Editor for it!
        const uri = vscode.Uri.parse('untitled:untitled.nc');
        vscode.commands.executeCommand('vscode.openWith', uri, 'ddcs.studioEditor');
    });
    context.subscriptions.push(disposable);
}
function waitForGateway(maxRetries = 20) {
    return new Promise((resolve) => {
        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            if (retries > maxRetries) {
                clearInterval(interval);
                resolve(false);
                return;
            }
            // Read the live gatewayPort each tick — the backend may have reported a fallback port by now.
            const req = http.get(`http://127.0.0.1:${gatewayPort}/api/descriptor`, (res) => {
                if (res.statusCode === 200) {
                    clearInterval(interval);
                    resolve(true);
                }
            });
            req.on('error', () => {
                // Connection refused, just ignore and retry
            });
            req.end();
        }, 500);
    });
}
// Fetch the gateway descriptor over host-side HTTP. Resolves null on any error/timeout/non-200.
function fetchDescriptor(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/api/descriptor`, { timeout: 2000 }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                resolve(null);
                return;
            }
            let body = '';
            res.on('data', (c) => body += c);
            res.on('end', () => { try {
                resolve(JSON.parse(body));
            }
            catch {
                resolve(null);
            } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}
async function updateStatusBar(item) {
    const d = await fetchDescriptor(gatewayPort);
    if (!d) {
        item.text = '$(circle-slash) DDCS: offline';
        item.tooltip = `No gateway answering on 127.0.0.1:${gatewayPort}`;
        return;
    }
    if (d.controller_connected) {
        const name = d.controller_name || d.machine_name || d.controller_family || 'controller';
        const fw = d.controller_firmware ? ` · fw ${d.controller_firmware}` : '';
        item.text = `$(zap) DDCS: ${name}`;
        item.tooltip = `Connected: ${name}${fw}\nbackend ${d.backend} · :${gatewayPort}`;
    }
    else {
        item.text = '$(plug) DDCS: gateway up';
        item.tooltip = `Gateway up (backend ${d.backend}) on :${gatewayPort} — no controller connected`;
    }
}
function deactivate() {
    if (gatewayProcess) {
        gatewayProcess.kill();
    }
}
//# sourceMappingURL=extension.js.map