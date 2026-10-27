// Runs inside VS Code's extension host: node test/run.mjs
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");
const { compileWireframe, encodeWireframe, renderWireframeSvg } = require("tsquare");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

exports.run = async function run() {
  const results = [];
  const test = async (name, fn) => {
    try { await fn(); results.push(`ok   ${name}`); }
    catch (e) { results.push(`FAIL ${name}: ${e.message}`); }
  };
  const examples = path.join(path.dirname(require.resolve("tsquare/package.json")), "examples"); // shipped in the package
  const doc = await vscode.workspace.openTextDocument(path.join(examples, "dashboard.tsq"));
  await vscode.window.showTextDocument(doc);
  const ext = vscode.extensions.getExtension("tsquare-js.tsquare-vscode");

  await test(".tsq opens as tsquare and activates the extension", async () => {
    assert.equal(doc.languageId, "tsquare");
    await until(() => ext.isActive, "activation");
  });

  await test("a valid file has no problems", async () => {
    await sleep(400);
    assert.deepEqual(vscode.languages.getDiagnostics(doc.uri), []);
  });

  await test("a typo shows a problem on its line", async () => {
    const bad = await vscode.workspace.openTextDocument({ language: "tsquare", content: 'board "X"\n  screen phone\n    buton "Hi"\n' });
    const diags = await until(() => { const d = vscode.languages.getDiagnostics(bad.uri); return d.length && d; }, "diagnostics");
    assert.equal(diags[0].range.start.line, 2);
    assert.match(diags[0].message, /button/);
  });

  await test("completions: components at the start of a line, values after =", async () => {
    const d = await vscode.workspace.openTextDocument({ language: "tsquare", content: 'board "X"\n  screen phone\n    but\n    button primary leadingIcon=hom\n' });
    const a = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", d.uri, new vscode.Position(2, 7));
    assert.ok(a.items.some((i) => i.label === "button"), "button offered");
    const b = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", d.uri, new vscode.Position(3, 34));
    assert.ok(b.items.some((i) => i.label === "home"), "icon names offered");
  });

  await test("the preview renders the board", async () => {
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand("tsquare.showPreviewToSide");
    const last = await until(() => ext.exports.lastPreview()?.width && ext.exports.lastPreview(), "a render");
    assert.ok(last.width > 1000 && last.height > 500, `board size ${last.width}×${last.height}`);
  });

  await test("the preview follows the active .tsq editor", async () => {
    const before = ext.exports.lastPreview().width;
    const other = await vscode.workspace.openTextDocument(path.join(examples, "notes-mobile.tsq"));
    await vscode.window.showTextDocument(other, vscode.ViewColumn.One);
    try { await until(() => ext.exports.lastPreview()?.width && ext.exports.lastPreview().width !== before, "a new render"); }
    catch (e) { throw new Error(`${e.message}; last=${JSON.stringify(ext.exports.lastPreview())} before=${before} active=${vscode.window.activeTextEditor?.document.fileName}`); }
  });

  await test("the preview's size is the board's as drawn, also when notes wrap differently than their length suggests", async () => {
    // a notes-only row in a grid: tsquare's boardLayout estimates note heights; measureBoardLayout measures them
    const wide = "WARNING: MANDATORY REVIEW WINDOW MUST MATCH WORKFLOW WWW MMM QA APPROVAL ".repeat(3).trim();
    const content = ["board layout=grid columns=2", '  screen phone "Top"', `  note "${wide}"`, `  note "${wide}"`, '  note "Short"', '  screen phone "Below"'].join("\n");
    const svg = await renderWireframeSvg(compileWireframe(content).spec, { skipValidation: true });
    const [, width, height] = svg.match(/^<svg width="(\d+)" height="(\d+)"/).map(Number);
    const notes = await vscode.workspace.openTextDocument({ language: "tsquare", content });
    await vscode.window.showTextDocument(notes, vscode.ViewColumn.One);
    await until(() => ext.exports.lastPreview()?.height === height && ext.exports.lastPreview(), `a ${width}×${height} render (last ${JSON.stringify(ext.exports.lastPreview())})`);
    assert.equal(ext.exports.lastPreview().width, width);
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(path.join(examples, "notes-mobile.tsq")), vscode.ViewColumn.One);
  });

  await test("problems leave the last render up and report a count", async () => {
    const editor = vscode.window.activeTextEditor;
    await editor.edit((e) => e.insert(new vscode.Position(1, 0), "  buton\n"));
    await until(() => ext.exports.lastPreview()?.problems, "a problem count");
    await vscode.commands.executeCommand("undo");
  });

  await test("colors: swatches only on the hex values tsquare reads as colors (board accent, flow color)", async () => {
    const d = await vscode.workspace.openTextDocument({ language: "tsquare", content: [
      'board "C" accent=#1a73e8',
      '  screen phone "A" #a',
      '    table columns=[Order, Total] data=[["#1042", "$120"], ["#abcdef", "$5"]]',
      '    text "#123456" accent=#654321',
      '  screen phone "B" #b',
      '  flow a -> b "Go" color="#00AA55"',
      '# board accent=#ff0000',
      '  FLOW b -> a color=#C0FFEE',
      '  flow a -> b color=#c0ffee1',
      "  flow b -> a color='#0000ff'",
      "  flow a -> b color='#ff0000\"",
    ].join("\n") });
    const colors = await vscode.commands.executeCommand("vscode.executeDocumentColorProvider", d.uri);
    const found = colors.map((c) => `${c.range.start.line}:${d.getText(c.range)}`).sort();
    assert.deepEqual(found, ["0:#1a73e8", "5:#00AA55", "7:#C0FFEE", "9:#0000ff"], "not in tables, text, ids, comments, components without a color prop, 7-digit hex, or mismatched quotes");
    const quoted = await vscode.workspace.openTextDocument({ language: "tsquare", content: "board 'D' accent='#1a73e8'" });
    const single = await vscode.commands.executeCommand("vscode.executeDocumentColorProvider", quoted.uri);
    assert.deepEqual(single.map((c) => quoted.getText(c.range)), ["#1a73e8"], "a single-quoted accent");
    const accent = colors.find((c) => c.range.start.line === 0).color;
    assert.deepEqual([accent.red, accent.green, accent.blue].map((v) => Math.round(v * 255)), [0x1a, 0x73, 0xe8]);
    // picking a color in VS Code's picker writes six-digit hex back
    const picked = await vscode.commands.executeCommand("vscode.executeColorPresentationProvider", new vscode.Color(1, 0.5, 0, 0.4), { uri: d.uri, range: colors[0].range });
    assert.equal(picked[0].label, "#ff8000");
  });

  await test("preview menu commands act on the previewed file: the title bar and … menu pass the panel, not a file", async () => {
    // Like the menus: VS Code passes the clicked editor's resource, here the webview panel's
    const panelUri = vscode.Uri.parse("webview-panel:webview-panel/webview-tsquare.preview-test");
    const source = await vscode.workspace.openTextDocument(path.join(examples, "sign-in.tsq"));
    await vscode.window.showTextDocument(source, vscode.ViewColumn.One);
    await vscode.commands.executeCommand("tsquare.showPreviewToSide");
    await until(() => ext.exports.lastPreview()?.width, "a render");
    // Focus is elsewhere on purpose (a plain-text file, so the preview stays on sign-in): a command from the
    // preview's own menu means that preview, whatever has focus. The test window often isn't focused anyway.
    const notes = await vscode.workspace.openTextDocument({ language: "plaintext", content: "notes" });
    await vscode.window.showTextDocument(notes, vscode.ViewColumn.Three);
    await vscode.env.clipboard.writeText("");
    await vscode.commands.executeCommand("tsquare.copyImageLink", panelUri);
    assert.equal(await vscode.env.clipboard.readText(), `https://tsquare.dev/svg/${encodeWireframe(source.getText())}`, "the link is sign-in's");
    await vscode.commands.executeCommand("tsquare.showSource", panelUri);
    await until(() => vscode.window.activeTextEditor?.document.uri.fsPath === source.uri.fsPath, "Show Source to open sign-in.tsq");
  });

  console.log("\n" + results.join("\n") + "\n");
  if (results.some((r) => r.startsWith("FAIL"))) throw new Error("some tests failed");
};
