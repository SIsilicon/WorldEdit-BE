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
  BlockBreakEvent
} from "mojang-minecraft";
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
    playerLeave: [PlayerLeaveEvent],
    ready: [ready],
    customCommand: [customCommand],
    playerChangeDimension: [playerChangeDimension]
}
interface ready {
    readonly loadTime: number
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