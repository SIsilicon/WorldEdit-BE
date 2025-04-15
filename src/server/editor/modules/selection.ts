import { EditorModule } from "./base";
import { BlockVolume, Player } from "@minecraft/server";
import { Vector } from "@notbeer-api";
import { IPlayerUISession, SelectionContainerVolume, SelectionManager } from "@minecraft/server-editor";
import { Selection, setSelectionClass } from "@modules/selection";
import { Shape } from "server/shapes/base_shape";
import { CuboidShape } from "server/shapes/cuboid";

const selections = new WeakMap<Player, SelectionManager>();

class EditorSelection extends Selection {
    public mode: "cuboid" | "extend" | "sphere" | "cylinder" | "volume" = "extend";

    public visible = true;

    get isEmpty() {
        return !this.volume || this.volume.isEmpty;
    }

    get isCuboid() {
        return this.volume.get().getVolumeList().length === 1;
    }

    get points() {
        const volume = this.volume.get();
        if (this.isCuboid) return [volume.getVolumeList()[0].from, volume.getVolumeList()[0].to].map((v) => Vector.from(v));
        else if (this.isEmpty) return [undefined, undefined];
        else return [volume.getMin(), volume.getMax()].map((v) => Vector.from(v));
    }

    set(index: 0 | 1, loc: Vector): void {
        if (this.isEmpty) this.volume.add(new BlockVolume(loc, loc));

        const volume = this.volume.get().getVolumeList()[0];
        volume[index === 0 ? "from" : "to"] = loc;
        this.volume.set(volume);
    }

    clear() {
        this.volume.clear();
    }

    getShape(): [Shape, Vector] | undefined {
        const box = this.volume.getBoundingBox();
        const size = Vector.sub(box.max, box.min).add(1);
        return [new CuboidShape(size.x, size.y, size.z), Vector.from(box.min)];
    }

    *getBlocks() {
        for (const block of this.volume.get().getBlockLocationIterator()) yield block;
    }

    getBlockCount() {
        return this.volume.volumeCount;
    }

    getRange(): [Vector, Vector] {
        const box = this.volume.getBoundingBox();
        return [Vector.from(box.min), Vector.from(box.max)];
    }

    private get volume(): SelectionContainerVolume {
        return selections.get(this.player)?.volume;
    }
}
setSelectionClass(EditorSelection);

export class SelectionModule extends EditorModule {
    constructor(session: IPlayerUISession) {
        super(session);
        selections.set(this.player, this.session.extensionContext.selectionManager);
    }

    teardown() {
        selections.delete(this.player);
    }
}
