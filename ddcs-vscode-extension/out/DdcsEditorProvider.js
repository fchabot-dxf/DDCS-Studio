"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DdcsEditorProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
class DdcsEditorProvider {
    context;
    getPort;
    diagnostics;
    static register(context, getPort, diagnostics) {
        const provider = new DdcsEditorProvider(context, getPort, diagnostics);
        const providerRegistration = vscode.window.registerCustomEditorProvider(DdcsEditorProvider.viewType, provider);
        return providerRegistration;
    }
    static viewType = 'ddcs.studioEditor';
    constructor(context, getPort, diagnostics) {
        this.context = context;
        this.getPort = getPort;
        this.diagnostics = diagnostics;
    }
    /**
     * Called when our custom editor is opened.
     */
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'web')),
                vscode.Uri.file(path.join(this.context.extensionPath, '../DDCS-Studio/web'))
            ]
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        }
        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            this.diagnostics.delete(document.uri);
        });
        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'documentChanged':
                    this.updateTextDocument(document, e.text);
                    return;
                case 'diagnostics':
                    this.publishDiagnostics(document, e.items);
                    return;
            }
        });
        // Initial update
        updateWebview();
    }
    /**
     * Write out the generated G-code changes to the underlying text document.
     */
    updateTextDocument(document, text) {
        if (document.getText() === text) {
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        // Just replace the entire document every time for this prototype.
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
        return vscode.workspace.applyEdit(edit);
    }
    /** Publish linter findings (computed in the webview) to VS Code's Problems panel for this document. */
    publishDiagnostics(document, items) {
        const diags = (items || []).map((it) => {
            const range = new vscode.Range(it.line, it.startCol, it.line, it.endCol);
            const sev = it.severity === 'error' ? vscode.DiagnosticSeverity.Error
                : it.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Information;
            const d = new vscode.Diagnostic(range, it.message, sev);
            d.source = 'DDCS';
            if (it.code) {
                d.code = it.code;
            }
            return d;
        });
        this.diagnostics.set(document.uri, diags);
    }
    /**
     * Get the static html used for the editor webviews.
     */
    getHtmlForWebview(webview) {
        const extensionWebPath = path.join(this.context.extensionPath, 'web');
        const indexPath = path.join(extensionWebPath, 'extension_index.html');
        let htmlContent = fs.readFileSync(indexPath, 'utf8');
        // Regex magic: Find all src="..." and href="..." that are relative paths
        htmlContent = htmlContent.replace(/(src|href)="([^"]+)"/g, (match, attr, relativePath) => {
            // Ignore absolute URLs like http://, data:, or vscode-webview://, or anchor links
            if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('vscode-webview:') || relativePath.startsWith('#')) {
                return match;
            }
            const absolutePath = path.resolve(extensionWebPath, relativePath);
            const webviewUri = webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
            return `${attr}="${webviewUri}"`;
        });
        const apiBase = `http://127.0.0.1:${this.getPort()}`;
        // Content-Security-Policy must appear BEFORE the resources it governs, so inject it right after
        // <head>. Intentionally permissive — this is a localhost dev prototype with inline scripts and
        // inline event handlers (onclick="…"), so script-src needs 'unsafe-inline'. connect-src opens
        // localhost so the shared client.js seam can reach the Python gateway (http + ws). Tighten before ship.
        const csp = `<meta http-equiv="Content-Security-Policy" content="`
            + `default-src 'none'; `
            + `img-src ${webview.cspSource} https: data: blob:; `
            + `style-src ${webview.cspSource} 'unsafe-inline'; `
            + `font-src ${webview.cspSource} data:; `
            + `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; `
            + `worker-src ${webview.cspSource} blob:; `
            + `connect-src http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*;`
            + `">`;
        htmlContent = htmlContent.replace('<head>', `<head>${csp}`);
        // Inject VS Code API + Message listener + the gateway API base (consumed by client.js's seam).
        const injection = `
            <script>
                // The Python gateway the webview's shared client.js should talk to (client seam base URL).
                window.__ddcsApiBase = ${JSON.stringify(apiBase)};

                // Store VS Code API globally
                window.vscode = acquireVsCodeApi();

                // Listen for messages from the Extension Host
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'update') {
                        // Dispatch a custom event that extensionApp.js can listen for
                        window.dispatchEvent(new CustomEvent('vscode:updateDocument', { detail: message.text }));
                    }
                });
            </script>
        `;
        htmlContent = htmlContent.replace('</head>', `${injection}</head>`);
        return htmlContent;
    }
}
exports.DdcsEditorProvider = DdcsEditorProvider;
//# sourceMappingURL=DdcsEditorProvider.js.map