import { BlockVolumeBase, Player, system, Vector3 } from "@minecraft/server";
import { IPlayerUISession, PaintCompletionState, RelativeVolumeListBlockVolume, Widget, WidgetComponentVolumeOutline } from "@minecraft/server-editor";
import { Jobs } from "@modules/jobs";
import { Mask } from "@modules/mask";
import { Pattern } from "@modules/pattern";
import { Thread, Vector, VectorSet } from "@notbeer-api";
import { shapeToBlockVolume } from "editor/util";
import { Brush } from "server/brushes/base_brush";
import { SphereBrush } from "server/brushes/sphere_brush";
import { getSession } from "server/sessions";

const managers = new WeakMap<IPlayerUISession, EditorBrushManager>();

class EditorBrushManager {
    private readonly session: IPlayerUISession;
    private readonly player: Player;

    private widget?: Widget;
    private volumeOutline?: WidgetComponentVolumeOutline;

    private previewWidget?: Widget;
    private previewVolumeOutline?: WidgetComponentVolumeOutline;

    private readonly volumeUpdator = shapeToBlockVolume();
    private volume: BlockVolumeBase;
    private volumeOffset: Vector3 = Vector.ZERO;

    private locations = new VectorSet();
    private paintingHandler?: number;
    private onComplete?: (state: PaintCompletionState) => void;

    private mask = new Mask();
    private brush: Brush;

    constructor(session: IPlayerUISession) {
        this.session = session;
        this.player = session.extensionContext.player;
        this.brush = new SphereBrush(3, new Pattern("stone"), false);
        this.updateVolume();
    }

    getBrushShapeOffset(): Vector3 {
        return (this.player.getDynamicProperty("brushShapeOffset") as Vector3) ?? Vector.ZERO;
    }

    setBrushShapeOffset(offset: Vector3): void {
        if (this.volumeOutline) this.volumeOutline.offset = offset;
        this.player.setDynamicProperty("brushShapeOffset", offset);
    }

    activateBrushTool(): void {
        if (!this.widget) {
            const widgetGroup = this.session.extensionContext.widgetManager.createGroup();
            this.widget ??= widgetGroup.createWidget(Vector.ZERO, { bindPositionToBlockCursor: true, selectable: false });
            this.volumeOutline ??= this.widget.addVolumeOutline("shape", this.volume, {
                volumeOffset: Vector.add(this.volumeOffset, this.volume?.getMin() ?? Vector.ZERO),
                offset: this.getBrushShapeOffset(),
                showOutline: false,
            });

            this.previewWidget ??= widgetGroup.createWidget(Vector.ZERO, { selectable: false });
            this.previewVolumeOutline ??= this.previewWidget.addVolumeOutline("preview", new RelativeVolumeListBlockVolume(), { showOutline: false });
        }
        this.widget.visible = true;
    }

    deactivateBrushTool(): void {
        if (this.widget) this.widget.visible = false;
        this.endPainting(true);
    }

    setBrushMask(mask: Mask): void {
        this.mask = mask;
    }

    setBrush(brush: Brush): void {
        this.brush = brush;
        this.updateVolume();
    }

    singlePaint(onComplete: (state: PaintCompletionState) => void): void {
        this.applyBrush([this.widget!.location], (success) => onComplete(success ? PaintCompletionState.Success : PaintCompletionState.Failed));
    }

    beginPainting(onComplete: (state: PaintCompletionState) => void): void {
        if (this.paintingHandler !== undefined) return;
        this.locations.clear();
        this.paintingHandler = system.runInterval(() => {
            const nextLocation = this.widget?.location;
            if (!nextLocation || this.locations.has(nextLocation)) return;

            this.locations.add(nextLocation);
            const previewVolume = this.previewVolumeOutline?.getVolume() as RelativeVolumeListBlockVolume;
            if (previewVolume && this.volumeOutline) {
                const volume = this.volumeOutline.getVolume();
                const offset = Vector.add(nextLocation, this.getBrushShapeOffset()).add(this.volumeOffset);
                volume.translate(offset);
                previewVolume.add(volume);
                volume.translate(Vector.mul(offset, -1));
                this.previewWidget.location = previewVolume.getMin();
            }
        });
        this.onComplete = onComplete;
    }

    endPainting(discard: boolean): void {
        if (this.paintingHandler === undefined) return;
        system.clearRun(this.paintingHandler);
        this.paintingHandler = undefined;
        this.previewVolumeOutline?.getVolume().clear();
        if (!discard) {
            this.applyBrush(Array.from(this.locations.values()), (success) => {
                this.onComplete?.(success ? PaintCompletionState.Success : PaintCompletionState.Failed);
            });
        } else {
            this.onComplete?.(PaintCompletionState.Canceled);
        }
        this.onComplete = undefined;
    }

    isBrushPaintBusy(): boolean {
        return this.paintingHandler !== undefined;
    }

    private updateVolume() {
        const [shape, location] = this.brush.getOutline();
        this.volumeUpdator.update(shape, (volume) => {
            this.volume = volume;
            this.volumeOffset = location;
            if (this.volumeOutline) {
                this.volumeOutline.setVolume(this.volume);
                this.volumeOutline.volumeOffset = Vector.add(this.volumeOffset, this.volume.getMin());
            }
        });
    }

    private applyBrush(locations: Vector3[], onFinish?: (success: boolean) => void) {
        const session = getSession(this.player);
        const offsetLocations = locations.map((loc) => Vector.add(loc, this.getBrushShapeOffset()));
        new Thread().start(
            function* (this: EditorBrushManager) {
                try {
                    yield* Jobs.run(session, -1, this.brush.apply(offsetLocations, session, this.mask));
                    onFinish?.(true);
                } catch (err) {
                    onFinish?.(false);
                    throw err;
                }
            }.bind(this)
        );
    }
}

export function getEditorBrushManager(session: IPlayerUISession) {
    if (!managers.has(session)) managers.set(session, new EditorBrushManager(session));
    return managers.get(session)!;
}
