import { BlockLocation, BlockPermutation, Dimension, StringBlockProperty, BoolBlockProperty, IntBlockProperty, MinecraftBlockTypes } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, contentLog, Vector, Server } from "@notbeer-api";
import { PlayerSession } from "server/sessions.js";
import { Token } from "./extern/tokenizr.js";
import { tokenize, throwTokenError, mergeTokens, parseBlock, parseBlockStates, AstNode, processOps, parsedBlock, parseNumberList } from "./parser.js";

type AnyBlockProperty = StringBlockProperty | BoolBlockProperty | IntBlockProperty;

export class Pattern implements CustomArgType {
  private block: PatternNode;
  private compiledFunc: (ctx: typeof patternContext, loc: BlockLocation, dim: Dimension) => void;
  private stringObj = "";

  public playerSession: PlayerSession;

  constructor(pattern = "") {
    if (pattern) {
      const obj = Pattern.parseArgs([pattern]).result;
      this.block = obj.block;
      this.stringObj = obj.stringObj;
      this.compile();
    }
  }

  /**
   * Sets a block at a location in a dimension.
   * @param loc
   * @param dimension
   * @returns True if the block at the location changed; false otherwise
   */
  setBlock(loc: BlockLocation, dimension: Dimension) {
    try {
      patternContext.session = this.playerSession;
      const oldBlock = dimension.getBlock(loc).permutation;
      this.compiledFunc(patternContext, loc, dimension);
      const newBlock = dimension.getBlock(loc).permutation;

      if (oldBlock.type.id != newBlock.type.id) {
        return true;
      }
      for (const state of oldBlock.getAllProperties() as AnyBlockProperty[]) {
        if (state.value != (newBlock.getProperty(state.name) as AnyBlockProperty).value) {
          return true;
        }
      }
      return false;
    } catch (err) {
      //contentLog.error(err);
      return false;
    }
  }

  clear() {
    this.block = null;
    this.stringObj = "";
    this.compiledFunc = null;
  }

  empty() {
    return this.block == null;
  }

  addBlock(block: BlockPermutation) {
    const states: parsedBlock["states"] = new Map();
    block.getAllProperties().forEach((state: AnyBlockProperty) => {
      if (!state.name.startsWith("wall_connection_type") && !state.name.startsWith("liquid_depth")) {
        states.set(state.name, state.value);
      }
    });

    if (this.block == null) {
      this.block = new ChainPattern(null);
    }

    this.block.nodes.push(new BlockPattern(null, {
      id: block.type.id,
      states: states
    }));
    this.stringObj = "(picked)";
    this.compile();
  }

  getBlockSummary() {
    let text = "";
    const blockMap = new Map<string, number>();
    for (const pattern of this.block.nodes) {
      let sub = (<BlockPattern>pattern).block.id.replace("minecraft:", "");
      for (const state of (<BlockPattern>pattern).block.states) {
        const val = state[1];
        if (typeof val == "string" && val != "x" && val != "y" && val != "z") {
          sub += `(${val})`;
          break;
        }
      }
      if (blockMap.has(sub)) {
        blockMap.set(sub, blockMap.get(sub) + 1);
      } else {
        blockMap.set(sub, 1);
      }
    }

    let i = 0;
    for (const block of blockMap) {
      if (block[1] > 1) {
        text += `${block[1]}x ${block[0]}`;
      } else {
        text += block[0];
      }
      if (i < blockMap.size - 1) text += ", ";
      i++;
    }
    return text;
  }

  getPatternInCommand() {
    let blockData: parsedBlock;
    if (this.block instanceof BlockPattern) {
      blockData = this.block.block;
    } else if (this.block instanceof ChainPattern && this.block.nodes.length == 1 && this.block.nodes[0] instanceof BlockPattern) {
      blockData = this.block.nodes[0].block;
    }

    if (!blockData) return;

    let command = blockData.id;
    if (blockData.states?.size) {
      command += "[";
      let i = 0;
      for (const [state, val] of blockData.states.entries()) {
        command += `"${state}":`;
        command += typeof val == "string" ? `"${val}"` : `${val}`;
        if (i++ < blockData.states.size - 1) {
          command += ",";
        }
      }
      command += "]";
    }
    return command;
  }

  private compile() {
    contentLog.debug("compiling", this.stringObj, "to", this.block.compile());
    if (this.block) {
      this.compiledFunc = new Function("ctx", "loc", "dim", this.block.compile()) as typeof this.compiledFunc;
    }
  }

