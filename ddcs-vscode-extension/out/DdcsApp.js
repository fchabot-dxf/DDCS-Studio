"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DdcsApp = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const dlog_1 = require("./dlog");
/**
 * DdcsApp — the DDCS authoring tool, hosted as a WebviewPanel (NOT a custom editor). Each launch opens
 * the blocks/wizard panel PLUS a normal untitled `.nc` text editor in a new tab; the app generates G-code
 * INTO that `.nc` (the host applies the edits). The panel is the tool (nothing to save); the `.nc` is the
 * program you save.
 *
 * Settings are HOST-OWNED: the app mirrors its settings up here, the host persists them (globalState) and
 * seeds them into every webview it creates (app + preview), so all windows share one source of truth and
 * the preview gets the right stock/WCS context. (Each VS Code webview has isolated localStorage, so this
 * seeding is the only way to share it.)
 */
class DdcsApp {
    context;
    getPort;
    diagnostics;
    previews = new Map();
    appCounter = 0;
    settingsStore = {};
    constructor(context, getPort, diagnostics) {
        this.context = context;
        this.getPort = getPort;
        this.diagnostics = diagnostics;
        const saved = context.globalState.get('ddcsSettings');
        if (saved) {
            this.settingsStore = saved;
        }
    }
    /** Launch the app: the tool panel + a paired `.nc` G-code editor in a new tab beside it. */
    async launch() {
        (0, dlog_1.dlog)(`[host] launch() start (counter=${this.appCounter})`);
        this.appCounter += 1;
        const uri = vscode.Uri.parse(`untitled:DDCS-program-${this.appCounter}.nc`);
        const document = await vscode.workspace.openTextDocument(uri);
        (0, dlog_1.dlog)(`[host] launch: doc opened ${document.uri.toString()}`);
        const panel = vscode.window.createWebviewPanel('ddcs.app', 'DDCS Extension', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: this.roots() });
        (0, dlog_1.dlog)('[host] launch: panel created');
        panel.webview.html = this.getAppHtml(panel.webview);
        this.wireApp(panel, document);
        // The G-code editor — a normal text tab in column two; the program is generated into here.
        await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true });
        (0, dlog_1.dlog)('[host] launch: done');
    }
    roots() {
        return [
            vscode.Uri.file(path.join(this.context.extensionPath, 'web')),
            vscode.Uri.file(path.join(this.context.extensionPath, '..', 'DDCS-Studio', 'web')),
        ];
    }
    wireApp(panel, document) {
        const updateWebview = () => panel.webview.postMessage({ type: 'update', text: document.getText() });
        const changeSub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
                const pv = this.previews.get(document.uri.toString());
                if (pv) {
                    pv.webview.postMessage({ type: 'gcode', text: document.getText() });
                }
            }
        });
        panel.onDidDispose(() => {
            changeSub.dispose();
            this.diagnostics.delete(document.uri);
            const pv = this.previews.get(document.uri.toString());
            if (pv) {
                pv.dispose();
            }
        });
        panel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'documentChanged':
                    this.updateTextDocument(document, e.text);
                    return;
                case 'diagnostics':
                    this.publishDiagnostics(document, e.items);
                    return;
                case 'log':
                    (0, dlog_1.dlog)('[webview] ' + (e.text || ''));
                    return;
                case 'settings':
                    // The app mirrors its settings up — the host is the source of truth (persist + reuse).
                    if (e.store) {
                        this.settingsStore = e.store;
                        this.context.globalState.update('ddcsSettings', e.store);
                    }
                    return;
                case 'openPreview':
                    this.openPreview(document, e.start);
                    return;
            }
        });
        updateWebview();
    }
    /** Apply the app's generated G-code to the paired `.nc` document (whole-doc replace). */
    updateTextDocument(document, text) {
        if (document.getText() === text) {
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
        return vscode.workspace.applyEdit(edit);
    }
    /** Publish linter findings (computed in the webview) to the Problems panel for the G-code document. */
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
    /** Open (or reveal) the pop-out toolpath preview window for this program's G-code. */
    async openPreview(document, start) {
        const key = document.uri.toString();
        const existing = this.previews.get(key);
        if (existing) {
            existing.reveal(vscode.ViewColumn.Three, true);
            return;
        }
        // Reshape into: [ col1 | col2{ top, bottom } ] so the preview opens BELOW the G-code editor.
        // Group order is left→right, top→bottom, so col1=VC1 (app), col2-top=VC2 (G-code), col2-bottom=VC3.
        await vscode.commands.executeCommand('vscode.setEditorLayout', {
            orientation: 0,
            groups: [{}, { groups: [{}, {}] }],
        });
        const panel = vscode.window.createWebviewPanel('ddcs.preview', 'DDCS Preview', { viewColumn: vscode.ViewColumn.Three, preserveFocus: true }, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: this.roots() });
        this.previews.set(key, panel);
        panel.webview.html = this.getPreviewHtml(panel.webview);
        panel.webview.onDidReceiveMessage((e) => {
            if (e && e.type === 'previewReady') {
                panel.webview.postMessage({ type: 'gcode', text: document.getText(), start: start || null });
            }
            else if (e && e.type === 'log') {
                (0, dlog_1.dlog)(e.text || '');
            }
        });
        panel.onDidDispose(() => { this.previews.delete(key); });
    }
    // ---- webview HTML ------------------------------------------------------------------------------
    /** Seed script that restores the host-owned settings into a webview's localStorage before its bundle. */
    settingsSeed() {
        return `<script>try{var s=${JSON.stringify(this.settingsStore).replace(/</g, '\\u003c')};for(var k in s){localStorage.setItem(k,s[k]);}}catch(e){}</script>`;
    }
    rewriteAssets(webview, webPath, html) {
        return html.replace(/(src|href)="([^"]+)"/g, (match, attr, rel) => {
            if (rel.startsWith('http') || rel.startsWith('data:') || rel.startsWith('vscode-webview:') || rel.startsWith('#')) {
                return match;
            }
            const abs = path.resolve(webPath, rel);
            return `${attr}="${webview.asWebviewUri(vscode.Uri.file(abs)).toString()}"`;
        });
    }
    getAppHtml(webview) {
        const webPath = path.join(this.context.extensionPath, 'web');
        let html = this.rewriteAssets(webview, webPath, fs.readFileSync(path.join(webPath, 'extension_index.html'), 'utf8'));
        const apiBase = `http://127.0.0.1:${this.getPort()}`;
        const csp = `<meta http-equiv="Content-Security-Policy" content="`
            + `default-src 'none'; img-src ${webview.cspSource} https: data: blob:; media-src ${webview.cspSource} https: data: blob:; `
            + `style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; `
            + `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; worker-src ${webview.cspSource} blob:; `
            + `connect-src ${webview.cspSource} https: http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*;">`;
        html = html.replace('<head>', `<head>${csp}${this.settingsSeed()}`);
        const injection = `
            <script>
                window.__ddcsApiBase = ${JSON.stringify(apiBase)};
                window.vscode = acquireVsCodeApi();
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'update') {
                        window.dispatchEvent(new CustomEvent('vscode:updateDocument', { detail: message.text }));
                    }
                });
            </script>`;
        html = html.replace('</head>', `${injection}</head>`);
        return html;
    }
    getPreviewHtml(webview) {
        const webPath = path.join(this.context.extensionPath, 'web');
        let html = this.rewriteAssets(webview, webPath, fs.readFileSync(path.join(webPath, 'preview.html'), 'utf8'));
        const csp = `<meta http-equiv="Content-Security-Policy" content="`
            + `default-src 'none'; img-src ${webview.cspSource} https: data: blob:; media-src ${webview.cspSource} https: data: blob:; `
            + `style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; `
            + `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; worker-src ${webview.cspSource} blob:; `
            + `connect-src ${webview.cspSource} https: http://127.0.0.1:* http://localhost:*;">`;
        html = html.replace('<head>', `<head>${csp}${this.settingsSeed()}`);
        html = html.replace('</head>', `<script>window.vscode = acquireVsCodeApi();</script></head>`);
        return html;
    }
}
exports.DdcsApp = DdcsApp;
//# sourceMappingURL=DdcsApp.js.map