import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("physical via clearance is not counted twice against inflated occupancy", (): void => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    useExactPortCoordinates: true,
    allowBlindAndBuriedVias: true,
    nodeWithPortPoints: {
      capacityMeshNodeId: "two-legal-vias",
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 0.8,
      availableZ: [0, 1],
      portPoints: [-0.2, 0.2].flatMap((y, index) => [
        { x: 0, y, z: 0, connectionName: `net${index}` },
        { x: 0, y, z: 1, connectionName: `net${index}` },
      ]),
    },
    obstacles: [],
    traceThickness: 0.1524,
    traceMargin: 0.15,
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  const routes = solver.getOutput()
  expect(routes).toHaveLength(2)
  expect(routes.every((route) => route.vias.length === 1)).toBeTrue()
  const [first, second] = routes.map((route) => route.vias[0]!)
  expect(Math.hypot(first!.x - second!.x, first!.y - second!.y)).toBeGreaterThanOrEqual(
    0.2032 + 0.15,
  )
})
