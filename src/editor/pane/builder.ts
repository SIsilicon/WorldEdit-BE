import { Vector3 } from "@minecraft/server";
import {
    IBoolPropertyItemOptions,
    IButtonPropertyItemOptions,
    IComboBoxPropertyItemOptions,
    IDropdownPropertyItem,
    IDropdownPropertyItemEntry,
    IDropdownPropertyItemOptions,
    IModalTool,
    INumberPropertyItemOptions,
    IObservable,
    IPlayerUISession,
    IProgressIndicatorPropertyItemOptions,
    IPropertyItemBase,
    IPropertyPane,
    IRootPropertyPane,
    IStringPropertyItemOptions,
    ISubPanePropertyItemOptions,
    ITextPropertyItemOptions,
    IToggleGroupPropertyItemOptions,
    IVector3PropertyItemOptions,
    LocalizedString,
    makeObservable,
} from "@minecraft/server-editor";
import { generateId } from "@notbeer-api";

interface BasePaneItem {
    type: string;
    uniqueId?: string;
}

interface DividerPaneItem extends BasePaneItem {
    type: "divider";
}

interface ProgressPaneItem extends BasePaneItem, IProgressIndicatorPropertyItemOptions {
    type: "progress";
}

interface ButtonPaneItem extends BasePaneItem, IButtonPropertyItemOptions {
    type: "button";
    pressed: () => void;
}

interface TogglePaneItem extends BasePaneItem, IBoolPropertyItemOptions {
    type: "toggle";
    value: boolean;
}

interface SliderPaneItem extends BasePaneItem, INumberPropertyItemOptions {
    type: "slider";
    value: number;
}

interface DropdownPaneItem extends BasePaneItem, IDropdownPropertyItemOptions {
    type: "dropdown";
    value: number;
}

interface ComboBoxPaneItem extends BasePaneItem, IComboBoxPropertyItemOptions {
    type: "combo_box";
    value: string;
}

interface ToggleGroupPaneItem extends BasePaneItem, IToggleGroupPropertyItemOptions {
    type: "toggle_group";
    value: number;
}

interface Vector3PaneItem extends BasePaneItem, IVector3PropertyItemOptions {
    type: "vector3";
    value: { x: number; y: number; z: number };
}

interface TextAreaPaneItem extends BasePaneItem, IStringPropertyItemOptions {
    type: "text_area";
    value: string;
}

interface LabelPaneItem extends BasePaneItem, ITextPropertyItemOptions {
    type: "label";
    text: string;
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

export interface PaneLayout extends ISubPanePropertyItemOptions {
    items: PaneItem[] | { build: (pane: UIPane) => void };
}

export class UIPane {
    private pane: IPropertyPane;
    private readonly subPanes: Record<string | number, UIPane> = {};
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
        return this.createSubPane(generateId(), layout) as string;
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
                    this.properties[id] = this.pane.addProgressIndicator({ ...item, progress: this.makeObservable(item.progress ?? 0, id) });
                    break;
                case "label":
                    this.properties[id] = this.pane.addText(this.makeObservable(item.text, id), item);
                    break;
                case "text_area":
                    this.properties[id] = this.pane.addString(this.makeObservable(item.value, id), item);
                    break;
                case "toggle":
                    this.properties[id] = this.pane.addBool(this.makeObservable(item.value, id), item);
                    break;
                case "slider":
                    this.properties[id] = this.pane.addNumber(this.makeObservable(item.value, id), item);
                    break;
                case "dropdown":
                    this.properties[id] = this.pane.addDropdown(this.makeObservable(item.value, id), item);
                    break;
                case "combo_box":
                    this.properties[id] = this.pane.addComboBox(this.makeObservable(item.value, id), item);
                    break;
                case "toggle_group":
                    this.properties[id] = this.pane.addToggleGroup(this.makeObservable(item.value, id), item);
                    break;
                case "vector3":
                    this.properties[id] = this.pane.addVector3(this.makeObservable(item.value, id), item);
                    break;
                case "subpane":
                    this.createSubPane(id, item);
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

    private createSubPane(id: string | number, layout: PaneLayout) {
        this.subPanes[id] = new UIPane(this.session, layout, this.pane.createSubPane(layout));
        return id;
    }

    private makeObservable(value: any, id: string | number) {
        const observable = makeObservable(value);
        this.observables[id] = observable;
        return observable;
    }
}
