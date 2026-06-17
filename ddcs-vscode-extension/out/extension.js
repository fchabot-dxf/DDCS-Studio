"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function activate(context) {
    console.log('DDCS Studio Prototype is now active!');
    let disposable = vscode.commands.registerCommand('ddcs.openWizard', () => {
        // We define the two folders the Webview is allowed to read from:
        const extensionWebPath = path.join(context.extensionPath, 'web');
        const studioWebPath = path.join(context.extensionPath, '../DDCS-Studio/web');
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel('ddcsWizard', 'DDCS Studio Wizards', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            // Grant access to BOTH the extension's web folder and the shared Studio web folder
            localResourceRoots: [
                vscode.Uri.file(extensionWebPath),
                vscode.Uri.file(studioWebPath)
            ]
        });
        // Set the HTML content for the webview
        panel.webview.html = getRealWebviewContent(panel.webview, extensionWebPath);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'insertCode':
                    insertCodeToEditor(message.text);
                    return;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
function insertCodeToEditor(text) {
    vscode.workspace.openTextDocument({ content: text, language: 'plaintext' }).then(document => {
        vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    });
}
function getRealWebviewContent(webview, extensionWebPath) {
    // 1. Read the new stripped-down index file we just generated
    const indexPath = path.join(extensionWebPath, 'extension_index.html');
    let htmlContent = fs.readFileSync(indexPath, 'utf8');
    // 2. Regex magic: Find all src="..." and href="..." that are relative paths
    htmlContent = htmlContent.replace(/(src|href)="([^"h#d][^"]*)"/g, (match, attr, relativePath) => {
        // Ignore absolute URLs like http://, data:, or vscode-webview://
        if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('vscode-webview:')) {
            return match;
        }
        // Resolve the relative path (e.g. "../../DDCS-Studio/web/styles.css") 
        // into an absolute hard drive path
        const absolutePath = path.resolve(extensionWebPath, relativePath);
        // Convert the hard drive path into a secure VS Code URI
        const webviewUri = webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
        return `${attr}="${webviewUri}"`;
    });
    // We inject a tiny script to capture the VS Code API globally
    const injection = `
        <script>
            // Store VS Code API globally so existing DDCS scripts can talk to the editor
            window.vscode = acquireVsCodeApi();
        </script>
    `;
    htmlContent = htmlContent.replace('</head>', `${injection}</head>`);
    return htmlContent;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map