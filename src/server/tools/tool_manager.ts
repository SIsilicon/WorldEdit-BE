import { Player, BlockLocation, ItemStack, BeforeItemUseEvent, BlockBreakEvent, EntityInventoryComponent } from "mojang-minecraft";
import { Server } from "@notbeer-api";
import { Tool } from "./base_tool.js";
import { getSession } from "../sessions.js";
import { ENABLE_BLOCK_BREAK } from "@config.js";

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
      if (ev.source.id != "minecraft:player" || !ev.item) {
        return;
      }
      this.onItemUse(ev.item, ev.source as Player, ev);
    });
    Server.on("beforeItemUseOn", ev => {
      if (ev.source.id != "minecraft:player" || !ev.item) {
        return;
      }
      this.onItemUse(ev.item, ev.source as Player, ev, ev.blockLocation);
    });
    if (ENABLE_BLOCK_BREAK) {
      Server.on("blockBreak", ev => {
        if (ev.player.id != "minecraft:player") {
          return;
        }
        this.onBlockBreak(ev.item, ev.player, ev, ev.block.location);
      });
    }
    Server.on("tick", ev => {
      this.currentTick = ev.currentTick;
    });
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
      this.bindings.get(player.name).set(`${itemId}/${itemData}`, tool);
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
      this.bindings.get(player.name).delete(`${itemId}/${itemData}`);
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
      return this.bindings.get(player.name)?.has(`${itemId}/${itemData}`) || this.fixedBindings.has(itemId + "/0");
    } else {
      return false;
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
      const tool: toolObject = this.bindings.get(player.name).get(`${itemId}/${itemData}`);
      if (tool && prop in tool) {
        tool[prop] = value;
        return true;
      }
    }
    return false;
  }

  hasProperty(itemId: string, itemData: number, player: Player, prop: string) {
    if (itemId) {
      const tool: toolObject = this.bindings.get(player.name).get(`${itemId}/${itemData}`);
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

  private onItemUse(item: ItemStack, player: Player, ev: BeforeItemUseEvent, loc?: BlockLocation) {
    if (this.disabled.includes(player.name)) {
      return;
    }

    const key = `${item.id}/${item.data}`;
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

  private onBlockBreak(item: ItemStack, player: Player, ev: BlockBreakEvent, loc?: BlockLocation) {
    if (this.disabled.includes(player.name)) {
      return;
    }

    const comp = player.getComponent("inventory") as EntityInventoryComponent;
    if (comp.container.getItem(player.selectedSlot) == null) return;
    item = comp.container.getItem(player.selectedSlot);

    const key = `${item.id}/${item.data}`;
    let tool: Tool;
    if (this.bindings.get(player.name)?.has(key)) {
      tool = this.bindings.get(player.name).get(key);
    } else if (this.fixedBindings.has(key)) {
      tool = this.fixedBindings.get(key);
    } else {
      return;
    }

    player.dimension.getBlock(loc).setPermutation(ev.brokenBlockPermutation);
    tool.process(getSession(player), this.currentTick, loc, ev.brokenBlockPermutation);
  }

  private createPlayerBindingMap(player: Player) {
    if (!this.bindings.has(player.name)) {
      this.bindings.set(player.name, new Map<string, Tool>());
    }
  }
}
export const Tools = new ToolBuilder();