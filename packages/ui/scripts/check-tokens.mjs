#!/usr/bin/env node
/**
 * M1 token lint for the ui package: fails when component code hardcodes
 * raw colors, radii, px sizes, or durations instead of tokens/variables.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "src");

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const violations = [];
const patterns = [
  [/#[0-9a-fA-F]{3,8}\b/, "raw color"],
  [/\bborder-radius:\s*\d/, "raw radius"],
  [/\btransition:\s*[^;]*(?<!var\([^)]*|\d)ms/, "raw duration"],
];

for (const file of walk(srcDir)) {
  const text = readFileSync(file, "utf8");
  for (const [re, label] of patterns) {
    const m = re.exec(text);
    if (m) violations.push(`${file}: ${label} "${m[0]}"`);
  }
}

if (violations.length > 0) {
  console.error("Token violations (M1):\n" + violations.join("\n"));
  process.exit(1);
}
console.log("tokens ok");
