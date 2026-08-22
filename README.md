# crap4ts

`crap4ts` calculates function-level CRAP scores for TypeScript source with a Tree-sitter syntax tree and executable-line coverage. Missing coverage is an error by default.

```bash
pipx install git+https://github.com/lukasa1993/crap4ts.git
crap4ts --fail-over 6
```

Supported coverage inputs: LCOV, Cobertura XML, coverage.py JSON, Istanbul JSON, and LLVM export JSON. Use `--no-test` to analyze an existing report. Use `--allow-missing-coverage` only for exploratory work.

Exit status: `0` pass, `1` configuration/execution/coverage error, `2` quality limit failure.

## Development

```bash
python -m pip install -e . pytest
pytest -q
```
