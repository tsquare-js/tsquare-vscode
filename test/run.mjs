// Runs test/suite.cjs in the installed VS Code (no download), in a throwaway profile,
// against this folder or, with EXTENSION_PATH, an unpacked VSIX.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = process.env.VSCODE_BIN ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
const profile = mkdtempSync(path.join(tmpdir(), "tsquare-vscode-test-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(code, [
  `--extensionDevelopmentPath=${process.env.EXTENSION_PATH ?? path.resolve(here, "..")}`, // EXTENSION_PATH: an unpacked VSIX (test/vsix.mjs)
  `--extensionTestsPath=${path.join(here, "suite.cjs")}`,
  `--user-data-dir=${profile}`,
  `--extensions-dir=${path.join(profile, "extensions")}`,
  "--disable-workspace-trust",
  "--skip-welcome", "--skip-release-notes",
  path.join(path.dirname(createRequire(import.meta.url).resolve("tsquare/package.json")), "examples"),
], { stdio: "inherit", env });
rmSync(profile, { recursive: true, force: true });
process.exit(r.status ?? 1);
