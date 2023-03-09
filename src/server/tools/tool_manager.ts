import { Player, ItemStack, BeforeItemUseEvent, world, BlockBreakEvent, EntityInventoryComponent } from "@minecraft/server";
import { contentLog, Server, sleep, Thread, Vector } from "@notbeer-api";
import { Tool } from "./base_tool.js";
import { getSession, hasSession } from "../sessions.js";
import config from "config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolConstruct = new (...args: any[]) => Tool;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type toolObject = {[key: string]: any} & Tool;

class ToolBuilder {
  private tools = new Map<string, toolConstruct>();
  private bindings = new Map<string, Map<string, Tool>>();
  private fixedBindings = new Map<string, Tool>();

  private disabled: string[] = [];
  private currentTick = 0;

  constructor() {
    Server.on("beforeItemUse", ev => {
      if (ev.source.typeId != "minecraft:player" || !ev.item) {
        return;
      }
      this.onItemUse(ev.item, ev.source as Player, ev);
    });
    Server.on("beforeItemUseOn", ev => {
      if (ev.source.typeId != "minecraft:player" || !ev.item) {
        return;
      }
      // TODO: Fixed in 1.19.80
      this.onItemUse(ev.item, ev.source as Player, ev, Vector.from(ev.source.getBlockFromViewDirection({
        includePassableBlocks: true,
        includeLiquidBlocks: false,
        maxDistance: 10
      })?.location));
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

    if (config.useBlockBreaking) {
      Server.on("blockBreak", ev => {
        const item = Server.player.getHeldItem(ev.player);
        if (!item) {
          return;
        }
        this.onBlockBreak(item, ev.player, ev);
      });
    }
  }

  register(toolClass: toolConstruct, name: string, item?: string) {
    this.tools.set(name, toolClass);
    if (item) {
      this.fixedBindings.set(item + "/0", new (toolClass)());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bind(toolId: string, itemId: string, itemData: number, player: Player, ...args: any[]) {
    this.unbind(itemId, itemData, player);
    if (itemId) {
      const tool = new (this.tools.get(toolId))(...args);
      tool.type = toolId;
      this.createPlayerBindingMap(player);
      this.bindings.get(player.name).set(`${itemId}/${0}`, tool);
      return tool;
    } else {
      throw "worldedit.tool.noItem";
    }
  }

  unbind(itemId: string, itemData: number, player: Player) {
    if (itemId) {
      if (this.fixedBindings.has(itemId + "/0")) {
        throw "worldedit.tool.fixedBind";
      }
      this.createPlayerBindingMap(player);
      this.bindings.get(player.name).delete(`${itemId}/${0}`);
    } else {
      throw "worldedit.tool.noItem";
    }
  }

  deleteBindings(player: Player) {
    this.bindings.delete(player.name);
    this.setDisabled(player, false);
  }

  hasBinding(itemId: string, itemData: number, player: Player) {
    if (itemId) {
      return this.bindings.get(player.name)?.has(`${itemId}/${0}`) || this.fixedBindings.has(itemId + "/0");
    } else {
      return false;
    }
  }

  getBindingType(itemId: string, itemData: number, player: Player) {
    if (itemId) {
      const tool = this.bindings.get(player.name)?.get(`${itemId}/${0}`) || this.fixedBindings.get(itemId + "/0");
      return tool?.type ?? "";
    } else {
      return "";
    }
  }

  getBoundItems(player: Player, type?: RegExp|string) {
    const tools = this.bindings.get(player.name);
    return tools ? Array.from(tools.entries())
      .filter(binding => !type || (typeof type == "string" ? binding[1].type == type : type.test(binding[1].type)))
      .map(binding => [binding[0].split("/")[0], parseInt(binding[0].split("/")[1])] as [string, number])
      : [] as [string, number][];
  }

  setProperty<T>(itemId: string, itemData: number, player: Player, prop: string, value: T) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(player.name).get(`${itemId}/${0}`);
      if (tool && prop in tool) {
        tool[prop] = value;
        return true;
      }
    }
    return false;
  }

  getProperty<T>(itemId: string, itemData: number, player: Player, prop: string) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(player.name).get(`${itemId}/${0}`);
      if (tool && prop in tool) {
        return tool[prop] as T;
      }
    }
    return null as T;
  }

  hasProperty(itemId: string, itemData: number, player: Player, prop: string) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(player.name).get(`${itemId}/${0}`);
      if (tool && prop in tool) {
        return true;
      }
    }
    return false;
  }

  setDisabled(player: Player, disabled: boolean) {
    if (disabled && !this.disabled.includes(player.name)) {
      this.disabled.push(player.name);
    } else if (!disabled && this.disabled.includes(player.name)) {
      this.disabled.splice(this.disabled.indexOf(player.name), 1);
    }
  }

  private *onItemTick(item: ItemStack, player: Player, tick: number) {
    if (this.disabled.includes(player.name) || !hasSession(player.name)) {
      return;
    }

    const key = `${item.typeId}/${0}`;
    let tool: Tool;
    if (this.bindings.get(player.name)?.has(key)) {
      tool = this.bindings.get(player.name).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    const gen = tool.tick?.(tool, player, getSession(player), tick);
    if (gen) yield* gen;
  }

  private onItemUse(item: ItemStack, player: Player, ev: BeforeItemUseEvent, loc?: Vector) {
    if (this.disabled.includes(player.name) || !hasSession(player.name)) {
      return;
    }

    const key = `${item.typeId}/${0}`;
    let tool: Tool;
    if (this.bindings.get(player.name)?.has(key)) {
      tool = this.bindings.get(player.name).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    tool.process(getSession(player), this.currentTick, loc);
    ev.cancel = true;
  }

  private onBlockBreak(item: ItemStack, player: Player, ev: BlockBreakEvent) {
    if (this.disabled.includes(player.name)) {
      return;
    }

    const comp = player.getComponent("inventory") as EntityInventoryComponent;
    if (comp.container.getItem(player.selectedSlot) == null) return;
    item = comp.container.getItem(player.selectedSlot);

    const key = `${item.typeId}/${0}`;
    let tool: Tool;
    if (this.bindings.get(player.name)?.has(key)) {
      tool = this.bindings.get(player.name).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    const processed = tool.process(getSession(player), this.currentTick, Vector.from(ev.block.location), ev.brokenBlockPermutation);
    if (processed) {
      player.dimension.getBlock(ev.block.location).setPermutation(ev.brokenBlockPermutation);
    }
  }

  private createPlayerBindingMap(player: Player) {
    if (!this.bindings.has(player.name)) {
      this.bindings.set(player.name, new Map<string, Tool>());
    }
  }
}
export const Tools = new ToolBuilder();