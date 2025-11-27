import { BlockPermutation, BlockStates, BlockStateType, RawMessage } from "@minecraft/server";
import { ComboBoxPropertyItemDataType } from "@minecraft/server-editor";
import { Token } from "@modules/extern/tokenizr";
import {
    PatternNode,
    VoidPatternNode,
    BlockPatternNode,
    ChainPatternNode,
    TypePatternNode,
    StatePatternNode,
    RandStatePatternNode,
    ClipboardPatternNode,
    BlobPatternNode,
    Pattern,
    InputPatternNode,
} from "@modules/pattern";
import { Vector } from "@notbeer-api";
import { UIPane } from "./builder";

const dummyToken = new Token("", undefined, "");
const defaultBLock = "stone";
const blockPatternNode = (block = defaultBLock) => new BlockPatternNode(dummyToken, BlockPermutation.resolve(block));
const patternTypes = new Map<new (...args: any[]) => PatternNode, [string, () => PatternNode]>([
    [VoidPatternNode, ["Void Pattern", () => new VoidPatternNode(dummyToken)]],
    [BlockPatternNode, ["Block Pattern", blockPatternNode]],
    [ChainPatternNode, ["Chain Pattern", () => new ChainPatternNode(dummyToken, [blockPatternNode()])]],
    [TypePatternNode, ["Block Type Pattern", () => new TypePatternNode(dummyToken, defaultBLock)]],
    [StatePatternNode, ["Block State Pattern", () => new StatePatternNode(dummyToken, new Map())]],
    [RandStatePatternNode, ["Random Block State Pattern", () => new RandStatePatternNode(dummyToken, defaultBLock)]],
    // [ClipboardPatternNode, ["Clipboard Pattern", () => new ClipboardPatternNode(dummyToken, Vector.ZERO)]],
    // [HandPatternNode, ["Hotbar Pattern", () => new HandPatternNode(dummyToken)]],
    // [GradientPatternNode, ["Gradient Pattern", () => new GradientPatternNode(dummyToken, "")]],
    [BlobPatternNode, ["Blob Pattern", () => new BlobPatternNode(dummyToken, 3, new ChainPatternNode(dummyToken, [blockPatternNode(defaultBLock), blockPatternNode("cobblestone")]))]],
    [InputPatternNode, ["Input Pattern", () => new InputPatternNode(dummyToken, defaultBLock)]],
]);

export class PatternUIBuilder {
    private node: PatternNode | undefined;

    constructor(pattern: Pattern) {
        this.node = pattern.getRootNode();
    }

    get pattern() {
        return Pattern.fromNode(this.node);
    }

    build(pane: UIPane) {
        this.buildPatternUI(pane, this.node);
    }

