import { Entity } from "@minecraft/server";

export interface banDataObj {
    bannedPlayer: string;
    date?: string;
    length: number;
    unbanTime: number;
    reason: string;
    bannedBy: string;
}

export interface getPlayerAtPosReturn {
    list: Array<Entity> | null;
    error: boolean;
}
export interface getItemCountReturn {
    count: number;
    slot: number;
}
