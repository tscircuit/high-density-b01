// Original B01 search loop from e651cab6c314e7aab6df31fd6067277436f67148.
// The upstream f974f97 B01 loop is identical. Only private field access syntax
// changes so the frozen loop can share the unchanged native geometry engine.
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

export class FrozenB01VisitedSolver extends HighDensitySolverB01 {
  override _step(): void {
    for (let i = 0; i < this.stepMultiplier; i++) {
      if (this.solved || this.failed) return
      frozenStepOnce.call(this)
    }
  }
}

function frozenStepOnce(this: HighDensitySolverB01): void {
  if (!this["activeConnSeg"]) {
    if (this["unsolvedSegs"].length === 0) {
      this["solved"] = true
      return
    }

    const next = this["unsolvedSegs"].shift()!
    this["activeConnSeg"] = next
    this["activeConnId"] = next.connId

    this["nodePool"].clear()
    this["ripChain"].clear()
    this["heap"].clear()
    this["seqCounter"] = 0
    this["searchIterations"] = 0
    this["nextStamp"]()

    const h = this["computeH"](
      next.startZ,
      next.startCellId,
      next.endZ,
      next.endCellId,
    )
    const f = h * this["hyperParameters"].greedyMultiplier
    const startIdx = this["nodePool"].push(
      next.startZ,
      next.startCellId,
      0,
      -1,
      -1,
      0,
    )
    const startFlatIdx = next.startZ * this["planeSize"] + next.startCellId
    const startStateIdx = this["getSearchStateIdx"](startFlatIdx, 0)
    this["bestGStamp"][startStateIdx] = this["stamp"]
    this["bestGValue"][startStateIdx] = 0
    this["heap"].push(f, this["seqCounter"]++, startIdx)
    return
  }

  this["searchIterations"]++
  const connRips = this["ripCount"][this["activeConnId"]] ?? 0
  const budget = Math.round(
    this["baseSearchBudgetIters"] * (1 + Math.min(connRips, 10) * 0.25),
  )
  if (this["searchIterations"] > budget) {
    const pen = this["penalty2d"]
    for (let i = 0; i < pen.length; i++) {
      pen[i] = pen[i]! * 0.9
    }
    this["unsolvedSegs"].push(this["activeConnSeg"])
    this["activeConnSeg"] = null
    this["activeConnId"] = -1
    this["heap"].clear()
    this["nodePool"].clear()
    this["consecutiveSkips"]++
    if (
      this["consecutiveSkips"] >= Math.max(3, this["unsolvedSegs"].length * 3)
    ) {
      this["error"] =
        `Convergence failure: ${this["unsolvedSegs"].length} connections stuck`
      this["failed"] = true
    }
    return
  }

  if (this["heap"].size === 0) {
    this["error"] =
      `No path found for ${this["connIdToName"][this["activeConnId"]]}`
    this["failed"] = true
    return
  }

  const nodeIdx = this["heap"].pop()
  const z = this["nodePool"].z[nodeIdx]!
  const cellId = this["nodePool"].cellId[nodeIdx]!
  const g = this["nodePool"].g[nodeIdx]!
  const rippedHead = this["nodePool"].ripHead[nodeIdx]!
  const ripCount = this["nodePool"].ripCount[nodeIdx]!

  const flatIdx = z * this["planeSize"] + cellId
  const searchStateIdx = this["getSearchStateIdx"](flatIdx, ripCount)
  if (this["visitedStamp"][searchStateIdx] === this["stamp"]) return
  this["visitedStamp"][searchStateIdx] = this["stamp"]
  this["visitedFlatStamp"][flatIdx] = this["stamp"]

  const seg = this["activeConnSeg"]
  if (z === seg.endZ && cellId === seg.endCellId) {
    this["finalizeRoute"](nodeIdx)
    this["activeConnSeg"] = null
    this["activeConnId"] = -1
    return
  }

  const visited = this["visitedStamp"]
  const stamp = this["stamp"]
  const activeConn = this["activeConnId"]
  const endZ = seg.endZ
  const endCellId = seg.endCellId
  const neighborStart = this["neighborOffset"][cellId]!
  const neighborEnd = this["neighborOffset"][cellId + 1]!

  for (let i = neighborStart; i < neighborEnd; i++) {
    const neighborCellId = this["neighborIds"][i]!
    const nextFlatIdx = z * this["planeSize"] + neighborCellId

    this["computeMoveCostAndRips"](
      activeConn,
      z,
      cellId,
      neighborCellId,
      false,
      rippedHead,
      ripCount,
      this["neighborCosts"][i]!,
    )
    if (this["_moveCost"] < 0) continue

    const nextStateIdx = this["getSearchStateIdx"](
      nextFlatIdx,
      this["_moveRipCount"],
    )
    if (visited[nextStateIdx] === stamp) continue

    const g2 = g + this["_moveCost"]
    if (
      this["bestGStamp"][nextStateIdx] === stamp &&
      g2 >= this["bestGValue"][nextStateIdx]!
    ) {
      continue
    }
    this["bestGStamp"][nextStateIdx] = stamp
    this["bestGValue"][nextStateIdx] = g2
    const f2 =
      g2 +
      this["computeH"](z, neighborCellId, endZ, endCellId) *
        this["hyperParameters"].greedyMultiplier

    const newNodeIdx = this["nodePool"].push(
      z,
      neighborCellId,
      g2,
      nodeIdx,
      this["_moveRippedHead"],
      this["_moveRipCount"],
    )
    this["heap"].push(f2, this["seqCounter"]++, newNodeIdx)
  }

  if (this["viaAllowed"][cellId]) {
    for (let nz = 0; nz < this["layers"]; nz++) {
      if (nz === z) continue
      const nextFlatIdx = nz * this["planeSize"] + cellId

      this["computeMoveCostAndRips"](
        activeConn,
        nz,
        cellId,
        cellId,
        true,
        rippedHead,
        ripCount,
        0,
      )
      if (this["_moveCost"] < 0) continue

      const nextStateIdx = this["getSearchStateIdx"](
        nextFlatIdx,
        this["_moveRipCount"],
      )
      if (visited[nextStateIdx] === stamp) continue

      const g2 = g + this["_moveCost"]
      if (
        this["bestGStamp"][nextStateIdx] === stamp &&
        g2 >= this["bestGValue"][nextStateIdx]!
      ) {
        continue
      }
      this["bestGStamp"][nextStateIdx] = stamp
      this["bestGValue"][nextStateIdx] = g2
      const f2 =
        g2 +
        this["computeH"](nz, cellId, endZ, endCellId) *
          this["hyperParameters"].greedyMultiplier

      const newNodeIdx = this["nodePool"].push(
        nz,
        cellId,
        g2,
        nodeIdx,
        this["_moveRippedHead"],
        this["_moveRipCount"],
      )
      this["heap"].push(f2, this["seqCounter"]++, newNodeIdx)
    }
  }
}