    private buildPatternUI(pane: UIPane, patternNode: PatternNode, parentNode?: PatternNode) {
        let type = patternNode.constructor as new (...args: any[]) => PatternNode;

        const build = () => {
            pane.changeItems([
                {
                    type: "dropdown",
                    title: "Type",
                    entries: Array.from(patternTypes.values()).map(([label], value) => ({ label, value })),
                    value: Array.from(patternTypes.keys()).indexOf(type),
                    onChange: (typeIndex) => {
                        const oldNode = patternNode;
                        type = Array.from(patternTypes.keys())[typeIndex];
                        patternNode = patternTypes.get(type)[1]();
                        if (!parentNode) this.node = patternNode;
                        build();

                        const siblings = parentNode?.nodes;
                        if (siblings && siblings.includes(oldNode)) {
                            const index = siblings.indexOf(oldNode);
                            siblings.splice(index, 1, patternNode);
                        }
                    },
                },
                { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            ]);

            const subPane = pane.getSubPane(1);
            if (type === BlockPatternNode) this.buildBlockPatternUI(subPane, patternNode as BlockPatternNode);
            else if (type === ChainPatternNode) this.buildChainPatternUI(subPane, patternNode as ChainPatternNode);
            else if (type === TypePatternNode) this.buildTypeOrRandStatePatternUI(subPane, patternNode as TypePatternNode);
            else if (type === StatePatternNode) this.buildStatePatternUI(subPane, patternNode as StatePatternNode);
            else if (type === RandStatePatternNode) this.buildTypeOrRandStatePatternUI(subPane, patternNode as RandStatePatternNode);
            // else if (type === ClipboardPatternNode) this.buildClipboardPatternUI(subPane, patternNode as ClipboardPatternNode);
            // else if (type === HandPatternNode) this.buildTypeOrRandStatePatternUI(subPane, patternNode.node as RandStatePatternNode);
            // else if (type === GradientPatternNode) this.buildTypeOrRandStatePatternUI(subPane, patternNode as RandStatePatternNode);
            else if (type === BlobPatternNode) this.buildBlobPatternUI(subPane, patternNode as BlobPatternNode);
            else if (type === InputPatternNode) this.buildInputPatternUI(subPane, patternNode as InputPatternNode);
        };
        build();
    }

    private buildBlockPatternUI(pane: UIPane, node: BlockPatternNode) {
        const buildBlockProperties = () => {
            pane.getSubPane(1).changeItems(
                Object.entries(node.permutation.getAllStates()).map(([key, value]) => {
                    const validValues = BlockStates.get(key).validValues;
                    return {
                        type: "dropdown",
                        title: key,
                        value: validValues.indexOf(value),
                        entries: validValues.map((v, i) => ({ label: `${v}`, value: i })),
                        onChange: (index) => (node.permutation = node.permutation.withState(key as any, validValues[index])),
                    };
                })
            );
        };

        pane.changeItems([
            {
                type: "combo_box",
                title: "Block",
                dataType: ComboBoxPropertyItemDataType.Block,
                showImage: true,
                value: node.permutation.type.id,
                onChange: (value) => {
                    node.permutation = BlockPermutation.resolve(value);
                    buildBlockProperties();
                },
            },
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
        ]);
        buildBlockProperties();
    }

    private buildChainPatternUI(pane: UIPane, node: ChainPatternNode) {
        const eachSubPane = (callback: (pane: UIPane, index: number) => void) => {
            Object.values(patternPane.getAllSubPanes()).forEach((pane, index) => callback(pane, index));
        };

        const updateSubPanes = () => {
            eachSubPane((pane, index) => {
                pane.setVisibility(2, node.nodes.length > 1);
                pane.setValue(0, node.getWeight(index) * 100);
                pane.title = `Sub-Pattern ${index + 1}`;
            });
        };

        const addPatternUI = (pane: UIPane, index: number, subNode: PatternNode) => {
            const subPane = pane.addSubPane({
                title: `Sub-Pattern ${index + 1}`,
                items: [
                    {
                        type: "slider",
                        title: "Weight",
                        value: node.getWeight(index) * 100,
                        min: 0,
                        max: 100,
                        isInteger: true,
                        visible: !node.evenDistribution,
                        onChange: (value) => node.setWeight(index, value / 100),
                    },
                    { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
                    {
                        type: "button",
                        title: "Remove Pattern",
                        variant: 3,
                        visible: node.nodes.length > 1,
                        pressed: () => {
                            pane.removeSubPane(subPane);
                            node.nodes.splice(index, 1);
                            node.removeWeight(index);
                            updateSubPanes();
                        },
                    },
                ],
            });
            this.buildPatternUI(pane.getSubPane(subPane).getSubPane(1), subNode, node);
        };

        pane.changeItems([
            {
                type: "toggle",
                title: "Even Distribution",
                value: node.evenDistribution,
                onChange: (value) => {
                    node.evenDistribution = value;
                    eachSubPane((pane) => pane.setVisibility(0, !node.evenDistribution));
                },
            },
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            {
                type: "button",
                title: "Add Sub-Pattern",
                pressed: () => {
                    const newNode = blockPatternNode();
                    node.nodes.push(newNode);
                    addPatternUI(patternPane, node.nodes.length - 1, newNode);
                    updateSubPanes();
                },
            },
        ]);

        const patternPane = pane.getSubPane(1);
        for (let i = 0; i < node.nodes.length; i++) addPatternUI(patternPane, i, node.nodes[i]);
        updateSubPanes();
    }

    private buildTypeOrRandStatePatternUI(pane: UIPane, node: TypePatternNode | RandStatePatternNode) {
        pane.changeItems([
            {
                type: "combo_box",
                title: "Block",
                dataType: ComboBoxPropertyItemDataType.Block,
                showImage: true,
                value: node.type,
                onChange: (value) => (node.type = value),
            },
        ]);
    }

    private buildStatePatternUI(pane: UIPane, node: StatePatternNode) {
        let validNewStates = BlockStates.getAll().filter((state) => !node.states.has(state.id));

        const addStateUI = (pane: UIPane, state: BlockStateType, defaultValue?: any) => {
            const subPane = pane.addSubPane({
                hasMargins: false,
                hasExpander: false,
                items: [
                    {
                        type: "dropdown",
                        title: state,
                        value: defaultValue !== undefined ? state.validValues.indexOf(defaultValue) : 0,
                        entries: state.validValues.map((v, i) => ({ label: `${v}`, value: i })),
                        onChange: (index) => node.states.set(state.id, state.validValues[index]),
                    },
                    {
                        type: "button",
                        title: "Delete State",
                        variant: 3,
                        pressed: () => {
                            pane.removeSubPane(subPane);
                            node.states.delete(state.id);
                            updateStateEntries();
                        },
                    },
                ],
            });
        };

        const updateStateEntries = () => {
            validNewStates = BlockStates.getAll().filter((state) => !node.states.has(state.id));
            pane.updateEntries(1, [{ label: "Select State", value: -1 }, ...validNewStates.map((state, i) => ({ label: state.id, value: i }))]);
        };

        pane.changeItems([
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            {
                type: "dropdown",
                title: "New Block State",
                entries: [],
                value: -1,
                onChange: (value) => {
                    if (value === -1) return;
                    const newState = validNewStates[value];
                    node.states.set(newState.id, newState.validValues[0]);
                    addStateUI(statePane, newState);
                    updateStateEntries();
                    pane.setValue(1, -1);
                },
            },
        ]);

        const statePane = pane.getSubPane(0);
        for (const [state, value] of node.states.entries()) addStateUI(statePane, BlockStates.get(state), value);
        updateStateEntries();
    }

    private buildClipboardPatternUI(pane: UIPane, node: ClipboardPatternNode) {
        pane.changeItems([
            {
                type: "vector3",
                title: "Offset",
                value: { x: node.offset.x, y: node.offset.y, z: node.offset.z },
                onChange: (value) => (node.offset = new Vector(value.x, value.y, value.z)),
            },
        ]);
    }

    private buildInputPatternUI(pane: UIPane, node: InputPatternNode) {
        pane.changeItems([
            {
                type: "text_area",
                title: "Pattern",
                value: node.input,
                onChange: (value) => {
                    node.input = value;
                    try {
                        Pattern.parseArgs([node.input]);
                        pane.setVisibility(1, false);
                    } catch (err) {
                        pane.setVisibility(1, true);
                        if ("isSyntaxError" in err) {
                            const { start, end } = err as { start: number; end: number };
                            pane.setValue(1, { id: "commands.generic.syntax", props: [value.slice(0, start), value.slice(start, end + 1), value.slice(end + 1)] });
                        } else if (err.rawtext?.[0].translate) {
                            const message = err.rawtext[0] as RawMessage;
                            pane.setValue(1, { id: message.translate, props: message.with as string[] });
                        }
                    }
                },
            },
            { type: "label", visible: false, text: "" },
        ]);
    }

    private buildBlobPatternUI(pane: UIPane, node: BlobPatternNode) {
        pane.changeItems([
            {
                type: "slider",
                title: "Blob Size",
                value: node.size,
                onChange: (value) => (node.size = value),
            },
            { type: "subpane", title: "Sub-Pattern", items: [] },
        ]);
        this.buildPatternUI(pane.getSubPane(1), node.nodes[0], node);
    }
}
