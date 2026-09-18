import { readFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = process.argv[2];

if (!sourceRoot) {
  throw new Error("Usage: node tools/export_source_action_templates.mjs <thenewproject/toy path>");
}

const actionModulePath = path.join(sourceRoot, "modules", "duel", "duel-actions.js");
const actionRulesPath = path.join(sourceRoot, "data", "battle", "runtime", "action-templates.json");
const [source, actionRulesText] = await Promise.all([
  readFile(actionModulePath, "utf8"),
  readFile(actionRulesPath, "utf8")
]);
const scope = {};
const attachedSource = source.replace(/\}\)\(globalThis\);\s*$/, "})(__scope);");
new Function("__scope", attachedSource)(scope);

const api = scope.JJKDuelActions;
if (!api || typeof api.registerDependencies !== "function" || typeof api.getDuelActionTemplates !== "function") {
  throw new Error("Source duel-actions module did not expose the expected dependency API");
}

const actionRules = JSON.parse(actionRulesText);
api.registerDependencies({
  getDuelActionRules: () => actionRules
});

const templates = api.getDuelActionTemplates();
process.stdout.write(`${JSON.stringify({
  schema: "godot-source-action-template-export-v1",
  source_module: "modules/duel/duel-actions.js",
  source_rules: "data/battle/runtime/action-templates.json",
  source_version: actionRules.version ?? "",
  templates
})}\n`);

