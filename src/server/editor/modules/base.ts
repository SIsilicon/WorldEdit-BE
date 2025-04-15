import { Player } from "@minecraft/server";
import { IDisposable, IPlayerLogger, IPlayerUISession } from "@minecraft/server-editor";

export abstract class EditorModule implements IDisposable {
    protected readonly session: IPlayerUISession;
    protected readonly player: Player;
    protected readonly log: IPlayerLogger;

    constructor(session: IPlayerUISession) {
        this.session = session;
        this.player = session.extensionContext.player;
        this.log = session.log;
    }

    teardown() {}
}
