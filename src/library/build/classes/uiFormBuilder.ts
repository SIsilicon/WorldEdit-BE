/* eslint-disable @typescript-eslint/ban-types */
import { MessageFormData, MessageFormResponse, ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse, FormCancelationReason, FormResponse } from "@minecraft/server-ui";
import { Form, FormData, UIAction, MessageForm, ActionForm, SubmitAction, ModalForm, UIFormName, MenuContext as MenuContextType, DynamicElem, HotbarForm, HotbarItem } from "../../@types/build/classes/uiFormBuilder";
import { BeforeItemUseEvent, Player, TickEvent } from "@minecraft/server";
import { Server, setTickTimeout } from "@notbeer-api";

abstract class UIForm<T extends {}> {
  private readonly form: Form<T>;
  protected readonly cancelAction: UIAction<T, void>;

  constructor(form: Form<T>) {
    this.form = form;
    this.cancelAction = form.cancel;
  }

  protected abstract build(form: Form<T>, resEl: <S>(elem: DynamicElem<T, S>) => S): FormData;

  public abstract enter(player: Player, ctx: MenuContext<T>): void;

  public abstract exit(player: Player, ctx: MenuContext<T>): void;

  protected handleCancel(response: FormResponse, player: Player, ctx: MenuContext<T>) {
    if (response.canceled) {
      if (response.cancelationReason == FormCancelationReason.userBusy) {
        setTickTimeout(() => this.enter(player, ctx));
      } else {
        this.cancelAction(ctx, player);
      }
      return true;
    }
    return false;
  }

  protected buildFormData(player: Player, ctx: MenuContext<T>) {
    const resolve = <S>(elem: DynamicElem<T, S>): S => this.resolve(elem, player, ctx);
    return this.build(this.form, resolve);
  }

  protected resolve<S>(element: DynamicElem<T, S>, player: Player, ctx: MenuContext<T>) {
    if (element instanceof Function) {
      return element(ctx, player);
    } else {
      return element;
    }
  }
}

class MessageUIForm<T extends {}> extends UIForm<T> {
  private readonly action1: UIAction<T, void>;
  private readonly action2: UIAction<T, void>;

  constructor(form: MessageForm<T>) {
    super(form);
    this.action1 = form.button1.action;
    this.action2 = form.button2.action;
  }

  protected build(form: MessageForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S) {
    const formData = new MessageFormData();
    formData.title(resEl(form.title));
    formData.body(resEl(form.message));
    formData.button1(resEl(form.button1.text));
    if ("button2" in form) {
      formData.button2(resEl(form.button2.text));
    }
    return formData;
  }

  enter(player: Player, ctx: MenuContext<T>) {
    this.buildFormData(player, ctx).show(player).then((response: MessageFormResponse) => {
      if (this.handleCancel(response, player, ctx)) {
        return;
      }
      if (response.selection == 0) {
        this.action1(ctx, player);
      } else if (response.selection == 1) {
        this.action2(ctx, player);
      }
    });
  }

  exit() {
    return;
  }
}

class ActionUIForm<T extends {}> extends UIForm<T> {
  private actions: UIAction<T, void>[] = []; // Changes between builds

  protected build(form: ActionForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S) {
    this.actions = [];
    const formData = new ActionFormData();
    formData.title(resEl(form.title));

    if (form.message) {
      formData.body(resEl(form.message));
    }
    for (const button of resEl(form.buttons)) {
      formData.button(resEl(button.text), resEl(button.icon));
      this.actions.push(button.action);
    }
    return formData;
  }

  async enter(player: Player, ctx: MenuContext<T>) {
    const form = this.buildFormData(player, ctx);
    const actions = this.actions;
    form.show(player).then((response: ActionFormResponse) => {
      if (this.handleCancel(response, player, ctx)) {
        return;
      }
      actions[response.selection]?.(ctx, player);
    });
  }

  exit() {
    return;
  }
}

class ModalUIForm<T extends {}> extends UIForm<T> {
  private readonly submit: SubmitAction<T>;
  private inputNames: string[] = []; // Changes between builds

  constructor(form: ModalForm<T>) {
    super(form);
    this.submit = form.submit;
  }

  protected build(form: ModalForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S) {
    this.inputNames = [];
    const formData = new ModalFormData();
    formData.title(resEl(form.title));

    for (const id in form.inputs) {
      const input = form.inputs[id as UIFormName];

      if (input.type == "dropdown") {
        formData.dropdown(
          resEl(input.name), resEl(input.options),
          resEl(input.default)
        );
      } else if (input.type == "slider") {
        formData.slider(
          resEl(input.name), resEl(input.min), resEl(input.max),
          resEl(input.step), resEl(input.default)
        );
      } else if (input.type == "textField") {
        formData.textField(
          resEl(input.name), resEl(input.placeholder),
          resEl(input.default)
        );
      } else if (input.type == "toggle") {
        formData.toggle(
          resEl(input.name), resEl(input.default)
        );
      }
      this.inputNames.push(id);
    }
    return formData;
  }

