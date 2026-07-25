# @tscircuit/high-density-b01

Obstacle-aware high-density PCB trace routing with bounded rip-and-replace.

This repository was bootstrapped from
[`tscircuit/high-density-a01`](https://github.com/tscircuit/high-density-a01)
at commit `9a3a3dbc62d425c0459e6fc2fef7a656b448e9a0`, preserving its history and
baseline A-series solvers. B01 obstacle-aware routing will be developed against
the committed obstacle dataset described below.

## Obstacle dataset 01

`fixtures/obstacle-dataset01/obstacle-dataset01.json` is derived from
[`high-density-dataset-z04`](https://github.com/tscircuit/high-density-dataset-z04)
at commit `137370563bd98310f08baa78f4800cd5a6849274`.

Each sample:

- fits inside a 15×15mm routing window;
- contains at least four connection names;
- preserves the complete original `nodeWithPortPoints`;
- routes exactly `floor(connectionCount / 2)` sorted connection names with
  `HighDensitySolverA03`;
- stores those successful routes as initially fixed route obstacles; and
- records the remaining connection names as the B01 routing workload.

The full original ports are retained so future repair modes can selectively
thaw a prerouted obstacle when routing around it is impossible.

Regenerate the committed 100-sample dataset with:

```sh
bun run generate:obstacle-dataset01
```

## Development

```sh
bun install
bun run build
bun test
bun run format:check
./benchmark.sh --limit 20
```

The package uses the GitHub-vanilla layout: `lib/index.ts` is the module entry
point and only `lib` is included when the package is installed.
