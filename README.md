# tsquare for VS Code

Highlighting, problems and a live preview for [tsquare](https://tsquare.dev) wireframes (`.tsq` files). Not published yet.

- **Language:** `.tsq` files open as tsquare, with highlighting, `#` line comments (Cmd+/), and autocomplete for components, props, option words, icons and accents.
- **Problems:** the file is checked as you type. Each problem is a squiggle on its line and an entry in the Problems panel, with the same message `tsquare check` prints.
- **Preview:** Open Preview to the Side (Cmd+K V, or the button in the editor's title bar), like Markdown's. It renders on your machine, with nothing sent anywhere, follows the active `.tsq` editor, and keeps the last valid render while there are problems. Zoom, pan and the screen chips come from `tsquare/viewer`, the playground's viewer. The zoom level is in the status bar; click it to fit the board.
- **Commands** (the preview's `…` menu and the Command Palette): Copy Image Link (a tsquare.dev SVG link), Open in Playground, Export SVG, Export PNG.

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

Tests: `npm test` runs the typecheck, the grammar test (`test/grammar.mjs`, with VS Code's TextMate engine) and an integration test in your installed VS Code (`test/run.mjs`: a throwaway profile, nothing downloaded; set `VSCODE_BIN` to use another build). CI runs the first two.

## Not done yet

- **Packaging:** a VSIX with the dependencies bundled and the Inter font files shipped beside it.
- **PNG export without native code:** draw the preview's SVG onto a canvas at 2× instead of using `@resvg/resvg-js`, so one VSIX works on every platform.
- **tsquare code blocks in Markdown files**, in VS Code's Markdown preview.
- **Publishing:** a VS Code Marketplace publisher and an Open VSX account.

## License

MIT
