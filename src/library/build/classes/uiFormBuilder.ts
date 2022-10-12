import { MessageFormData, MessageFormResponse, ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { setTickTimeout } from "@notbeer-api";

type UIFormName = `$${string}`
type UIAction = (player: Player, ctx: MenuContext) => void

interface BaseInput {
  name: string
  type: string
}

interface Slider extends BaseInput {
  type: "slider"
  min: number
  max: number
  step: number
  default?: number
}

interface Dropdown extends BaseInput {
  type: "dropdown"
  options: string[],
  default?: number
}

interface TextField extends BaseInput {
  type: "textField"
  placeholder: string,
  default?: string
}

interface Toggle extends BaseInput {
  type: "toggle"
  default?: boolean
}

type Input = Slider | Dropdown | TextField | Toggle
type SubmitAction = (player: Player, ctx: MenuContext, input: {[key: UIFormName]: string|number|boolean}) => void

interface Button {
  text: string
  icon?: string
  action: UIAction
}

interface BaseForm {
  title: string,
  cancel: UIAction
}

interface MessageForm extends BaseForm {
  message: string
  button1: Button
  button2?: Button
}

interface ActionForm extends BaseForm {
  message?: string
  buttons: Button[]
}

interface ModalForm extends BaseForm {
  inputs: {[key: UIFormName]: Input},
  submit: SubmitAction
}

type Form = MessageForm | ActionForm | ModalForm
type FormData = ActionFormData | MessageFormData | ModalFormData
type FormResponse = ActionFormResponse | MessageFormResponse | ModalFormResponse

abstract class UIForm {
  protected formData: FormData;
  protected cancelAction: UIAction;

  constructor(form: Form) {
    this.cancelAction = form.cancel;
  }

  abstract enter(player: Player, ctx: MenuContext): void;

  protected handleCancel(response: FormResponse, player: Player, ctx: MenuContext) {
    if (response.canceled) {
      if (response.cancelationReason == FormCancelationReason.userBusy) {
        setTickTimeout(() => this.enter(player, ctx));
      } else {
        this.cancelAction(player, ctx);
      }
      return true;
    }
    return false;
  }
}

class MessageUIForm extends UIForm {
  private action1: UIAction;
  private action2: UIAction;

  constructor (form: MessageForm) {
    super(form);
    this.action1 = form.button1.action;
    this.action2 = form.button2.action;

    this.formData = new MessageFormData();
    this.formData.title(form.title);
    this.formData.body(form.message);
    this.formData.button1(form.button1.text);
    if ("button2" in form) {
      this.formData.button2(form.button2.text);
    }
    this.formData.title(form.title);
  }

  async enter(player: Player, ctx: MenuContext) {
    const response: MessageFormResponse = await this.formData.show(player);
    if (this.handleCancel(response, player, ctx)) {
      return;
    }

    if (response.selection == 0) {
      this.action1(player, ctx);
    } else if (response.selection == 1) {
      this.action2(player, ctx);
    }
  }
}

class ActionUIForm extends UIForm {
  private actions: UIAction[] = [];

  constructor (form: ActionForm) {
    super(form);

    this.formData = new ActionFormData();
    this.formData.title(form.title);
    if (form.message) {
      this.formData.body(form.message);
    }
    for (const button of form.buttons) {
      this.formData.button(button.text, button.icon);
      this.actions.push(button.action);
    }
  }

  async enter(player: Player, ctx: MenuContext) {
    const response: ActionFormResponse = await this.formData.show(player);
    if (this.handleCancel(response, player, ctx)) {
      return;
    }
    this.actions[response.selection]?.(player, ctx);
  }
}

class ModalUIForm extends UIForm {
  private submit: SubmitAction;
  private inputNames: string[] = [];

  constructor (form: ModalForm) {
    super(form);

    this.formData = new ModalFormData();
    this.formData.title(form.title);
    for (const id in form.inputs) {
      const input = form.inputs[id as UIFormName];

      if (input.type == "dropdown") {
        this.formData.dropdown(input.name, input.options, input.default);
      } else if (input.type == "slider") {
        this.formData.slider(input.name, input.min, input.max, input.step, input.default);
      } else if (input.type == "textField") {
        this.formData.textField(input.name, input.placeholder, input.default);
      } else if (input.type == "toggle") {
        this.formData.toggle(input.name, input.default);
      }

      this.inputNames.push(id);
    }
    this.submit = form.submit;
  }

  async enter(player: Player, ctx: MenuContext) {
    const response: ModalFormResponse = await this.formData.show(player);
    if (this.handleCancel(response, player, ctx)) {
      return;
    }

    const inputs: {[key: string]: string|number|boolean} = {};
    for (const i in response.formValues) {
      inputs[this.inputNames[i]] = response.formValues[i];
    }
    this.submit(player, ctx, inputs);
  }
}

class MenuContext {
  private stack: string[] = [];

  constructor(private player: Player) {}

  goto(menu: UIFormName) {
    this.stack.push(menu);
    return UIForms.goto(menu, this.player, this);
  }

  returnto(menu: UIFormName) {
    let popped: string;
    // eslint-disable-next-line no-cond-assign
    while (popped = this.stack.pop()) {
      if (popped == menu) {
        return this.goto(menu);
      }
    }
    return false;
  }
}

export class UIFormBuilder {

  private forms = new Map<UIFormName, UIForm>();

  register(name: UIFormName, form: Form) {
    if ("button1" in form) {
      this.forms.set(name, new MessageUIForm(form));
    } else if ("buttons" in form) {
      this.forms.set(name, new ActionUIForm(form));
    } else if ("inputs" in form) {
      this.forms.set(name, new ModalUIForm(form));
    }
  }

  show(name: UIFormName, player: Player) {
    const ctx = new MenuContext(player);
    ctx.goto(name);
  }

  goto(name: UIFormName, player: Player, ctx: MenuContext) {
    if (this.forms.has(name)) {
      this.forms.get(name)?.enter(player, ctx);
    } else {
      throw new TypeError(`Menu "${name}" has not been registered!`);
    }
  }
}

export const UIForms = new UIFormBuilder();