import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('DDCS Studio Prototype is now active!');

    let disposable = vscode.commands.registerCommand('ddcs.openWizard', () => {
        // We define the two folders the Webview is allowed to read from:
        const extensionWebPath = path.join(context.extensionPath, 'web');
        const studioWebPath = path.join(context.extensionPath, '../DDCS-Studio/web');

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'ddcsWizard', 
            'DDCS Studio Wizards', 
            vscode.ViewColumn.Beside, 
            {
                enableScripts: true, 
                retainContextWhenHidden: true, 
                // Grant access to BOTH the extension's web folder and the shared Studio web folder
                localResourceRoots: [
                    vscode.Uri.file(extensionWebPath),
                    vscode.Uri.file(studioWebPath)
                ]
            }
        );

        // Set the HTML content for the webview
        panel.webview.html = getRealWebviewContent(panel.webview, extensionWebPath);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'insertCode':
                        insertCodeToEditor(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function insertCodeToEditor(text: string) {
    vscode.workspace.openTextDocument({ content: text, language: 'plaintext' }).then(document => {
        vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    });
}

function getRealWebviewContent(webview: vscode.Webview, extensionWebPath: string): string {
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

export function deactivate() {}
