import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { CuboidShape } from "../shapes/cuboid.js";
import { Mask } from "@modules/mask.js";
import { smooth } from "../commands/region/smooth_func.js";
import { Selection } from "@modules/selection.js";

/**
 * This smooths the terrain in the world.
 */
export class SmoothBrush extends Brush {
  public readonly id = "smooth_brush";

  private shape: CuboidShape;
  private size: number;
  private iterations: number;
  private mask: Mask;

  /**
    * @param radius The radius of the smoothing area
    * @param iterations The number of times the area is smoothed
    * @param mask determine what blocks affect the height map
    */
  constructor(radius: number, iterations: number, mask: Mask) {
    super();
    this.assertSizeInRange(radius);
    this.shape = new CuboidShape(radius*2+1, radius*2+1, radius*2+1);
    this.size = radius;
    this.iterations = iterations;
    this.mask = mask;
  }

  public resize(value: number) {
    this.assertSizeInRange(value);
    this.shape = new CuboidShape(value*2+1, value*2+1, value*2+1);
    this.size = value;
    this.shape.usedInBrush = true;
  }

  public getSize() {
    return this.size;
  }

  public getIterations() {
    return this.iterations;
  }

  public getHeightMask() {
    return this.mask;
  }

  public paintWith() {
    throw "commands.generic.wedit:noMaterial";
  }

  public *apply(loc: Vector, session: PlayerSession, mask?: Mask) {
    const point = loc.offset(-this.size, -this.size, -this.size);
    yield* smooth(session, this.iterations, this.shape, point, this.mask, mask);
  }

  public updateOutline(selection: Selection, loc: Vector): void {
    const point = loc.offset(-this.size, -this.size, -this.size);
    selection.mode = "cuboid";
    selection.set(0, point);
    selection.set(1, point.offset(this.size*2+1, this.size*2+1, this.size*2+1));
  }

  public toJSON() {
    return {
      id: this.id,
      radius: this.size,
      iterations: this.iterations,
      mask: this.mask.getSource()
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static parseJSON(json: {[key: string]: any}) {
    return [json.radius, json.iterations, new Mask(json.mask)];
  }
}
brushTypes.set("smooth_brush", SmoothBrush);