/**
 * Autocomplete for .tsq files: the same rules as the playground editor's
 * (src/playground/editor.ts in the tsquare repo), on VS Code's completion API.
 */
import * as vscode from "vscode";
import type { ComponentInfo, LanguageData, PropInfo } from "tsquare";

const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
const Kind = vscode.CompletionItemKind;

function item(label: string, kind: vscode.CompletionItemKind, detail?: string, doc?: string, sortPrefix = "1") {
  const i = new vscode.CompletionItem(label, kind);
  if (detail) i.detail = detail;
  if (doc) i.documentation = doc;
  i.sortText = sortPrefix + label;
  return i;
}

export function completionProvider(data: LanguageData): vscode.CompletionItemProvider {
  const byName = new Map(data.components.map((c) => [normalize(c.name), c]));
  const components = data.components.map((c) => item(c.name, Kind.Class, c.children ? "holds elements" : undefined, c.description));
  const icons = data.icons.map((label) => item(label, Kind.Constant));
  const accents = data.accents.map((label) => item(label, Kind.Color, "accent"));

  const valuesFor = (prop: PropInfo | undefined, key: string) => {
    if (key === "icon" || prop?.icon) return icons;
    if (prop?.accent) return accents;
    return (prop?.values ?? []).map((label) => item(label, Kind.EnumMember));
  };
  const argumentItems = (c: ComponentInfo) => [
    ...c.words.map((label) => item(label, Kind.Keyword, "option")),
    ...c.props.map((p) => {
      const i = item(`${p.name}=`, Kind.Property, p.kind === "enum" ? p.values!.slice(0, 4).join(" | ") + (p.values!.length > 4 ? " …" : "") : p.kind, p.description, "2");
      i.command = { title: "Suggest values", command: "editor.action.triggerSuggest" }; // after `kind=`, offer the values
      return i;
    }),
  ];

  return {
    provideCompletionItems(doc, pos) {
      const before = doc.lineAt(pos.line).text.slice(0, pos.character);
      if (/^\s*#/.test(before)) return; // in a comment (whole lines only)
      if ((before.match(/"/g) ?? []).length % 2 === 1) return; // in quoted text
      const range = (typed: string) => new vscode.Range(pos.line, pos.character - typed.length, pos.line, pos.character);
      const withRange = (items: vscode.CompletionItem[], typed: string) => items.map((i) => { i.range = range(typed); return i; });

      // The component name, at the start of the line
      const first = before.match(/^(\s*)([\w-]*)$/);
      if (first) return withRange(components, first[2]);

      const component = byName.get(normalize(before.trim().split(/\s+/)[0] ?? ""));
      if (!component) return;

      // key=value, including inside lists and objects: actions=[sea…  items=[{icon=ho…
      const kv = before.match(/([\w-]+)\s*[=:]\s*(?:\[[^\]]*?)?(?:\{[^}]*?[=:]\s*)?([\w#-]*)$/);
      if (kv) {
        const key = before.match(/([\w-]+)\s*[=:]\s*[\w#-]*$/)?.[1] ?? kv[1];
        const prop = component.props.find((p) => p.name === kv[1]);
        return withRange(valuesFor(key === "icon" ? undefined : prop, key), kv[2]);
      }

      // `icon search`: Icon's main text is an icon name
      const word = before.match(/\s([\w-]*)$/);
      if (!word) return;
      const isIconName = component.name === "icon" && /^\s*icon\s+[\w-]*$/.test(before);
      return withRange(isIconName ? icons : argumentItems(component), word[1]);
    },
  };
}
