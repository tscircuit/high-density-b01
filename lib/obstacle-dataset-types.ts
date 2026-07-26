import type { HighDensityRoutePoint, NodeWithPortPoints } from "./types"

export type HighDensityRouteObstacle = {
  type: "route"
  connectionName: string
  rootConnectionName?: string
  traceThickness: number
  viaDiameter: number
  route: HighDensityRoutePoint[]
  vias: Array<{ x: number; y: number }>
}

export type HighDensityRectObstacle = {
  type: "rect"
  connectionName: string
  rootConnectionName?: string
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
  zLayers: number[]
}

export type HighDensityObstacle =
  | HighDensityRouteObstacle
  | HighDensityRectObstacle

export type HighDensityObstacleDatasetSample = {
  sampleId: string
  sourceProblemId: number
  nodeWithPortPoints: NodeWithPortPoints
  preRoutedConnectionNames: string[]
  connectionNamesToRoute: string[]
  obstacles: HighDensityRouteObstacle[]
}

export type HighDensityObstacleDataset = {
  format: "high_density_obstacle_dataset"
  formatVersion: 2
  sourceDataset: "high-density-dataset-z04"
  sourceDatasetCommit: string
  preRouter: "HighDensitySolverA03"
  fullRoutabilityCheck: "HighDensitySolverA03"
  obstaclesFromFullReferenceRoute: true
  routingWindowMaxWidthMm: 15
  routingWindowMaxHeightMm: 15
  connectionPartition: "sorted_connection_names_first_half"
  samples: HighDensityObstacleDatasetSample[]
}
