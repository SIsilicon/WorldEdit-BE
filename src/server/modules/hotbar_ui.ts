/* eslint-disable @typescript-eslint/ban-types */
import { BeforeItemUseEvent, Player, BeforeItemUseOnEvent, TickEvent } from "@minecraft/server";
import { Server, RawText, setTickTimeout } from "@notbeer-api";
import { PlayerUtil } from "./player_util.js";
import { Pattern } from "./pattern.js";
import { Mask } from "./mask.js";
import { PlayerSession } from "../sessions.js";
import { print, printerr } from "../util.js";
import { SphereBrush } from "../brushes/sphere_brush.js";
import { CylinderBrush } from "../brushes/cylinder_brush.js";
import { SmoothBrush } from "../brushes/smooth_brush.js";
import { Tools } from "../tools/tool_manager.js";
import { MenuContext, UIAction, DynamicElem, UIFormName } from "library/@types/build/classes/uiFormBuilder.js";

interface HotbarItem<T extends {}> {
  item: DynamicElem<T, string>
  dataValue?: DynamicElem<T, number>
  action: UIAction<T, void>
}

interface HotbarForm<T extends{}> {
  title: DynamicElem<T, string>,
  cancel: UIAction<T, void>

  items: DynamicElem<T, {[key in 0|1|2|3|4|5|6|7]?: HotbarItem<T>}>
  tick?: UIAction<T, void>
  entered?: UIAction<T, void>
  exiting?: UIAction<T, void>
}

type HotbarEventContext = MenuContext<{
  __useEvent__: (ev: BeforeItemUseEvent) => void
  __tickEvent__: (ev: TickEvent) => void
}>

class HotbarUIForm<T extends {}> {
  private items: { name: string, data: number, action: UIAction<T, void> }[] = [];
  private title: string;

  private readonly tick: UIAction<T, void>;
  private readonly cancel: UIAction<T, void>;
  private readonly entered: UIAction<T, void>;
  private readonly exiting: UIAction<T, void>;

  constructor(private readonly form: HotbarForm<T>) {
    this.tick = form.tick;
    this.entered = form.entered;
    this.exiting = form.exiting;
    this.cancel = form.cancel;
  }

  protected build(ctx: MenuContext<T>, player: Player) {
    const resEl = <S>(element: DynamicElem<T, S>): S => {
      return element instanceof Function ? element(ctx, player) : element;
    };

    this.items = [];
    this.title = resEl(this.form.title);
    const formItems = resEl(this.form.items);
    for (let i = 0; i < 8; i++) {
      const itemData: HotbarItem<T> = formItems[i as keyof HotbarForm<T>["items"]] ?? { item: "wedit:blank" };
      this.items.push({
        name: resEl(itemData.item),
        data: resEl(itemData.dataValue ?? 0),
        action: itemData.action
      });
    }
    this.items.push({ name: "wedit:cancel_button", data: 0, action: (ctx, player) => {
      ctx.goto(null);
      this.cancel(ctx, player);
    }});
    return null as FormData;
  }

