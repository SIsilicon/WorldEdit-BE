import { BlockLocation, BlockPermutation, Player } from "mojang-minecraft";
import { PlayerSession } from "../sessions.js";
import { Server, Thread } from "@notbeer-api";
import { print, printerr } from "../util.js";
import { RawText } from "@notbeer-api";

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
  readonly useOn: (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) => void;
  /**
    * The function that's called when the tool has broken a block.
    */
  readonly breakOn: (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation, brokenpermutation: BlockPermutation) => void;
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
  private breakOnTick = 0;
  private lastUse = Date.now();

  process(session: PlayerSession, tick: number, loc?: BlockLocation, brokenBlockPermutation?: BlockPermutation): boolean {
    const player = session.getPlayer();

    if (!loc && !this.use || loc && !this.useOn || brokenBlockPermutation && !this.breakOn) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onFail = (e: any) => {
      printerr(e.message ? `${e.name}: ${e.message}` : e, player, true);
      if (e.stack) {
        printerr(e.stack, player, false);
      }
    };

    new Thread().start(function* (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
      self.currentPlayer = player;
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
          } else if (!brokenBlockPermutation) {
            self.useOnTick = tick;
            self.useOn(self, player, session, loc);
          }
          else
          {
            self.breakOnTick = tick;
            self.breakOn(self, player, session, loc, brokenBlockPermutation);
          }
        }
      } catch(e) {
        onFail(e);
      }
      self.currentPlayer = null;
    }, this, player, session, loc);
    return true;
  }
}