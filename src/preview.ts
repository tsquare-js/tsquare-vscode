/**
 * The preview webview: the playground's viewer (tsquare/viewer), fed by the extension.
 * Bundled into dist/preview.js; no network access (the CSP allows blob: images only).
 */
import { createViewer, type BoardItem } from "tsquare/viewer";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void; setState(s: unknown): void };
const vscode = acquireVsCodeApi();

const $ = (id: string) => document.getElementById(id)!;
let hasBoard = false;

const viewer = createViewer(
  { stage: $("stage"), canvas: $("canvas"), screens: $("screens"), empty: $("empty") },
  { onZoom: (scale) => vscode.postMessage({ type: "zoom", scale }) },
);

const problems = $("problems") as HTMLButtonElement;
problems.addEventListener("click", () => vscode.postMessage({ type: "problems" }));

window.addEventListener("message", (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "render") {
    hasBoard = true;
    viewer.show(m.svg, m.width, m.height, m.items as BoardItem[]);
    viewer.setStale(false);
    problems.hidden = true;
  } else if (m.type === "problems") {
    viewer.setStale(hasBoard);
    problems.textContent = `${m.count} problem${m.count === 1 ? "" : "s"}${hasBoard ? " · showing the last valid render" : ""}`;
    problems.hidden = false;
    if (!hasBoard) $("empty").textContent = "Nothing to show until the problems are fixed";
  } else if (m.type === "fit") {
    viewer.fit();
  } else if (m.type === "source") {
    vscode.setState({ uri: m.uri });
  }
});

vscode.postMessage({ type: "ready" });
