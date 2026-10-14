/**
 * tsquare for VS Code: problems as you type, autocomplete, and a live preview
 * beside the editor. Rendering runs here, in the extension host, with the same
 * library code as the CLI (the `tsquare` package); nothing is sent anywhere unless the user copies or
 * opens a link.
 */
import * as vscode from "vscode";
import { boardLayout, compileWireframe, encodeWireframe, languageData, renderWireframePng, renderWireframeSvg } from "tsquare";
import { completionProvider } from "./completions.js";

const LANGUAGE = "tsquare";
const VIEW_TYPE = "tsquare.preview";
const BASE = "https://tsquare.dev";

const isTsquare = (doc: vscode.TextDocument) => doc.languageId === LANGUAGE;

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE);
  const zoomStatus = vscode.window.createStatusBarItem("tsquare.zoom", vscode.StatusBarAlignment.Right, 100);
  zoomStatus.name = "tsquare Preview Zoom";
  zoomStatus.command = "tsquare.fit";
  zoomStatus.tooltip = "Fit to window";
  const previews = new PreviewManager(context, zoomStatus);
  context.subscriptions.push(diagnostics, zoomStatus, previews);

  // ── Problems ──
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const check = (doc: vscode.TextDocument) => {
    if (!isTsquare(doc)) return;
    const { issues } = compileWireframe(doc.getText());
    diagnostics.set(doc.uri, issues.map((i) => {
      const line = doc.lineAt(Math.min(Math.max(i.line - 1, 0), doc.lineCount - 1));
      const range = line.isEmptyOrWhitespace ? line.range : new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex, line.lineNumber, line.text.trimEnd().length);
      const d = new vscode.Diagnostic(range, i.message, vscode.DiagnosticSeverity.Error);
      d.source = "tsquare";
      return d;
    }));
  };
  const schedule = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); check(doc); }, 200));
  };
  vscode.workspace.textDocuments.forEach(check);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => { if (isTsquare(e.document)) { schedule(e.document); previews.changed(e.document); } }),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)),
    vscode.window.onDidChangeActiveTextEditor((editor) => { if (editor && isTsquare(editor.document)) previews.follow(editor.document); }),
  );

  // ── Autocomplete ──
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(LANGUAGE, completionProvider(languageData()), " ", "=", "[", ",", "{"),
  );

  // ── Commands ──
  /** The document a command acts on: the active tsquare editor, else the active preview's source. */
  const target = async (uri?: vscode.Uri) => {
    // Menus pass the clicked resource: a .tsq file from the Explorer, but the panel itself
    // (webview-panel:…) from the preview's title bar and … menu, which isn't a document.
    if (uri instanceof vscode.Uri && uri.scheme !== "webview-panel") return vscode.workspace.openTextDocument(uri);
    const editor = vscode.window.activeTextEditor;
    if (editor && isTsquare(editor.document)) return editor.document;
    return previews.activeDocument();
  };
  const command = (id: string, run: (doc: vscode.TextDocument) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, async (uri?: vscode.Uri) => {
      const doc = await target(uri);
      if (doc) return run(doc);
      vscode.window.showInformationMessage("Open a .tsq file first.");
    }));

  command("tsquare.showPreviewToSide", (doc) => previews.show(doc, vscode.ViewColumn.Beside));
  command("tsquare.showPreview", (doc) => previews.show(doc, vscode.ViewColumn.Active));
  command("tsquare.showSource", (doc) => vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One }));
  command("tsquare.copyImageLink", async (doc) => {
    if (!(await valid(doc))) return;
    await vscode.env.clipboard.writeText(`${BASE}/svg/${encodeWireframe(doc.getText())}`);
    vscode.window.setStatusBarMessage("$(check) Copied the image link", 2500);
  });
  command("tsquare.openInPlayground", (doc) => vscode.env.openExternal(vscode.Uri.parse(`${BASE}/playground#${encodeWireframe(doc.getText())}`)));
  command("tsquare.exportSvg", (doc) => exportImage(doc, "svg"));
  command("tsquare.exportPng", (doc) => exportImage(doc, "png"));
  context.subscriptions.push(vscode.commands.registerCommand("tsquare.fit", () => previews.post({ type: "fit" })));

  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
    async deserializeWebviewPanel(panel, state: { uri?: string } | undefined) {
      if (!state?.uri) return panel.dispose();
      try { previews.restore(panel, await vscode.workspace.openTextDocument(vscode.Uri.parse(state.uri))); }
      catch { panel.dispose(); }
    },
  }));

  /** For the integration test (test/suite.cjs): what the preview last sent to its webview. */
  return { lastPreview: () => previews.last };
}

export function deactivate() {}

/** False (and shows the first problem) when the text has problems. */
async function valid(doc: vscode.TextDocument) {
  const { issues } = compileWireframe(doc.getText());
  if (!issues.length) return true;
  const choice = await vscode.window.showErrorMessage(
    `${doc.fileName.split(/[\\/]/).pop()} has ${issues.length} problem${issues.length === 1 ? "" : "s"}. Line ${issues[0].line}: ${issues[0].message}`,
    "Show Problems",
  );
  if (choice) vscode.commands.executeCommand("workbench.actions.view.problems");
  return false;
}

