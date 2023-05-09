import { BlockPermutation, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Server, Thread } from "@notbeer-api";
import { print, printerr } from "../util.js";
import { RawText, Vector } from "@notbeer-api";

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
  readonly useOn: (self: Tool, player: Player, session: PlayerSession, loc: Vector) => void | Generator<unknown>;
  /**
   * The function that's called every tick the tool is held.
   */
  readonly tick: (self: Tool, player: Player, session: PlayerSession, tick: number) => Generator<unknown>;
  /**
   * The function that's called when the tool has broken a block.
   */
  readonly breakOn: (self: Tool, player: Player, session: PlayerSession, loc: Vector, brokenBlock: BlockPermutation) => void;
  /**
   * The permission required for the tool to be used.
   */
  readonly permission: string;

  /**
   * @internal
   * The type of the tool; is set on bind, from registration information
   */
  type: string;

  private currentPlayer: Player;
  log(message: string | RawText) {
    print(message, this.currentPlayer, true);
  }

  private useOnTick = 0;
  private lastUse = Date.now();

  process(session: PlayerSession, tick: number, loc?: Vector, brokenBlock?: BlockPermutation): boolean {
    const player = session.getPlayer();

    if (!loc && !this.use || loc && !this.useOn || brokenBlock && !this.breakOn) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onFail = (e: any) => {
      printerr(e.message ? RawText.text(`${e.name}: `).append("translate", e.message) : e, player, true);
      if (e.stack) {
        printerr(e.stack, player, false);
      }
    };

    new Thread().start(function* (self: Tool, player: Player, session: PlayerSession, loc: Vector, brokenBlock: BlockPermutation) {
      self.currentPlayer = player;
      session.usingItem = true;
      try {
        if (!Server.player.hasPermission(player, self.permission)) {
          throw "worldedit.tool.noPerm";
        }

        if (Date.now() - self.lastUse > 200) {
          self.lastUse = Date.now();

          if (!loc) {
            if (self.useOnTick != tick) {
              if (self.use.constructor.name == "GeneratorFunction") {
                yield* self.use(self, player, session) as Generator<void, void>;
              } else {
                self.use(self, player, session) as void;
              }
            }
          } else if (!brokenBlock) {
            self.useOnTick = tick;
            if (self.useOn.constructor.name == "GeneratorFunction") {
              yield* self.useOn(self, player, session, loc) as Generator<void, void>;
            } else {
              self.useOn(self, player, session, loc) as void;
            }
          } else {
            self.breakOn(self, player, session, loc, brokenBlock);
          }
        }
      } catch(e) {
        onFail(e);
      } finally {
        session.usingItem = false;
      }
      self.currentPlayer = null;
    }, this, player, session, loc, brokenBlock);
    return true;
  }

  delete() {
    return;
  }
}