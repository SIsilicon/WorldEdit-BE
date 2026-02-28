import { IModalTool, IRootPropertyPane, IPlayerUISession, SupportedKeyboardActionTypes, KeyBinding } from "@minecraft/server-editor";

export class SharedControl {
    public readonly localizationPrefix: string;
    public readonly tool: IModalTool;
    public readonly propertyPane: IRootPropertyPane;
    public readonly controlName: string;
    public readonly session: IPlayerUISession;

    private active = false;
    private initialized = false;

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, controlName: string, localizationPrefix: string) {
        this.session = session;
        this.tool = parentTool;
        this.propertyPane = parentPropertyPane;
        this.controlName = controlName;
        this.localizationPrefix = localizationPrefix;
    }

    get isActive() {
        return this.active;
    }

    get isInitialized() {
        return this.initialized;
    }

    initialize() {
        this.initialized = true;
    }

    shutdown() {
        this.initialized = false;
    }

    activateControl() {
        if (!this.initialized) throw new Error("Control must be initialized before it can be activated");
        if (this.active) throw new Error("Control is already active");
        this.active = true;
    }

    deactivateControl() {
        if (!this.active) throw new Error("Control is not active");
        this.active = false;
    }

    registerToolKeyBinding(action: SupportedKeyboardActionTypes, binding: KeyBinding, tag: string) {
        this.tool.registerKeyBinding(action, binding, {
            uniqueId: this.getToolKeyBindingId(tag),
            label: `${this.localizationPrefix}.keybinding.${tag}.title`,
            tooltip: `${this.localizationPrefix}.keybinding.${tag}.tooltip`,
        });
    }

    getToolKeyBindingId(tag: string) {
        return `${this.tool.id}:${this.controlName}Keybinding:${tag}`;
    }

    localize(key: string) {
        return `${this.localizationPrefix}.${key}`;
    }
}
