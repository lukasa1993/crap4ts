#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyze, formatReport, runTestCommand } from "./core.js";

const VERSION = "0.1.0";
const DEFAULT_COVERAGE = "target/coverage/coverage-final.json";
const DEFAULT_TEST = "npx vitest run --coverage --coverage.reporter=json --coverage.reportsDirectory=target/coverage";

function help(): void {
  console.log(`crap4ts ${VERSION}

Usage: crap4ts [options] [path-fragment ...]

Options:
  --root <path>          Project root. Default: current directory
  --coverage <path>      Istanbul JSON or LCOV report
  --test-command <cmd>   Command that creates the report
  --no-test              Read an existing report
  --json                 Write machine-readable output
  --fail-over <score>    Exit 2 when any CRAP score is above the limit
  --version              Print the version
  --help                 Print this help
`);
}

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      coverage: { type: "string" },
      "test-command": { type: "string" },
      "no-test": { type: "boolean" },
      json: { type: "boolean" },
      "fail-over": { type: "string" },
      version: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) { help(); process.exit(0); }
  if (values.version) { console.log(VERSION); process.exit(0); }
  const root = resolve(values.root ?? ".");
  const coverageValue = values.coverage ?? DEFAULT_COVERAGE;
  const coveragePath = isAbsolute(coverageValue) ? coverageValue : resolve(root, coverageValue);
  if (!values["no-test"]) {
    rmSync(dirname(coveragePath), { recursive: true, force: true });
    mkdirSync(dirname(coveragePath), { recursive: true });
    runTestCommand(values["test-command"] ?? DEFAULT_TEST, root);
  }
  const metrics = analyze(root, coveragePath, positionals);
  console.log(values.json ? JSON.stringify(metrics, null, 2) : formatReport(metrics).trimEnd());
  if (values["fail-over"] !== undefined) {
    const limit = Number(values["fail-over"]);
    if (!Number.isFinite(limit)) throw new Error("--fail-over must be a number");
    if (metrics.some((metric) => metric.crap !== null && metric.crap > limit)) process.exit(2);
  }
} catch (error) {
  console.error(`crap4ts: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
