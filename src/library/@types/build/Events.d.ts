import { 
    BeforeChatEvent,
    BeforeExplosionEvent,
    BeforePistonActivateEvent, 
    BlockExplodeEvent,
    ChatEvent,
    TickEvent,
    EffectAddEvent,
    Entity,
    ExplosionEvent,
    PistonActivateEvent,
    WeatherChangeEvent 
} from "mojang-minecraft";
import { registerInformation } from './classes/CommandBuilder';

export interface EventList {
    beforeMessage: [BeforeChatEvent],
    beforeExplosion: [BeforeExplosionEvent],
    beforePistonActivate: [BeforePistonActivateEvent],
    blockExplode: [BlockExplodeEvent],
    messageCreate: [ChatEvent],
    tick: [TickEvent],
    entityEffected: [EffectAddEvent],
    entityCreate: [Entity],
    explosion: [ExplosionEvent],
    pistonActivate: [PistonActivateEvent],
    weatherChange: [WeatherChangeEvent],
    playerJoin: [Entity],
    playerLeave: [playerLeave],
    ready: [ready],
    customCommand: [customCommand]
}
interface playerLeave {
    readonly name: string
}
interface ready {
    readonly loadTime: number
}
interface customCommand {
    registration: registerInformation,
    data: BeforeChatEvent,
    readonly createdAt: Date,
    readonly createdTimestamp: number
}