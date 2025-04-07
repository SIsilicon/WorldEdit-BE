import { Player, ItemStack, ItemUseBeforeEvent, world, PlayerBreakBlockBeforeEvent, EntityHitBlockAfterEvent, system, PlayerInteractWithBlockBeforeEvent } from "@minecraft/server";
import { contentLog, Databases, Server, sleep, Thread, Vector } from "@notbeer-api";
import { Tool, ToolAction } from "./base_tool.js";
import { PlayerSession, getSession, hasSession } from "../sessions.js";
import { Database } from "library/@types/classes/databaseBuilder.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolConstruct = new (...args: any[]) => Tool;
type toolCondition = (player: Player, session: PlayerSession) => boolean;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolObject = { [key: string]: any } & Tool;

const tools = new Map<string, toolConstruct>();

Databases.addParser((k, v, databaseName) => {
    if (databaseName.startsWith("tools|") && v && typeof v === "object" && "toolType" in v) {
        try {
            const toolClass = tools.get(v.toolType);
            const tool = new toolClass(...(toolClass as toolConstruct & typeof Tool).parseJSON(v));
            tool.type = v.toolType;
            return tool;
        } catch (err) {
            contentLog.error(`Failed to load tool from '${JSON.stringify(v)}' for '${k}': ${err}`);
        }
    } else {
        return v;
    }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== "wedit:reset_tools_database" || !sourceEntity) return;
    Databases.delete(`tools|${sourceEntity.id}`);
});

class ToolBuilder {
    private bindings = new Map<string, Database<{ [id: string]: Tool }>>();
    private fixedBindings = new Map<string, Tool>();
    private prevHeldTool = new Map<Player, Tool>();
    private conditionalBindings = new Map<string, { condition: toolCondition; tool: Tool }>();
    private disabled: string[] = [];

    constructor() {
        Server.on("itemUseBefore", (ev) => {
            if (!ev.itemStack || !hasSession(ev.source.id)) return;
            this.onItemUse(ev.itemStack, ev.source, ev);
        });

        Server.on("itemUseOnBefore", (ev) => {
            if (!ev.itemStack || !hasSession(ev.player.id)) return;
            this.onItemUse(ev.itemStack, ev.player, ev, Vector.from(ev.block));
        });

        Server.on("entityCreate", ({ entity }) => {
            if (!entity?.hasComponent("minecraft:item")) return;

            const player = entity.dimension.getPlayers({ closest: 1, location: entity.location, maxDistance: 2 })[0];
            if (player) this.onItemDrop(entity.getComponent("item").itemStack, player);
        });

        Server.on("blockBreak", (ev) => {
            if (!ev.itemStack || !hasSession(ev.player.id)) return;
            this.onBlockBreak(ev.itemStack, ev.player, ev, Vector.from(ev.block));
        });

        Server.on("blockHit", (ev) => {
            if (ev.damagingEntity.typeId != "minecraft:player" || !hasSession(ev.damagingEntity.id)) return;
            const item = Server.player.getHeldItem(ev.damagingEntity as Player);
            if (!item) return;
            this.onBlockHit(item, ev.damagingEntity as Player, ev, Vector.from(ev.hitBlock));
        });

        new Thread().start(function* (self: ToolBuilder) {
            while (true) {
                for (const player of world.getPlayers()) {
                    if (!hasSession(player.id)) break;
                    try {
                        const item = Server.player.getHeldItem(player);
                        if (item) {
                            yield* self.onItemTick(item, player, system.currentTick);
                        } else {
                            self.stopHolding(player);
                        }
                    } catch (err) {
                        contentLog.error(err);
                    }
                }
                yield sleep(1);
            }
        }, this);
    }

