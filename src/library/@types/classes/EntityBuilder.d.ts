import { Entity } from "@minecraft/server";

export interface getEntityAtPosReturn {
    list: Array<Entity> | null;
    error: boolean;
}
