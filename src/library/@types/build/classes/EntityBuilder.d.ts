import { Entity } from "mojang-minecraft";

export interface getEntityAtPosReturn {
    list: Array<Entity> | null,
    error: Boolean
}