import { Player, system } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Server, Thread } from "@notbeer-api";
import { printerr } from "../util.js";
import { RawText, Vector } from "@notbeer-api";

export enum ToolAction {
    USE = "use",
    USE_ON = "useOn",
    BREAK = "break",
    HIT = "hit",
    DROP = "drop",
    STOP_HOLD = "stopHold",
}

/**
 * The base tool class for handling tools that WorldEdit builders may use.
 */
export abstract class Tool {
    /**
     * The function that's called when the tool is being used.
     */
    readonly use: (self: Tool, player: Player, session: PlayerSession) => void | Generator<unknown, void>;
    /**
     * The function that's called when the tool is being used on a block.
     */
    readonly useOn: (self: Tool, player: Player, session: PlayerSession, loc: Vector) => void | Generator<unknown, void>;
    /**
     * The function that's called when the tool has broken a block.
     */
    readonly break: (self: Tool, player: Player, session: PlayerSession, loc: Vector) => void | Generator<unknown, void>;
    /**
     * The function that's called when the tool has hit a block.
     */
    readonly hit: (self: Tool, player: Player, session: PlayerSession, loc: Vector) => void | Generator<unknown, void>;
    /**
     * The function that's called when the tool is dropped.
     */
    readonly drop: (self: Tool, player: Player, session: PlayerSession) => void | Generator<unknown, void>;
    /**
     * The function that's called when the tool stops being held.
     */
    readonly stopHold: (self: Tool, player: Player, session: PlayerSession) => void | Generator<unknown, void>;
    /**
     * The function that's called every tick the tool is held.
     */
    readonly tick: (self: Tool, player: Player, session: PlayerSession, tick: number) => void | Generator<unknown, void>;
    /**
     * The permission required for the tool to be used.
     */
    readonly permission: string;
    /**
     * Whether there should be some delay between item use to avoid rapid fire.
     */
    readonly noDelay: boolean = false;

    /**
     * @internal
     * The type of the tool; is set on bind, from registration information
     */
    type: string;

    private useOnTick = 0;
    private lastUse = system.currentTick;

    process(session: PlayerSession, action: ToolAction, loc?: Vector): boolean {
        const player = session.getPlayer();
        const tick = system.currentTick;

        if (!this[action]) return false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onFail = (e: any) => {
            printerr(e.message ? RawText.text(`${e.name}: `).append("translate", e.message) : e, player, true);
            if (e.stack) {
                printerr(e.stack, player, false);
            }
        };

        new Thread().start(
            function* (self: Tool, player: Player, session: PlayerSession, action: ToolAction, loc: Vector) {
                session.usingItem = true;
                try {
                    if (!Server.player.hasPermission(player, self.permission)) {
                        throw "worldedit.tool.noPerm";
                    }

                    if (system.currentTick - self.lastUse > 4 || self.noDelay) {
                        self.lastUse = system.currentTick;

                        if (!(action == ToolAction.USE && self.useOnTick == tick)) {
                            if (action == ToolAction.USE_ON) self.useOnTick = tick;
                            const func = self[action];
                            if (func.constructor.name == "GeneratorFunction") {
                                yield* func(self, player, session, loc) as Generator<unknown, void>;
                            } else {
                                func(self, player, session, loc) as void;
                            }
                        }
                    }
                } catch (e) {
                    onFail(e);
                } finally {
                    session.usingItem = false;
                }
            },
            this,
            player,
            session,
            action,
            loc
        );
        return true;
    }

    delete() {
        return;
    }

    toJSON(): { toolType: string } {
        return { toolType: this.type };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    static parseJSON(json: { [key: string]: any }): any[] {
        return [];
    }
}
