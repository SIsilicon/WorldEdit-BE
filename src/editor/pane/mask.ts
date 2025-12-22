import { ComboBoxPropertyItemDataType } from "@minecraft/server-editor";
import { Token } from "@modules/extern/tokenizr";
import { Vector, whenReady } from "@notbeer-api";
import { UIPane } from "./builder";
import {
    BlockMaskNode,
    ChainMaskNode,
    ExistingMaskNode,
    InputMaskNode,
    IntersectMaskNode,
    Mask,
    MaskNode,
    NegateMaskNode,
    OffsetMaskNode,
    PercentMaskNode,
    ShadowMaskNode,
    StateMaskNode,
    SurfaceMaskNode,
    TagMaskNode,
} from "@modules/mask";
import { BlockPermutation, BlockStates, BlockStateType, BlockTypes, RawMessage } from "@minecraft/server";

const dummyToken = new Token("", undefined, "");
const defaultBLock = "air";
const blockMaskNode = (block = defaultBLock) => new BlockMaskNode(dummyToken, { id: block });
const maskTypes = new Map<new (...args: any[]) => MaskNode, [string, () => MaskNode]>([
    [BlockMaskNode, ["Block Mask", blockMaskNode]],
    [ChainMaskNode, ["Chain Mask", () => new ChainMaskNode(dummyToken, [blockMaskNode()])]],
    [IntersectMaskNode, ["Interset Mask", () => new IntersectMaskNode(dummyToken, [blockMaskNode()])]],
    [StateMaskNode, ["Block State Mask", () => new StateMaskNode(dummyToken, new Map(), false)]],
    [TagMaskNode, ["Tag Mask", () => new TagMaskNode(dummyToken, "wood")]],
    [NegateMaskNode, ["Negate Mask", () => new NegateMaskNode(dummyToken, blockMaskNode())]],
    [OffsetMaskNode, ["Offset Mask", () => new OffsetMaskNode(dummyToken, Vector.UP, blockMaskNode())]],
    [SurfaceMaskNode, ["Surface Mask", () => new SurfaceMaskNode(dummyToken)]],
    [ExistingMaskNode, ["Existing Mask", () => new ExistingMaskNode(dummyToken)]],
    [ShadowMaskNode, ["Shadow Mask", () => new ShadowMaskNode(dummyToken)]],
    [PercentMaskNode, ["Random Mask", () => new PercentMaskNode(dummyToken, 0.5)]],
    [InputMaskNode, ["Input Mask", () => new InputMaskNode(dummyToken, defaultBLock)]],
]);

const blockTags: string[] = [];
whenReady(() => {
    const set = new Set<string>();
    BlockTypes.getAll().forEach(({ id }) =>
        BlockPermutation.resolve(id)
            .getTags()
            .forEach((tag) => set.add(tag))
    );
    blockTags.push(...set.keys());
});

export class MaskUIBuilder {
    private node: MaskNode | undefined;

    constructor(mask: Mask) {
        this.node = mask.getRootNode();
    }

    get mask() {
        return Mask.fromNode(this.node);
    }

    build(pane: UIPane) {
        this.buildMaskUI(pane, this.node);
    }

