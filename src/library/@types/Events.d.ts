import {
  BeforeChatEvent,
  BeforeExplosionEvent,
  BeforePistonActivateEvent,
  BlockExplodeEvent,
  BeforeItemUseEvent,
  BeforeItemUseOnEvent,
  ChatEvent,
  TickEvent,
  PlayerLeaveEvent,
  EffectAddEvent,
  ExplosionEvent,
  PistonActivateEvent,
  WeatherChangeEvent,
  Player,
  Dimension,
  BlockBreakEvent,
  WorldInitializeEvent,
  Entity
} from "@minecraft/server";
import { registerInformation } from "./classes/CommandBuilder";

export interface EventList {
    beforeMessage: [BeforeChatEvent],
    beforeExplosion: [BeforeExplosionEvent],
    beforePistonActivate: [BeforePistonActivateEvent],
    blockExplode: [BlockExplodeEvent],
    messageCreate: [ChatEvent],
    beforeItemUse: [BeforeItemUseEvent],
    beforeItemUseOn: [BeforeItemUseOnEvent],
    blockBreak: [BlockBreakEvent],
    tick: [TickEvent],
    entityEffected: [EffectAddEvent],
    entityCreate: [EntityCreateEvent],
    explosion: [ExplosionEvent],
    pistonActivate: [PistonActivateEvent],
    weatherChange: [WeatherChangeEvent],
    playerJoin: [PlayerJoinEvent],
    playerLoaded: [PlayerLoadedEvent]
    playerLeave: [PlayerLeaveEvent],
    ready: [ready],
    customCommand: [customCommand],
    playerChangeDimension: [playerChangeDimension],
    worldInitialize: [WorldInitializeEvent]
}

interface ready {
    readonly loadTime: number
}
interface PlayerLoadedEvent {
    readonly player: Player
}
interface PlayerJoinEvent {
    readonly playerName: string
}
interface playerChangeDimension {
    readonly player: Player,
    readonly dimension: Dimension
}
export interface EntityCreateEvent { // Equivalent of EntitySpawnEvent (1.19.60+)
    /**
     * Entity that was spawned.
     */
    readonly entity: Entity;
}
interface customCommand {
    registration: registerInformation,
    data: BeforeChatEvent,
    readonly createdAt: Date,
    readonly createdTimestamp: number
}