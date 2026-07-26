# Obstacle dataset 01

This committed dataset is generated from Z04 by
`scripts/generate-obstacle-dataset01.ts`.

The generator selects deterministic Z04 problems with at least four connection
names and routing windows no larger than 15×15mm. It completely routes each
accepted node with `HighDensitySolverA03`, rejects failed or geometrically
invalid reference routes, and stores the first half of that complete solution
as immutable `type: "route"` obstacles.

The Cosmos fixture `obstacle-dataset01-selector.fixture.tsx` browses all 100
samples and debugs B01 against the fixed obstacles. Dashed lines are prerouted
obstacles and solid lines are B01 output.

Do not edit `obstacle-dataset01.json` by hand. Regenerate it with:

```sh
bun run generate:obstacle-dataset01
```
