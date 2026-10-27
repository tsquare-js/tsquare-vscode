# Changelog

## 0.2.0

- **Built on tsquare 0.13.2** (it was 0.9.1). The preview gets tsquare's renderer fixes since then: content taller than its screen no longer hides a toast or tab bar or pushes a modal or bottom sheet down, a screen name wider than its screen ends in "…" instead of pushing the screens after it off the board, and notes on the board are laid out at the height they're drawn at (a row of notes in a grid no longer moves the screens below it or sends a flow arrow across a screen). The language hasn't changed.
- **The preview's size and its screen buttons match the board** on boards with notes: they come from tsquare's `measureBoardLayout`, which measures notes as drawn, instead of an estimate that could be a line or more off.

## 0.1.0

The first release.

- **Live preview** beside the editor (Cmd+K V), rendered on your machine: zoom, pan, a button per screen, the zoom level in the status bar. It follows the active `.tsq` file and keeps the last valid board while there are problems.
- **Problems as you type,** on their lines and in the Problems panel, with the same messages as `tsquare check`.
- **Highlighting and autocomplete** for components, props, option values, icons and colors.
- **Color swatches and the color picker** for the board's `accent=#…` and a flow's `color=#…`, and only those.
- **Export SVG, Copy Image Link and Open in Playground** from the preview's `…` menu and the Command Palette.
- Built on tsquare 0.9.1.
