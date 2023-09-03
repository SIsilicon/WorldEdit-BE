import { Vector3, BlockPermutation } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector } from "@notbeer-api";
import { Token } from "./extern/tokenizr.js";
import { tokenize, throwTokenError, mergeTokens, parseBlock, AstNode, processOps, parseBlockStates, parsedBlock, blockPermutation2ParsedBlock, BlockUnit } from "./block_parsing.js";

export class Mask implements CustomArgType {
  private condition: MaskNode;
  private stringObj = "";

  constructor(mask = "") {
    if (mask) {
      const obj = Mask.parseArgs([mask]).result;
      this.condition = obj.condition;
      this.stringObj = obj.stringObj;
    }
  }

  /**
   * Tests if this mask matches a block
   * @param block
   * @returns True if the block matches; false otherwise
   */
  matchesBlock(block: BlockUnit) {
    if (this.empty()) {
      return true;
    }
    return this.condition.matchesBlock(block);
  }

  clear() {
    this.condition = null;
    this.stringObj = "";
  }

  empty() {
    return this.condition == null;
  }

  addBlock(permutation: BlockPermutation) {
    if (this.condition == null) {
      this.condition = new ChainMask(null);
    }

    const block = blockPermutation2ParsedBlock(permutation);
    this.condition.nodes.push(new BlockMask(null, block));

    if (this.stringObj) this.stringObj += ",";
    this.stringObj += block.id.replace("minecraft:", "");
    if (block.states.size) this.stringObj += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
  }

  intersect(mask: Mask) {
    let node: MaskNode;
    if (!mask.condition) {
      node = this.condition;
    } else if (!this.condition) {
      node = mask.condition;
    } else {
      node = new IntersectMask(null);
      node.nodes = [this.condition, mask.condition];
    }

    const intersect = new Mask();
    intersect.condition = node;
    return intersect;
  }

  getBlockSummary() {
    if (!this.condition || !(this.condition instanceof ChainMask)) {
      return "";
    }

    let text = "";
    let i = 0;
    for (const mask of this.condition.nodes) {
      let sub = (<BlockMask> mask).block.id.replace("minecraft:", "");
      for (const state of (<BlockMask> mask).block.states) {
        const val = state[1];
        if (typeof val == "string" && val != "x" && val != "y" && val != "z") {
          sub += `(${val})`;
          break;
        }
      }
      text += sub;
      if (i < this.condition.nodes.length-1) text += ", ";
      i++;
    }
    return text;
  }

  getSource() {
    return this.stringObj;
  }

  static parseArgs(args: Array<string>, index = 0) {
    const input = args[index];
    if (!input) {
      return {result: new Mask(), argIndex: index+1};
    }

    const tokens = tokenize(input);
    let token: Token;

    function processTokens(inBracket: boolean) {
      const ops: MaskNode[] = [];
      const out: MaskNode[] = [];
      const start = tokens.curr();

      function nodeToken() {
        return mergeTokens(token, tokens.curr(), input);
      }

      // eslint-disable-next-line no-cond-assign
      while (token = tokens.next()) {
        if (token.type == "id") {
          out.push(new BlockMask(nodeToken(), parseBlock(tokens, input, false, true) as parsedBlock));
        } else if (token.value == ",") {
          processOps(out, ops, new ChainMask(token));
        } else if (token.type == "space") {
          processOps(out, ops, new IntersectMask(token));
        } else if (token.value == "!") {
          processOps(out, ops, new NegateMask(token));
        } else if (token.type == "bracket") {
          if (token.value == "<") {
            processOps(out, ops, new OffsetMask(token, 0,  1, 0));
          } else if (token.value == ">") {
            processOps(out, ops, new OffsetMask(token, 0, -1, 0));
          } else if (token.value == "(") {
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
        } else if (token.value == "#") {
          const t = tokens.next();
          if (t.value == "existing") {
            out.push(new ExistingMask(nodeToken()));
          } else if (t.value == "surface" || t.value == "exposed") {
            out.push(new SurfaceMask(nodeToken()));
          } else if (t.value == "#") {
            const id = tokens.next();
            if (id.type != "id") {
              throwTokenError(id);
            }
            out.push(new TagMask(nodeToken(), id.value));
          } else {
            throwTokenError(t);
          }
        } else if (token.value == "%") {
          const num = tokens.next();
          if (num.type != "number") {
            throwTokenError(num);
          }
          out.push(new PercentMask(nodeToken(), num.value / 100));
        } else if (token.value == "^") {
          let states: parsedBlock["states"];
          let strict = false;
          let t = tokens.next();
          if (t.value == "=") {
            strict = true;
            t = tokens.next();
            if (t.value != "[") {
              throwTokenError(t);
            }
            states = parseBlockStates(tokens);
          } else if (t.value == "[") {
            states = parseBlockStates(tokens);
          } else {
            throwTokenError(t);
          }
          out.push(new StateMask(nodeToken(), states, strict));
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

    let out: MaskNode;
    try {
      out = processTokens(false);
      out.postProcess();
    } catch (error) {
      if (error.pos != undefined) {
        const err: commandSyntaxError = {
          isSyntaxError: true,
          idx: index,
          start: error.pos,
          end: error.pos+1,
          stack: error.stack
        };
        throw err;
      }
      throw error;
    }

    const mask = new Mask();
    mask.stringObj = args[index];
    mask.condition = out;

    return {result: mask, argIndex: index+1};
  }

  static clone(original: Mask) {
    const mask = new Mask();
    mask.condition = original.condition;
    mask.stringObj = original.stringObj;
    return mask;
  }

  toString() {
    return `[mask: ${this.stringObj}]`;
  }
}

abstract class MaskNode implements AstNode {
  public nodes: MaskNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    abstract matchesBlock(block: BlockUnit): boolean;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() {}
}

class BlockMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;
  readonly states: Record<string, string | number | boolean>;

  constructor(token: Token, public block: parsedBlock) {
    super(token);
    this.states = Object.fromEntries(block.states?.entries() ?? []);
  }

  matchesBlock(block: BlockUnit) {
    return block.permutation.matches(this.block.id, this.states);
  }
}

class StateMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public states: parsedBlock["states"], public strict: boolean) {
    super(token);
  }

  matchesBlock(block: BlockUnit) {
    const props = block.permutation.getAllStates();
    let states_passed = 0;
    for (const [state, val] of this.states.entries()) {
      if (this.strict && state in props && val == props[state]) {
        states_passed++;
      } else if (!this.strict && (!(state in props) || val == props[state])) {
        states_passed++;
      }
    }
    return states_passed == this.states.size;
  }
}

class SurfaceMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  matchesBlock(block: BlockUnit) {
    const loc = Vector.from(block.location);
    const dim = block.dimension;
    const isEmpty = (loc: Vector3) => {
      return dim.getBlock(loc).isAir;
    };

