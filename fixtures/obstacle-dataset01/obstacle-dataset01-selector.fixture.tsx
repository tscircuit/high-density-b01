import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { useMemo, useState } from "react"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacleDataset } from "../../lib/obstacle-dataset-types"
import obstacleDatasetJson from "./obstacle-dataset01.json"

const obstacleDataset = obstacleDatasetJson as HighDensityObstacleDataset

export default function ObstacleDataset01SelectorFixture() {
  const [sampleNumberInput, setSampleNumberInput] = useState("1")

  const maxSampleNumber = obstacleDataset.samples.length
  const parsedSampleNumber = Number.parseInt(sampleNumberInput, 10)
  const safeSampleNumber = Number.isFinite(parsedSampleNumber)
    ? Math.min(Math.max(parsedSampleNumber, 1), maxSampleNumber)
    : 1
  const sample = obstacleDataset.samples[safeSampleNumber - 1]

  const remainingNodeWithPortPoints = useMemo(() => {
    if (!sample) return null
    const connectionNamesToRoute = new Set(sample.connectionNamesToRoute)
    return {
      ...sample.nodeWithPortPoints,
      capacityMeshNodeId: `${sample.nodeWithPortPoints.capacityMeshNodeId}-obstacle01-${safeSampleNumber}`,
      portPoints: sample.nodeWithPortPoints.portPoints.filter((portPoint) =>
        connectionNamesToRoute.has(portPoint.connectionName),
      ),
    }
  }, [sample, safeSampleNumber])

  if (!sample || !remainingNodeWithPortPoints) {
    return <div>Obstacle dataset 01 is empty.</div>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <label htmlFor="obstacle-dataset01-sample-number">
          Obstacle dataset 01 sample #
        </label>
        <input
          id="obstacle-dataset01-sample-number"
          type="number"
          min={1}
          max={maxSampleNumber}
          value={sampleNumberInput}
          onChange={(event) => setSampleNumberInput(event.currentTarget.value)}
          style={{ width: 96 }}
        />
        <button
          type="button"
          onClick={() =>
            setSampleNumberInput(String(Math.max(1, safeSampleNumber - 1)))
          }
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() =>
            setSampleNumberInput(
              String(Math.min(maxSampleNumber, safeSampleNumber + 1)),
            )
          }
        >
          Next
        </button>
        <span>
          Showing {safeSampleNumber} / {maxSampleNumber}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          <strong>{sample.sampleId}</strong> / source problem{" "}
          <code>{sample.sourceProblemId}</code>
        </div>
        <div>
          Fixed obstacle connections: {sample.preRoutedConnectionNames.length};
          connections to route: {sample.connectionNamesToRoute.length}; size:{" "}
          {sample.nodeWithPortPoints.width.toFixed(3)} ×{" "}
          {sample.nodeWithPortPoints.height.toFixed(3)} mm
        </div>
        <div>
          <span style={{ fontWeight: 600 }}>Dashed:</span> immutable obstacle
          traces; <span style={{ fontWeight: 600 }}>solid:</span> B01 output.
          Colors indicate copper layer.
        </div>
      </div>

      <GenericSolverDebugger
        key={`obstacle-dataset01-${safeSampleNumber}`}
        createSolver={() => {
          const solver = new HighDensitySolverB01({
            ...defaultB01Params,
            nodeWithPortPoints: remainingNodeWithPortPoints,
            obstacles: sample.obstacles,
            maxCellCount: 200_000,
          })
          solver.MAX_ITERATIONS = 1_000_000
          solver.setup()
          return solver
        }}
      />
    </div>
  )
}