async function exportImage(doc: vscode.TextDocument, format: "svg" | "png") {
  if (!(await valid(doc))) return;
  const { spec } = compileWireframe(doc.getText());
  const defaultUri = doc.uri.with({ path: doc.uri.path.replace(/\.tsq$/i, "") + `.${format}` });
  const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { [format.toUpperCase()]: [format] } });
  if (!uri) return;
  const bytes = format === "svg"
    ? new TextEncoder().encode(await renderWireframeSvg(spec!, { skipValidation: true }))
    : await renderWireframePng(spec!, { skipValidation: true, scale: 2 });
  await vscode.workspace.fs.writeFile(uri, bytes);
  const choice = await vscode.window.showInformationMessage(`Saved ${uri.path.split("/").pop()}`, "Open");
  if (choice) vscode.commands.executeCommand("vscode.open", uri);
}

// ── Preview ─────────────────────────────────────────────────────────────

type ToWebview =
  | { type: "render"; svg: string; width: number; height: number; items: unknown[] }
  | { type: "problems"; count: number }
  | { type: "fit" }
  | { type: "source"; uri: string };

/**
 * One preview panel that follows the active .tsq editor, like VS Code's
 * Markdown preview. The webview gets an SVG string per render and draws it
 * with the playground's viewer (zoom, pan, screen chips).
 */
class PreviewManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private doc: vscode.TextDocument | undefined;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposables: vscode.Disposable[] = [];
  /** What the webview was last sent: a board's size, or a problem count. */
  last: { width?: number; height?: number; problems?: number } | undefined;

  constructor(private context: vscode.ExtensionContext, private zoomStatus: vscode.StatusBarItem) {}

  show(doc: vscode.TextDocument, column: vscode.ViewColumn) {
    if (this.panel) {
      this.panel.reveal(column === vscode.ViewColumn.Beside ? undefined : column, true);
      this.follow(doc);
      return;
    }
    const panel = vscode.window.createWebviewPanel(VIEW_TYPE, "", { viewColumn: column, preserveFocus: true }, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist"), vscode.Uri.joinPath(this.context.extensionUri, "media")],
    });
    this.restore(panel, doc);
  }

  restore(panel: vscode.WebviewPanel, doc: vscode.TextDocument) {
    this.panel = panel;
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, "media", "tsquare.svg");
    panel.webview.html = this.html(panel.webview);
    this.disposables.push(
      panel.onDidDispose(() => { this.panel = undefined; this.zoomStatus.hide(); this.disposables.forEach((d) => d.dispose()); this.disposables = []; }),
      panel.onDidChangeViewState(() => { if (panel.active) this.zoomStatus.show(); else this.zoomStatus.hide(); }),
      panel.webview.onDidReceiveMessage((m) => this.receive(m)),
    );
    if (panel.active) this.zoomStatus.show();
    this.follow(doc);
  }

  /** Show another document (the preview follows the active .tsq editor). */
  follow(doc: vscode.TextDocument) {
    if (!this.panel) return;
    const switched = this.doc?.uri.toString() !== doc.uri.toString();
    this.doc = doc;
    this.panel.title = `Preview ${doc.uri.path.split("/").pop()}`;
    this.post({ type: "source", uri: doc.uri.toString() }); // kept in the webview's state, to restore the preview after a reload
    if (switched) this.render();
  }

  changed(doc: vscode.TextDocument) {
    if (!this.panel || doc.uri.toString() !== this.doc?.uri.toString()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.render(), 150);
  }

  activeDocument() {
    return this.panel?.active ? this.doc : undefined;
  }

  post(message: ToWebview) {
    this.panel?.webview.postMessage(message);
  }

  private async render() {
    const doc = this.doc;
    if (!doc || !this.panel) return;
    const mine = ++this.seq;
    const { spec, issues } = compileWireframe(doc.getText());
    if (!spec || issues.length) {
      this.last = { problems: issues.length };
      return this.post({ type: "problems", count: issues.length });
    }
    try {
      const svg = await renderWireframeSvg(spec, { skipValidation: true });
      if (mine !== this.seq) return; // a newer edit is already rendering
      const { width, height, items } = boardLayout(spec);
      this.last = { width, height };
      this.post({ type: "render", svg, width, height, items });
    } catch (err) {
      vscode.window.showErrorMessage(`tsquare couldn't render ${doc.uri.path.split("/").pop()}: ${(err as Error).message}`);
    }
  }

  private receive(m: { type: string; scale?: number }) {
    if (m.type === "ready") this.render(); // the webview (re)loaded; send the current board
    if (m.type === "zoom" && m.scale) this.zoomStatus.text = `${Math.round(m.scale * 100)}%`;
    if (m.type === "problems") vscode.commands.executeCommand("workbench.actions.view.problems");
  }

  private html(webview: vscode.Webview) {
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const asset = (...p: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, ...p));
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${asset("media", "preview.css")}">
</head>
<body>
<div class="screens" id="screens" aria-label="Zoom to a screen"></div>
<div class="stage" id="stage"><div class="canvas" id="canvas"></div><div class="empty" id="empty">Rendering…</div></div>
<button class="problems" id="problems" type="button" hidden></button>
<script nonce="${nonce}" src="${asset("dist", "preview.js")}"></script>
</body>
</html>`;
  }

  dispose() {
    this.panel?.dispose();
  }
}
