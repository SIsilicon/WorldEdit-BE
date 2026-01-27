import { Vector3 } from "@minecraft/server";
import {
    IBoolPropertyItemOptions,
    IButtonPropertyItemOptions,
    IComboBoxPropertyItemOptions,
    IDropdownPropertyItem,
    IDropdownPropertyItemEntry,
    IDropdownPropertyItemOptions,
    IModalOverlayPane,
    IModalTool,
    INumberPropertyItemOptions,
    IObservable,
    IPlayerUISession,
    IProgressIndicatorPropertyItemOptions,
    IPropertyItemBase,
    IPropertyPane,
    IRootPropertyPane,
    IStringPropertyItemOptions,
    ISubPanePropertyItem,
    ISubPanePropertyItemOptions,
    ITextPropertyItemOptions,
    IToggleGroupPropertyItemOptions,
    IVector3PropertyItemOptions,
    LocalizedString,
    makeObservable,
} from "@minecraft/server-editor";
import { generateId } from "@notbeer-api";
import { getSession } from "server/sessions";

type MayObservable<T> = IObservable<T> | T;

interface BasePaneItem {
    type: string;
    uniqueId?: string;
}

interface ObservablePaneItem<T> extends BasePaneItem {
    validator?: (value: T) => T | undefined;
}

interface DividerPaneItem extends BasePaneItem {
    type: "divider";
}

interface ButtonPaneItem extends BasePaneItem, IButtonPropertyItemOptions {
    type: "button";
    pressed: () => void;
}

interface ProgressPaneItem extends ObservablePaneItem<number>, IProgressIndicatorPropertyItemOptions {
    type: "progress";
}

interface TogglePaneItem extends ObservablePaneItem<boolean>, IBoolPropertyItemOptions {
    type: "toggle";
    value: MayObservable<boolean>;
}

interface SliderPaneItem extends ObservablePaneItem<number>, INumberPropertyItemOptions {
    type: "slider";
    value: MayObservable<number>;
}

interface DropdownPaneItem extends ObservablePaneItem<number>, IDropdownPropertyItemOptions {
    type: "dropdown";
    value: MayObservable<number>;
}

interface ComboBoxPaneItem extends ObservablePaneItem<string>, IComboBoxPropertyItemOptions {
    type: "combo_box";
    value: MayObservable<string>;
}

interface ToggleGroupPaneItem extends ObservablePaneItem<number>, IToggleGroupPropertyItemOptions {
    type: "toggle_group";
    value: MayObservable<number>;
}

interface Vector3PaneItem extends ObservablePaneItem<Vector3>, IVector3PropertyItemOptions {
    type: "vector3";
    value: MayObservable<Vector3>;
}

interface TextAreaPaneItem extends ObservablePaneItem<string>, IStringPropertyItemOptions {
    type: "text_area";
    value: MayObservable<string>;
}

interface LabelPaneItem extends ObservablePaneItem<string>, ITextPropertyItemOptions {
    type: "label";
    text: MayObservable<string>;
}

interface SubPane extends BasePaneItem, ISubPanePropertyItemOptions {
    type: "subpane";
    items: PaneItem[] | { build: (pane: UIPane) => void };
}

export type PaneItem =
    | DividerPaneItem
    | ButtonPaneItem
    | ProgressPaneItem
    | SliderPaneItem
    | TogglePaneItem
    | DropdownPaneItem
    | ComboBoxPaneItem
    | ToggleGroupPaneItem
    | Vector3PaneItem
    | TextAreaPaneItem
    | LabelPaneItem
    | SubPane;

export type PaneBuilder = { build: (pane: UIPane) => void };

export interface PaneLayout extends ISubPanePropertyItemOptions {
    items: PaneItem[] | PaneBuilder;
}

export interface ModalPaneLayout extends PaneLayout {
    title?: LocalizedString;
}

export class UIPane {
    private pane: IPropertyPane;
    private readonly subPanes: Record<string | number, UIPane> = {};
    private readonly modals: Record<string, IModalOverlayPane> = {};
    private readonly observables: Record<string | number, IObservable<number | boolean | Vector3 | LocalizedString>> = {};
    private readonly properties: Record<string | number, IPropertyItemBase> = {};
    private readonly mainPane: IPropertyPane;

