# Obstacle dataset 01

This committed dataset is generated from Z04 by
`scripts/generate-obstacle-dataset01.ts`.

The generator selects deterministic Z04 problems with at least four connection
names and routing windows no larger than 15×15mm. It routes the first half of
the sorted connection names with `HighDensitySolverA03`, rejects failed or
geometrically invalid preroutes, and stores successful routes as `type:
"route"` obstacles.

Do not edit `obstacle-dataset01.json` by hand. Regenerate it with:

```sh
bun run generate:obstacle-dataset01
```
