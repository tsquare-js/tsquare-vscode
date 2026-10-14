// Tokenizes sample lines (and every example shipped with tsquare) with VS Code's TextMate engine and checks the scopes: node test/grammar.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import vsctm from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const require = createRequire(import.meta.url);
await oniguruma.loadWASM(readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer);
const registry = new vsctm.Registry({
  onigLib: Promise.resolve({ createOnigScanner: (p) => new oniguruma.OnigScanner(p), createOnigString: (s) => new oniguruma.OnigString(s) }),
  loadGrammar: async () => vsctm.parseRawGrammar(readFileSync(new URL("../syntaxes/tsquare.tmLanguage.json", import.meta.url), "utf8"), "x.json"),
});
const grammar = await registry.loadGrammar("source.tsquare");

/** "text" → its last scope (without .tsquare), for each token that isn't whitespace. */
function tokens(line) {
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
  return tokens
    .map((t) => [line.slice(t.startIndex, t.endIndex), t.scopes.at(-1).replace(/\.tsquare$/, "")])
    .filter(([text]) => text.trim());
}
/** The scopes covering every character of `text` (its first occurrence) must include `scope`. */
function hasScope(line, text, scope) {
  const start = line.indexOf(text);
  const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
  return start >= 0 && tokens
    .filter((t) => t.endIndex > start && t.startIndex < start + text.length)
    .every((t) => t.scopes.includes(`${scope}.tsquare`));
}

const cases = [
  ['board "Analytics" accent=#1a73e8', { board: "entity.name.type", '"Analytics"': "string.quoted.double", accent: "entity.other.attribute-name", "#1a73e8": "constant.other.color.rgb-value.hex" }],
  ["# a comment line", { "# a comment line": "comment.line.number-sign" }],
  ["    button primary \"Sign in\" #signin fullWidth", { button: "entity.name.type", primary: "support.constant", '"Sign in"': "string.quoted.double", "#signin": "entity.name.label", fullWidth: "support.constant" }],
  ["    table columns=[Order, Total] data=[[\"#1042\", \"$120\"]]", { "[": "punctuation.section.brackets", ",": "punctuation.separator.comma", Order: "support.constant" }],
  ["    tabs items=[#1001, Don't save] active=7", { "#1001": "support.constant", "Don't": "support.constant", "7": "constant.numeric" }],
  ["  flow signin -> home \"Tap\" dashed", { flow: "entity.name.type", "->": "keyword.operator.arrow", '"Tap"': "string.quoted.double" }],
  ["    toggle \"Wi-Fi\" on=true", { "true": "constant.language" }],
  ["```tsquare", { "```tsquare": "comment.line.fence" }],
];
let failed = 0;
for (const [line, expected] of cases) {
  for (const [text, scope] of Object.entries(expected)) {
    if (hasScope(line, text, scope)) continue;
    failed++;
    console.log(`FAIL ${JSON.stringify(line)}: ${text} isn't ${scope}\n     ${JSON.stringify(tokens(line))}`);
  }
}
console.log(failed ? `${failed} wrong` : `ok   grammar: ${cases.length} lines`);

// Drift check: the examples shipped with the pinned tsquare use the current language.
// Every character outside whitespace must get a scope, and each element line must start with a component.
const examples = path.join(path.dirname(require.resolve("tsquare/package.json")), "examples");
let lines = 0, unscoped = 0;
for (const file of readdirSync(examples).filter((f) => f.endsWith(".tsq"))) {
  readFileSync(path.join(examples, file), "utf8").split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    lines++;
    const { tokens } = grammar.tokenizeLine(line, vsctm.INITIAL);
    const bare = tokens.filter((t) => t.scopes.length === 1 && line.slice(t.startIndex, t.endIndex).trim());
    const first = tokens.find((t) => line.slice(t.startIndex, t.endIndex).trim());
    const ok = !bare.length && (first.scopes.some((sc) => sc.startsWith("comment.")) || first.scopes.includes("entity.name.type.tsquare"));
    if (!ok) { unscoped++; console.log(`FAIL ${file}:${i + 1}: ${JSON.stringify(line.trim())}`); }
  });
}
console.log(unscoped ? `${unscoped} example lines not fully highlighted` : `ok   grammar: all ${lines} lines of tsquare's examples`);
failed += unscoped;
process.exit(failed ? 1 : 0);
