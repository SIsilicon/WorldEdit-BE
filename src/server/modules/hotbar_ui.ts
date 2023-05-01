/* eslint-disable @typescript-eslint/ban-types */
import { ItemUseBeforeEvent, Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerUtil } from "./player_util.js";
import { MenuContext, UIAction, DynamicElem, UIFormName } from "library/@types/classes/uiFormBuilder.js";
import { print } from "server/util.js";

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
  __useEvent__: (ev: ItemUseBeforeEvent) => void
  __tickEvent__: (ev: {currentTick: number}) => void
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

    print(title, player);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item.name} 1 ${item.data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`, player);
    }

    const itemUseBefore = (ev: ItemUseBeforeEvent) => {
      if (ev.source != player) return;
      ev.cancel = true;

      const slot = player.selectedSlot;
      if (items[slot].name == "wedit:blank") return;

      items[slot].action?.(ctx, player);
    };
    Server.prependListener("itemUseBefore", itemUseBefore);

    const tick = () => {
      this.tick?.(ctx, player);
    };
    Server.prependListener("tick", tick);

    const eventCtx = ctx as unknown as HotbarEventContext;
    eventCtx.setData("__useEvent__", itemUseBefore);
    eventCtx.setData("__tickEvent__", tick);
    this.entered?.(ctx, player);
  }

  exit(player: Player, ctx: MenuContext<T>) {
    this.exiting?.(ctx, player);
    const eventCtx = ctx as unknown as HotbarEventContext;
    Server.off("itemUseBefore", eventCtx.getData("__useEvent__"));
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