    return !isEmpty(loc) && (
      isEmpty(loc.offset( 0, 1, 0)) || isEmpty(loc.offset( 0,-1, 0)) ||
      isEmpty(loc.offset(-1, 0, 0)) || isEmpty(loc.offset( 1, 0, 0)) ||
      isEmpty(loc.offset( 0, 0,-1)) || isEmpty(loc.offset( 0, 0, 1))
    );
  }
}

class ExistingMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  matchesBlock(block: BlockUnit) {
    return !block.isAir;
  }
}

class TagMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public tag: string) {
    super(token);
  }

  matchesBlock(block: BlockUnit) {
    return block.hasTag(this.tag);
  }
}

class PercentMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public percent: number) {
    super(token);
  }

  matchesBlock() {
    return Math.random() < this.percent;
  }
}

class ChainMask extends MaskNode {
  readonly prec = 3;
  readonly opCount = 2;

  matchesBlock(block: BlockUnit) {
    for (const mask of this.nodes) {
      if (mask.matchesBlock(block))
        return true;
    }
    return false;
  }

  postProcess() {
    super.postProcess();

    const masks = this.nodes;
    this.nodes = [];
    while (masks.length) {
      const mask = masks.shift();
      if (mask instanceof ChainMask) {
        const sub = mask.nodes.reverse();
        for (const child of sub) {
          masks.unshift(child);
        }
      } else {
        this.nodes.push(mask);
        mask.postProcess();
      }
    }
  }
}

class IntersectMask extends MaskNode {
  readonly prec = 1;
  readonly opCount = 2;

  matchesBlock(block: BlockUnit) {
    for (const mask of this.nodes) {
      if (!mask.matchesBlock(block))
        return false;
    }
    return true;
  }

  postProcess() {
    super.postProcess();

    const masks = this.nodes;
    this.nodes = [];
    while (masks.length) {
      const mask = masks.shift();
      if (mask instanceof IntersectMask) {
        const sub = mask.nodes.reverse();
        for (const child of sub) {
          masks.unshift(child);
        }
      } else {
        this.nodes.push(mask);
        mask.postProcess();
      }
    }
  }
}

class NegateMask extends MaskNode {
  readonly prec = 2;
  readonly opCount = 1;

  matchesBlock(block: BlockUnit) {
    return !this.nodes[0].matchesBlock(block);
  }
}

// Overlay and Underlay
class OffsetMask extends MaskNode {
  readonly prec = 2;
  readonly opCount = 1;

  constructor(token: Token, public x: number, public y: number, public z: number) {
    super(token);
  }

  matchesBlock(block: BlockUnit) {
    const loc = block.location;
    return this.nodes[0].matchesBlock(block.dimension.getBlock({
      x: loc.x + this.x,
      y: loc.y + this.y,
      z: loc.z + this.z
    }));
  }

  postProcess() {
    while (this.nodes[0] instanceof OffsetMask) {
      this.x += this.nodes[0].x;
      this.y += this.nodes[0].y;
      this.z += this.nodes[0].z;
      this.nodes = this.nodes[0].nodes;
    }
  }
}