    register(toolClass: toolConstruct, name: string, item?: string | string[], condition?: toolCondition) {
        tools.set(name, toolClass);
        if (typeof item == "string") {
            this.fixedBindings.set(item, new toolClass());
        } else if (condition && Array.isArray(item)) {
            const tool = { condition, tool: new toolClass() };
            for (const key of item) {
                this.conditionalBindings.set(key, tool);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bind(toolId: string, itemId: string, playerId: string, ...args: any[]) {
        this.unbind(itemId, playerId);
        if (itemId) {
            const tool = new (tools.get(toolId))(...args);
            tool.type = toolId;
            this.createPlayerBindingMap(playerId);
            this.bindings.get(playerId).data[itemId]?.delete();
            this.bindings.get(playerId).data[itemId] = tool;
            this.bindings.get(playerId).save();
            return tool;
        } else {
            throw "worldedit.tool.noItem";
        }
    }

    unbind(itemId: string, playerId: string) {
        if (itemId) {
            if (this.fixedBindings.has(itemId)) {
                throw "worldedit.tool.fixedBind";
            }
            this.createPlayerBindingMap(playerId);
            this.bindings.get(playerId).data[itemId]?.delete();
            delete this.bindings.get(playerId).data[itemId];
            this.bindings.get(playerId).save();
        } else {
            throw "worldedit.tool.noItem";
        }
    }

    hasBinding(itemId: string, playerId: string) {
        if (itemId) {
            return !!this.bindings.get(playerId)?.data[itemId] || this.fixedBindings.has(itemId);
        } else {
            return false;
        }
    }

    getBindingType(itemId: string, playerId: string) {
        if (itemId) {
            const tool = this.bindings.get(playerId)?.data[itemId] || this.fixedBindings.get(itemId);
            return tool?.type ?? "";
        } else {
            return "";
        }
    }

    getBoundItems(playerId: string, type?: RegExp | string) {
        this.createPlayerBindingMap(playerId);
        const tools = this.bindings.get(playerId).data;
        return tools
            ? Array.from(Object.entries(tools))
                  .filter((binding) => !type || (typeof type == "string" ? binding[1].type == type : type.test(binding[1].type)))
                  .map((binding) => binding[0] as string)
            : ([] as string[]);
    }

    setProperty<T>(itemId: string, playerId: string, prop: string, value: T) {
        if (itemId) {
            const tool: toolObject = this.bindings.get(playerId).data[itemId];
            if (tool && prop in tool) {
                tool[prop] = value;
                this.bindings.get(playerId).save();
                return true;
            }
        }
        return false;
    }

    getProperty<T>(itemId: string, playerId: string, prop: string) {
        if (itemId) {
            const tool: toolObject = this.bindings.get(playerId).data[itemId];
            if (tool && prop in tool) {
                return tool[prop] as T;
            }
        }
        return null as T;
    }

    hasProperty(itemId: string, playerId: string, prop: string) {
        if (itemId) {
            const tool: toolObject = this.bindings.get(playerId).data[itemId];
            if (tool && prop in tool) {
                return true;
            }
        }
        return false;
    }

    setDisabled(playerId: string, disabled: boolean) {
        if (disabled && !this.disabled.includes(playerId)) {
            this.disabled.push(playerId);
        } else if (!disabled && this.disabled.includes(playerId)) {
            this.disabled.splice(this.disabled.indexOf(playerId), 1);
        }
    }

    private *onItemTick(item: ItemStack, player: Player, tick: number) {
        if (this.disabled.includes(player.id) || !hasSession(player.id)) return this.stopHolding(player);

        const key = item.typeId;
        let tool: Tool;
        if (this.bindings.get(player.id)?.data[key]) {
            tool = this.bindings.get(player.id).data[key];
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else {
            return this.stopHolding(player);
        }

        if (this.prevHeldTool.get(player) !== tool) {
            this.stopHolding(player);
            this.prevHeldTool.set(player, tool);
        }

        const gen = tool.tick?.(tool, player, getSession(player), tick);
        if (gen) yield* gen;
    }

    private onItemUse(item: ItemStack, player: Player, ev: ItemUseBeforeEvent | PlayerInteractWithBlockBeforeEvent, loc?: Vector) {
        if (this.disabled.includes(player.id) || !hasSession(player.id)) return;

        const key = item.typeId;
        let tool: Tool;
        if (this.bindings.get(player.id)?.data[key]) {
            tool = this.bindings.get(player.id).data[key];
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else if (this.conditionalBindings.get(key)?.condition(player, getSession(player))) {
            tool = this.conditionalBindings.get(key).tool;
        } else {
            return;
        }

        loc = loc ? (tool.onSurface ? Vector.add(loc, (<PlayerInteractWithBlockBeforeEvent>ev).blockFace) : loc) : undefined;
        if (tool.process(getSession(player), loc ? ToolAction.USE_ON : ToolAction.USE, loc)) {
            ev.cancel = true;
        }
    }

    private onBlockBreak(item: ItemStack, player: Player, ev: PlayerBreakBlockBeforeEvent, loc: Vector) {
        if (this.disabled.includes(player.id)) return;

        const key = item.typeId;
        let tool: Tool;
        if (this.bindings.get(player.id)?.data[key]) {
            tool = this.bindings.get(player.id).data[key];
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else if (this.conditionalBindings.get(key)?.condition(player, getSession(player))) {
            tool = this.conditionalBindings.get(key).tool;
        } else {
            return;
        }
        if (tool.process(getSession(player), ToolAction.BREAK, loc)) {
            ev.cancel = true;
        }
    }

    private onBlockHit(item: ItemStack, player: Player, ev: EntityHitBlockAfterEvent, loc: Vector) {
        if (this.disabled.includes(player.id)) return;

        const key = item.typeId;
        let tool: Tool;
        if (this.bindings.get(player.id)?.data[key]) {
            tool = this.bindings.get(player.id).data[key];
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else if (this.conditionalBindings.get(key)?.condition(player, getSession(player))) {
            tool = this.conditionalBindings.get(key).tool;
        } else {
            return;
        }
        tool.process(getSession(player), ToolAction.HIT, loc);
    }

    private onItemDrop(item: ItemStack, player: Player) {
        if (this.disabled.includes(player.id) || !hasSession(player.id)) {
            return;
        }

        const key = item.typeId;
        let tool: Tool;
        if (this.bindings.get(player.id)?.data[key]) {
            tool = this.bindings.get(player.id).data[key];
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else if (this.conditionalBindings.get(key)?.condition(player, getSession(player))) {
            tool = this.conditionalBindings.get(key).tool;
        } else {
            return;
        }
        tool.process(getSession(player), ToolAction.DROP);
    }

    private createPlayerBindingMap(playerId: string) {
        if (this.bindings.has(playerId)) return;
        const database = Databases.load<{ [id: string]: Tool }>(`tools|${playerId}`);
        this.bindings.set(playerId, database);
    }

    private stopHolding(player: Player) {
        if (!this.prevHeldTool.has(player)) return;
        this.prevHeldTool.get(player)?.process(getSession(player), ToolAction.STOP_HOLD);
        this.prevHeldTool.delete(player);
    }
}
export const Tools = new ToolBuilder();
