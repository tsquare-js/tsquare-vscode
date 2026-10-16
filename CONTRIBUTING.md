# Contributing

## How it relates to tsquare

The extension depends on the [`tsquare`](https://www.npmjs.com/package/tsquare) package, pinned to one release, and gets everything from it: parsing and checking, rendering (`renderWireframeSvg`, `boardLayout`), autocomplete data (`languageData`), share links (`encodeWireframe`) and the preview's viewer (`tsquare/viewer`). The language itself lives in the [tsquare repo](https://github.com/tsquare-js/tsquare). Only the highlighting grammar (`syntaxes/`) is written here, and its test runs over every example shipped with the pinned version, so a language change shows up as a failing test when the pin is bumped.

## Develop

```bash
npm install
npm run build
```

Open this folder in VS Code and press F5 (or Ctrl+F5 to run without the debugger). That opens a second window with the extension loaded and tsquare's examples open. Or launch it from a terminal:

```bash
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --extensionDevelopmentPath="$PWD" node_modules/tsquare/examples
```

To try a change to the tsquare library before it's released, point the extension at a local checkout without saving it to `package.json`: `npm install ../tsquare --no-save` (rebuild the library first), then `npm run build`. `npm ci` puts the pinned release back.

## Package

```bash
npm run package
```

One VSIX for every platform, about 565 KB. It builds a production bundle first (`vscode:prepublish`): tsquare and its dependencies are bundled into `dist/extension.js`, the two Inter font files tsquare reads from disk go in `dist/node_modules/@fontsource/inter/` with the font's license, and `dist/THIRD_PARTY_LICENSES.txt` collects the license, any NOTICE file, and where the source is for every bundled package. A package that ships no license file needs its notice in `licenses/<name>.txt` (with where it comes from), or the build stops. `.vscodeignore` keeps sources, tests and `node_modules` out. Install the result with **Extensions: Install from VSIX…**, or `code --install-extension tsquare-vscode-<version>.vsix`. CI builds one on every push (the run's `vsix` artifact).

## Test

- `npm test`: the typecheck, the grammar test (`test/grammar.mjs`, with VS Code's TextMate engine) and the integration tests in your installed VS Code (`test/run.mjs`: a throwaway profile, nothing downloaded; set `VSCODE_BIN` to use another build).
- `npm run test:vsix`: packages the VSIX, unpacks it outside the repo, checks what's inside, and runs the same integration tests against it. It needs macOS or Linux (it uses `unzip` and a local VS Code); the VSIX itself works everywhere.

CI runs the typecheck and the grammar test, and builds the VSIX.

## Release

See [RELEASING.md](RELEASING.md).