  enter(player: Player, ctx: MenuContext<T>) {
    const form = this.buildFormData(player, ctx);
    const inputNames = this.inputNames;
    form.show(player).then((response: ModalFormResponse) => {
      if (this.handleCancel(response, player, ctx)) {
        return;
      }
      const inputs: {[key: string]: string|number|boolean} = {};
      for (const i in response.formValues) {
        inputs[inputNames[i]] = response.formValues[i];
      }
      this.submit(ctx, player, inputs);
    });
  }

  exit() {
    return;
  }
}

type EventContext = MenuContext<{
  __useEvent__: (ev: BeforeItemUseEvent) => void
  __tickEvent__: (ev: TickEvent) => void
}>

class HotbarUIForm<T extends {}> extends UIForm<T> {
  private items: { name: string, data: number, action: UIAction<T, void> }[] = [];
  private readonly tick: UIAction<T, void>;

  constructor(form: HotbarForm<T>) {
    super(form);
    this.tick = form.tick;
  }

  protected build(form: HotbarForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S) {
    this.items = [];
    const formItems = resEl(form.items);
    for (let i = 0; i < 8; i++) {
      const itemData: HotbarItem<T> = formItems[i as keyof HotbarForm<T>["items"]] ?? { item: "wedit:blank" };
      this.items.push({
        name: resEl(itemData.item),
        data: resEl(itemData.dataValue ?? 0),
        action: itemData.action
      });
    }
    this.items.push({ name: "wedit:cancel_button", data: 0, action: this.cancelAction });
    return null as FormData;
  }

  enter(player: Player, ctx: MenuContext<T>) {
    Server.player.stashHotbar(player);
    this.buildFormData(player, ctx);
    const items = this.items;

    for (let i = 0; i < this.items.length; i++) {
      const item = items[i];
      Server.runCommand(`replaceitem entity @s slot.hotbar ${i} ${item.name} 1 ${item.data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`, player);
    }

    const addEventCtx = () => {
      const eventCtx = ctx as unknown as EventContext;
      eventCtx.setData("__useEvent__", beforeItemUse);
      eventCtx.setData("__tickEvent__", tick);
    };

    const beforeItemUse = (ev: BeforeItemUseEvent) => {
      if (ev.source != player) return;
      ev.cancel = true;

      const slot = player.selectedSlot;
      if (items[slot].name == "wedit:blank") return;

      addEventCtx();
      items[slot].action?.(ctx, player);
    };
    Server.prependListener("beforeItemUse", beforeItemUse);

    const tick = () => {
      addEventCtx();
      this.tick(ctx, player);
    };
    Server.prependListener("tick", tick);
  }

  exit(player: Player, ctx: MenuContext<T>) {
    const eventCtx = ctx as unknown as EventContext;
    Server.off("beforeItemUse", eventCtx.getData("__useEvent__"));
    Server.off("tick", eventCtx.getData("__tickEvent__"));
    Server.player.restoreHotbar(player);
  }
}

class MenuContext<T extends {}> implements MenuContextType<T> {
  private stack: string[] = [];
  private data: T = {} as T;

  constructor(private player: Player) {}

  getData<S extends keyof T>(key: S): T[S] {
    return this.data[key];
  }

  setData<S extends keyof T>(key: S, value: T[S]) {
    this.data[key] = value;
  }

  goto(menu: UIFormName) {
    this.stack.push(menu);
    UIForms.goto(menu, this.player, this);
  }

  returnto(menu: UIFormName) {
    let popped: string;
    // eslint-disable-next-line no-cond-assign
    while (popped = this.stack.pop()) {
      if (popped == menu) {
        this.goto(menu);
        break;
      }
    }
  }
}

export class UIFormBuilder {

  private forms = new Map<UIFormName, UIForm<{}>>();
  private active = new Map<Player, UIForm<{}>>();

  /**
   * Register a UI Form to be displayed to users.
   * @param name The name of the UI form
   * @param form The layout of the UI form
   */
  register<T extends {}>(name: UIFormName, form: Form<T>) {
    if ("button1" in form) {
      this.forms.set(name, new MessageUIForm(form));
    } else if ("buttons" in form) {
      this.forms.set(name, new ActionUIForm(form));
    } else if ("inputs" in form) {
      this.forms.set(name, new ModalUIForm(form));
    } else if ("items" in form) {
      this.forms.set(name, new HotbarUIForm(form));
    }
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
    const ctx = new MenuContext<T>(player);
    Object.entries(data).forEach(e => ctx.setData(e[0] as keyof T, e[1] as typeof data[keyof T]));
    ctx.goto(name);
    return false;
  }

  /**
   * Go from one UI form to another.
   * Should only be used within UI form element functions!
   * @param name The name of the UI form to go to
   * @param player The player to display the UI form to
   * @param ctx The context to be passed to the UI form
   */
  goto(name: UIFormName, player: Player, ctx: MenuContext<{}>) {
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
    } else {
      throw new TypeError(`Menu "${name}" has not been registered!`);
    }
  }

  displayingUI(player: Player) {
    return this.active.has(player);
  }
}

export const UIForms = new UIFormBuilder();