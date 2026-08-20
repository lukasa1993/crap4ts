import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

export interface CoveragePoint {
  line: number;
  count: number;
}

export type CoverageMap = Map<string, CoveragePoint[]>;

export interface FunctionMetric {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  complexity: number;
  coverage: number | null;
  crap: number | null;
}

const EXCLUDED_DIRS = new Set([
  ".git", ".hg", ".next", ".turbo", "coverage", "dist", "build",
  "node_modules", "target", "vendor",
]);

export function score(complexity: number, coveragePercent: number | null): number | null {
  if (coveragePercent === null) return null;
  const uncovered = 1 - coveragePercent / 100;
  return complexity * complexity * uncovered * uncovered * uncovered + complexity;
}

function normalizedPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function discoverFiles(root: string, filters: readonly string[] = []): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(join(directory, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (entry.name.endsWith(".d.ts") || /(?:^|\.)((spec)|(test))\.[cm]?tsx?$/.test(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const rel = normalizedPath(relative(root, absolute));
      if (filters.length > 0 && !filters.some((value) => rel.includes(value))) continue;
      files.push(absolute);
    }
  };
  walk(root);
  return files.sort();
}

function isFunctionNode(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node);
}

function containingNames(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  const names: string[] = [];
  let current = node.parent;
  while (current) {
    if ((ts.isClassDeclaration(current) || ts.isClassExpression(current)) && current.name) {
      names.unshift(current.name.text);
    } else if (ts.isModuleDeclaration(current)) {
      names.unshift(current.name.getText(sourceFile).replace(/["']/g, ""));
    }
    current = current.parent;
  }
  return names;
}

function localFunctionName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
      || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.name) {
    const prefix = ts.isGetAccessorDeclaration(node) ? "get " : ts.isSetAccessorDeclaration(node) ? "set " : "";
    return prefix + node.name.getText(sourceFile);
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent)) return parent.name.getText(sourceFile);
  if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) return parent.name.getText(sourceFile);
  if (ts.isCallExpression(parent)) return `<callback@${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}>`;
  return `<anonymous@${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}>`;
}

export function cyclomaticComplexity(node: ts.FunctionLikeDeclaration): number {
  let value = 1;
  const visit = (current: ts.Node): void => {
    if (current !== node && isFunctionNode(current)) return;
    if (ts.isIfStatement(current)
      || ts.isForStatement(current)
      || ts.isForInStatement(current)
      || ts.isForOfStatement(current)
      || ts.isWhileStatement(current)
      || ts.isDoStatement(current)
      || ts.isCatchClause(current)
      || ts.isConditionalExpression(current)
      || ts.isCaseClause(current)
      || ts.isDefaultClause(current)) {
      value += 1;
    } else if (ts.isBinaryExpression(current)) {
      const kind = current.operatorToken.kind;
      if (kind === ts.SyntaxKind.AmpersandAmpersandToken
        || kind === ts.SyntaxKind.BarBarToken
        || kind === ts.SyntaxKind.QuestionQuestionToken) value += 1;
    }
    ts.forEachChild(current, visit);
  };
  if (node.body) visit(node.body);
  return value;
}

export function extractFunctions(path: string, root = process.cwd()): FunctionMetric[] {
  const text = readFileSync(path, "utf8");
  const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);
  const metrics: FunctionMetric[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunctionNode(node) && node.body) {
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      const name = [...containingNames(node, sourceFile), localFunctionName(node, sourceFile)].join(".");
      metrics.push({
        name,
        file: normalizedPath(relative(root, path)),
        startLine,
        endLine,
        complexity: cyclomaticComplexity(node),
        coverage: null,
        crap: null,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return metrics;
}

function parseLcov(text: string): CoverageMap {
  const map: CoverageMap = new Map();
  let current: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      current = normalizedPath(line.slice(3));
      if (!map.has(current)) map.set(current, []);
    } else if (line.startsWith("DA:") && current) {
      const [lineNumber, count] = line.slice(3).split(",", 2).map(Number);
      if (Number.isFinite(lineNumber) && Number.isFinite(count)) map.get(current)!.push({ line: lineNumber, count });
    }
  }
  return map;
}

function parseIstanbul(text: string): CoverageMap {
  const payload = JSON.parse(text) as Record<string, any>;
  const map: CoverageMap = new Map();
  for (const [filename, data] of Object.entries(payload)) {
    const points: CoveragePoint[] = [];
    const statementMap = data.statementMap ?? {};
    const counts = data.s ?? {};
    for (const [id, location] of Object.entries(statementMap) as Array<[string, any]>) {
      const line = Number(location?.start?.line);
      if (Number.isFinite(line)) points.push({ line, count: Number(counts[id] ?? 0) });
    }
    map.set(normalizedPath(filename), points);
  }
  return map;
}

export function loadCoverage(path: string): CoverageMap {
  const text = readFileSync(path, "utf8");
  if (extname(path).toLowerCase() === ".json" || text.trimStart().startsWith("{")) return parseIstanbul(text);
  return parseLcov(text);
}

function pointsForFile(coverage: CoverageMap, filename: string): CoveragePoint[] | null {
  const normalized = normalizedPath(filename);
  if (coverage.has(normalized)) return coverage.get(normalized)!;
  const matches = [...coverage.entries()].filter(([candidate]) => candidate.endsWith("/" + normalized) || normalized.endsWith("/" + candidate));
  return matches.length === 1 ? matches[0][1] : null;
}

export function analyze(root: string, coveragePath: string | null, filters: readonly string[] = []): FunctionMetric[] {
  const coverage = coveragePath && existsSync(coveragePath) ? loadCoverage(coveragePath) : new Map<string, CoveragePoint[]>();
  const metrics = discoverFiles(root, filters).flatMap((file) => extractFunctions(file, root));
  for (const metric of metrics) {
    const points = pointsForFile(coverage, metric.file);
    if (!points) continue;
    const relevant = points.filter((point) => point.line >= metric.startLine && point.line <= metric.endLine);
    const percent = relevant.length === 0 ? 0 : 100 * relevant.filter((point) => point.count > 0).length / relevant.length;
    metric.coverage = percent;
    metric.crap = score(metric.complexity, percent);
  }
  return metrics.sort((left, right) => {
    if (left.crap === null && right.crap === null) return left.name.localeCompare(right.name);
    if (left.crap === null) return 1;
    if (right.crap === null) return -1;
    return right.crap - left.crap || left.name.localeCompare(right.name);
  });
}

export function runTestCommand(command: string, root: string): void {
  execSync(command, { cwd: root, stdio: "inherit", shell: true });
}

export function formatReport(metrics: readonly FunctionMetric[]): string {
  const header = `${"Function".padEnd(34)} ${"File".padEnd(42)} ${"CC".padStart(4)} ${"Cov%".padStart(7)} ${"CRAP".padStart(8)}`;
  const lines = ["CRAP Report", "===========", header, "-".repeat(header.length)];
  for (const metric of metrics) {
    const coverage = metric.coverage === null ? "N/A" : `${metric.coverage.toFixed(1)}%`;
    const crap = metric.crap === null ? "N/A" : metric.crap.toFixed(1);
    lines.push(`${metric.name.slice(0, 34).padEnd(34)} ${metric.file.slice(0, 42).padEnd(42)} ${String(metric.complexity).padStart(4)} ${coverage.padStart(7)} ${crap.padStart(8)}`);
  }
  return lines.join("\n") + "\n";
}
