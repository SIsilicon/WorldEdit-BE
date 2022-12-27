import {
  BeforeChatEvent,
  BeforeExplosionEvent,
  BeforePistonActivateEvent,
  BlockExplodeEvent,
  BeforeItemUseEvent,
  BeforeItemUseOnEvent,
  ChatEvent,
  TickEvent,
  PlayerJoinEvent,
  PlayerLeaveEvent,
  EffectAddEvent,
  EntityCreateEvent,
  ExplosionEvent,
  PistonActivateEvent,
  WeatherChangeEvent,
  Player,
  Dimension,
  BlockBreakEvent,
  WorldInitializeEvent
} from "@minecraft/server";
import { registerInformation } from "./classes/CommandBuilder";

export interface EventList {
    beforeMessage: [BeforeChatEvent],
    beforeExplosion: [BeforeExplosionEvent],
    beforePistonActivate: [BeforePistonActivateEvent],
    blockExplode: [BlockExplodeEvent],
    messageCreate: [ChatEvent],
    BeforeItemUse: [BeforeItemUseEvent],
    BeforeItemUseOn: [BeforeItemUseOnEvent],
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
interface playerChangeDimension {
    readonly player: Player,
    readonly dimension: Dimension
}
interface customCommand {
    registration: registerInformation,
    data: BeforeChatEvent,
    readonly createdAt: Date,
    readonly createdTimestamp: number
}