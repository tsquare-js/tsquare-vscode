// Packages the VSIX, unpacks it outside the repo (so nothing can load from node_modules),
// checks what's inside, and runs the integration tests against it: node test/vsix.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { name, version } = JSON.parse(execFileSync("node", ["-p", "JSON.stringify(require('./package.json'))"], { cwd: root, encoding: "utf8" }));
const vsix = path.join(root, `${name}-${version}.vsix`);
execFileSync("npx", ["vsce", "package", "--no-dependencies", "--out", vsix], { cwd: root, stdio: "ignore" });

const dir = mkdtempSync(path.join(tmpdir(), "tsquare-vsix-"));
try {
  execFileSync("unzip", ["-q", vsix, "-d", dir]);
  const ext = path.join(dir, "extension");
  const files = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : [path.relative(ext, path.join(d, e.name))]));
  const all = files(ext);
  const expect = ["dist/extension.js", "dist/preview.js", "dist/THIRD_PARTY_LICENSES.txt", "dist/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff", "dist/node_modules/@fontsource/inter/files/inter-latin-600-normal.woff", "dist/node_modules/@fontsource/inter/LICENSE", "LICENSE.txt", "readme.md", "package.json"] // vsce renames LICENSE and README.md;
  const missing = expect.filter((f) => !all.includes(f));
  const unexpected = all.filter((f) => /(^|\/)(src|test|\.github|\.vscode)\/|\.map$|^node_modules\//.test(f));
  console.log(`VSIX: ${all.length} files, ${(statSync(vsix).size / 1024).toFixed(0)} KB`);
  if (missing.length || unexpected.length) throw new Error(`missing: ${missing.join(", ") || "none"}; shouldn't be there: ${unexpected.join(", ") || "none"}`);
  const r = spawnSync("node", [path.join(root, "test", "run.mjs")], { stdio: "inherit", env: { ...process.env, EXTENSION_PATH: ext } });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
