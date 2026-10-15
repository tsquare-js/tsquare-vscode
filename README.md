# tsquare for VS Code

Highlighting, problems and a live preview for [tsquare](https://tsquare.dev) wireframes (`.tsq` files). Not published yet.

- **Language:** `.tsq` files open as tsquare, with highlighting, `#` line comments (Cmd+/), and autocomplete for components, props, option words, icons and accents.
- **Colors:** the board's `accent=#…` and a flow's `color=#…` get a swatch and VS Code's color picker. Nothing else does: VS Code's default swatches are off, so an order number like `"#1042"` in a table isn't shown as a color.
- **Problems:** the file is checked as you type. Each problem is a squiggle on its line and an entry in the Problems panel, with the same message `tsquare check` prints.
- **Preview:** Open Preview to the Side (Cmd+K V, or the button in the editor's title bar), like Markdown's. It renders on your machine, with nothing sent anywhere, follows the active `.tsq` editor, and keeps the last valid render while there are problems. Zoom, pan and the screen chips come from `tsquare/viewer`, the playground's viewer. The zoom level is in the status bar; click it to fit the board.
- **Commands** (the preview's `…` menu and the Command Palette): Copy Image Link (a tsquare.dev SVG link; change `/svg/` to `/png/` for a PNG), Open in Playground, Export SVG.

## How it relates to tsquare

The extension depends on the [`tsquare`](https://www.npmjs.com/package/tsquare) package, pinned to one release, and gets everything from it: parsing and checking, rendering (`renderWireframeSvg`, `boardLayout`), autocomplete data (`languageData`), share links (`encodeWireframe`) and the preview's viewer (`tsquare/viewer`). The language itself lives in the [tsquare repo](https://github.com/tsquare-js/tsquare). Only the highlighting grammar (`syntaxes/`) is written here, and its test runs over every example shipped with the pinned version, so a language change shows up as a failing test when the pin is bumped.

## Develop

```bash
npm install
npm run build
```

Open this folder in VS Code and press F5. That opens a second window with the extension loaded and tsquare's examples open. Or launch it from a terminal:

```bash
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --extensionDevelopmentPath="$PWD" node_modules/tsquare/examples
```

**Package** a VSIX (about 565 KB, one file for every platform):

```bash
npm run package
```

It builds a production bundle first (`vscode:prepublish`): tsquare and its dependencies are bundled into `dist/extension.js`, the two Inter font files tsquare reads from disk go in `dist/node_modules/@fontsource/inter/` with the font's license, and `dist/THIRD_PARTY_LICENSES.txt` collects the license, any NOTICE file, and where the source is for every bundled package. A package that ships no license file needs its notice in `licenses/<name>.txt` (with where it comes from), or the build stops. `.vscodeignore` keeps sources, tests and `node_modules` out. Install the result with **Extensions: Install from VSIX…**, or `code --install-extension tsquare-vscode-<version>.vsix`. CI builds one on every push (the run's `vsix` artifact).

Tests: `npm test` runs the typecheck, the grammar test (`test/grammar.mjs`, with VS Code's TextMate engine) and an integration test in your installed VS Code (`test/run.mjs`: a throwaway profile, nothing downloaded; set `VSCODE_BIN` to use another build). `npm run test:vsix` packages the VSIX, unpacks it outside the repo, checks what's inside, and runs the same integration tests against it. It needs macOS or Linux (it uses `unzip` and a local VS Code); the VSIX itself works everywhere. CI runs the typecheck and the grammar test.

## Not done yet

- **tsquare code blocks in Markdown files**, in VS Code's Markdown preview.
- **Publishing:** a VS Code Marketplace publisher and an Open VSX account.

## License

MIT
