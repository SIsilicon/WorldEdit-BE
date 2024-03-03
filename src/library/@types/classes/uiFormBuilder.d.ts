/* eslint-disable @typescript-eslint/ban-types */
import { Player, RawMessage } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";

type UIFormName = `$${string}`;
type UIAction<T extends {}, S> = (ctx: MenuContext<T>, player: Player) => S;
type DynamicElem<T extends {}, S> = S | UIAction<T, S>;
type LocalizedText = string | RawMessage;

interface BaseInput<T extends {}, S> {
    name: DynamicElem<T, LocalizedText>;
    type: string;
    default?: DynamicElem<T, S>;
}

interface Slider<T extends {}> extends BaseInput<T, number> {
    type: "slider";
    min: DynamicElem<T, number>;
    max: DynamicElem<T, number>;
    step?: DynamicElem<T, number>;
}

interface Dropdown<T extends {}> extends BaseInput<T, number> {
    type: "dropdown";
    options: DynamicElem<T, LocalizedText[]>;
}

interface TextField<T extends {}> extends BaseInput<T, string> {
    type: "textField";
    placeholder: DynamicElem<T, string>;
}

interface Toggle<T extends {}> extends BaseInput<T, boolean> {
    type: "toggle";
}

type Input<T extends {}> = Slider<T> | Dropdown<T> | TextField<T> | Toggle<T>;
type SubmitAction<T extends {}> = (ctx: MenuContext<T>, player: Player, input: { [key: UIFormName]: string | number | boolean }) => void;

interface Button<T extends {}> {
    text: DynamicElem<T, LocalizedText>;
    action: UIAction<T, void>;
}

interface ActionButton<T extends {}> extends Button<T> {
    icon?: DynamicElem<T, string>;
    visible?: DynamicElem<T, boolean>;
}

interface BaseForm<T extends {}> {
    /** The title of the UI form */
    title: DynamicElem<T, LocalizedText>;
    /** Action to perform when the user exits or cancels the form */
    cancel?: UIAction<T, void>;
}

/** A form with a message and two options */
interface MessageForm<T extends {}> extends BaseForm<T> {
    message: DynamicElem<T, LocalizedText>;
    button1: Button<T>;
    button2: Button<T>;
}

/** A form with an array of buttons to interact with */
interface ActionForm<T extends {}> extends BaseForm<T> {
    /** Text that appears above the array of buttons */
    message?: DynamicElem<T, LocalizedText>;
    /** The array of buttons to interact with */
    buttons: DynamicElem<T, ActionButton<T>[]>;
}

interface ModalForm<T extends {}> extends BaseForm<T> {
    inputs: DynamicElem<T, { [key: UIFormName]: Input<T> }>;
    submit: SubmitAction<T>;
}

type Form<T extends {}> = MessageForm<T> | ActionForm<T> | ModalForm<T>;
type FormData = ActionFormData | MessageFormData | ModalFormData;

interface MenuContext<T extends {}> {
    readonly currentMenu: UIFormName;

    getData<S extends keyof T>(key: S): T[S];
    setData<S extends keyof T>(key: S, value: T[S]): void;
    goto(menu: UIFormName): void;
    returnto(menu: UIFormName): void;
    back(): void;
    confirm(title: LocalizedText, message: LocalizedText, yes: UIAction<T, void>, no?: UIAction<T, void>): void;
    error(errorMessage: LocalizedText): void;
}

export { Form, FormData, UIAction, DynamicElem, MessageForm, ActionForm, SubmitAction, ModalForm, UIFormName, MenuContext, LocalizedText };
