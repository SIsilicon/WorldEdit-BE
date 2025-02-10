/* eslint-disable @typescript-eslint/ban-types */
import { MessageFormData, MessageFormResponse, ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse, FormCancelationReason, FormResponse } from "@minecraft/server-ui";
import { Form, FormData, UIAction, MessageForm, ActionForm, SubmitAction, ModalForm, UIFormName, MenuContext as MenuContextType, DynamicElem, LocalizedText } from "../@types/classes/uiFormBuilder";
import { Player, RawMessage } from "@minecraft/server";
import { setTickTimeout, contentLog } from "@notbeer-api";

abstract class UIForm<T extends {}> {
    private readonly form: Form<T>;
    protected readonly cancelAction?: UIAction<T, void>;

    constructor(form: Form<T>) {
        this.form = form;
        this.cancelAction = form.cancel;
    }

    protected abstract build(form: Form<T>, resEl: <S>(elem: DynamicElem<T, S>) => S, errorFmt?: RawMessage): FormData;

    public abstract enter(player: Player, ctx: MenuContextType<T>, error?: LocalizedText): void;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public exit(player: Player, ctx: MenuContextType<T>) {
        /**/
    }

    protected handleCancel(response: FormResponse, player: Player, ctx: MenuContext<T>) {
        if (!response.canceled) return false;
        if (response.cancelationReason == FormCancelationReason.UserBusy) {
            setTickTimeout(() => this.enter(player, ctx));
        } else {
            ctx.goto(undefined);
            this.cancelAction?.(ctx, player);
        }
        return true;
    }

    protected buildFormData(player: Player, ctx: MenuContext<T>, error?: LocalizedText) {
        const resolve = <S>(elem: DynamicElem<T, S>): S => this.resolve(elem, player, ctx);
        if (typeof error === "string") {
            error = { rawtext: [{ text: "§c" }, { translate: error }, { text: "§r" }] };
        } else if (error) {
            error = { rawtext: [{ text: "§c" }, ...error.rawtext!, { text: "§r" }] };
        }
        return this.build(this.form, resolve, error);
    }

    protected resolve<S>(element: DynamicElem<T, S>, player: Player, ctx: MenuContext<T>) {
        return element instanceof Function ? element(ctx, player) : element;
    }
}

class MessageUIForm<T extends {}> extends UIForm<T> {
    private readonly action1: UIAction<T, void>;
    private readonly action2: UIAction<T, void>;

    constructor(form: MessageForm<T>) {
        super(form);
        this.action1 = form.button2.action;
        this.action2 = form.button1.action;
    }

    protected build(form: MessageForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S) {
        const formData = new MessageFormData();
        formData.title(resEl(form.title));
        formData.body(resEl(form.message));
        formData.button1(resEl(form.button2.text));
        formData.button2(resEl(form.button1.text));
        return formData;
    }

    enter(player: Player, ctx: MenuContext<T>) {
        this.buildFormData(player, ctx)
            .show(player)
            .then((response: MessageFormResponse) => {
                if (this.handleCancel(response, player, ctx)) return;
                ctx.goto(undefined);
                if (response.selection == 0) {
                    this.action1(ctx, player);
                } else if (response.selection == 1) {
                    this.action2(ctx, player);
                }
            });
    }
}

class ActionUIForm<T extends {}> extends UIForm<T> {
    private actions: UIAction<T, void>[] = []; // Changes between builds

    protected build(form: ActionForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S, errorFmt?: RawMessage) {
        this.actions = [];
        const formData = new ActionFormData();
        formData.title(errorFmt ?? resEl(form.title));

        if (form.message) formData.body(resEl(form.message));
        if (resEl((ctx) => (<MenuContext<T>>ctx).canGoBack())) {
            formData.button("<< Back");
            this.actions.push((ctx) => ctx.back());
        }
        for (const button of resEl(form.buttons)) {
            formData.button(resEl(button.text), resEl(button.icon));
            this.actions.push(button.action);
        }
        return formData;
    }

    enter(player: Player, ctx: MenuContext<T>, error?: LocalizedText) {
        const form = this.buildFormData(player, ctx, error);
        const actions = this.actions;
        form.show(player).then((response: ActionFormResponse) => {
            if (this.handleCancel(response, player, ctx)) return;
            ctx.goto(undefined);
            actions[response.selection]?.(ctx, player);
        });
    }
}

class ModalUIForm<T extends {}> extends UIForm<T> {
    private readonly submit: SubmitAction<T>;
    private inputNames: string[] = []; // Changes between builds

    constructor(form: ModalForm<T>) {
        super(form);
        this.submit = form.submit;
    }

