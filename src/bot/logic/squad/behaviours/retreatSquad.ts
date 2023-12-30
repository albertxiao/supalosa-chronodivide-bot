import { ActionsApi, GameApi, OrderType, PlayerData, Vector2 } from "@chronodivide/game-api";
import { GlobalThreat } from "../../threat/threat.js";
import { Squad } from "../squad.js";
import { SquadAction, SquadBehaviour, disband, noop, requestSpecificUnits, requestUnits } from "../squadBehaviour.js";
import { MatchAwareness } from "../../awareness.js";
import { ActionBatcher } from "./actionBatcher.js";

const SCOUT_MOVE_COOLDOWN_TICKS = 30;

export class RetreatSquad implements SquadBehaviour {
    private createdAt: number | null = null;

    constructor(
        private unitIds: number[],
        private retreatToPoint: Vector2,
    ) {}

    public onAiUpdate(
        gameApi: GameApi,
        actionsApi: ActionsApi,
        actionBatcher: ActionBatcher,
        playerData: PlayerData,
        squad: Squad,
        matchAwareness: MatchAwareness,
    ): SquadAction {
        if (!this.createdAt) {
            this.createdAt = gameApi.getCurrentTick();
        }
        if (squad.getUnitIds().length > 0) {
            // Only send the order once we have managed to claim some units.
            actionsApi.orderUnits(
                squad.getUnitIds(),
                OrderType.AttackMove,
                this.retreatToPoint.x,
                this.retreatToPoint.y,
            );
            return disband();
        }
        if (this.createdAt && gameApi.getCurrentTick() > this.createdAt + 240) {
            // Disband automatically after 240 ticks in case we couldn't actually claim any units.
            return disband();
        } else {
            return requestSpecificUnits(this.unitIds, 1000);
        }
    }
}
