import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { analyze, extractFunctions, score } from "../dist/core.js";

test("score follows the CRAP formula", () => {
  assert.equal(score(10, 50), 22.5);
  assert.equal(score(10, 100), 10);
});

test("extracts function complexity and maps Istanbul coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "crap4ts-"));
  try {
    mkdirSync(join(root, "src"));
    const source = join(root, "src", "sample.ts");
    writeFileSync(source, "export function choose(a: boolean, b: boolean) {\n  if (a && b) return 1;\n  return 0;\n}\n");
    const functions = extractFunctions(source, root);
    assert.equal(functions[0].name, "choose");
    assert.equal(functions[0].complexity, 3);
    const coverage = join(root, "coverage-final.json");
    writeFileSync(coverage, JSON.stringify({
      [source]: { statementMap: { "0": { start: { line: 2 }, end: { line: 2 } }, "1": { start: { line: 3 }, end: { line: 3 } } }, s: { "0": 1, "1": 0 } },
    }));
    const metrics = analyze(root, coverage);
    assert.equal(metrics[0].coverage, 50);
    assert.equal(metrics[0].crap, 4.125);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
