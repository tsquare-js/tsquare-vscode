/**
 * Colors in .tsq files: a swatch and VS Code's color picker for the hex values
 * tsquare reads as colors, and nothing else. Without a provider, VS Code's
 * default decorators (editor.defaultColorDecorators: "auto") swatch anything
 * that looks like hex, like the order number in `data=[["#1042", …]]`.
 */
import * as vscode from "vscode";

/**
 * The props that take a hex color: Board accent and Flow color (tsquare's other
 * color props, Badge tone and Input error, take no hex). languageData() flags
 * only `accent`, so the list is spelled out here.
 */
const COLOR_PROPS: Record<string, string[]> = { board: ["accent"], flow: ["color"] };

/** key=#rrggbb or key="#rrggbb"; tsquare accepts only six-digit hex. */
const HEX_VALUE = /(?<=^|\s)([\w-]+)\s*[=:]\s*(["']?)(#[0-9a-fA-F]{6})\2(?![\w-])/g;

const toColor = (hex: string) =>
  new vscode.Color(...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]), 1);
const toHex = (c: vscode.Color) =>
  "#" + [c.red, c.green, c.blue].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join(""); // no alpha in tsquare

export const colorProvider: vscode.DocumentColorProvider = {
  provideDocumentColors(doc) {
    const colors: vscode.ColorInformation[] = [];
    for (let line = 0; line < doc.lineCount; line++) {
      const text = doc.lineAt(line).text;
      // the component is the first word (comments start with #, so they have none); names ignore case
      const props = COLOR_PROPS[text.match(/^\s*([A-Za-z][\w-]*)/)?.[1].toLowerCase() ?? ""];
      if (!props) continue;
      for (const m of text.matchAll(HEX_VALUE)) {
        if (!props.includes(m[1])) continue;
        const start = m.index! + m[0].length - m[2].length - m[3].length;
        colors.push(new vscode.ColorInformation(new vscode.Range(line, start, line, start + 7), toColor(m[3])));
      }
    }
    return colors;
  },
  provideColorPresentations(color) {
    return [new vscode.ColorPresentation(toHex(color))];
  },
};