  static parseArgs(args: Array<string>, index = 0) {
    const input = args[index];
    if (!input) {
      return { result: new Pattern(), argIndex: index + 1 };
    }

    const tokens = tokenize(input);
    let token: Token;

    function processTokens(inBracket: boolean) {
      const ops: PatternNode[] = [];
      const out: PatternNode[] = [];
      const start = tokens.curr();

      function nodeToken() {
        return mergeTokens(token, tokens.curr(), input);
      }

      // eslint-disable-next-line no-cond-assign
      while (token = tokens.next()) {
        if (token.type == "id") {
          out.push(new BlockPattern(nodeToken(), parseBlock(tokens, input, false) as parsedBlock));
        } else if (token.type == "number") {
          const num = token;
          const t = tokens.next();
          if (t.value == "%") {
            processOps(out, ops, new PercentPattern(nodeToken(), num.value));
          } else {
            throwTokenError(t);
          }
        } else if (token.value == ",") {
          processOps(out, ops, new ChainPattern(token));
        } else if (token.value == "^") {
          const t = tokens.next();
          if (t.type == "id") {
            out.push(new TypePattern(nodeToken(), parseBlock(tokens, input, true) as string));
          } else if (t.value == "[") {
            out.push(new StatePattern(nodeToken(), parseBlockStates(tokens)));
          } else {
            throwTokenError(t);
          }
        } else if (token.value == "*") {
          const t = tokens.next();
          if (t.type != "id") {
            throwTokenError(t);
          }
          out.push(new RandStatePattern(nodeToken(), parseBlock(tokens, input, true) as string));
        } else if (token.value == "#") {
          const t = tokens.next();
          if (t.value == "clipboard") {
            let offset = Vector.ZERO;
            if (tokens.peek()?.value == "@") {
              tokens.next();
              if (tokens.next().value != "[") {
                throwTokenError(tokens.curr());
              }
              const array = parseNumberList(tokens, 3);
              offset = Vector.from(array as [number, number, number]);
            }
            out.push(new ClipboardPattern(nodeToken(), offset.toBlock()));
          } else if (t.value == "hand") {
            out.push(new HandPattern(nodeToken()));
          } else {
            throwTokenError(t);
          }
        } else if (token.type == "bracket") {
          if (token.value == "(") {
            out.push(processTokens(true));
          } else if (token.value == ")") {
            if (!inBracket) {
              throwTokenError(token);
            } else {
              processOps(out, ops);
              break;
            }
          } else {
            throwTokenError(token);
          }
        } else if (token.type == "EOF") {
          if (inBracket) {
            throwTokenError(token);
          } else {
            processOps(out, ops);
          }
        } else {
          throwTokenError(token);
        }
      }

      if (out.length > 1) {
        throwTokenError(out.slice(-1)[0].token);
      } else if (!out.length) {
        throwTokenError(start);
      } else if (ops.length) {
        const op = ops.slice(-1)[0];
        throwTokenError(op instanceof Token ? op : op.token);
      }

      return out[0];
    }

    let out: PatternNode;
    try {
      out = processTokens(false);
      out.postProcess();
    } catch (error) {
      if (error.pos != undefined) {
        const err: commandSyntaxError = {
          isSyntaxError: true,
          idx: index,
          start: error.pos,
          end: error.pos + 1,
          stack: error.stack
        };
        throw err;
      }
      throw error;
    }

    const pattern = new Pattern();
    pattern.stringObj = args[index];
    pattern.block = out;
    pattern.compile();

    return { result: pattern, argIndex: index + 1 };
  }

  static clone(original: Pattern) {
    const pattern = new Pattern();
    pattern.block = original.block;
    pattern.stringObj = original.stringObj;
    pattern.compile();
    return pattern;
  }

  toString() {
    return `[pattern: ${this.stringObj}]`;
  }
}

abstract class PatternNode implements AstNode {
  public nodes: PatternNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) { }

    abstract compile(): string;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() { }
}

class BlockPattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public block: parsedBlock) {
    super(token);
  }

  compile() {
    let result = `let block = ctx.mcBlocks.get('${this.block.id}').createDefaultBlockPermutation();`;
    if (this.block.states) {
      for (const [state, val] of this.block.states.entries()) {
        result += `\nblock.getProperty('${state}').value = ${typeof val == "string" ? `'${val}'` : val};`;
      }
    }
    result += "\ndim.getBlock(loc).setPermutation(block);";
    return result;
  }
}

class TypePattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public type: string) {
    super(token);
  }

  compile() {
    let type = this.type;
    if (!type.includes(":")) {
      type = "minecraft:" + type;
    }
    return `let newBlock = ctx.mcBlocks.get('${type}').createDefaultBlockPermutation();
let oldBlock = dim.getBlock(loc);
oldBlock.permutation.getAllProperties().forEach(prop => {
    newBlock.getProperty(prop.name).value = prop.value;
})
oldBlock.setPermutation(newBlock);`;
  }
}

class StatePattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public states: parsedBlock["states"]) {
    super(token);
  }

  compile() {
    let result = "let newBlock = dim.getBlock(loc).permutation.clone();";
    result += "\nlet oldBlock = dim.getBlock(loc);";
    for (const [state, val] of this.states.entries()) {
      result += `\nnewBlock.getProperty('${state}').value = ${typeof val == "string" ? `'${val}'` : val};`;
    }
    result += "\noldBlock.setPermutation(newBlock);";
    return result;
  }
}

class RandStatePattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public block: string) {
    super(token);
  }

  compile() {
    let type = this.block;
    if (!type.includes(":")) {
      type = "minecraft:" + type;
    }

    return `let block = ctx.mcBlocks.get('${type}').createDefaultBlockPermutation();
block.getAllProperties().forEach(state => {
    state.value = state.validValues[Math.floor(Math.random() * state.validValues.length)] ?? state.value;
});
dim.getBlock(loc).setPermutation(block);`;
  }
}

class ClipboardPattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public offset: BlockLocation) {
    super(token);
  }

  compile() {
    const zeroOffset = this.offset.x == 0 && this.offset.y == 0 && this.offset.z == 0;
    return `const clipboard = ctx.session?.clipboard;
if (clipboard?.isAccurate) {
  const w = function (m, n) {
    return n >= 0 ? n % m : (n % m + m) % m;
  };
  const size = clipboard.getSize();
  const offset = ${zeroOffset ? "loc" : `loc.offset(${-this.offset.x}, ${-this.offset.y}, ${-this.offset.z})`};
  const sampledLoc = new ctx.BlockLocation(w(size.x, offset.x), w(size.y, offset.y), w(size.z, offset.z));
  const block = clipboard.getBlock(sampledLoc);
  if (block) {
    dim.getBlock(loc).setPermutation(block);
  }
}
`;
  }
}

class HandPattern extends PatternNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token) {
    super(token);
  }

  compile() {
    return `const player = ctx.session?.getPlayer();
if (player) {
  const slot = player.selectedSlot;
  const item = player.getComponent("minecraft:inventory").container.getItem(slot);
  if (item && ctx.mcBlocks.get(item.typeId)) {
    const block = ctx.server.block.dataValueToPermutation(item.typeId, item.data);
    dim.getBlock(loc).setPermutation(block);
  }
}
`;
  }
}

class PercentPattern extends PatternNode {
  readonly prec = 2;
  readonly opCount = 1;

  constructor(token: Token, public percent: number) {
    super(token);
  }

  compile() {
    return "";
  }
}

class ChainPattern extends PatternNode {
  readonly prec = 1;
  readonly opCount = 2;

  private evenDistribution = true;
  private cumWeights: number[] = [];
  private weightTotal: number;

  compile() {
    if (this.nodes.length == 1) {
      return this.nodes[0].compile();
    }

    let result = "";
    result += "let rand = " + (this.evenDistribution ? `Math.floor(Math.random() * ${this.nodes.length});\n` : `${this.weightTotal} * Math.random();\n`);
    for (let i = 0; i < this.nodes.length; i++) {
      if (i != 0) {
        result += "else ";
      }
      result += `if (${this.evenDistribution ? `rand == ${i}`: `${this.cumWeights[i]} >= rand`}) {(() => {\n${this.nodes[i].compile()}\n})()}\n`;
    }
    return result;
  }

  postProcess() {
    super.postProcess();

    const defaultPercent = 100 / this.nodes.length;
    let totalPercent = 0;

    const patterns = this.nodes;
    const weights = [];
    this.nodes = [];
    while (patterns.length) {
      const pattern = patterns.shift();
      if (pattern instanceof ChainPattern) {
        const sub = pattern.nodes.reverse();
        for (const child of sub) {
          patterns.unshift(child);
        }
      } else if (pattern instanceof PercentPattern) {
        this.evenDistribution = false;
        this.nodes.push(pattern.nodes[0]);
        weights.push(pattern.percent);
        pattern.nodes[0].postProcess();
        totalPercent += pattern.percent;
      } else {
        this.nodes.push(pattern);
        weights.push(defaultPercent);
        pattern.postProcess();
        totalPercent += defaultPercent;
      }
    }
    weights.map(value => {
      // printDebug(value / totalPercent);
      return value / totalPercent;
    });

    if (!this.evenDistribution) {
      for (let i = 0; i < weights.length; i += 1) {
        this.cumWeights.push(weights[i] + (this.cumWeights[i - 1] || 0));
      }
      this.weightTotal = this.cumWeights[this.cumWeights.length - 1];
    }
  }
}

const patternContext = {
  mcBlocks: MinecraftBlockTypes,
  session: null as PlayerSession,
  server: Server,
  print: contentLog.debug,
  BlockLocation: BlockLocation
};
