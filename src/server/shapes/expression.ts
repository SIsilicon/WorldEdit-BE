import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { BlockLocation } from "@minecraft/server";
import { Expression } from "@modules/expression.js";
import { Vector } from "library/utils/vector.js";

export class ExpressionShape extends Shape {
  private size: Vector;
  private expr: Expression;

  constructor(size: Vector, expr: Expression) {
    super();
    this.size = size;
    this.expr = expr;
  }

  public getRegion(loc: BlockLocation) {
    return <[BlockLocation, BlockLocation]>[
      loc,
      loc.offset(this.size.x-1, this.size.y-1, this.size.z-1)
    ];
  }

  public getYRange() {
    throw Error("YRange not implemented");
    return [null, null] as [number, number];
  }

  protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
    genVars.hollow = options.hollow;
    genVars.neighbourOffsets = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    genVars.func = this.expr.compile();
  }

  protected inShape(relLoc: BlockLocation, genVars: shapeGenVars) {

    const getBlock = (offX: number, offY: number, offZ: number) => {
      const coords = [
        ((relLoc.x + offX) / Math.max(this.size.x-1, 1)) * 2.0 - 1.0,
        ((relLoc.y + offY) / Math.max(this.size.y-1, 1)) * 2.0 - 1.0,
        ((relLoc.z + offZ) / Math.max(this.size.z-1, 1)) * 2.0 - 1.0
      ];
      const val = genVars.func(coords[0], coords[1], coords[2]);
      return val == true || val > 0;
    };

    const block = getBlock(0, 0, 0);
    if (genVars.hollow && block) {
      let neighbourCount = 0;
      for (const offset of genVars.neighbourOffsets) {
        neighbourCount += getBlock(...offset as [number, number, number]) ? 1 : 0;
      }
      return neighbourCount == 6 ? false : block;
    } else {
      return block;
    }
  }
}