import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 emits every logical same-net connection sharing one physical route", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "identical-endpoint-aliases",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    availableZ: [0, 1],
    portPoints: [
      {
        connectionName: "shared_net_mst0",
        rootConnectionName: "shared_net",
        x: -1,
        y: 0,
        z: 0,
      },
      {
        connectionName: "shared_net_mst0",
        rootConnectionName: "shared_net",
        x: 1,
        y: 0,
        z: 0,
      },
      {
        connectionName: "shared_net_mst1",
        x: 1,
        y: 0,
        z: 0,
      },
      {
        connectionName: "shared_net_mst1",
        x: -1,
        y: 0,
        z: 0,
      },
    ],
  }
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [],
  })

  solver.solve()
  const routes = solver.getOutput()
  const forwardRoute = routes.find(
    (route) => route.connectionName === "shared_net_mst0",
  )
  const reverseAlias = routes.find(
    (route) => route.connectionName === "shared_net_mst1",
  )

  expect(solver.solved).toBe(true)
  expect(solver.solvedConnectionsMap.size).toBe(1)
  expect(routes).toHaveLength(2)
  expect(forwardRoute?.rootConnectionName).toBe("shared_net")
  expect(forwardRoute?.route[0]).toMatchObject({ x: -1, y: 0, z: 0 })
  expect(forwardRoute?.route.at(-1)).toMatchObject({ x: 1, y: 0, z: 0 })
  expect(reverseAlias?.rootConnectionName).toBe("shared_net")
  expect(reverseAlias?.route[0]).toMatchObject({ x: 1, y: 0, z: 0 })
  expect(reverseAlias?.route.at(-1)).toMatchObject({ x: -1, y: 0, z: 0 })
  expect(reverseAlias?.route.map(({ x, y, z }) => ({ x, y, z }))).toEqual(
    [...forwardRoute!.route].reverse().map(({ x, y, z }) => ({ x, y, z })),
  )
})
