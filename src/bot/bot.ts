import {
    ApiEventType,
    Bot,
    GameApi,
    ApiEvent,
    QueueStatus,
    ObjectType,
    FactoryType,
    Size,
} from "@chronodivide/game-api";

import { determineMapBounds } from "./logic/map/map.js";
import { SectorCache } from "./logic/map/sector.js";
import { MissionController } from "./logic/mission/missionController.js";
import { SquadController } from "./logic/squad/squadController.js";
import { QUEUES, QueueController, queueTypeToName } from "./logic/building/queueController.js";
import { MatchAwareness, MatchAwarenessImpl } from "./logic/awareness.js";
import { formatTimeDuration } from "./logic/common/utils.js";

const DEBUG_STATE_UPDATE_INTERVAL_SECONDS = 6;

// Number of ticks per second at the base speed.
const NATURAL_TICK_RATE = 15;
const BOT_AUTO_SURRENDER_TIME_SECONDS = 7200; // 7200 = 2 hours (approx 30 mins in real time, given a game speed of 4)

export class SupalosaBot extends Bot {
    private tickRatio?: number;
    private knownMapBounds: Size | undefined;
    private missionController: MissionController;
    private squadController: SquadController;
    private queueController: QueueController;
    private tickOfLastAttackOrder: number = 0;

    private matchAwareness: MatchAwareness | null = null;

    constructor(
        name: string,
        country: string,
        private tryAllyWith: string[] = [],
        private enableLogging = true,
    ) {
        super(name, country);
        this.missionController = new MissionController((message, sayInGame) => this.logBotStatus(message, sayInGame));
        this.squadController = new SquadController((message, sayInGame) => this.logBotStatus(message, sayInGame));
        this.queueController = new QueueController();
    }

    override onGameStart(game: GameApi) {
        const gameRate = game.getTickRate();
        const botApm = 300;
        const botRate = botApm / 60;
        this.tickRatio = Math.ceil(gameRate / botRate);

        this.knownMapBounds = determineMapBounds(game.mapApi);
        const myPlayer = game.getPlayerData(this.name);

        this.matchAwareness = new MatchAwarenessImpl(
            null,
            new SectorCache(game.mapApi, this.knownMapBounds),
            myPlayer.startLocation,
            (message, sayInGame) => this.logBotStatus(message, sayInGame),
        );
        this.matchAwareness.onGameStart(game, myPlayer);

        this.logBotStatus(`Map bounds: ${this.knownMapBounds.width}, ${this.knownMapBounds.height}`);

        this.tryAllyWith.forEach((playerName) => this.actionsApi.toggleAlliance(playerName, true));
    }

    override onGameTick(game: GameApi) {
        if (!this.matchAwareness) {
            return;
        }

        const threatCache = this.matchAwareness.getThreatCache();

        if ((game.getCurrentTick() / NATURAL_TICK_RATE) % DEBUG_STATE_UPDATE_INTERVAL_SECONDS === 0) {
            this.updateDebugState(game);
        }

        if (game.getCurrentTick() % this.tickRatio! === 0) {
            const myPlayer = game.getPlayerData(this.name);

            this.matchAwareness.onAiUpdate(game, myPlayer);

            if (game.getCurrentTick() / NATURAL_TICK_RATE > BOT_AUTO_SURRENDER_TIME_SECONDS) {
                this.logBotStatus(`Auto-surrendering after ${BOT_AUTO_SURRENDER_TIME_SECONDS} seconds.`);
                this.actionsApi.quitGame();
            }

            // hacky resign condition
            const armyUnits = game.getVisibleUnits(this.name, "self", (r) => r.isSelectableCombatant);
            const mcvUnits = game.getVisibleUnits(
                this.name,
                "self",
                (r) => !!r.deploysInto && game.getGeneralRules().baseUnit.includes(r.name),
            );
            const productionBuildings = game.getVisibleUnits(
                this.name,
                "self",
                (r) => r.type == ObjectType.Building && r.factory != FactoryType.None,
            );
            if (armyUnits.length == 0 && productionBuildings.length == 0 && mcvUnits.length == 0) {
                this.logBotStatus(`No army or production left, quitting.`);
                this.actionsApi.quitGame();
            }

            // Build logic.
            this.queueController.onAiUpdate(
                game,
                this.productionApi,
                this.actionsApi,
                myPlayer,
                threatCache,
                (message) => this.logBotStatus(message),
            );

            // Mission logic every 6 ticks
            if (this.gameApi.getCurrentTick() % 6 === 0) {
                this.missionController.onAiUpdate(game, myPlayer, this.matchAwareness, this.squadController);
            }

            // Squad logic every 3 ticks
            if (this.gameApi.getCurrentTick() % 3 === 0) {
                this.squadController.onAiUpdate(game, this.actionsApi, myPlayer, this.matchAwareness);
            }
        }
    }

    private getHumanTimestamp(game: GameApi) {
        return formatTimeDuration(game.getCurrentTick() / NATURAL_TICK_RATE);
    }

    private logBotStatus(message: string, sayInGame: boolean = false) {
        if (!this.enableLogging) {
            return;
        }
        const timestamp = this.getHumanTimestamp(this.gameApi);
        console.log(`[${timestamp} ${this.name}] ${message}`);
        if (sayInGame) {
            this.actionsApi.sayAll(`${timestamp}: ${message}`);
        }
    }

    private updateDebugState(game: GameApi) {
        if (!this.getDebugMode()) {
            return;
        }

        const myPlayer = game.getPlayerData(this.name);
        const queueState = QUEUES.reduce((prev, queueType) => {
            if (this.productionApi.getQueueData(queueType).size === 0) {
                return prev;
            }
            const paused = this.productionApi.getQueueData(queueType).status === QueueStatus.OnHold;
            return (
                prev +
                " [" +
                queueTypeToName(queueType) +
                (paused ? " PAUSED" : "") +
                ": " +
                this.productionApi.getQueueData(queueType).items.map((item) => item.rules.name + "x" + item.quantity) +
                "]"
            );
        }, "");
        let globalDebugText = `Cash: ${myPlayer.credits} | Queues: ${queueState}\n`;
        const harvesters = game.getVisibleUnits(this.name, "self", (r) => r.harvester).length;
        globalDebugText += `Harvesters: ${harvesters}\n`;
        globalDebugText += this.squadController.debugSquads(this.gameApi, this.actionsApi);
        this.missionController.logDebugOutput();

        // Tag enemy units with IDs
        game.getVisibleUnits(this.name, "hostile").forEach((unitId) => {
            this.actionsApi.setUnitDebugText(unitId, unitId.toString());
        });

        this.actionsApi.setGlobalDebugText(globalDebugText);
    }

    override onGameEvent(ev: ApiEvent) {
        switch (ev.type) {
            case ApiEventType.ObjectDestroy: {
                // Add to the stalemate detection.
                if (ev.attackerInfo?.playerName == this.name) {
                    this.tickOfLastAttackOrder += (this.gameApi.getCurrentTick() - this.tickOfLastAttackOrder) / 2;
                }
                break;
            }
            default:
                break;
        }
    }
}
