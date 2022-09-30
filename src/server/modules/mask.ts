import { BlockLocation, BlockPermutation, Dimension, StringBlockProperty, BoolBlockProperty, IntBlockProperty } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, contentLog } from "@notbeer-api";
import { Token } from "./extern/tokenizr.js";
import { tokenize, throwTokenError, mergeTokens, parseBlock, AstNode, processOps, parseBlockStates, parsedBlock } from "./parser.js";

type AnyBlockProperty = StringBlockProperty | BoolBlockProperty | IntBlockProperty;

export class Mask implements CustomArgType {
  private condition: MaskNode;
  private compiledFunc: (ctx: null, loc: BlockLocation, dim: Dimension) => boolean;
  private stringObj = "";

  constructor(mask = "") {
    if (mask) {
      const obj = Mask.parseArgs([mask]).result;
      this.condition = obj.condition;
      this.stringObj = obj.stringObj;
      this.compile();
    }
  }

  matchesBlock(loc: BlockLocation, dimension: Dimension) {
    if (this.empty()) {
      return true;
    }
    return this.compiledFunc(null, loc, dimension);
  }

  clear() {
    this.condition = null;
    this.stringObj = "";
    this.compiledFunc = null;
  }

  empty() {
    return this.condition == null;
  }

  addBlock(block: BlockPermutation) {
    const states: parsedBlock["states"] = new Map();
    block.getAllProperties().forEach((state: AnyBlockProperty) => {
      if (!state.name.startsWith("wall_connection_type") && !state.name.startsWith("liquid_depth")) {
        states.set(state.name, state.value);
      }
    });

    if (this.condition == null) {
      this.condition = new ChainMask(null);
    }

    this.condition.nodes.push(new BlockMask(null, {
      id: block.type.id,
      data: -1,
      states: states
    }));
    this.stringObj = "(picked)";
    this.compile();
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
    intersect.compile();
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

  private compile() {
    contentLog.debug("compiling", this.stringObj, "to", this.condition?.compile());
    if (this.condition) {
      this.compiledFunc = new Function("ctx", "loc", "dim",
        "let isEmpty = (loc) => {dim.getBlock(loc).typeId == 'minecraft:air'};" +
        this.condition.compile()
      ) as typeof this.compiledFunc;
    }
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
          out.push(new BlockMask(nodeToken(), parseBlock(tokens, input, false) as parsedBlock));
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
    mask.compile();

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

    abstract compile(): string;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() {}
}

class BlockMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public block: parsedBlock) {
    super(token);
  }

  compile() {
    if (this.block.data != -1) {
      return `try { dim.runCommand(\`testforblock \${loc.x} \${loc.y} \${loc.z} ${this.block.id} ${this.block.data}\`); return true } catch { return false }`;
    } else {
      let result = "let block = dim.getBlock(loc).permutation;";
      result += `\nif (block.type.id != '${this.block.id}') return false;`;
      if (this.block.states) {
        for (const [state, val] of this.block.states.entries()) {
          result += `\nif (block.getProperty('${state}').value != ${typeof val == "string" ? `'${val}'` : val}) return false;`;
        }
      }
      result += "\nreturn true;";
      return result;
    }
  }
}

class StateMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public states: parsedBlock["states"], public strict: boolean) {
    super(token);
  }

  compile() {
    let result = "const block = dim.getBlock(loc).permutation;\nlet states_passed = 0;\nlet prop;";
    for (const [state, val] of this.states.entries()) {
      result += `\nprop = block.getProperty('${state}');`;
      if (this.strict) {
        result += `\nif (prop && prop.value == ${typeof val == "string" ? `'${val}'` : val}) states_passed++;`;
      } else {
        result += `\nif (!prop || prop.value == ${typeof val == "string" ? `'${val}'` : val}) states_passed++;`;
      }
    }
    return result + `\nreturn states_passed == ${this.states.size};`;
  }
}

class SurfaceMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  compile() {
    return `
    return !isEmpty(loc) && (
isEmpty(loc.offset(0, 1, 0)) || isEmpty(loc.offset(0, -1, 0)) ||
isEmpty(loc.offset(-1, 0, 0)) || isEmpty(loc.offset(1, 0, 0)) ||
isEmpty(loc.offset(0, 0, -1)) || isEmpty(loc.offset(0, 0, 1)));`;
  }
}

class ExistingMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  compile() {
    return "return !isEmpty(loc);";
  }
}

class TagMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public tag: string) {
    super(token);
  }

  compile() {
    return `return dim.getBlock(loc).hasTag('${this.tag}');`;
  }
}

class PercentMask extends MaskNode {
  readonly prec = -1;
  readonly opCount = 0;

  constructor(token: Token, public percent: number) {
    super(token);
  }

  compile() {
    return `return Math.random() < ${this.percent};`;
  }
}

class ChainMask extends MaskNode {
  readonly prec = 3;
  readonly opCount = 2;

  compile() {
    if (this.nodes.length == 1) {
      return this.nodes[0].compile();
    }
    let result = "";
    for (const mask of this.nodes) {
      result += `\nif ((() => {\n${mask.compile()}\n})()) return true;`;
    }
    return result.substring(1) + "\nreturn false;";
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

  compile() {
    if (this.nodes.length == 1) {
      return this.nodes[0].compile();
    }
    let result = "";
    for (const mask of this.nodes) {
      result += `\nif (!(() => {\n${mask.compile()}\n})()) return false;`;
    }
    return result.substring(1) + "\nreturn true;";
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

  compile() {
    return `return !(() => {\n${this.nodes[0].compile()}\n})();`;
  }
}

// Overlay and Underlay
class OffsetMask extends MaskNode {
  readonly prec = 2;
  readonly opCount = 1;

  constructor(token: Token, public x: number, public y: number, public z: number) {
    super(token);
  }

  compile() {
    return `return ((loc) => {\n${this.nodes[0].compile()}\n})(loc.offset(${this.x}, ${this.y}, ${this.z}));`;
  }

  // matchesBlock(loc: BlockLocation, dim: Dimension) {
  //     return this.nodes[0].matchesBlock(loc.offset(this.x, this.y, this.z), dim);
  // }

  postProcess() {
    while (this.nodes[0] instanceof OffsetMask) {
      this.x += this.nodes[0].x;
      this.y += this.nodes[0].y;
      this.z += this.nodes[0].z;
      this.nodes = this.nodes[0].nodes;
    }
  }
}