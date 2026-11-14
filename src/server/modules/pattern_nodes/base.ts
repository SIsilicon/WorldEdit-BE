import { Vector3, BlockPermutation } from "@minecraft/server";
import { Vector } from "@notbeer-api";
import { PlayerSession } from "server/sessions.js";
import { Token } from "../extern/tokenizr.js";
import { AstNode, BlockUnit } from "../block_parsing.js";
import { Cardinal } from "../directions.js";

export interface patternContext {
    session: PlayerSession;
    hand: BlockPermutation;
    range: [Vector, Vector];
    getCenter: (location: Vector3) => Vector;
    gradientRadius: number;
    placePosition: Vector;
    cardinal: Cardinal;
}

export interface patternNodeJSON {
    type: string;
    settings?: any;
    children?: patternNodeJSON[];
}

export abstract class PatternNode implements AstNode {
    public nodes: PatternNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    prepare() {
        for (const node of this.nodes) node.prepare();
    }

    abstract getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined;

    optimize() {
        for (const node of this.nodes) node.optimize();
    }

    abstract toJSON(): patternNodeJSON;
}
