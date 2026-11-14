import { Vector3, BlockPermutation, Dimension, BlockVolumeBase } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector, Server, whenReady, regionSize } from "@notbeer-api";
import { PlayerSession } from "server/sessions.js";
import { Token } from "./extern/tokenizr.js";
import {
    tokenize,
    throwTokenError,
    mergeTokens,
    parseBlock,
    parsedBlock,
    parseBlockStates,
    processOps,
    parseNumberList,
    blockPermutation2ParsedBlock,
    parsedBlock2BlockPermutation,
    BlockUnit,
} from "./block_parsing.js";
import { Cardinal, CardinalDirection } from "./directions.js";
import { Mask } from "./mask.js";
import { closestPoint } from "library/utils/closestpoint.js";
import { Selection } from "./selection.js";
import { PatternNode, patternContext, patternNodeJSON } from "./pattern_nodes/base.js";
import {
    BlockPatternNode,
    VoidPatternNode,
    TypePatternNode,
    StatePatternNode,
    RandStatePatternNode,
    ClipboardPatternNode,
    HandPatternNode,
    GradientPatternNode,
    PercentPatternNode,
    InputPatternNode,
    ChainPatternNode,
} from "./pattern_nodes/standard.js";
import {
    BlobPatternNode,
    PerlinPatternNode,
    CrackedPatternNode,
    WoodPatternNode,
    TurbulencePatternNode,
    MarblePatternNode,
    FbmPatternNode,
    VeinsPatternNode,
    WarpedPatternNode,
    SimplexPatternNode,
    ValuePatternNode,
    PingPongPatternNode,
} from "./pattern_nodes/noise.js";
import {
    GridPatternNode,
    TrianglePatternNode,
    HexagonPatternNode,
    BrickPatternNode,
    DotsPatternNode,
    RingsPatternNode,
    BubblesPatternNode,
    VoronoiPatternNode,
    StripesPatternNode,
    WavesPatternNode,
    TruchetPatternNode,
    SpiralPatternNode,
    SpotsPatternNode,
} from "./pattern_nodes/geometric.js";

// Keep old imports from pattern.js compatible with the rest of WorldEdit.
export * from "./pattern_nodes/base.js";
export * from "./pattern_nodes/standard.js";
export * from "./pattern_nodes/noise.js";
export * from "./pattern_nodes/geometric.js";

export interface patternContextOptions {
    strokePoints?: Vector3[];
    gradientRadius?: number;
}

export class Pattern implements CustomArgType {
    private block: PatternNode;
    private stringSource = undefined;
    private simpleCache: BlockPermutation;

    private context = {} as patternContext;

    constructor(pattern: string | patternNodeJSON = "") {
        if (!pattern) return;
        whenReady(() => {
            const obj = typeof pattern === "string" ? Pattern.parseArgs([pattern]).result : Pattern.parseJSON(pattern);
            this.block = obj.block;
            this.stringSource = obj.stringSource;
        });
    }

    withContext(session: PlayerSession, range: [Vector3, Vector3], options?: patternContextOptions) {
        const pattern = this.clone();
        pattern.context.session = session;
        pattern.context.range = [Vector.from(range[0]), Vector.from(range[1])];
        pattern.context.cardinal = new Cardinal(CardinalDirection.Forward);
        pattern.context.placePosition = session.getPlacementPosition();
        pattern.context.gradientRadius = options?.gradientRadius ?? Vector.sub(range[1], range[0]).length / 2;
        const item = Server.player.getHeldItem(session.player);
        pattern.context.hand = item ? Server.block.itemToPermutation(item) : BlockPermutation.resolve("air");

        const centers = (options?.strokePoints ?? [Vector.add(...range).div(2)]).map(Vector.from);
        pattern.context.getCenter = closestPoint(centers);

        pattern.getRootNode().prepare();
        return pattern;
    }

    /**
     * Replaces a block with this pattern
     * @param block
     * @returns True if the block changed; false otherwise
     */
    setBlock(block: BlockUnit) {
        try {
            const oldBlock = block.permutation;
            const newBlock = this.block.getPermutation(block, this.context);
            if (!newBlock) return false;
            block.setPermutation(newBlock);
            return !oldBlock.matches(block.typeId);
        } catch (err) {
            // console.error(err);
            return false;
        }
    }

    getRootNode() {
        return this.block;
    }

