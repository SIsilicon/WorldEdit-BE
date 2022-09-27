import { BlockLocation } from "mojang-minecraft";
import { PlayerSession } from "../sessions.js";
import { Brush } from "./base_brush.js";
import { CylinderShape } from "../shapes/cylinder.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Selection } from "@modules/selection.js";

/**
 * This brush creates cylinder shaped patterns in the world.
 */
export class CylinderBrush extends Brush {
  private shape: CylinderShape;
  private pattern: Pattern;
  private height: number;
  private hollow: boolean;
  private radius: number;

  /**
    * @param radius The radius of the cylinders
    * @param height The height of the cylinders
    * @param pattern The pattern the cylinders will be made of
    * @param hollow Whether the cylinders will be made hollow
    */
  constructor(radius: number, height: number, pattern: Pattern, hollow: boolean) {
    super();
    this.assertSizeInRange(radius);
    this.shape = new CylinderShape(height, radius);
    this.shape.usedInBrush = true;
    this.height = height;
    this.pattern = pattern;
    this.hollow = hollow;
    this.radius = radius;
  }

  public resize(value: number) {
    this.assertSizeInRange(value);
    this.shape = new CylinderShape(this.height, value);
    this.shape.usedInBrush = true;
    this.radius = value;
  }

  public paintWith(value: Pattern) {
    this.pattern = value;
  }

  public *apply(loc: BlockLocation, session: PlayerSession, mask?: Mask) {
    yield* this.shape.generate(loc, this.pattern, mask, session, {"hollow": this.hollow});
  }

  // TODO: Support cylinder shape
  public updateOutline(selection: Selection, loc: BlockLocation): void {
    const region = this.shape.getRegion(loc);
    selection.mode = "cuboid";
    selection.set(0, region[0]);
    selection.set(1, region[1]);
  }
}