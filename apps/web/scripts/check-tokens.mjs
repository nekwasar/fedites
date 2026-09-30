#!/usr/bin/env node
/**
 * M1 token lint for the web app: fails on hardcoded hex colors or raw
 * border-radius in component code (CSS variables only).
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
for (const file of walk(srcDir)) {
  const text = readFileSync(file, "utf8");
  const m = /#[0-9a-fA-F]{6}\b/.exec(text);
  if (m) violations.push(`${file}: raw color "${m[0]}"`);
  const r = /borderRadius:\s*["'\d]/.exec(text);
  if (r) violations.push(`${file}: hardcoded border radius`);
}

if (violations.length > 0) {
  console.error("Token violations (M1):\n" + violations.join("\n"));
  process.exit(1);
}
console.log("tokens ok");