    clear() {
        this.block = undefined;
        this.stringSource = this.stringSource ? "" : undefined;
        this.simpleCache = undefined;
    }

    empty() {
        return !this.block;
    }

    addBlock(permutation: BlockPermutation) {
        if (!this.block) {
            this.block = new ChainPatternNode(undefined);
        } else if (!(this.block instanceof ChainPatternNode)) {
            const old = this.block;
            this.block = new ChainPatternNode(undefined);
            this.block.nodes.push(old);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.block.nodes.push(new BlockPatternNode(undefined, parsedBlock2BlockPermutation(block)));

        if (this.stringSource) {
            this.stringSource += ",";
            this.stringSource += block.id.replace("minecraft:", "");
            if (block.states.size) this.stringSource += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
        }
        this.simpleCache = undefined;
    }

    isSimple() {
        return this.block instanceof BlockPatternNode || (this.block instanceof ChainPatternNode && this.block.nodes.length == 1 && this.block.nodes[0] instanceof BlockPatternNode);
    }

    fillBlocks(dimension: Dimension, volume: BlockVolumeBase, mask?: Mask) {
        const filter = mask?.getSimpleBlockFilter() ?? {};
        if (this.isSimple()) {
            if (!this.simpleCache) {
                if (this.block instanceof BlockPatternNode) {
                    this.simpleCache = this.block.permutation;
                } else if (this.block instanceof ChainPatternNode) {
                    this.simpleCache = (this.block.nodes[0] as BlockPatternNode).permutation;
                }
            }
            return dimension.fillBlocks(volume, this.simpleCache, { blockFilter: filter }).getCapacity();
        } else {
            // FIXME: https://bugs.mojang.com/browse/MCPE/issues/MCPE-240572
            // Due to the bug above, dimension.getBlocks does not work as expected in certain situations.
            // So until this is fixed, we manually filter the blocks.

            let count = 0;
            // volume = dimension.getBlocks(volume, filter);
            for (const location of volume.getBlockLocationIterator()) {
                const block = dimension.getBlock(location);
                if (!block || !mask?.matchesBlock(block)) continue; // Temporary
                count += this.setBlock(block) ? 1 : 0;
            }
            return count;
        }
    }

    optimize() {
        this.block.optimize();
    }

    clone() {
        const pattern = new Pattern();
        pattern.block = this.block;
        pattern.stringSource = this.stringSource;
        return pattern;
    }

    convertToJSON() {
        this.stringSource = undefined;
    }

    toJSON() {
        return this.stringSource ?? this.block?.toJSON() ?? "";
    }

    toString() {
        return `[pattern: ${this.stringSource ?? JSON.stringify(this.block)}]`;
    }

    static parseArgs(args: Array<string>, index = 0) {
        const input = args[index];
        if (!input) {
            return { result: new Pattern(), argIndex: index + 1 };
        }

        const tokens = tokenize(input);
        let token: Token;

        function processTokens(inBracket: boolean) {
            const ops: PatternNode[] = [];
            const out: PatternNode[] = [];
            const start = tokens.curr();

            function nodeToken() {
                return mergeTokens(token, tokens.curr(), input);
            }

            function parseNoiseParams(defaults: number[], validators: ((value: number) => boolean)[] = []) {
                const values = [...defaults];
                let index = 0;

                while (tokens.peek()?.value == ":") {
                    const colon = tokens.next();
                    if (index >= defaults.length) throwTokenError(colon);

                    const valueToken = tokens.next();
                    if (!valueToken || valueToken.type != "number") throwTokenError(valueToken ?? colon);

                    const value = valueToken.value as number;
                    if (validators[index] && !validators[index](value)) throwTokenError(valueToken);

                    values[index] = value;
                    index++;
                }

                return values;
            }

            // eslint-disable-next-line no-cond-assign
            while ((token = tokens.next())) {
                if (token.value === "void") {
                    out.push(new VoidPatternNode(nodeToken()));
                } else if (token.type == "id") {
                    out.push(new BlockPatternNode(nodeToken(), parsedBlock2BlockPermutation(parseBlock(tokens, input, false) as parsedBlock)));
                } else if (token.type == "number") {
                    const num = token;
                    const t = tokens.next();
                    if (t.value == "%") {
                        processOps(out, ops, new PercentPatternNode(nodeToken(), num.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == ",") {
                    processOps(out, ops, new ChainPatternNode(nodeToken()));
                } else if (token.value == "^") {
                    const t = tokens.next();
                    if (t.type == "id") {
                        out.push(new TypePatternNode(nodeToken(), parseBlock(tokens, input, true) as string));
                    } else if (t.value == "[") {
                        out.push(new StatePatternNode(nodeToken(), parseBlockStates(tokens)));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == "*") {
                    const t = tokens.next();
                    if (t.type != "id") {
                        throwTokenError(t);
                    }
                    out.push(new RandStatePatternNode(nodeToken(), parseBlock(tokens, input, true) as string));
                } else if (token.value == "$") {
                    const t = tokens.next();
                    let cardinal: Cardinal | "radial" | "light";
                    if (t.type != "id") throwTokenError(t);
                    if (tokens.peek().value == ".") {
                        tokens.next();
                        const d: string = tokens.next()?.value;
                        cardinal = d === "rad" ? "radial" : d === "lit" ? "light" : Cardinal.parseArgs([d]).result;
                    }

                    out.push(new GradientPatternNode(nodeToken(), t.value, cardinal));
                } else if (token.value == "#") {
                    const t = tokens.next();
                    if (t.value == "clipboard") {
                        let offset = Vector.ZERO;
                        if (tokens.peek()?.value == "@") {
                            tokens.next();
                            if (tokens.next().value != "[") throwTokenError(tokens.curr());
                            const array = parseNumberList(tokens, 3);
                            offset = Vector.from(array as [number, number, number]);
                        }
                        out.push(new ClipboardPatternNode(nodeToken(), offset.floor()));
                    } else if (t.value == "hand") {
                        out.push(new HandPatternNode(nodeToken()));
                    } else if (t.value.match?.(/^blob[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BlobPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(4))));
                    } else if (t.value.match?.(/^perlin[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new PerlinPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6))));
                    } else if (t.value.match?.(/^grid[1-9][0-9]*$/)) {
                        const sizeX = Number.parseInt((t.value as string).slice(4), 10);
                        if (!Number.isSafeInteger(sizeX)) throwTokenError(t);
                        // A missing third dimension means a 2D grid.
                        const [sizeZ, sizeY] = parseNoiseParams([sizeX, 0], [(value) => Number.isSafeInteger(value) && value > 0, (value) => Number.isSafeInteger(value) && value > 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new GridPatternNode(nodeToken(), sizeX, sizeZ, sizeY));
                    } else if (t.value.match?.(/^triangle[1-9][0-9]*$/)) {
                        const size = Number.parseInt((t.value as string).slice(8), 10);
                        if (!Number.isSafeInteger(size)) throwTokenError(t);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new TrianglePatternNode(nodeToken(), size));
                    } else if (t.value.match?.(/^hexagon[1-9][0-9]*$/)) {
                        const size = Number.parseInt((t.value as string).slice(7), 10);
                        if (!Number.isSafeInteger(size)) throwTokenError(t);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new HexagonPatternNode(nodeToken(), size));
                    } else if (t.value.match?.(/^brick[1-9][0-9]*$/)) {
                        const width = Number.parseInt((t.value as string).slice(5), 10);
                        if (!Number.isSafeInteger(width) || width < 2) throwTokenError(t);
                        const [height, mortar] = parseNoiseParams(
                            [Math.max(2, Math.floor(width / 2)), 1],
                            [(value) => Number.isSafeInteger(value) && value >= 2, (value) => Number.isSafeInteger(value) && value >= 0]
                        );
                        if (mortar >= width || mortar >= height) throwTokenError(t);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BrickPatternNode(nodeToken(), width, height, mortar));
                    } else if (t.value.match?.(/^dots[1-9][0-9]*$/)) {
                        const spacing = Number.parseInt((t.value as string).slice(4), 10);
                        if (!Number.isSafeInteger(spacing) || spacing < 2) throwTokenError(t);
                        const [radius] = parseNoiseParams([Math.max(1, Math.floor(spacing / 4))], [(value) => Number.isSafeInteger(value) && value >= 1 && value <= spacing / 2]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new DotsPatternNode(nodeToken(), spacing, radius));
                    } else if (t.value.match?.(/^rings[1-9][0-9]*$/)) {
                        const spacing = Number.parseInt((t.value as string).slice(5), 10);
                        if (!Number.isSafeInteger(spacing)) throwTokenError(t);
                        const [thickness] = parseNoiseParams([Math.max(1, Math.floor(spacing / 4))], [(value) => Number.isSafeInteger(value) && value >= 1 && value <= spacing]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new RingsPatternNode(nodeToken(), spacing, thickness));
                    } else if (t.value.match?.(/^bubbles[1-9][0-9]*$/)) {
                        const average = Number.parseInt((t.value as string).slice(7), 10);
                        if (!Number.isSafeInteger(average)) throwTokenError(t);
                        const defaultVariation = Math.min(2, average - 1);
                        const [variation, edge, concentration] = parseNoiseParams(
                            [defaultVariation, Math.min(2, average - defaultVariation), 0.6],
                            [(value) => Number.isSafeInteger(value) && value >= 0, (value) => Number.isSafeInteger(value) && value >= 1, (value) => value >= 0 && value <= 1]
                        );
                        if (variation >= average || edge > average - variation) throwTokenError(t);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BubblesPatternNode(nodeToken(), average, variation, edge, concentration));
                    } else if (t.value.match?.(/^voronoi[1-9][0-9]*$/)) {
                        const size = Number.parseInt((t.value as string).slice(7), 10);
                        if (!Number.isSafeInteger(size)) throwTokenError(t);
                        const [jitter] = parseNoiseParams([0.8], [(value) => value >= 0 && value <= 1]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new VoronoiPatternNode(nodeToken(), size, jitter));
                    } else if (t.value.match?.(/^stripes[1-9][0-9]*$/)) {
                        const width = Number.parseInt((t.value as string).slice(7), 10);
                        if (!Number.isSafeInteger(width)) throwTokenError(t);
                        const [angle] = parseNoiseParams([0], [(value) => Number.isFinite(value) && value >= 0 && value < 360]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new StripesPatternNode(nodeToken(), width, angle));
                    } else if (t.value.match?.(/^waves[1-9][0-9]*$/)) {
                        const width = Number.parseInt((t.value as string).slice(5), 10);
                        if (!Number.isSafeInteger(width)) throwTokenError(t);
                        const [amplitude, wavelength] = parseNoiseParams(
                            [Math.max(1, Math.floor(width / 2)), width * 6],
                            [(value) => Number.isFinite(value) && value >= 0, (value) => Number.isSafeInteger(value) && value >= 2]
                        );
                        if (!Number.isSafeInteger(wavelength)) throwTokenError(t);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new WavesPatternNode(nodeToken(), width, amplitude, wavelength));
                    } else if (t.value.match?.(/^truchet[1-9][0-9]*$/)) {
                        const size = Number.parseInt((t.value as string).slice(7), 10);
                        if (!Number.isSafeInteger(size) || size < 4) throwTokenError(t);
                        const [thickness] = parseNoiseParams([Math.max(1, Math.floor(size / 6))], [(value) => Number.isSafeInteger(value) && value >= 1 && value <= size / 2]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new TruchetPatternNode(nodeToken(), size, thickness));
                    } else if (t.value.match?.(/^spiral[1-9][0-9]*$/)) {
                        const width = Number.parseInt((t.value as string).slice(6), 10);
                        if (!Number.isSafeInteger(width)) throwTokenError(t);
                        const [turns] = parseNoiseParams([1], [(value) => Number.isSafeInteger(value) && value >= 1 && value <= 32]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new SpiralPatternNode(nodeToken(), width, turns));
                    } else if (t.value.match?.(/^spots[1-9][0-9]*$/)) {
                        const spacing = Number.parseInt((t.value as string).slice(5), 10);
                        if (!Number.isSafeInteger(spacing) || spacing < 4) throwTokenError(t);
                        const [radius, concentration] = parseNoiseParams(
                            [Math.max(1, Math.round(spacing / 2)), 0.75],
                            [(value) => Number.isFinite(value) && value > 0 && value <= spacing, (value) => Number.isFinite(value) && value >= 0 && value <= 1]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new SpotsPatternNode(nodeToken(), spacing, radius, concentration));
                    } else if (t.value.match?.(/^cracked[1-9][0-9]*$/)) {
                        const [thickness] = parseNoiseParams([1], [(value) => value >= 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new CrackedPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(7)), thickness));
                    } else if (t.value.match?.(/^wood[1-9][0-9]*$/)) {
                        const [bands] = parseNoiseParams([10], [(value) => value > 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new WoodPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(4)), bands));
                    } else if (t.value.match?.(/^turbulence[1-9][0-9]*$/)) {
                        const [octaves, persistence, lacunarity] = parseNoiseParams(
                            [4, 0.5, 2],
                            [(value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new TurbulencePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(10)), octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^marble[1-9][0-9]*$/)) {
                        const [bands, distortion, octaves, persistence, lacunarity] = parseNoiseParams(
                            [1, 8, 4, 0.5, 2],
                            [(value) => value > 0, (value) => value >= 0, (value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new MarblePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6)), bands, distortion, octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^fbm[1-9][0-9]*$/)) {
                        const [octaves, persistence, lacunarity] = parseNoiseParams(
                            [4, 0.5, 2],
                            [(value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new FbmPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(3)), octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^veins[1-9][0-9]*$/)) {
                        const [width] = parseNoiseParams([0.1], [(value) => value >= 0 && value <= 1]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new VeinsPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(5)), width));
                    } else if (t.value.match?.(/^warped[1-9][0-9]*$/)) {
                        const [strength] = parseNoiseParams([1.5], [(value) => value >= 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new WarpedPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6)), strength));
                    } else if (t.value.match?.(/^simplex[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new SimplexPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(7))));
                    } else if (t.value.match?.(/^value[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new ValuePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(5))));
                    } else if (t.value.match?.(/^pingpong[1-9][0-9]*$/)) {
                        const [strength, octaves, persistence, lacunarity] = parseNoiseParams(
                            [2, 4, 0.5, 2],
                            [(value) => value > 0, (value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new PingPongPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(8)), strength, octaves, persistence, lacunarity));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.type == "bracket") {
                    if (token.value == "(") {
                        out.push(processTokens(true));
                    } else if (token.value == ")") {
                        if (!inBracket) {
                            throwTokenError(token);
                        } else {
                            processOps(out, ops);
                            break;
                        }
                    } else {
                        throwTokenError(token);
                    }
                } else if (token.type == "EOF") {
                    if (inBracket) {
                        throwTokenError(token);
                    } else {
                        processOps(out, ops);
                    }
                } else {
                    throwTokenError(token);
                }
            }

            if (out.length > 1) {
                throwTokenError(out.slice(-1)[0].token);
            } else if (!out.length) {
                throwTokenError(start);
            } else if (ops.length) {
                const op = ops.slice(-1)[0];
                throwTokenError(op instanceof Token ? op : op.token);
            }

            return out[0];
        }

        let out: PatternNode;
        try {
            out = processTokens(false);
            out.optimize();
        } catch (error) {
            if (error.pos != undefined) {
                const err: commandSyntaxError = {
                    isSyntaxError: true,
                    idx: index,
                    start: error.pos,
                    end: error.pos + 1,
                    stack: error.stack,
                };
                throw err;
            }
            throw error;
        }

        const pattern = new Pattern();
        pattern.stringSource = args[index];
        pattern.block = out;

        return { result: pattern, argIndex: index + 1 };
    }

    static parseJSON(json: patternNodeJSON): Pattern {
        const chainExplicitOverrides: Array<[ChainPatternNode, boolean]> = [];
        function buildNode({ type, settings, children }: patternNodeJSON): PatternNode {
            let node!: PatternNode;
            switch (type) {
                case "block":
                    node = new BlockPatternNode(null, BlockPermutation.resolve(settings.id, settings.states));
                    break;
                case "void":
                    node = new VoidPatternNode(null);
                    break;
                case "type":
                    node = new TypePatternNode(null, settings.type);
                    break;
                case "state":
                    node = new StatePatternNode(null, new Map(Object.entries(settings.states)));
                    break;
                case "randstate":
                    node = new RandStatePatternNode(null, settings.type);
                    break;
                case "clipboard":
                    node = new ClipboardPatternNode(null, Vector.from(settings.offset));
                    break;
                case "hand":
                    node = new HandPatternNode(null);
                    break;
                case "gradient":
                    node = new GradientPatternNode(
                        null, //
                        settings.gradientId,
                        settings.cardinal in CardinalDirection ? new Cardinal(settings.cardinal) : settings.cardinal
                    );
                    break;
                case "percent":
                    node = new PercentPatternNode(null, settings.percent);
                    break;
                case "input":
                    node = new InputPatternNode(null, settings.input);
                    break;
                case "blob":
                    node = new BlobPatternNode(null, settings.size);
                    break;
                case "perlin":
                    node = new PerlinPatternNode(null, settings.size);
                    break;
                case "grid":
                    node = new GridPatternNode(null, settings.sizeX, settings.sizeZ, settings.sizeY ?? 0);
                    break;
                case "triangle":
                    node = new TrianglePatternNode(null, settings.size);
                    break;
                case "hexagon":
                    node = new HexagonPatternNode(null, settings.size);
                    break;
                case "brick":
                    node = new BrickPatternNode(null, settings.width, settings.height, settings.mortar ?? 1);
                    break;
                case "dots":
                    node = new DotsPatternNode(null, settings.spacing, settings.radius);
                    break;
                case "rings":
                    node = new RingsPatternNode(null, settings.spacing, settings.thickness);
                    break;
                case "bubbles":
                    node = new BubblesPatternNode(null, settings.averageRadius, settings.variation ?? 2, settings.edge ?? 2, settings.concentration ?? 0.6);
                    break;
                case "voronoi":
                    node = new VoronoiPatternNode(null, settings.size, settings.jitter ?? 0.8);
                    break;
                case "stripes":
                    node = new StripesPatternNode(null, settings.width, settings.angle ?? 0);
                    break;
                case "waves":
                    node = new WavesPatternNode(null, settings.width, settings.amplitude, settings.wavelength);
                    break;
                case "truchet":
                    node = new TruchetPatternNode(null, settings.size, settings.thickness);
                    break;
                case "spiral":
                    node = new SpiralPatternNode(null, settings.width, settings.turns ?? 1);
                    break;
                case "spots":
                    node = new SpotsPatternNode(null, settings.spacing, settings.radius, settings.concentration ?? 0.75);
                    break;
                case "cracked":
                    node = new CrackedPatternNode(null, settings.size, settings.thickness ?? 1);
                    break;
                case "wood":
                    node = new WoodPatternNode(null, settings.size, settings.bands ?? 10);
                    break;
                case "turbulence":
                    node = new TurbulencePatternNode(null, settings.size, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "marble":
                    node = new MarblePatternNode(null, settings.size, settings.bands ?? 1, settings.distortion ?? 8, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "fbm":
                    node = new FbmPatternNode(null, settings.size, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "veins":
                    node = new VeinsPatternNode(null, settings.size, settings.width ?? 0.1);
                    break;
                case "warped":
                    node = new WarpedPatternNode(null, settings.size, settings.strength ?? 1.5);
                    break;
                case "simplex":
                    node = new SimplexPatternNode(null, settings.size);
                    break;
                case "value":
                    node = new ValuePatternNode(null, settings.size);
                    break;
                case "pingpong":
                    node = new PingPongPatternNode(null, settings.size, settings.strength ?? 2, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "chain":
                    node = new ChainPatternNode(null);
                    if (typeof settings?.explicitNoiseWeights === "boolean") {
                        chainExplicitOverrides.push([node as ChainPatternNode, settings.explicitNoiseWeights]);
                    }
                    break;
                default:
                    throw new Error(`Unknown pattern type: ${type}`);
            }

            if (children) node.nodes = children.map((child) => buildNode(child));
            return node;
        }

        const pattern = new Pattern();
        pattern.block = buildNode(json);
        pattern.block.optimize();
        for (const [node, value] of chainExplicitOverrides) node.hasExplicitWeights = value;
        return pattern;
    }

    static fromNode(node: PatternNode) {
        const pattern = new Pattern();
        pattern.block = node;
        return pattern;
    }
}

export function patternsFromSelection(selection: Selection) {
    if (selection.isEmpty) return [];

    const [min, max] = selection.getRange();
    const dim = selection.player.dimension;
    const layers: { [layer: number]: Pattern } = {};
    const layerAxis = regionSize(min, max).largestAxis();

    for (const block of selection.getBlocks()) {
        const pattern = (layers[block[layerAxis]] ??= new Pattern());
        pattern.addBlock(dim.getBlock(block).permutation);
    }

    const patterns: Pattern[] = [];
    for (const layer in layers) {
        const pattern = layers[layer];
        pattern.optimize();
        patterns.push(pattern);
    }

    return patterns;
}
