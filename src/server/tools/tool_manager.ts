import { Player, ItemStack, ItemUseBeforeEvent, world, EntityInventoryComponent, PlayerBreakBlockBeforeEvent } from "@minecraft/server";
import { contentLog, Server, sleep, Thread, Vector, Database } from "@notbeer-api";
import { Tool } from "./base_tool.js";
import { getSession, hasSession } from "../sessions.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolConstruct = new (...args: any[]) => Tool;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolObject = {[key: string]: any} & Tool;

class ToolBuilder {
  private tools = new Map<string, toolConstruct>();
  private bindings = new Map<string, Map<string, Tool>>();
  private databases = new Map<string, Database>;
  private fixedBindings = new Map<string, Tool>();

  private disabled: string[] = [];
  private currentTick = 0;

  constructor() {
    Server.on("itemUseBefore", ev => {
      if (ev.source.typeId != "minecraft:player" || !ev.itemStack) {
        return;
      }

      this.onItemUse(ev.itemStack, ev.source as Player, ev);
    });
    Server.on("itemUseOnBefore", ev => {
      if (ev.source.typeId != "minecraft:player" || !ev.itemStack) {
        return;
      }
      this.onItemUse(ev.itemStack, ev.source as Player, ev, Vector.from(ev.block));
    });

    Server.on("tick", ev => {
      this.currentTick = ev.currentTick;
    });

    new Thread().start(function* (self: ToolBuilder) {
      while (true) {
        for (const player of world.getPlayers()) {
          try {
            const item = Server.player.getHeldItem(player);
            if (!item) continue;
            yield* self.onItemTick(item, player, self.currentTick);
          } catch (err) {
            contentLog.error(err);
          }
        }
        yield sleep(1);
      }
    }, this);

    Server.on("blockBreak", ev => {
      const item = Server.player.getHeldItem(ev.player);
      if (!item) {
        return;
      }
      this.onBlockBreak(item, ev.player, ev);
    });
  }

  register(toolClass: toolConstruct, name: string, item?: string) {
    this.tools.set(name, toolClass);
    if (item) {
      this.fixedBindings.set(item, new (toolClass)());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bind(toolId: string, itemId: string, playerId: string, ...args: any[]) {
    this.unbind(itemId, playerId);
    if (itemId) {
      const tool = new (this.tools.get(toolId))(...args);
      tool.type = toolId;
      this.createPlayerBindingMap(playerId);
      this.bindings.get(playerId).get(itemId)?.delete();
      this.bindings.get(playerId).set(itemId, tool);
      this.databases.get(playerId).set(itemId, tool);
      this.databases.get(playerId).save();
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
      this.bindings.get(playerId).get(itemId)?.delete();
      this.bindings.get(playerId).delete(itemId);
      this.databases.get(playerId).delete(itemId);
      this.databases.get(playerId).save();
    } else {
      throw "worldedit.tool.noItem";
    }
  }

  deleteBindings(playerId: string) {
    this.bindings.get(playerId).forEach(v => v.delete());
    this.bindings.delete(playerId);
    this.setDisabled(playerId, false);
  }

  hasBinding(itemId: string, playerId: string) {
    if (itemId) {
      return this.bindings.get(playerId)?.has(itemId) || this.fixedBindings.has(itemId);
    } else {
      return false;
    }
  }

  getBindingType(itemId: string, playerId: string) {
    if (itemId) {
      const tool = this.bindings.get(playerId)?.get(itemId) || this.fixedBindings.get(itemId);
      return tool?.type ?? "";
    } else {
      return "";
    }
  }

  getBoundItems(playerId: string, type?: RegExp|string) {
    this.createPlayerBindingMap(playerId);
    const tools = this.bindings.get(playerId);
    return tools ? Array.from(tools.entries())
      .filter(binding => !type || (typeof type == "string" ? binding[1].type == type : type.test(binding[1].type)))
      .map(binding => binding[0]) : [] as string[];
  }

  setProperty<T>(itemId: string, playerId: string, prop: string, value: T) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(playerId).get(itemId);
      if (tool && prop in tool) {
        tool[prop] = value;
        this.databases.get(playerId).set(itemId, tool);
        this.databases.get(playerId).save();
        return true;
      }
    }
    return false;
  }

  getProperty<T>(itemId: string, playerId: string, prop: string) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(playerId).get(itemId);
      if (tool && prop in tool) {
        return tool[prop] as T;
      }
    }
    return null as T;
  }

  hasProperty(itemId: string, playerId: string, prop: string) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(playerId).get(itemId);
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
    if (this.disabled.includes(player.id) || !hasSession(player.id)) {
      return;
    }

    const key = item.typeId;
    let tool: Tool;
    if (this.bindings.get(player.id)?.has(key)) {
      tool = this.bindings.get(player.id).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    const gen = tool.tick?.(tool, player, getSession(player), tick);
    if (gen) yield* gen;
  }

  private onItemUse(item: ItemStack, player: Player, ev: ItemUseBeforeEvent, loc?: Vector) {
    if (this.disabled.includes(player.id) || !hasSession(player.id)) {
      return;
    }

    const key = item.typeId;
    let tool: Tool;
    if (this.bindings.get(player.id)?.has(key)) {
      tool = this.bindings.get(player.id).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    tool.process(getSession(player), this.currentTick, loc);
    ev.cancel = true;
  }

  private onBlockBreak(item: ItemStack, player: Player, ev: PlayerBreakBlockBeforeEvent) {
    if (this.disabled.includes(player.id)) {
      return;
    }

    const comp = player.getComponent("inventory") as EntityInventoryComponent;
    if (comp.container.getItem(player.selectedSlot) == null) return;
    item = comp.container.getItem(player.selectedSlot);

    const key = item.typeId;
    let tool: Tool;
    if (this.bindings.get(player.id)?.has(key)) {
      tool = this.bindings.get(player.id).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    const processed = tool.process(getSession(player), this.currentTick, Vector.from(ev.block), ev.block.permutation);
    if (processed) ev.cancel = true;
  }

  private createPlayerBindingMap(playerId: string) {
    if (this.bindings.has(playerId)) return;
    this.bindings.set(playerId, new Map<string, Tool>());
    const database = new Database(`wedit:tools,${playerId}`);
    this.databases.set(playerId, database);
    database.load();
    for (const itemId of database.keys()) {
      const json = database.get(itemId);
      try {
        const toolClass = this.tools.get(json.type);
        const tool = new toolClass(...(toolClass as toolConstruct & typeof Tool).parseJSON(json));
        tool.type = json.type;
        this.bindings.get(playerId).set(itemId, tool);
      } catch (err) {
        contentLog.error(`Failed to load tool from '${JSON.stringify(json)}' for '${itemId}': ${err}`);
      }
    }
  }
}
export const Tools = new ToolBuilder();