import { ActionsApi, GameApi, PlayerData } from "@chronodivide/game-api";
import { Mission, MissionAction, disbandMission, noop } from "../mission.js";
import { MatchAwareness } from "../../awareness.js";
import { DebugLogger } from "../../common/utils.js";
import { MissionBehaviour } from "./missionBehaviour.js";
import { ActionBatcher } from "../actionBatcher.js";

/**
 * A mission that just delegates to the mission behaviour.
 */
export abstract class BasicMission<T extends MissionBehaviour, U = undefined> extends Mission<T, U> {
    constructor(uniqueName: string, behaviour: T, logger: DebugLogger) {
        super(uniqueName, behaviour, logger);
    }

    _onAiUpdate(
        gameApi: GameApi,
        actionsApi: ActionsApi,
        playerData: PlayerData,
        matchAwareness: MatchAwareness,
        actionBatcher: ActionBatcher,
    ): MissionAction {
        return this.getBehaviour.onAiUpdate(
            gameApi,
            actionsApi,
            actionBatcher,
            playerData,
            this,
            matchAwareness,
            this.logger,
        );
    }
}