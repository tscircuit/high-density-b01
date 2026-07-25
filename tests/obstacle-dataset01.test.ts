import { expect, test } from "bun:test"
import obstacleDatasetJson from "../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import type { HighDensityObstacleDataset } from "../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../lib/routeGeometryValidation"

const obstacleDataset = obstacleDatasetJson as HighDensityObstacleDataset

test("obstacle dataset 01 contains valid deterministic half-routed samples", () => {
  expect(obstacleDataset.format).toBe("high_density_obstacle_dataset")
  expect(obstacleDataset.samples).toHaveLength(100)

  for (const sample of obstacleDataset.samples) {
    const allConnectionNames = [
      ...new Set(
        sample.nodeWithPortPoints.portPoints.map(
          (portPoint) => portPoint.connectionName,
        ),
      ),
    ].sort((firstName, secondName) => firstName.localeCompare(secondName))
    const expectedPreRoutedCount = Math.floor(allConnectionNames.length / 2)
    const obstacleConnectionNames = new Set(
      sample.obstacles.map((obstacle) => obstacle.connectionName),
    )

    expect(sample.nodeWithPortPoints.width).toBeLessThanOrEqual(15)
    expect(sample.nodeWithPortPoints.height).toBeLessThanOrEqual(15)
    expect(sample.preRoutedConnectionNames).toEqual(
      allConnectionNames.slice(0, expectedPreRoutedCount),
    )
    expect(sample.connectionNamesToRoute).toEqual(
      allConnectionNames.slice(expectedPreRoutedCount),
    )
    expect([...obstacleConnectionNames].sort()).toEqual(
      [...sample.preRoutedConnectionNames].sort(),
    )
    expect(
      sample.obstacles.every((obstacle) => obstacle.type === "route"),
    ).toBe(true)
    expect(findRouteGeometryViolations(sample.obstacles)).toHaveLength(0)
  }
})
