import { Player } from "@minecraft/server";
import { RawText, Vector, CustomArgType } from "@notbeer-api";
import { getViewVector } from "server/util";

const DIRECTIONS: { [k: string]: Vector } = {
    u: new Vector(0, 1, 0),
    d: new Vector(0, -1, 0),
    n: new Vector(0, 0, -1),
    s: new Vector(0, 0, 1),
    e: new Vector(1, 0, 0),
    w: new Vector(-1, 0, 0),
};

export const directionVectors = Object.entries(DIRECTIONS);

export enum CardinalDirection {
    Forward = "forward",
    Back = "back",
    Left = "left",
    Right = "right",
    North = "north",
    South = "south",
    East = "east",
    West = "west",
    Up = "up",
    Down = "down",
}

export class Cardinal implements CustomArgType {
    public direction: CardinalDirection;

    constructor(direction: CardinalDirection = CardinalDirection.Forward) {
        this.direction = direction;
    }

    get cardinal() {
        return this.direction;
    }

    clone() {
        const cardinal = new Cardinal(this.direction);
        return cardinal;
    }

    getDirection(player?: Player) {
        const dirChar = this.direction.charAt(0);
        if (DIRECTIONS[dirChar]) {
            return DIRECTIONS[dirChar].clone();
        } else if (player) {
            const dir = getViewVector(player);
            let cardinal = Vector.ZERO;
            const absDir = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
            if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) {
                cardinal.x = Math.sign(dir.x);
            } else if (absDir[2] > absDir[0] && absDir[2] > absDir[1]) {
                cardinal.z = Math.sign(dir.z);
            } else {
                cardinal.y = Math.sign(dir.y);
            }

            if (dirChar === "b") {
                cardinal = cardinal.mul(-1);
            } else if (dirChar === "l" || dirChar === "r") {
                if (absDir[0] > absDir[2]) {
                    cardinal = new Vector(Math.sign(dir.x), 0, 0);
                } else {
                    cardinal = new Vector(0, 0, Math.sign(dir.z));
                }

                const xTemp = cardinal.x;
                if (dirChar === "r") {
                    cardinal.x = -cardinal.z;
                    cardinal.z = xTemp;
                } else {
                    cardinal.x = cardinal.z;
                    cardinal.z = -xTemp;
                }
            }

            return cardinal;
        }
    }

    toJSON() {
        return this.cardinal;
    }

    static parseArgs(args: Array<string>, index = 0) {
        let direction = args[index][0].toLowerCase();
        if (direction === "me" || direction === "m") direction = CardinalDirection.Forward;
        else if (direction.length === 1) direction = Object.values(CardinalDirection).find((dir) => dir[0] === direction);

        if (!Object.keys(CardinalDirection).includes(direction)) throw RawText.translate("commands.generic.wedit:invalidDir").with(args[index]);

        const cardinal = new Cardinal(direction as CardinalDirection);
        return { result: cardinal, argIndex: index + 1 };
    }
}
