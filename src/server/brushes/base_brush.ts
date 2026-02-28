import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import config from "config.js";
import { Shape } from "server/shapes/base_shape.js";
import { Vector3 } from "@minecraft/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type brushConstruct = (new (...args: any[]) => Brush) & { parseJSON: (json: { [key: string]: any }) => any[] };
export const brushTypes: Map<string, brushConstruct> = new Map();

/**
 * This class is the base for all brush types available in WorldEdit.
 */
export abstract class Brush {
    public abstract readonly id: string;

    /** Whether the brush works in strokes. */
    public readonly usesStrokes: boolean = true;

    /**
     * Applies the brush's effect somewhere in the world.
     * @param locations The locations where the brush is being applied
     * @param session The session that's using this brush
     * @param mask An optional mask to decide where the brush can affect the world
     */
    public abstract apply(locations: Vector[], session: PlayerSession, mask?: Mask): Generator<unknown, void>;

    /**
     * Gets the shape outline of the brush, and the offset from the hit postition to draw it at.
     */
    public abstract getOutline(): [Shape, Vector3];

    public delete() {
        return;
    }

    public assertSizeInRange(size: number) {
        if (size > config.maxBrushRadius) {
            throw RawText.translate("commands.wedit:brush.tooLarge").with(config.maxBrushRadius.toString());
        }
    }

    public abstract toJSON(): { id: string; [key: string]: unknown };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    public static parseJSON(json: { [key: string]: any }): any[] {
        return [];
    }
}
