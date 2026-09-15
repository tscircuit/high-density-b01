import { SolverDebugger } from "../components/SolverDebugger"
import nodeJson from "../../tests/b02/bugreport101-dominant-node.json"
import type { NodeWithPortPoints, PortPoint } from "../../lib/types"

const { portPointsInPairs, ...nodeFields } = nodeJson
const nodeWithPortPoints = {
  ...nodeFields,
  portPoints: (
    portPointsInPairs as unknown as Array<[PortPoint, PortPoint]>
  ).flat(),
} as NodeWithPortPoints

export default function Bugreport101HighDensityB02Fixture() {
  return (
    <SolverDebugger
      nodeWithPortPoints={nodeWithPortPoints}
      defaultSolverKey="b02"
      solverKeys={["b02"]}
      solverPropOverrides={{
        b02: {
          obstacles: [],
          traceThickness: 0.15,
          traceMargin: 0.1,
          viaDiameter: 0.3,
          effort: 1,
        },
      }}
      debugKey="bugreport101-high-density-b02"
    />
  )
}
