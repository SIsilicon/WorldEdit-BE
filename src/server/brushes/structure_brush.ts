import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Selection } from "@modules/selection.js";
import { RegionBuffer, RegionLoadOptions } from "@modules/region_buffer.js";

/**
 * Pastes structures on use
 */
export class StructureBrush extends Brush {
  public readonly id = "structure_brush";

  private structs: RegionBuffer[];
  private mask: Mask;
  private size: Vector;

  private structIdx: number;
  private randomTransform = true;

  /**
    * @param struct The structure being used
    * @param mask Determines what blocks in the world can get replaced by the structure
    */
  constructor(struct: RegionBuffer | RegionBuffer[], mask: Mask) {
    super();
    this.structs = Array.isArray(struct) ? struct : [struct];
    this.mask = mask;
    this.updateStructIdx();

    for (const struct of this.structs) {
      struct.ref();
    }
  }

  public resize(value: number) {
    throw "commands.generic.wedit:noSize";
  }

  public getSize() {
    return -1;
  }

  public getMask() {
    return this.mask;
  }

  public paintWith() {
    throw "commands.generic.wedit:noMaterial";
  }

  public *apply(loc: Vector, session: PlayerSession, mask?: Mask) {
    const history = session.getHistory();
    const record = history.record();
    try {
      const start = loc.offset(-this.size.x / 2, 1, -this.size.z / 2).floor();
      const end = start.add(this.size);
      const options: RegionLoadOptions = { mask: this.mask };
      if (this.randomTransform) {
        options.rotation = new Vector(0, [0, 90, 180, 270][Math.floor(Math.random() * 4)], 0);
        options.flip = new Vector(Math.random() > 0.5 ? 1 : -1, 1, Math.random() > 0.5 ? 1 : -1);
      }

      history.addUndoStructure(record, start, end);
      yield* this.structs[this.structIdx].loadProgressive(start, session.getPlayer().dimension, options);
      history.addRedoStructure(record, start, end);
      history.commit(record);
    } catch {
      history.cancel(record);
    }
    this.updateStructIdx();
  }

  public updateOutline(selection: Selection, loc: Vector) {
    const point = loc.offset(-this.size.x / 2, 1, -this.size.z / 2).floor();
    selection.mode = "cuboid";
    selection.set(0, point);
    selection.set(1, point.add(this.size.sub(1)));
  }

  public delete() {
    for (const struct of this.structs) {
      struct.deref();
    }
  }

  private updateStructIdx() {
    this.structIdx = Math.floor(Math.random() * this.structs.length);
    this.size = this.structs[this.structIdx].getSize();
    if (this.randomTransform) {
      this.size = new Vector(
        Math.max(this.size.x, this.size.z),
        this.size.y,
        Math.max(this.size.x, this.size.z)
      );
    }
  }
}