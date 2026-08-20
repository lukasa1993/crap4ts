# crap4ts

`crap4ts` calculates the Change Risk Anti-Pattern metric for TypeScript and TSX functions.

```text
CRAP = CC² × (1 - coverage)³ + CC
```

It uses the TypeScript compiler API for function boundaries and cyclomatic complexity. It reads Istanbul `coverage-final.json` or LCOV coverage.

## Install

```bash
npm install --global github:lukasa1993/crap4ts
```

## Run

From a project that uses Vitest:

```bash
crap4ts --fail-over 6
```

The default coverage command is:

```bash
npx vitest run --coverage --coverage.reporter=json --coverage.reportsDirectory=target/coverage
```

For Jest or another runner:

```bash
crap4ts --test-command "npm test -- --coverage --coverageReporters=json"   --coverage coverage/coverage-final.json
```

Read an existing report without tests:

```bash
crap4ts --no-test --coverage target/coverage/lcov.info
```

Use `--json` for machine-readable output. Positional path fragments limit source discovery.

## Complexity rules

Each function starts at `1`. The tool adds points for branches, loops, switch clauses, catches, conditional expressions, and `&&`, `||`, and `??` operators. Nested functions receive separate scores.

## Development

```bash
npm ci
npm test
```
