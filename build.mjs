// Builds dist/: the extension (Node, CommonJS) and the preview's script (browser).
//
// Everything the extension runs is bundled in, tsquare and its dependencies, so the
// VSIX needs no node_modules. One exception: tsquare reads its two Inter font files
// from disk, found with require.resolve("@fontsource/inter/files/…") next to the code,
// so they're copied to dist/node_modules/@fontsource/inter/ (with the font's license),
// where that lookup finds them.
//
//   node build.mjs               development: source maps
//   node build.mjs --production  for the VSIX: minified, plus dist/THIRD_PARTY_LICENSES.txt
//   node build.mjs --watch
import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");
const require = createRequire(import.meta.url);

rmSync("dist", { recursive: true, force: true });

// The fonts tsquare renders with, where its lookup finds them
const FONTS = ["inter-latin-400-normal.woff", "inter-latin-600-normal.woff"];
const fontPackage = path.dirname(path.dirname(require.resolve(`@fontsource/inter/files/${FONTS[0]}`)));
const fontsOut = "dist/node_modules/@fontsource/inter";
mkdirSync(`${fontsOut}/files`, { recursive: true });
for (const f of FONTS) copyFileSync(path.join(fontPackage, "files", f), `${fontsOut}/files/${f}`);
copyFileSync(path.join(fontPackage, "LICENSE"), `${fontsOut}/LICENSE`);
const { version } = JSON.parse(readFileSync(path.join(fontPackage, "package.json"), "utf8"));
// no "exports", so the deep file paths resolve
writeFileSync(`${fontsOut}/package.json`, JSON.stringify({ name: "@fontsource/inter", version, license: "OFL-1.1" }, null, 2) + "\n");

const builds = [
  {
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    target: "node20",
    // the PNG renderer (native) is only loaded by renderWireframePng, which the extension doesn't use
    external: ["vscode", "@resvg/resvg-js"],
    // tsquare finds its fonts relative to import.meta.url, which CommonJS doesn't have
    define: { "import.meta.url": "__import_meta_url" },
    banner: { js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;' },
    metafile: true,
  },
  {
    // the webview has no Node and no network: tsquare/viewer is bundled in
    entryPoints: ["src/preview.ts"],
    outfile: "dist/preview.js",
    platform: "browser",
    format: "iife",
    target: "es2022",
    metafile: true,
  },
].map((b) => ({ bundle: true, minify: production, sourcemap: !production, logLevel: "info", ...b }));

/** The license of every package bundled into dist/, for the notices their licenses ask to ship with copies. */
function thirdPartyLicenses(metafiles) {
  const packages = new Map();
  for (const meta of metafiles) {
    for (const input of Object.keys(meta.inputs)) {
      const m = input.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//);
      if (m) packages.set(m[2], m[1]);
    }
  }
  packages.set("@fontsource/inter", fontPackage); // shipped as files, not bundled
  const sections = [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([name, dir]) => {
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.[\w-]+)?$/i.test(f));
    if (!file && !pkg.license) throw new Error(`${name} has no license file and declares no license; check it by hand`);
    const author = typeof pkg.author === "string" ? pkg.author : pkg.author?.name;
    const text = file
      ? readFileSync(path.join(dir, file), "utf8").trim()
      : `${pkg.license} License${author ? `, ${author}` : ""} (declared in its package.json; the package ships no license file)`;
    return `${name} ${pkg.version} (${pkg.license})\n${"-".repeat(72)}\n${text}\n`;
  });
  return `This extension bundles the packages below (the Inter font as files, under dist/node_modules/@fontsource/inter/).\n\n${sections.join("\n\n")}`;
}

if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  const results = await Promise.all(builds.map((b) => esbuild.build(b)));
  if (production) writeFileSync("dist/THIRD_PARTY_LICENSES.txt", thirdPartyLicenses(results.map((r) => r.metafile)));
}
