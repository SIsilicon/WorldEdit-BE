import { Player } from "@minecraft/server";
import { RawText, Vector, CustomArgType } from "@notbeer-api";
import { getViewVector } from "server/util";

const directions = ["up", "down", "left", "right", "forward", "back", "north", "south", "east", "west", "me"];
const dirAliases = ["u", "d", "l", "r", "f", "b", "n", "s", "e", "w", "m"];

const DIRECTIONS: {[k: string]: Vector} = {
  "u": new Vector( 0, 1, 0),
  "d": new Vector( 0,-1, 0),
  "n": new Vector( 0, 0,-1),
  "s": new Vector( 0, 0, 1),
  "e": new Vector( 1, 0, 0),
  "w": new Vector(-1, 0, 0)
};

export const directionVectors = Object.entries(DIRECTIONS);

enum Dir {
    FORWARD, BACK, LEFT, RIGHT,
    NORTH, SOUTH, EAST, WEST,
    UP, DOWN
}

export class Cardinal implements CustomArgType {
  static readonly Dir = Dir;
  readonly Dir = Cardinal.Dir;

  private direction = "me";

  constructor(dir: Dir = Cardinal.Dir.FORWARD) {
    this.direction = {
      [Dir.FORWARD]: "f", [Dir.BACK]: "b",
      [Dir.LEFT]: "l", [Dir.RIGHT]: "r",
      [Dir.NORTH]: "n", [Dir.SOUTH]: "s",
      [Dir.EAST]: "e", [Dir.WEST]: "w",
      [Dir.UP]: "u", [Dir.DOWN]: "d"
    }[dir];
  }

  static parseArgs(args: Array<string>, index = 0) {
    const dir = args[index][0].toLowerCase();
    if (!directions.includes(dir) && !dirAliases.includes(dir)) {
      throw RawText.translate("commands.generic.wedit:invalidDir").with(args[index]);
      /*printDebug(dir);
            printDebug(dir in directions);*/
    }

    const cardinal = new Cardinal();
    cardinal.direction = dir;
    return {result: cardinal, argIndex: index+1};
  }

  static clone(original: Cardinal) {
    const cardinal = new Cardinal();
    cardinal.direction = original.direction;
    return cardinal;
  }

  getDirection(player: Player) {
    const dirChar = this.direction.charAt(0);
    if (DIRECTIONS[dirChar]) {
      return DIRECTIONS[dirChar].clone();
    } else {
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

      if (dirChar == "b") {
        cardinal = cardinal.mul(-1);
      } else if (dirChar == "l" || dirChar == "r") {
        if (absDir[0] > absDir[2]) {
          cardinal = new Vector(Math.sign(dir.x), 0, 0);
        } else {
          cardinal = new Vector(0, 0, Math.sign(dir.z));
        }

        const xTemp = cardinal.x;
        if (dirChar == "r") {
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
}