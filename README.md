# @tscircuit/high-density-b01

Obstacle-aware high-density PCB trace routing with bounded rip-and-replace.

This repository was bootstrapped from
[`tscircuit/high-density-a01`](https://github.com/tscircuit/high-density-a01)
at commit `9a3a3dbc62d425c0459e6fc2fef7a656b448e9a0`, preserving its history and
baseline A-series solvers.

## HighDensitySolverB01

`HighDensitySolverB01` extends the A03 high-density hypergraph search with
layer-aware, immutable route obstacles:

- trace segments block only their own layer;
- obstacle vias block candidate traces and vias across every layer;
- same-root obstacle copper remains connectable;
- foreign-root geometry is checked exactly before a hypergraph move is
  rejected; and
- routing windows larger than 15×15mm fail loudly.

Obstacle cells are a broad-phase lookup rather than the final collision test.
The exact check happens in output coordinates, which avoids coarse middle-grid
cells turning nearby traces into oversized rectangular walls.

```ts
import {
  defaultB01Params,
  HighDensitySolverB01,
  type HighDensityRouteObstacle,
} from "@tscircuit/high-density-b01"

const obstacles: HighDensityRouteObstacle[] = []
const solver = new HighDensitySolverB01({
  ...defaultB01Params,
  nodeWithPortPoints: remainingNodeWithPortPoints,
  obstacles,
})

solver.solve()
const newRoutes = solver.getOutput()
const completeRoutes = [...obstacles, ...newRoutes]
```

Set `rootConnectionName` on obstacles whenever it is known. B01 uses the root
name to permit intentional same-net contact while continuing to block foreign
nets.

## Obstacle dataset 01

`fixtures/obstacle-dataset01/obstacle-dataset01.json` is derived from
[`high-density-dataset-z04`](https://github.com/tscircuit/high-density-dataset-z04)
at commit `137370563bd98310f08baa78f4800cd5a6849274`.

Each sample:

- fits inside a 15×15mm routing window;
- contains at least four connection names;
- preserves the complete original `nodeWithPortPoints`;
- produces a complete, DRC-clean reference route with `HighDensitySolverA03`;
- stores the routes for exactly `floor(connectionCount / 2)` sorted connection
  names from that completed reference as the initial route obstacles; and
- records the remaining connection names as the B01 routing workload.

This guarantees that the exact selected obstacle traces participate in at least
one complete solution. The full original ports are retained in the fixture for
reproducibility; the benchmark passes only the removed connections to B01.

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
./benchmark.sh
```

The root benchmark runs B01 over all 100 obstacle samples, checks the combined
pre-routed and newly routed geometry, and reports valid rate plus P50/P95/average
duration. Use `--limit N`, `--sample N`, `--concurrency N`, or
`--max-iterations N` for focused runs. The inherited Z04 benchmark remains
available as `bun run benchmark:z04`.

The current B01 benchmark validates 100/100 samples with zero combined-route
geometry violations. On a four-worker local run, P50 was 0.007s, P95 was
0.076s, and average duration was 0.017s per sample.

The package uses the GitHub-vanilla layout: `lib/index.ts` is the module entry
point and only `lib` is included when the package is installed.