    protected build(form: ModalForm<T>, resEl: <S>(elem: DynamicElem<T, S>) => S, errorFmt?: RawMessage) {
        this.inputNames = [];
        const formData = new ModalFormData();
        formData.title(errorFmt ?? resEl(form.title));

        const formInputs = resEl(form.inputs);
        for (const id in formInputs) {
            const input = formInputs[id as UIFormName];

            if (input.type == "dropdown") {
                formData.dropdown(resEl(input.name), resEl(input.options), resEl(input.default));
            } else if (input.type == "slider") {
                formData.slider(resEl(input.name), resEl(input.min), resEl(input.max), resEl(input.step ?? 1), resEl(input.default));
            } else if (input.type == "textField") {
                formData.textField(resEl(input.name), resEl(input.placeholder), resEl(input.default));
            } else if (input.type == "toggle") {
                formData.toggle(resEl(input.name), resEl(input.default));
            }
            this.inputNames.push(id);
        }
        return formData;
    }

    enter(player: Player, ctx: MenuContext<T>, error: LocalizedText) {
        const form = this.buildFormData(player, ctx, error);
        const inputNames = this.inputNames;
        form.show(player).then((response: ModalFormResponse) => {
            if (this.handleCancel(response, player, ctx)) return;
            const inputs: { [key: string]: string | number | boolean } = {};
            for (const i in response.formValues) {
                inputs[inputNames[i]] = response.formValues[i];
            }
            ctx.goto(undefined);
            this.submit(ctx, player, inputs);
        });
    }
}

class MenuContext<T extends {}> implements MenuContextType<T> {
    private stack: `$${string}`[] = [];
    private data: T = {} as T;

    constructor(private player: Player) {}

    getData<S extends keyof T>(key: S): T[S] {
        return this.data[key];
    }

    setData<S extends keyof T>(key: S, value: T[S]) {
        this.data[key] = value;
    }

    goto(menu?: UIFormName) {
        if (menu && this.stack[this.stack.length - 1] === "$___confirmMenu___") {
            throw Error("Can't go to another form from a confirmation menu!");
        }
        this._goto(menu);
    }

    back() {
        this.stack.pop();
        this._goto(this.stack.pop());
    }

    returnto(menu: UIFormName) {
        let popped: string | undefined;
        // eslint-disable-next-line no-cond-assign
        while ((popped = this.stack.pop())) {
            if (popped === menu) {
                this._goto(menu);
                return;
            }
        }
        this._goto(undefined);
    }

    confirm(title: string, message: string, yes: UIAction<T, void>, no?: UIAction<T, void>) {
        this.stack.push("$___confirmMenu___");
        const form = new MessageUIForm({
            title,
            message,
            button1: { text: "No", action: no ?? ((ctx) => ctx.back()) },
            button2: { text: "Yes", action: yes },
        });
        form.enter(this.player, this);
    }

    error(errorMessage: LocalizedText) {
        this._goto(this.stack[this.stack.length - 1], errorMessage);
    }

    canGoBack() {
        return this.stack.length > 1;
    }

    get currentMenu() {
        return this.stack[this.stack.length - 1];
    }

    private _goto(menu?: UIFormName, error?: LocalizedText) {
        if (menu && menu !== this.stack[this.stack.length - 1]) this.stack.push(menu);
        if (this.stack.length >= 64) throw Error("UI Stack overflow!");
        UIForms.goto(menu, this.player, this, error);
    }
}

class UIFormBuilder {
    private forms = new Map<UIFormName, UIForm<{}>>();
    private active = new Map<Player, UIForm<{}>>();

    /**
     * Register a UI Form to be displayed to users.
     * @param name The name of the UI form
     * @param form The layout of the UI form
     */
    register<T extends {}>(name: UIFormName, form: Form<T>) {
        if (this.forms.has(name)) {
            throw `UIForm by the name ${name} has already been registered.`;
        }
        if ("button1" in form) {
            this.forms.set(name, new MessageUIForm(form));
        } else if ("buttons" in form) {
            this.forms.set(name, new ActionUIForm(form));
        } else if ("inputs" in form) {
            this.forms.set(name, new ModalUIForm(form));
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
        Object.entries(data ?? {}).forEach((e) => ctx.setData(e[0] as keyof T, e[1] as (typeof data)[keyof T]));
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
    goto(name: UIFormName, player: Player, ctx: MenuContextType<{}>, error?: LocalizedText) {
        if (this.active.has(player)) {
            this.active.get(player).exit(player, ctx);
            this.active.delete(player);
        }

        if (!name) {
            return;
        } else if (this.forms.has(name)) {
            contentLog.debug("UI going to", name, "for", player.name);
            const form = this.forms.get(name);
            this.active.set(player, form);
            form.enter(player, ctx, error);
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
        if (!this.active.has(player)) return false;
        if (!ui) return true;
        const form = this.active.get(player);
        for (const registered of this.forms.values()) {
            if (registered == form) return true;
        }
        return false;
    }
}

export const UIForms = new UIFormBuilder();
