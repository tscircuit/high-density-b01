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

test("B02 propagates invalid B01 grid configuration without throwing", () => {
  const solver = new HighDensitySolverB02({
    ...defaultB02Params,
    nodeWithPortPoints,
    obstacles: [],
    highResolutionCellSize: 0.3,
    lowResolutionCellSize: 0.4,
  })

  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBeFalse()
  expect(solver.failed).toBeTrue()
  expect(solver.error).toContain("Initial B01 setup failed")
  expect(solver.error).toContain("positive integer multiple")
  expect(solver.getOutput()).toEqual([])
})
