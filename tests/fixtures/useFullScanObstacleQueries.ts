import type { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

// Returning every primitive in insertion order restores the pre-index exact
// geometry loops without maintaining a second copy of the geometry engine.
export function useFullScanObstacleQueries(solver: HighDensitySolverB01): void {
  for (const [indexName, primitivesName] of [
    ["obstacleTraceSpatialIndex", "obstacleTracePrimitives"],
    ["obstacleViaSpatialIndex", "obstacleViaPrimitives"],
    ["obstacleRectSpatialIndex", "obstacleRectPrimitives"],
  ] as const) {
    const index = solver[indexName]
    if (index === null) continue
    const primitiveIndexes = solver[primitivesName].map((_, id) => id)
    index.search = () => primitiveIndexes
  }
}
