import { ActionsApi, GameApi, OrderType, PlayerData, Vector2 } from "@chronodivide/game-api";
import { MatchAwareness } from "../../awareness.js";
import { DebugLogger } from "../../common/utils.js";
import { getDistanceBetweenTileAndPoint } from "../../map/map.js";
import { PrioritisedScoutTarget } from "../../common/scout.js";
import { ActionBatcher } from "../actionBatcher.js";
import { MissionBehaviour } from "../missions/missionBehaviour.js";
import { Mission, MissionAction, disbandMission, noop, requestUnits } from "../mission.js";

const SCOUT_MOVE_COOLDOWN_TICKS = 30;

// Max units to spend on a particular scout target.
const MAX_ATTEMPTS_PER_TARGET = 5;

// Maximum ticks to spend trying to scout a target *without making progress towards it*.
// Every time a unit gets closer to the target, the timer refreshes.
const MAX_TICKS_PER_TARGET = 600;

export class ScoutingSquad implements MissionBehaviour {
    private scoutTarget: Vector2 | null = null;
    private attemptsOnCurrentTarget: number = 0;
    private scoutTargetRefreshedAt: number = 0;
    private lastMoveCommandTick: number = 0;
    private scoutTargetIsPermanent: boolean = false;

    // Minimum distance from a scout to the target.
    private scoutMinDistance?: number;

    private hadUnit: boolean = false;

    constructor(private priority: number) {}

    public onAiUpdate(
        gameApi: GameApi,
        actionsApi: ActionsApi,
        actionBatcher: ActionBatcher,
        playerData: PlayerData,
        mission: Mission<ScoutingSquad>,
        matchAwareness: MatchAwareness,
        logger: DebugLogger,
    ): MissionAction {
        const scoutNames = ["ADOG", "DOG", "E1", "E2", "FV", "HTK"];
        const scouts = mission.getUnitsOfTypes(gameApi, ...scoutNames);

        if ((matchAwareness.getSectorCache().getOverallVisibility() || 0) > 0.9) {
            return disbandMission();
        }

        if (scouts.length === 0) {
            // Count the number of times the scout dies trying to uncover the current scoutTarget.
            if (this.scoutTarget && this.hadUnit) {
                this.attemptsOnCurrentTarget++;
                this.hadUnit = false;
            }
            return requestUnits(scoutNames, this.priority);
        } else if (this.scoutTarget) {
            this.hadUnit = true;
            if (!this.scoutTargetIsPermanent) {
                if (this.attemptsOnCurrentTarget > MAX_ATTEMPTS_PER_TARGET) {
                    logger(
                        `Scout target ${this.scoutTarget.x},${this.scoutTarget.y} took too many attempts, moving to next`,
                    );
                    this.setScoutTarget(null, 0);
                    return noop();
                }
                if (gameApi.getCurrentTick() > this.scoutTargetRefreshedAt + MAX_TICKS_PER_TARGET) {
                    logger(`Scout target ${this.scoutTarget.x},${this.scoutTarget.y} took too long, moving to next`);
                    this.setScoutTarget(null, 0);
                    return noop();
                }
            }
            const targetTile = gameApi.mapApi.getTile(this.scoutTarget.x, this.scoutTarget.y);
            if (!targetTile) {
                throw new Error(`target tile ${this.scoutTarget.x},${this.scoutTarget.y} does not exist`);
            }
            if (gameApi.getCurrentTick() > this.lastMoveCommandTick + SCOUT_MOVE_COOLDOWN_TICKS) {
                this.lastMoveCommandTick = gameApi.getCurrentTick();
                scouts.forEach((unit) => {
                    if (this.scoutTarget) {
                        actionsApi.orderUnits([unit.id], OrderType.AttackMove, this.scoutTarget.x, this.scoutTarget.y);
                    }
                });
                // Check that a scout is actually moving closer to the target.
                const distances = scouts.map((unit) => getDistanceBetweenTileAndPoint(unit.tile, this.scoutTarget!));
                const newMinDistance = Math.min(...distances);
                if (!this.scoutMinDistance || newMinDistance < this.scoutMinDistance) {
                    logger(
                        `Scout timeout refreshed because unit moved closer to point (${newMinDistance} < ${this.scoutMinDistance})`,
                    );
                    this.scoutTargetRefreshedAt = gameApi.getCurrentTick();
                    this.scoutMinDistance = newMinDistance;
                }
            }
            if (gameApi.mapApi.isVisibleTile(targetTile, playerData.name)) {
                logger(`Scout target ${this.scoutTarget.x},${this.scoutTarget.y} successfully scouted, moving to next`);
                this.setScoutTarget(null, gameApi.getCurrentTick());
            }
        } else {
            const nextScoutTarget = matchAwareness.getScoutingManager().getNewScoutTarget();
            if (!nextScoutTarget) {
                logger(`No more scouting targets available, disbanding.`);
                return disbandMission();
            }
            this.setScoutTarget(nextScoutTarget, gameApi.getCurrentTick());
        }
        return noop();
    }

    setScoutTarget(target: PrioritisedScoutTarget | null, currentTick: number) {
        this.attemptsOnCurrentTarget = 0;
        this.scoutTargetRefreshedAt = currentTick;
        this.scoutTarget = target?.asVector2() ?? null;
        this.scoutMinDistance = undefined;
        this.scoutTargetIsPermanent = target?.isPermanent ?? false;
    }

    public getGlobalDebugText(): string | undefined {
        return undefined;
    }
}