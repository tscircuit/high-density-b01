import { expect, test } from "bun:test"
import {
  defaultB02Params,
  HighDensitySolverB02,
  type NodeWithPortPoints,
  type PortPoint,
} from "../../lib"
import nodeJson from "./bugreport101-dominant-node.json"

const { portPointsInPairs, ...nodeFields } = nodeJson
const nodeWithPortPoints = {
  ...nodeFields,
  portPoints: (
    portPointsInPairs as unknown as Array<[PortPoint, PortPoint]>
  ).flat(),
} as NodeWithPortPoints

test("B02 fails loudly when preloaded obstacles are supplied", () => {
  const props = {
    ...defaultB02Params,
    nodeWithPortPoints,
    obstacles: [
      {
        type: "rect" as const,
        connectionName: "foreign-net",
        center: nodeWithPortPoints.center,
        width: 0.5,
        height: 0.5,
        zLayers: [0],
      },
    ],
  }

  expect(HighDensitySolverB02.isApplicable(props)).toBeFalse()

  const solver = new HighDensitySolverB02(props)
  solver.solve()

  expect(solver.solved).toBeFalse()
  expect(solver.failed).toBeTrue()
  expect(solver.error).toContain("not structurally applicable")
  expect(solver.getOutput()).toEqual([])
})
