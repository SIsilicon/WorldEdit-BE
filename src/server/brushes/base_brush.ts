import { BlockLocation } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { Selection } from "@modules/selection.js";
import config from "@config.js";

/**
 * This class is the base for all brush types available in WorldEdit.
 */
export abstract class Brush {
    /**
    * A method that changes the size of the brush.
    * @param size The new size of the brush
    */
    public abstract resize(size: number): void;

    /**
    * A method that changes the material of the brush.
    * @param material The new material of the brush
    */
    public abstract paintWith(material: Pattern): void;

    /**
    * Applies the brush's effect somewhere in the world.
    * @param loc The location where the brush is being applied
    * @param session The session that's using this brush
    * @param mask An optional mask to decide where the brush can affect the world
    */
    public abstract apply(loc: BlockLocation, session: PlayerSession, mask?: Mask): Generator<unknown, void>;

    /**
     * Updates the position of the outline
     * @param selection The selection object that will draw the outline
     * @param loc The location where the brush will affect
     */
    public abstract updateOutline(selection: Selection, loc: BlockLocation): void;

    public assertSizeInRange(size: number) {
      if (size > config.maxBrushRadius) {
        throw RawText.translate("commands.wedit:brush.tooLarge").with(config.maxBrushRadius.toString());
      }
    }
}