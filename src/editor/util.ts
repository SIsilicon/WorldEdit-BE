import { BlockVolume, BlockVolumeBase, ListBlockVolume, system } from "@minecraft/server";
import { Vector } from "@notbeer-api";
import { Shape } from "server/shapes/base_shape";
import { CuboidShape } from "server/shapes/cuboid";

export const newLineMarkup = "[~*newLine~]";

export function shapeToBlockVolume() {
    let job: number;

    return {
        update: (shape: Shape | undefined, callback: (volume: BlockVolumeBase | undefined) => void) => {
            if (job) system.clearJob(job);

            if (!shape) {
                callback(undefined);
            } else if (shape instanceof CuboidShape) {
                callback(new BlockVolume(...shape.getRegion(Vector.ZERO)));
            } else {
                const activeJob = (job = system.runJob(
                    (function* () {
                        const volume = new ListBlockVolume([]);
                        for (const block of shape.getBlocks(Vector.ZERO)) {
                            volume.add([block]);
                            yield;
                        }
                        if (activeJob === job) callback(volume);
                    })()
                ));
            }
        },
    };
}
