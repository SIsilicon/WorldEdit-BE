import {
    ChatSendBeforeEvent,
    ExplosionBeforeEvent,
    BlockExplodeAfterEvent,
    ItemUseBeforeEvent,
    ItemUseOnBeforeEvent,
    ChatSendAfterEvent,
    Player,
    Dimension,
    Entity,
    PlayerBreakBlockBeforeEvent,
    EntityHitBlockAfterEvent,
    EffectAddAfterEvent,
    ExplosionAfterEvent,
    PistonActivateAfterEvent,
    WeatherChangeAfterEvent,
    PlayerLeaveAfterEvent,
    WorldInitializeAfterEvent,
} from "@minecraft/server";
import { registerInformation } from "./classes/CommandBuilder";

export interface EventList {
    beforeMessage: [ChatSendBeforeEvent];
    beforeExplosion: [ExplosionBeforeEvent];
    blockExplode: [BlockExplodeAfterEvent];
    messageCreate: [ChatSendAfterEvent];
    itemUseBefore: [ItemUseBeforeEvent];
    itemUseOnBefore: [ItemUseOnBeforeEvent];
    blockBreak: [PlayerBreakBlockBeforeEvent];
    blockHit: [EntityHitBlockAfterEvent];
    tick: [TickEvent];
    entityEffected: [EffectAddAfterEvent];
    entityCreate: [EntityCreateEvent];
    explosion: [ExplosionAfterEvent];
    pistonActivate: [PistonActivateAfterEvent];
    weatherChange: [WeatherChangeAfterEvent];
    playerJoin: [PlayerJoinEvent];
    playerLoaded: [PlayerLoadedEvent];
    playerLeave: [PlayerLeaveAfterEvent];
    ready: [ready];
    customCommand: [customCommand];
    playerChangeDimension: [playerChangeDimension];
    worldInitialize: [WorldInitializeAfterEvent];
}

interface TickEvent {
    currentTick: number;
    deltaTime: number;
}
interface ready {
    readonly loadTime: number;
}
interface PlayerLoadedEvent {
    readonly player: Player;
}
interface PlayerJoinEvent {
    readonly playerName: string;
}
interface playerChangeDimension {
    readonly player: Player;
    readonly dimension: Dimension;
}
export interface EntityCreateEvent {
    // Equivalent of EntitySpawnEvent (1.19.60+)
    /**
     * Entity that was spawned.
     */
    readonly entity: Entity;
}
interface customCommand {
    registration: registerInformation;
    data: ChatSendBeforeEvent;
    readonly createdAt: Date;
    readonly createdTimestamp: number;
}
