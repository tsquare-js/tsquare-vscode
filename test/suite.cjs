// Runs inside VS Code's extension host: node test/run.mjs
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");

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

  await test("problems leave the last render up and report a count", async () => {
    const editor = vscode.window.activeTextEditor;
    await editor.edit((e) => e.insert(new vscode.Position(1, 0), "  buton\n"));
    await until(() => ext.exports.lastPreview()?.problems, "a problem count");
    await vscode.commands.executeCommand("undo");
  });

  console.log("\n" + results.join("\n") + "\n");
  if (results.some((r) => r.startsWith("FAIL"))) throw new Error("some tests failed");
};
