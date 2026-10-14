// Bundles the extension (Node, CommonJS) and the preview webview script (browser).
// The extension leaves packages external: `tsquare` and its dependencies load
// from node_modules at runtime (it reads its font files from there).
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const builds = [
  {
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    target: "node20",
    packages: "external",
    external: ["vscode"],
  },
  {
    // the webview has no Node and no network: tsquare/viewer is bundled in
    entryPoints: ["src/preview.ts"],
    outfile: "dist/preview.js",
    platform: "browser",
    format: "iife",
    target: "es2022",
  },
].map((b) => ({ bundle: true, sourcemap: true, logLevel: "info", ...b }));

if (watch) for (const b of builds) await (await esbuild.context(b)).watch();
else await Promise.all(builds.map((b) => esbuild.build(b)));