    private buildMaskUI(pane: UIPane, maskNode: MaskNode, parentNode?: MaskNode) {
        let type = maskNode.constructor as new (...args: any[]) => MaskNode;

        const build = () => {
            pane.changeItems([
                {
                    type: "dropdown",
                    title: "Type",
                    entries: Array.from(maskTypes.values()).map(([label], value) => ({ label, value })),
                    value: Array.from(maskTypes.keys()).indexOf(type),
                    onChange: (typeIndex) => {
                        const oldNode = maskNode;
                        type = Array.from(maskTypes.keys())[typeIndex];
                        maskNode = maskTypes.get(type)[1]();
                        if (!parentNode) this.node = maskNode;
                        build();

                        const siblings = parentNode?.nodes;
                        if (siblings && siblings.includes(oldNode)) {
                            const index = siblings.indexOf(oldNode);
                            siblings.splice(index, 1, maskNode);
                        }
                    },
                },
                { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            ]);

            const subPane = pane.getSubPane(1);
            if (type === BlockMaskNode) this.buildBlockMaskUI(subPane, maskNode as BlockMaskNode);
            else if (type === StateMaskNode) this.buildStateMaskUI(subPane, maskNode as StateMaskNode);
            else if (type === SurfaceMaskNode) this.buildSurfaceMaskUI(subPane, maskNode as SurfaceMaskNode);
            else if (type === TagMaskNode) this.buildTagMaskUI(subPane, maskNode as TagMaskNode);
            else if (type === PercentMaskNode) this.buildPercentMaskUI(subPane, maskNode as PercentMaskNode);
            else if (type === ChainMaskNode) this.buildChainOrIntersectMaskUI(subPane, maskNode as ChainMaskNode);
            else if (type === IntersectMaskNode) this.buildChainOrIntersectMaskUI(subPane, maskNode as IntersectMaskNode);
            else if (type === NegateMaskNode) this.buildNegateMaskUI(subPane, maskNode as NegateMaskNode);
            else if (type === OffsetMaskNode) this.buildOffsetMaskUI(subPane, maskNode as OffsetMaskNode);
            else if (type === InputMaskNode) this.buildInputMaskUI(subPane, maskNode as InputMaskNode);
        };
        build();
    }

    private buildBlockMaskUI(pane: UIPane, node: BlockMaskNode) {
        let validNewStates: BlockStateType[] = [];
        const statePanes = new Map<string, string>();

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
                        onChange: (index) => node.block.states.set(state.id, state.validValues[index]),
                    },
                    {
                        type: "button",
                        title: "Delete State",
                        pressed: () => {
                            pane.removeSubPane(subPane);
                            node.block.states.delete(state.id);
                            statePanes.delete(state.id);
                            updateStateEntries();
                        },
                    },
                ],
            });
            statePanes.set(state.id, subPane);
        };

        const updateStateEntries = () => {
            validNewStates = Object.keys(BlockPermutation.resolve(node.block.id).getAllStates())
                .filter((state) => !node.block.states?.has(state))
                .map((state) => BlockStates.get(state));
            pane.setVisibility(2, !!validNewStates.length);
            pane.updateEntries(2, [{ label: "Select State", value: -1 }, ...validNewStates.map((state, i) => ({ label: state.id, value: i }))]);
        };

        pane.changeItems([
            {
                type: "combo_box",
                title: "Block",
                dataType: ComboBoxPropertyItemDataType.Block,
                showImage: true,
                value: node.block.id,
                onChange: (value) => {
                    node.block.id = value;
                    const validStates = BlockPermutation.resolve(node.block.id).getAllStates();
                    for (const state of node.block.states?.keys() ?? []) {
                        if (state in validStates) continue;
                        if (statePanes.has(state)) statePane.removeSubPane(statePanes.get(state));
                        node.block.states.delete(state);
                    }
                    updateStateEntries();
                },
            },
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            {
                type: "dropdown",
                title: "New Block State",
                entries: [],
                value: -1,
                onChange: (value) => {
                    if (value === -1) return;
                    const newState = validNewStates[value];
                    node.block.states ??= new Map();
                    node.block.states.set(newState.id, newState.validValues[0]);
                    addStateUI(pane.getSubPane(1), newState);
                    updateStateEntries();
                    pane.setValue(2, -1);
                },
            },
        ]);

        const statePane = pane.getSubPane(1);
        for (const [state, value] of node.block.states?.entries() ?? []) addStateUI(statePane, BlockStates.get(state), value);
        updateStateEntries();
    }

    private buildStateMaskUI(pane: UIPane, node: StateMaskNode) {
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
            {
                type: "toggle",
                title: "Strict Mode",
                value: node.strict,
                onChange: (value) => (node.strict = value),
            },
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

        const statePane = pane.getSubPane(1);
        for (const [state, value] of node.states.entries()) addStateUI(statePane, BlockStates.get(state), value);
        updateStateEntries();
    }

    private buildTagMaskUI(pane: UIPane, node: TagMaskNode) {
        pane.changeItems([
            {
                type: "dropdown",
                title: "Block Tag",
                value: blockTags.indexOf(node.tag),
                entries: blockTags.map((label, value) => ({ label, value })),
                onChange: (value) => (node.tag = blockTags[value]),
            },
        ]);
    }

    private buildChainOrIntersectMaskUI(pane: UIPane, node: ChainMaskNode | IntersectMaskNode) {
        const eachSubPane = (callback: (pane: UIPane, index: number) => void) => {
            Object.values(maskPane.getAllSubPanes()).forEach((pane, index) => callback(pane, index));
        };

        const updateSubPanes = () => {
            eachSubPane((pane, index) => {
                pane.setVisibility(1, node.nodes.length > 1);
                pane.title = `Sub-Mask ${index + 1}`;
            });
        };

        const addMaskUI = (pane: UIPane, index: number, subNode: MaskNode) => {
            const subPane = pane.addSubPane({
                title: `Sub-Mask ${index + 1}`,
                items: [
                    { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
                    {
                        type: "button",
                        title: "Remove Mask",
                        variant: 3,
                        visible: node.nodes.length > 1,
                        pressed: () => {
                            pane.removeSubPane(subPane);
                            node.nodes.splice(index, 1);
                            updateSubPanes();
                        },
                    },
                ],
            });
            this.buildMaskUI(pane.getSubPane(subPane).getSubPane(0), subNode, node);
        };

        pane.changeItems([
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            {
                type: "button",
                title: "Add Sub-Mask",
                pressed: () => {
                    const newNode = blockMaskNode();
                    node.nodes.push(newNode);
                    addMaskUI(maskPane, node.nodes.length - 1, newNode);
                    updateSubPanes();
                },
            },
        ]);

        const maskPane = pane.getSubPane(0);
        for (let i = 0; i < node.nodes.length; i++) addMaskUI(maskPane, i, node.nodes[i]);
        updateSubPanes();
    }

    private buildNegateMaskUI(pane: UIPane, node: NegateMaskNode) {
        pane.changeItems([{ type: "subpane", title: "Sub-Mask", items: [] }]);
        this.buildMaskUI(pane.getSubPane(0), node.nodes[0], node);
    }

    private buildOffsetMaskUI(pane: UIPane, node: OffsetMaskNode) {
        pane.changeItems([
            { type: "vector3", title: "Offset", value: node.offset, onChange: (value) => (node.offset = value) },
            { type: "subpane", title: "Sub-Mask", items: [] },
        ]);
        this.buildMaskUI(pane.getSubPane(1), node.nodes[0], node);
    }

    private buildSurfaceMaskUI(pane: UIPane, node: SurfaceMaskNode) {
        const range = { min: 0, max: 90 };
        pane.changeItems([
            {
                type: "toggle",
                title: "Filter Slope",
                value: node.lowerAngle === undefined || node.upperAngle === undefined,
                onChange: (value) => {
                    pane.setVisibility(1, value);
                    pane.setVisibility(2, value);
                    if (value) {
                        node.lowerAngle = 0;
                        node.upperAngle = 90;
                        pane.setValue(1, 0);
                        pane.setValue(2, 90);
                    } else {
                        node.lowerAngle = undefined;
                        node.upperAngle = undefined;
                    }
                },
            },
            { type: "slider", title: "Minimum Angle", ...range, value: node.lowerAngle ?? 0, onChange: (value) => (node.lowerAngle = value) },
            { type: "slider", title: "Maximum Angle", ...range, value: node.upperAngle ?? 90, onChange: (value) => (node.upperAngle = value) },
        ]);
    }

    private buildPercentMaskUI(pane: UIPane, node: PercentMaskNode) {
        pane.changeItems([{ type: "slider", title: "Chance", min: 0, max: 100, value: node.percent * 100, onChange: (value) => (node.percent = value / 100) }]);
    }

    private buildInputMaskUI(pane: UIPane, node: InputMaskNode) {
        pane.changeItems([
            {
                type: "text_area",
                title: "Mask",
                value: node.input,
                onChange: (value) => {
                    node.input = value;
                    try {
                        Mask.parseArgs([node.input]);
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
}
