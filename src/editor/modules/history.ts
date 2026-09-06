import { History, setHistoryClass } from "@modules/history";
import { EditorModule } from "./base";
import { Player, Vector3 } from "@minecraft/server";
import { VectorSet, Thread, getCurrentThread } from "@notbeer-api";
import { IPlayerUISession, PendingTransaction, TransactionManager } from "@minecraft/server-editor";

const transactionManagers = new WeakMap<Player, TransactionManager>();

let historyPointId = 0;

class EditorHistory extends History {
    private activeThread?: Thread;
    private transactions = new Map<number, PendingTransaction>();

    private get transactionManager(): TransactionManager {
        return transactionManagers.get(this.player)!;
    }

    record() {
        const transaction = this.transactionManager.createPendingTransaction("WorldEdit operation");
        if (!transaction.isValid()) this.assertNotRecording();
        this.activeThread = getCurrentThread();
        const historyPoint = historyPointId++;
        this.transactions.set(historyPoint, transaction);
        return historyPoint;
    }

    *commit(historyPoint: number): Generator<any, void> {
        yield;
        try {
            this.transactions.get(historyPoint)?.submit();
        } catch {
            /* pass */
        }
        this.transactions.delete(historyPoint);
        this.activeThread = undefined;
        return;
    }

    cancel(historyPoint: number) {
        this.transactions.get(historyPoint)?.discard();
        this.transactions.delete(historyPoint);
        this.activeThread = undefined;
    }

    *trackRegion(historyPoint: number, start: Vector3 | Vector3[] | VectorSet, end?: Vector3): Generator<any, void> {
        yield;
        const transaction = this.transactions.get(historyPoint);
        if (!transaction) return;
        if ("x" in start) transaction.trackBlockChangeArea(start, end as Vector3);
        else transaction.trackBlockChangeList(Array.from(start));
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
        return this.transactions.size > 0;
    }

    getActivePointsInThread(thread: Thread): number[] {
        return thread === this.activeThread ? [0] : [];
    }
}
setHistoryClass(EditorHistory);

export class HistoryModule extends EditorModule {
    constructor(session: IPlayerUISession) {
        super(session);
        const transactionManager = this.session.extensionContext.transactionManager;
        transactionManagers.set(this.player, transactionManager);
    }

    teardown() {
        transactionManagers.delete(this.player);
    }
}
