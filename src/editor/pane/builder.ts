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
    IPropertyItemBase,
    IPropertyPane,
    IRootPropertyPane,
    IStringPropertyItemOptions,
    ISubPanePropertyItemOptions,
    ITextPropertyItemOptions,
    IVector3PropertyItemOptions,
    LocalizedString,
    makeObservable,
} from "@minecraft/server-editor";
import { generateId } from "@notbeer-api";

interface BasePaneItem {
    type: string;
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

export type PaneItem = ButtonPaneItem | SliderPaneItem | TogglePaneItem | DropdownPaneItem | ComboBoxPaneItem | Vector3PaneItem | TextAreaPaneItem | LabelPaneItem | SubPane;

export interface PaneLayout extends ISubPanePropertyItemOptions {
    items: PaneItem[] | { build: (pane: UIPane) => void };
}

export class UIPane {
    private pane: IPropertyPane;
    private readonly subPanes: Record<string | number, UIPane> = {};
    private readonly observables: Record<number, IObservable<number | boolean | Vector3 | LocalizedString>> = {};
    private readonly properties: Record<number, IPropertyItemBase> = {};
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

    getValue(index: number) {
        return this.observables[index]?.value;
    }

    setValue(index: number, value: number | boolean | Vector3 | LocalizedString) {
        this.observables[index].set(value);
    }

    setVisibility(index: number, visible: boolean) {
        this.properties[index].visible = visible;
    }

    setEnabled(index: number, enabled: boolean) {
        this.properties[index].enable = enabled;
    }

    updateEntries(index: number, entries: IDropdownPropertyItemEntry[], newValue?: number) {
        (this.properties[index] as IDropdownPropertyItem).updateEntries(entries, newValue);
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
            switch (item.type) {
                case "button":
                    this.properties[i] = this.pane.addButton(item.pressed, item);
                    break;
                case "label":
                    this.properties[i] = this.pane.addText(this.makeObservable(item.text, i), item);
                    break;
                case "text_area":
                    this.properties[i] = this.pane.addString(this.makeObservable(item.value, i), item);
                    break;
                case "toggle":
                    this.properties[i] = this.pane.addBool(this.makeObservable(item.value, i), item);
                    break;
                case "slider":
                    this.properties[i] = this.pane.addNumber(this.makeObservable(item.value, i), item);
                    break;
                case "dropdown":
                    this.properties[i] = this.pane.addDropdown(this.makeObservable(item.value, i), item);
                    break;
                case "combo_box":
                    this.properties[i] = this.pane.addComboBox(this.makeObservable(item.value, i), item);
                    break;
                case "vector3":
                    this.properties[i] = this.pane.addVector3(this.makeObservable(item.value, i), item);
                    break;
                case "subpane":
                    this.createSubPane(i, item);
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

    private makeObservable(value: any, index: number) {
        const observable = makeObservable(value);
        this.observables[index] = observable;
        return observable;
    }
}
