import { GameApi, MapApi, PlayerData, Point2D, Tile, UnitData } from "@chronodivide/game-api";
import _ from "lodash";

const MAX_WIDTH_AND_HEIGHT = 500;

// Expensive one-time call to determine the size of the map.
// The result is a point just outside the bounds of the map.
export function determineMapBounds(mapApi: MapApi): Point2D {
    // Probably want to ask for an API change to get this.
    // Note that the maps is not always a rectangle!
    const zeroTile = { rx: 0, ry: 0 } as Tile;
    const allTiles = mapApi.getTilesInRect(zeroTile, { width: MAX_WIDTH_AND_HEIGHT, height: MAX_WIDTH_AND_HEIGHT });

    const maxX = _.maxBy(allTiles, (tile) => tile.rx)?.rx!;
    const maxY = _.maxBy(allTiles, (tile) => tile.ry)?.ry!;

    return { x: maxX, y: maxY };
}

export function calculateAreaVisibility(
    mapApi: MapApi,
    playerData: PlayerData,
    startPoint: Point2D,
    endPoint: Point2D,
): { visibleTiles: number; validTiles: number } {
    let validTiles: number = 0,
        visibleTiles: number = 0;
    for (let xx = startPoint.x; xx < endPoint.x; ++xx) {
        for (let yy = startPoint.y; yy < endPoint.y; ++yy) {
            let tile = mapApi.getTile(xx, yy);
            if (tile) {
                ++validTiles;
                if (mapApi.isVisibleTile(tile, playerData.name)) {
                    ++visibleTiles;
                }
            }
        }
    }
    let result = { visibleTiles, validTiles };
    return result;
}

export function getPointTowardsOtherPoint(
    gameApi: GameApi,
    startLocation: Point2D,
    endLocation: Point2D,
    minRadius: number,
    maxRadius: number,
    randomAngle: number,
): Point2D {
    let radius = minRadius + Math.round(gameApi.generateRandom() * (maxRadius - minRadius));
    let directionToSpawn = Math.atan2(endLocation.y - startLocation.y, endLocation.x - startLocation.x);
    let randomisedDirection =
        directionToSpawn - (randomAngle * (Math.PI / 12) + 2 * randomAngle * gameApi.generateRandom() * (Math.PI / 12));
    let candidatePointX = Math.round(startLocation.x + Math.cos(randomisedDirection) * radius);
    let candidatePointY = Math.round(startLocation.y + Math.sin(randomisedDirection) * radius);
    return { x: candidatePointX, y: candidatePointY };
}

export function getDistanceBetweenPoints(startLocation: Point2D, endLocation: Point2D): number {
    return Math.sqrt((startLocation.x - endLocation.x) ** 2 + (startLocation.y - endLocation.y) ** 2);
}

export function getDistanceBetweenUnits(unit1: UnitData, unit2: UnitData): number {
    return getDistanceBetweenPoints({ x: unit1.tile.rx, y: unit1.tile.ry }, { x: unit2.tile.rx, y: unit2.tile.ry });
}

export function getDistanceBetween(unit: UnitData, point: Point2D): number {
    return getDistanceBetweenPoints({ x: unit.tile.rx, y: unit.tile.ry }, point);
}
