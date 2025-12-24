import { EditorModule } from "./base";
import { BlockVolume, Player, system } from "@minecraft/server";
import { IPlayerUISession, SelectionContainerVolume, SelectionManager } from "@minecraft/server-editor";
import { DefaultSelection, setSelectionClass } from "@modules/selection";
import { Vector } from "@notbeer-api";
import { VolumeShape } from "editor/shapes/volume";
import { getSession } from "server/sessions";

const selections = new WeakMap<Player, SelectionManager>();
const ignoreSelectionUpdates = new WeakMap<Player, number>();

function ignoreSelectionUpdate(player: Player) {
    if (ignoreSelectionUpdates.has(player)) system.clearRun(ignoreSelectionUpdates.get(player));
    ignoreSelectionUpdates.set(
        player,
        system.runTimeout(() => ignoreSelectionUpdates.delete(player), 2)
    );
}

class EditorSelection extends DefaultSelection {
    private shapeBuildJob: number | undefined;

    public updateVolumeShape() {
        this.set(0, Vector.ZERO);
        this.set(1, Vector.ZERO);
        this.shape = [new VolumeShape(this.volume.get()), Vector.ZERO];
    }

    protected updateShape() {
        super.updateShape();

        if (this.shapeBuildJob !== undefined) {
            system.clearRun(this.shapeBuildJob);
            this.shapeBuildJob = undefined;
        }

        if (this.mode === "volume") return;

        if (this.isEmpty) {
            this.volume.clear();
        } else if (this.isCuboid) {
            this.volume.set(new BlockVolume(...this.getRange()));
        } else {
            this.volume.clear();
            this.shapeBuildJob = system.runJob(
                function* (this: EditorSelection) {
                    const blocks = [];
                    for (const block of this.getBlocks()) {
                        blocks.push(block);
                        yield;
                    }
                    this.volume.set(blocks);
                    ignoreSelectionUpdate(this.player);
                }.call(this)
            );
        }
        ignoreSelectionUpdate(this.player);
    }

    private get volume(): SelectionContainerVolume {
        return selections.get(this.player)?.volume;
    }
}
setSelectionClass(EditorSelection);

export class SelectionModule extends EditorModule {
    constructor(session: IPlayerUISession) {
        super(session);
        const selection = this.session.extensionContext.selectionManager;
        selections.set(this.player, selection);

        this.session.extensionContext.afterEvents.SelectionChange.subscribe(() => {
            if (ignoreSelectionUpdates.has(this.player)) return;

            const worldEditSelection = getSession(this.player).selection as EditorSelection;
            if (selection.volume.isEmpty) {
                worldEditSelection.clear();
            } else if (selection.volume.volumeCount === 1) {
                if (!worldEditSelection.isCuboid) worldEditSelection.mode = "cuboid";
                const { min, max } = selection.volume.getBoundingBox();
                worldEditSelection.set(0, Vector.from(min));
                worldEditSelection.set(1, Vector.from(max));
            } else {
                if (worldEditSelection.mode !== "volume") {
                    worldEditSelection.mode = "volume";
                    worldEditSelection.updateVolumeShape();
                }
            }
        });
    }

    teardown() {
        selections.delete(this.player);
    }
}
