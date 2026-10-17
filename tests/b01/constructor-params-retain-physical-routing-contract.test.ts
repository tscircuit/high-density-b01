import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("reconstructing B01 retains exact-coordinate and blind-via policies", (): void => {
  const solver = new HighDensitySolverB01({
    useExactPortCoordinates: true,
    allowBlindAndBuriedVias: true,
    nodeWithPortPoints: {
      capacityMeshNodeId: "disjoint-layer-vias",
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 0.4,
      availableZ: [0, 1, 2, 3],
      portPoints: [0, 1, 2, 3].map((z) => ({
        x: 0, y: 0, z, connectionName: z < 2 ? "a" : "b",
      })),
    },
    obstacles: [],
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  const [params] = solver.getConstructorParams()
  expect(params.allowBlindAndBuriedVias).toBeTrue()
  expect(params.useExactPortCoordinates).toBeTrue()
  const reconstructed = new HighDensitySolverB01(params)
  reconstructed.solve()
  expect(reconstructed.solved).toBeTrue()
  expect(reconstructed.failed).toBeFalse()
  expect(reconstructed.getOutput()).toHaveLength(2)
})
