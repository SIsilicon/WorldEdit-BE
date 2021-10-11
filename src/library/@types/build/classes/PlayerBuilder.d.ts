import { Entity } from "mojang-minecraft";

export interface banDataObj {
    bannedPlayer: string,
    date?: string,
    length: number,
    unbanTime: number,
    reason: string,
    bannedBy: string
} 

export interface getPlayerAtPosReturn {
    list: Array<Entity> | null,
    error: boolean
}
export interface getItemCountReturn {
    player: string,
    count: number
}