    constructor(
        private readonly session: IPlayerUISession,
        layout: PaneLayout,
        basePane?: IPropertyPane
    ) {
        this.mainPane = basePane ?? session.createPropertyPane({ title: layout.title });
        if (Array.isArray(layout.items)) this.changeItems(layout.items);
        else layout.items.build(this);
    }

    get player() {
        return this.session.extensionContext.player;
    }

    get worldedit() {
        return getSession(this.player);
    }

    get propertyPane() {
        return this.pane;
    }

    get title() {
        return this.mainPane.getTitle();
    }

    set title(value: LocalizedString | undefined) {
        this.mainPane.setTitle(value);
    }

    get visible() {
        return this.mainPane.visible;
    }

    set visible(value: boolean) {
        if (value) this.mainPane.show();
        else this.mainPane.hide();
    }

    getValue(id: string | number) {
        return this.observables[id]?.value;
    }

    setValue(id: string | number, value: number | boolean | Vector3 | LocalizedString) {
        this.observables[id].set(value);
    }

    setVisibility(id: string | number, visible: boolean) {
        this.properties[id].visible = visible;
    }

    setEnabled(id: string | number, enabled: boolean) {
        this.properties[id].enable = enabled;
    }

    updateEntries(id: string | number, entries: IDropdownPropertyItemEntry[], newValue?: number) {
        (this.properties[id] as IDropdownPropertyItem).updateEntries(entries, newValue);
    }

    addSubPane(layout: PaneLayout) {
        return this.createSubPane(generateId(), layout, this.pane.createSubPane(layout)) as string;
    }

    getSubPane(id: string | number) {
        return this.subPanes[id];
    }

    getAllSubPanes() {
        return { ...this.subPanes };
    }

    removeSubPane(id: string) {
        if (!(id in this.subPanes)) return;
        this.pane.removeSubPane(this.subPanes[id].mainPane);
        delete this.subPanes[id];
    }

    createModalPane(layout: ModalPaneLayout) {
        const id = generateId();
        this.modals[id] = (this.mainPane as IRootPropertyPane).createModalOverlayPane({ title: layout.title });
        return this.createSubPane(id, layout, this.modals[id].contentPane);
    }

    showModalPane(id: string) {
        this.modals[id].show();
    }

    hideModalPane(id: string) {
        this.modals[id].hide();
    }

    changeItems(items: PaneItem[]) {
        if (this.pane) this.mainPane.removeSubPane(this.pane);
        this.pane = this.mainPane.createSubPane({ hasExpander: false, hasMargins: false });
        this.pane.beginConstruct();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id = item.uniqueId ?? i;
            switch (item.type) {
                case "divider":
                    this.properties[id] = this.pane.addDivider();
                    break;
                case "button":
                    this.properties[id] = this.pane.addButton(item.pressed, item);
                    break;
                case "progress":
                    this.properties[id] = this.pane.addProgressIndicator({ ...item, progress: this.makeObservable((item.progress as number) ?? 0, id, item.validator) });
                    break;
                case "label":
                    this.properties[id] = this.pane.addText(this.makeObservable(item.text, id, item.validator), item);
                    break;
                case "text_area":
                    this.properties[id] = this.pane.addString(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "toggle":
                    this.properties[id] = this.pane.addBool(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "slider":
                    this.properties[id] = this.pane.addNumber(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "dropdown":
                    this.properties[id] = this.pane.addDropdown(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "combo_box":
                    this.properties[id] = this.pane.addComboBox(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "toggle_group":
                    this.properties[id] = this.pane.addToggleGroup(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "vector3":
                    this.properties[id] = this.pane.addVector3(this.makeObservable(item.value, id, item.validator), item);
                    break;
                case "subpane":
                    this.createSubPane(id, item, this.pane.createSubPane(item));
                    break;
                default:
                    this.pane;
            }
        }
        this.pane.endConstruct();
    }

    bindToTool(tool: IModalTool) {
        tool.bindPropertyPane(this.mainPane as IRootPropertyPane);
    }

    private createSubPane<T extends string | number>(id: T, layout: PaneLayout, pane: ISubPanePropertyItem): T {
        this.subPanes[id] = new UIPane(this.session, layout, pane);
        return id;
    }

    private makeObservable<T extends number | boolean | Vector3 | LocalizedString>(value: MayObservable<T>, id: string | number, validator?: (value: T) => T | undefined) {
        const observable = typeof value === "object" && "value" in value ? value : makeObservable(value, validator ? { validate: validator } : undefined);
        this.observables[id] = observable;
        return observable;
    }
}