  enter(player: Player, ctx: MenuContext<T>) {
    PlayerUtil.stashHotbar(player);
    this.build(ctx, player);

    const title = this.title;
    const items = this.items;

    print(title, player, false);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item.name} 1 ${item.data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`, player);
    }

    const beforeItemUse = (ev: BeforeItemUseEvent) => {
      if (ev.source != player) return;
      ev.cancel = true;

      const slot = player.selectedSlot;
      if (items[slot].name == "wedit:blank") return;

      items[slot].action?.(ctx, player);
    };
    Server.prependListener("beforeItemUse", beforeItemUse);

    const tick = () => {
      this.tick?.(ctx, player);
    };
    Server.prependListener("tick", tick);

    const eventCtx = ctx as unknown as HotbarEventContext;
    eventCtx.setData("__useEvent__", beforeItemUse);
    eventCtx.setData("__tickEvent__", tick);
    this.entered?.(ctx, player);
  }

  exit(player: Player, ctx: MenuContext<T>) {
    this.exiting?.(ctx, player);
    const eventCtx = ctx as unknown as HotbarEventContext;
    Server.off("beforeItemUse", eventCtx.getData("__useEvent__"));
    Server.off("tick", eventCtx.getData("__tickEvent__"));
    PlayerUtil.restoreHotbar(player);
  }
}

class HotbarContext<T extends {}> implements MenuContext<T> {
  private stack: string[] = [];
  private data: T = {} as T;
  private currentForm: HotbarUIForm<T>;

  private base: MenuContext<T>;

  constructor(private player: Player, base?: MenuContext<T>) {
    this.base = base;
  }

  getData<S extends keyof T>(key: S): T[S] {
    return this.base?.getData(key) ?? this.data[key];
  }

  setData<S extends keyof T>(key: S, value: T[S]) {
    this.base?.setData(key, value);
    this.data[key] = value;
  }

  goto(menu: UIFormName) {
    if (menu) {
      this.stack.push(menu);
    }
    try {
      this.currentForm = HotbarUI.goto(menu, this.player, this);
    } catch (e) {
      if (!this.currentForm && this.base) {
        this.base.goto(menu);
      } else {
        throw e;
      }
    }
  }

  returnto(menu: UIFormName) {
    let popped: string;
    // eslint-disable-next-line no-cond-assign
    while (popped = this.stack.pop()) {
      if (popped == menu) {
        this.goto(menu);
        return;
      }
    }
    this.goto(null);
    this.base?.returnto(menu);
  }
}

class HotbarUIBuilder {

  private forms = new Map<UIFormName, HotbarUIForm<{}>>();
  private active = new Map<Player, HotbarUIForm<{}>>();

  /**
   * Register a Hotbar UI Form to be displayed to users.
   * @param name The name of the UI form
   * @param form The layout of the UI form
   */
  register<T extends {}>(name: UIFormName, form: HotbarForm<T>) {
    this.forms.set(name, new HotbarUIForm(form));
  }

  /**
   * Displays a UI form registered as `name` to `player`.
   * @param name The name of the UI form
   * @param player The player the UI form must be shown to
   * @param data Context data to be made available to the UI form's elements
   * @returns True if another form is already being displayed. Otherwise false.
   */
  show<T extends {}>(name: UIFormName, player: Player, data?: T) {
    if (this.displayingUI(player)) {
      return true;
    }
    const ctx = new HotbarContext<T>(player);
    Object.entries(data).forEach(e => ctx.setData(e[0] as keyof T, e[1] as typeof data[keyof T]));
    ctx.goto(name);
    return false;
  }

  /**
   * Go from one UI form to another.
   * @internal
   * @param name The name of the UI form to go to
   * @param player The player to display the UI form to
   * @param ctx The context to be passed to the UI form
   */
  goto(name: UIFormName, player: Player, ctx: MenuContext<{}>) {
    if (!(ctx instanceof HotbarContext)) {
      ctx = new HotbarContext(player, ctx);
    }

    if (this.active.has(player)) {
      this.active.get(player).exit(player, ctx);
      this.active.delete(player);
    }

    if (!name) {
      return;
    } else if (this.forms.has(name)) {
      const form = this.forms.get(name);
      this.active.set(player, form);
      form.enter(player, ctx);
      return form;
    } else {
      throw new TypeError(`Menu "${name}" has not been registered!`);
    }
  }

  /**
   * @param player The player being tested
   * @param ui The name of the UI to test for, if you want to be specific
   * @returns Whether the UI, or any at all is being displayed.
   */
  displayingUI(player: Player, ui?: UIFormName) {
    if (this.active.has(player)) {
      if (ui) {
        const form = this.active.get(player);
        for (const registered of this.forms.values()) {
          if (registered == form) {
            return true;
          }
        }
        return false;
      }
      return true;
    }
    return false;
  }
}

export const HotbarUI = new HotbarUIBuilder();

// TODO: Port old config menu to new Hotbar UI builder

type hotbarItems = { [k: number]: string | [string, number] };
interface state {
    hotbar: hotbarItems,
    entered?: () => void,
    input?: (itemType: string, itemData?: number) => void | boolean,
    tick?: () => void,
    exiting?: () => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
}

export class SettingsHotbar {
  private state: state;
  private session: PlayerSession;
  private player: Player;
  private states: { [k: string]: state } = {
    main: {
      hotbar: {
        0: "wedit:inc_entities_on_button",
        1: "wedit:inc_air_on_button",
        3: "wedit:tool_config_button",
        5: "wedit:brush_config_button",
        8: ["wedit:cancel_button", 1]
      },
      entered: () => {
        if (this.session.includeEntities) {
          PlayerUtil.replaceItem(this.player, "wedit:inc_entities_off_button", "wedit:inc_entities_on_button", true);
        } else {
          PlayerUtil.replaceItem(this.player, "wedit:inc_entities_on_button", "wedit:inc_entities_off_button", true);
        }
        if (this.session.includeAir) {
          PlayerUtil.replaceItem(this.player, "wedit:inc_air_off_button", "wedit:inc_air_on_button", true);
        } else {
          PlayerUtil.replaceItem(this.player, "wedit:inc_air_on_button", "wedit:inc_air_off_button", true);
        }
      },
      input: (itemType) => {
        if (itemType == "wedit:inc_entities_off_button") {
          this.session.includeEntities = true;
          PlayerUtil.replaceItem(this.player, "wedit:inc_entities_off_button", "wedit:inc_entities_on_button", true);
        } else if (itemType == "wedit:inc_entities_on_button") {
          this.session.includeEntities = false;
          PlayerUtil.replaceItem(this.player, "wedit:inc_entities_on_button", "wedit:inc_entities_off_button", true);
        } else if (itemType == "wedit:inc_air_off_button") {
          this.session.includeAir = true;
          PlayerUtil.replaceItem(this.player, "wedit:inc_air_off_button", "wedit:inc_air_on_button", true);
        } else if (itemType == "wedit:inc_air_on_button") {
          this.session.includeAir = false;
          PlayerUtil.replaceItem(this.player, "wedit:inc_air_on_button", "wedit:inc_air_off_button", true);
        } else if (itemType == "wedit:tool_config_button") {
          this.state["editMode"] = "tool";
          this.changeState("chooseTool");
        } else if (itemType == "wedit:brush_config_button") {
          this.state["editMode"] = "brush";
          this.changeState("chooseTool");
        } else if (itemType == "wedit:cancel_button") {
          this.session.exitSettings();
        }
      },
      editMode: "brush"
    },
    chooseTool: {
      hotbar: {
        0: "wedit:new_brush_button",
        8: "wedit:cancel_button"
      },
      entered: () => {
        this.state.idx = 0;
        this.state.update();
        this.msg("worldedit.config.editTool");
        Tools.setDisabled(this.player, true);
      },
      input: (itemType, itemData) => {
        if (itemType == "wedit:new_brush_button") {
          this.changeState("chooseItem");
          this.newTool = true;
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("main");
        } else if (itemType == "wedit:next_button") {
          this.state.idx++;
          this.state.update();
        } else if (itemType == "wedit:prev_button") {
          this.state.idx--;
          this.state.update();
        } else if (itemType == "wedit:blank") {
          return;
        } else {
          this.currBindItem = [itemType, itemData];
          this.newTool = false;
          this.changeState("editTool");
          return true;
        }
      },
      exiting: () => {
        setTickTimeout((player: Player) => {
          Tools.setDisabled(player, false);
        }, 1, this.player);
      },

      idx: 0,
      update: () => {
        const tools = Tools.getBoundItems(this.player, this.states.main.editMode == "brush" ? "brush" : /^.*(?<!brush)$/);
        const items: hotbarItems = { ...this.state.hotbar };
        if (tools.length < 6) {
          for (let i = 0; i < tools.length; i++) {
            items[i + 2] = tools[i];
          }
        } else {
          const idx = this.state.idx;
          if (idx > 0) {
            items[1] = "wedit:prev_button";
          }
          if (idx < tools.length - 5) {
            items[7] = "wedit:next_button";
          }
          for (let i = 0; i < 5; i++) {
            items[i + 2] = tools[i + idx];
          }
        }
        this.setHotbarItems(items);
      }
    },
    chooseItem: {
      hotbar: {
        8: "wedit:cancel_button"
      },
      entered: () => {
        this.msg("worldedit.config.chooseItem");
        Server.runCommand("clear @s wedit:blank", this.player);
      },
      input: (itemType) => {
        if (itemType == "wedit:cancel_button") {
          this.changeState("chooseTool");
        }
      },
      tick: () => {
        const item = Server.player.getHeldItem(this.player);
        if (this.player.selectedSlot != 8 && item) {
          this.currBindItem = [item.typeId, item.data];
          this.changeState("editTool");
        }
      }
    },
    editTool: {
      hotbar: {
        0: "wedit:delete_button",
        3: "wedit:sphere_button",
        4: "wedit:cylinder_button",
        5: "wedit:smooth_button",
        8: "wedit:cancel_button"
      },
      entered: () => {
        let hotbarItems = { ...this.state.hotbar };
        if (this.states.main.editMode == "tool") {
          hotbarItems = {
            0: "wedit:delete_button",
            2: "wedit:selection_button",
            3: "wedit:far_selection_button",
            5: "wedit:navigation_button",
            6: "wedit:stacker_button",
            8: "wedit:cancel_button"
          };
        }
        if (this.newTool) {
          delete hotbarItems[0];
        }

        this.editingTool = "";
        this.toolData = [];
        this.setHotbarItems(hotbarItems);
        this.msg("worldedit.config.choose." + this.states.main.editMode);
      },
      input: (itemType) => {
        if (itemType == "wedit:sphere_button") {
          this.editingTool = "sphere";
          this.changeState(this.toolMenus["sphere"][0]);
        } else if (itemType == "wedit:cylinder_button") {
          this.editingTool = "cylinder";
          this.changeState(this.toolMenus["cylinder"][0]);
        } else if (itemType == "wedit:smooth_button") {
          this.editingTool = "smooth";
          this.changeState(this.toolMenus["smooth"][0]);
        } else if (itemType == "wedit:selection_button") {
          this.editingTool = "selection";
          this.changeState("confirmTool");
        } else if (itemType == "wedit:far_selection_button") {
          this.editingTool = "far_selection";
          this.changeState("confirmTool");
        } else if (itemType == "wedit:navigation_button") {
          this.editingTool = "navigation";
          this.changeState("confirmTool");
        } else if (itemType == "wedit:stacker_button") {
          this.editingTool = "stacker";
          this.changeState(this.toolMenus["stacker"][0]);
        } else if (itemType == "wedit:delete_button") {
          this.editingTool = "unbind";
          this.changeState("confirmTool");
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("chooseTool");
        }
      }
    },
    selectNumber: {
      hotbar: {
        1: "wedit:one_button",
        2: "wedit:two_button",
        3: "wedit:three_button",
        4: "wedit:four_button",
        5: "wedit:five_button",
        6: "wedit:six_button",
        8: "wedit:cancel_button"
      },
      entered: () => {
        if (this.states.main.editMode == "tool") {
          if (this.editingTool == "stacker") {
            this.msg("worldedit.config.selectRange.tool");
          }
        } else {
          if (this.toolData.length == 0) {
            this.msg("worldedit.config.selectRadius.brush");
          } else if (this.toolData.length == 1 && this.editingTool == "cylinder") {
            this.msg("worldedit.config.selectHeight.brush");
          } else if (this.toolData.length == 1 && this.editingTool == "smooth") {
            this.msg("worldedit.config.selectSmooth.brush");
          }
        }
      },
      input: (itemType) => {
        let num: number;
        if (itemType == "wedit:one_button") {
          num = 1;
        } else if (itemType == "wedit:two_button") {
          num = 2;
        } else if (itemType == "wedit:three_button") {
          num = 3;
        } else if (itemType == "wedit:four_button") {
          num = 4;
        } else if (itemType == "wedit:five_button") {
          num = 5;
        } else if (itemType == "wedit:six_button") {
          num = 6;
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("editTool");
          return;
        }
        if (num) {
          this.toolData.push(num);
          this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
        }
      }
    },
    patternAndMask: {
      hotbar: {
        3: "wedit:pattern_picker",
        5: "wedit:mask_picker",
        7: "wedit:confirm_button",
        8: "wedit:cancel_button"
      },
      entered: () => {
        this.stashedPattern = this.session.globalPattern;
        this.stashedMask = this.session.globalMask;
        this.session.globalPattern = new Pattern();
        this.session.globalMask = new Mask();

        this.msg("worldedit.config.paternMask." + this.states.main.editMode);
      },
      input: (itemType) => {
        if (itemType == "wedit:confirm_button") {
          this.toolData.push([this.session.globalPattern, this.session.globalMask]);
          this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("editTool");
        }
      },
      exiting: () => {
        this.session.globalPattern = this.stashedPattern;
        this.session.globalMask = this.stashedMask;
      }
    },
    mask: {
      hotbar: {
        4: "wedit:mask_picker",
        7: "wedit:confirm_button",
        8: "wedit:cancel_button"
      },
      entered: () => {
        this.stashedMask = this.session.globalMask;
        this.session.globalMask = new Mask();
        this.msg("worldedit.config.mask." + this.states.main.editMode);
      },
      input: (itemType) => {
        if (itemType == "wedit:confirm_button") {
          this.toolData.push(this.session.globalMask);
          this.changeState(this.toolMenus[this.editingTool][this.toolData.length]);
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("editTool");
        }
      },
      exiting: () => {
        this.session.globalMask = this.stashedMask;
      }
    },
    confirmTool: {
      hotbar: {
        3: "wedit:confirm_button",
        5: "wedit:cancel_button"
      },
      input: (itemType) => {
        if (itemType == "wedit:confirm_button") {
          const item = this.currBindItem;

          if (this.editingTool == "unbind") {
            this.session.unbindTool(item);
            this.changeState("chooseTool");
            this.msg("worldedit.config.unbind");
            return;
          }

          if (this.editingTool == "sphere") {
            this.session.bindTool("brush", item, new SphereBrush(this.toolData[0], this.toolData[1][0], false), this.toolData[1][1]);
          } else if (this.editingTool == "cylinder") {
            this.session.bindTool("brush", item, new CylinderBrush(this.toolData[0], this.toolData[1], this.toolData[2][0], false), this.toolData[2][1]);
          } else if (this.editingTool == "smooth") {
            this.session.bindTool("brush", item, new SmoothBrush(this.toolData[0], this.toolData[1], this.toolData[2]));
          } else if (this.editingTool == "selection") {
            this.session.bindTool("selection_wand", item);
          } else if (this.editingTool == "far_selection") {
            this.session.bindTool("far_selection_wand", item);
          } else if (this.editingTool == "navigation") {
            this.session.bindTool("navigation_wand", item);
          } else if (this.editingTool == "stacker") {
            this.session.bindTool("stacker_wand", item, this.toolData[0], this.toolData[1]);
          }

          this.changeState("chooseTool");
          if (!PlayerUtil.hasItem(this.player, ...item)) {
            Server.runCommand(`give @s ${item[0]} 1 ${item[1]}`, this.player);
            this.msg("worldedit.config.setGive." + this.states.main.editMode);
          } else {
            this.msg("worldedit.config.set." + this.states.main.editMode);
          }
        } else if (itemType == "wedit:cancel_button") {
          this.changeState("editTool");
        }
      },
      tick: () => {
        if (this.editingTool == "unbind") {
          this.msg("worldedit.config.confirm.delete");
          return;
        }

        let msg = RawText.translate("worldedit.config.confirm").append("text", "\n");
        msg = msg.append("translate", `item.wedit:${this.editingTool}_button`).append("text", this.toolData.length ? ":\n " : "");

        if (this.editingTool == "sphere") {
          msg.append("translate", "worldedit.config.radius").with(this.toolData[0]);
          const pattern = this.toolData[1][0].getBlockSummary();
          const mask = this.toolData[1][1].getBlockSummary();
          if (pattern) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.creates").with(pattern);
          }
          if (mask) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.affects").with(mask);
          }
        } else if (this.editingTool == "cylinder") {
          msg.append("translate", "worldedit.config.radius").with(this.toolData[0]);
          msg.append("text", "\n ");
          msg.append("translate", "worldedit.config.height").with(this.toolData[1]);
          const pattern = this.toolData[2][0].getBlockSummary();
          const mask = this.toolData[2][1].getBlockSummary();

          if (pattern) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.creates").with(pattern);
          }
          if (mask) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.affects").with(mask);
          }
        } else if (this.editingTool == "smooth") {
          msg.append("translate", "worldedit.config.radius").with(this.toolData[0]);
          msg.append("text", "\n ");
          msg.append("translate", "worldedit.config.smooth").with(this.toolData[1]);
          const mask = this.toolData[2].getBlockSummary();

          if (mask) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.affects").with(mask);
          }
        } else if (this.editingTool == "stacker") {
          msg.append("translate", "worldedit.config.range").with(this.toolData[0]);
          const mask = this.toolData[1].getBlockSummary();
          if (mask) {
            msg.append("text", "\n ");
            msg.append("translate", "worldedit.config.affects").with(mask);
          }
        }
        this.msg(msg);
      }
    }
  };

  private currBindItem: [string, number]; // Id and data value
  private newTool: boolean;
  private editingTool = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toolData: any[] = [];
  private toolMenus: { [k: string]: string[] } = {
    "sphere": ["selectNumber", "patternAndMask", "confirmTool"],
    "cylinder": ["selectNumber", "selectNumber", "patternAndMask", "confirmTool"],
    "smooth": ["selectNumber", "selectNumber", "mask", "confirmTool"],
    "stacker": ["selectNumber", "mask", "confirmTool"]
  };

  private cancelItemUseOn = (ev: BeforeItemUseOnEvent) => {
    if (ev.source.typeId == "minecraft:player" && (ev.source as Player).name == this.player.name) {
      ev.cancel = true;
    }
  };

  private stashedPattern: Pattern;
  private stashedMask: Mask;

  constructor(session: PlayerSession) {
    this.session = session;
    this.player = session.getPlayer();
    PlayerUtil.stashHotbar(session.getPlayer());
    this.changeState("main");
    Server.on("beforeItemUseOn", this.cancelItemUseOn);
  }

  onTick() {
    this.state?.tick?.();
  }

  onItemUse(ev: BeforeItemUseEvent) {
    if (ev.item) {
      if (this.state?.input?.(ev.item.typeId, ev.item.data)) {
        ev.cancel = true;
      }
    }
  }

  setHotbarItems(items: hotbarItems) {
    const player = this.player;
    for (let i = 0; i < 9; i++) {
      const [item, data] = Array.isArray(items[i]) ? <[string, number]>items[i] : [<string>items[i] ?? "wedit:blank", 0];
      Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item} 1 ${data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`, player);
    }
  }

  changeState(state: string) {
    this.state?.exiting?.();
    this.state = this.states[state];
    this.setHotbarItems(this.state.hotbar);
    this.state.entered?.();
  }

  msg(msg: string | RawText, ...sub: string[]) {
    let raw = msg;
    if (typeof msg == "string") {
      raw = RawText.translate(msg);
      for (const text of sub) raw = raw.with(text);
    }
    print(raw, this.player, true);
  }

  err(msg: string | RawText, ...sub: string[]) {
    let raw = msg;
    if (typeof msg == "string") {
      raw = RawText.translate(msg);
      for (const text of sub) raw = raw.with(text);
    }
    printerr(raw, this.player, true);
  }

  exit() {
    this.state?.exiting?.();
    PlayerUtil.restoreHotbar(this.player);
    this.session = null;
    this.player = null;
    Server.off("beforeItemUseOn", this.cancelItemUseOn);
  }
}