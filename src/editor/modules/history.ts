import { History, setHistoryClass } from "@modules/history";
import { EditorModule } from "./base";
import { Player, Vector3 } from "@minecraft/server";
import { VectorSet, Thread, getCurrentThread } from "@notbeer-api";
import { IPlayerUISession, TransactionManager } from "@minecraft/server-editor";

const transactionManagers = new WeakMap<Player, TransactionManager>();

class EditorHistory extends History {
    private activeThread?: Thread;

    record() {
        if (!this.transactionManager.openTransaction("WorldEdit operation")) this.assertNotRecording();
        this.activeThread = getCurrentThread();
        return 0;
    }

    *commit(): Generator<any, void> {
        yield;
        try {
            this.transactionManager.commitOpenTransaction();
        } catch {
            /* pass */
        }
        this.activeThread = undefined;
        return;
    }

    cancel() {
        this.transactionManager.discardOpenTransaction();
        this.activeThread = undefined;
    }

    *trackRegion(_: number, start: Vector3 | Vector3[] | VectorSet, end?: Vector3): Generator<any, void> {
        yield;
        if ("x" in start) this.transactionManager.trackBlockChangeArea(start, end);
        else this.transactionManager.trackBlockChangeList(Array.from(start));
        return;
    }

    trackSelection(): void {
        console.error("Selection tracking is not implemented yet.");
    }

    *undo(): Generator<any, boolean> {
        yield;
        if (!this.transactionManager.undoSize()) return true;
        this.transactionManager.undo();
        return false;
    }

    *redo(): Generator<any, boolean> {
        yield;
        if (!this.transactionManager.redoSize()) return true;
        this.transactionManager.redo();
        return false;
    }

    clear() {
        console.error("History clear is not implemented.");
    }

    isRecording(): boolean {
        const madeTransaction = this.transactionManager.openTransaction("Testing WorldEdit history recording");
        if (madeTransaction) this.transactionManager.discardOpenTransaction();
        return !madeTransaction;
    }

    getActivePointsInThread(thread: Thread): number[] {
        return thread === this.activeThread ? [0] : [];
    }

    private get transactionManager(): TransactionManager {
        return transactionManagers.get(this.player)!;
    }
}
setHistoryClass(EditorHistory);

export class HistoryModule extends EditorModule {
    constructor(session: IPlayerUISession) {
        super(session);
        const transactionManager = this.session.extensionContext.transactionManager;
        transactionManagers.set(this.player, transactionManager);
        transactionManager.discardOpenTransaction();
    }

    teardown() {
        transactionManagers.delete(this.player);
    }
}
