# High Density B01 Development Guide

## Commands

- Build/typecheck: `bun run build`
- Test: `bun test`
- Format check: `bun run format:check`
- Benchmark: `./benchmark.sh`
- Regenerate obstacle dataset: `bun run generate:obstacle-dataset01`

Always set `BUN_UPDATE_SNAPSHOTS=1` when intentionally updating snapshot tests
with `bun test path/to/test.ts`.

Keep one test per file. Throw on invalid solver state instead of silently
falling back to another strategy.
