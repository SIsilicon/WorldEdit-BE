import { commandSyntaxError, contentLog } from "@notbeer-api";
import { MinecraftBlockTypes } from "@minecraft/server";
import { Token, Tokenizr, ParsingError } from "./extern/tokenizr.js";

export type parsedBlock = {
    id: string,
    data: number,
    states: Map<string, string|number|boolean>
}

export interface AstNode {
    prec: number,
    opCount: number,
    rightAssoc?: boolean,
    nodes: AstNode[],
    token: Token
}

const lexer = new Tokenizr();
{
  /*lexer.rule(/'(.*)'/, (ctx, match) => {
        ctx.accept('string', match[1]);
    });*/
  lexer.rule(/[~#%^=*+-/|:!&,]/, (ctx) => {
    ctx.accept("misc");
  });
  lexer.rule(/\s+/, (ctx) => {
    ctx.accept("space");
  });
  // eslint-disable-next-line no-useless-escape
  lexer.rule(/[\[\]\(\)\<\>\{\}]/, (ctx) => {
    ctx.accept("bracket");
  });
  lexer.rule(/(true|false)/, (ctx, match) => {
    ctx.accept("boolean", match[0] == "true" ? true : false);
  });
  lexer.rule(/[a-zA-Z_][a-zA-Z0-9_]*/, (ctx) => {
    ctx.accept("id");
  });
  lexer.rule(/[0-9]+(\.[0-9]+)*/, (ctx, match) => {
    ctx.accept("number", parseFloat(match[0]));
  });
  lexer.rule(/[0-9]+/, (ctx, match) => {
    ctx.accept("number", parseInt(match[0]));
  });
}

export function tokenize(input: string) {
  try {
    lexer.input(input);
  } catch (err) {
    if (err instanceof ParsingError) {
      const error: commandSyntaxError = {
        isSyntaxError: true,
        idx: -1,
        start: err.pos,
        end: err.pos + 1,
        stack: contentLog.stack()
      };
      throw error;
    }
    throw err;
  }
  return new Tokens(lexer.tokens());
}

export function mergeTokens(start: Token, end: Token, input: string) {
  const sub = input.substring(start.pos, end.pos + end.text.length);
  return new Token("merge", sub, sub, start.pos);
}

export function throwTokenError(token: Token): never {
  const err: commandSyntaxError = {
    isSyntaxError: true,
    idx: -1,
    start: token.pos,
    end: token.pos + token.text.length,
    stack: contentLog.stack()
  };
  throw err;
}

export function processOps(out: AstNode[], ops: AstNode[], op?: AstNode) {
  while (ops.length) {
    const op2 = ops.slice(-1)[0];
    if (op && (op.prec > op2.prec || op.prec == op2.prec && op2.rightAssoc)) {
      break;
    }

    if (out.length < op2.opCount) {
      throwTokenError(op2.token);
    }

    ops.pop(); // <= op2
    for (let i = 0; i < op2.opCount; i++) {
      op2.nodes.unshift(out.pop());
    }
    out.push(op2);
  }

  if (op) {
    ops.push(op);
  }
}

export function parseBlock(tokens: Tokens, input: string, typeOnly: boolean): parsedBlock|string {
  let typeToken = tokens.curr();
  const block: parsedBlock = {
    id: tokens.curr().value,
    data: -1,
    states: null
  };
  let token: Token;

  function finish() {
    if (!block.id.includes(":")) {
      block.id = "minecraft:" + block.id;
    }
    // TODO: Test against custom blocks
    if (!MinecraftBlockTypes.get(block.id)) {
      throwTokenError(typeToken);
    }
    return typeOnly ? block.id : block;
  }

  // eslint-disable-next-line no-cond-assign
  while (token = tokens.peek()) {
    switch (token.type) {
    case "misc":
      if (token.value == ":") {
        token = tokens.next();
        const peek = tokens.peek();
        if (peek.type == "id") {
          if (block.id.includes(":") || block.data != -1) throwTokenError(peek);
          block.id += ":" + peek.value;
          token = tokens.next();
          typeToken = mergeTokens(typeToken, token, input);
          if (typeOnly)
            return finish();
        } else if (peek.type == "number") {
          if (typeOnly)
            return finish();
          if (block.data != -1)
            throwTokenError(peek);
          block.data = peek.value;
          token = tokens.next();
          return finish();
        } else {
          throwTokenError(peek);
        }
      } else {
        return finish();
      }
      break;
    case "bracket":
      if (token.value == "[") {
        if (typeOnly)
          return finish();
        if (block.states != null)
          throwTokenError(token);
        token = tokens.next();
        block.states = parseBlockStates(tokens);
        return finish();
      } else {
        return finish();
      }
      break;
    default:
      return finish();
    }
  }
}

export function parseBlockStates(tokens: Tokens): parsedBlock["states"] {
  const blockStates: parsedBlock["states"] = new Map();
  let expectingBlockValue = false;
  let blockDataName: string = null;
  let blockDataValue: string|number|boolean = null;
  function pushDataTag() {
    blockStates.set(blockDataName, blockDataValue);
    expectingBlockValue = false;
    blockDataName = null;
    blockDataValue = null;
  }
  // TODO: Test state names and values are valid
  let token: Token;
  // eslint-disable-next-line no-cond-assign
  while (token = tokens.next()) {
    switch (token.type) {
    case "id": case "number": case "boolean":
      if (expectingBlockValue) {
        if (blockDataValue != null) {
          throwTokenError(token);
        }
        blockDataValue = token.value;
      } else {
        if (blockDataName != null || token.type == "number" || token.type == "boolean") {
          throwTokenError(token);
        }
        blockDataName = token.value;
      }
      break;
    case "misc":
      if (token.value == "=") {
        if (expectingBlockValue) {
          throwTokenError(token);
        }
        expectingBlockValue = true;
      } else if (token.value == ",") {
        if (blockDataValue == null) {
          throwTokenError(token);
        }
        pushDataTag();
      } else {
        throwTokenError(token);
      }
      break;
    case "bracket":
      if (token.value != "]" || token.value == "]" && blockDataValue == null) {
        throwTokenError(token);
      }
      pushDataTag();
      return blockStates;
    default:
      throwTokenError(token);
    }
  }
}

class Tokens {
  private idx = -1;
  private currToken: Token;

  constructor(public readonly tokens: Token[]) {}

  curr() {
    return this.currToken;
  }

  next() {
    this.currToken = this.tokens[++this.idx];
    return this.currToken;
  }

  peek(pos = 0) {
    return this.tokens[this.idx + pos + 1];
  }

  seek(pos: number) {
    this.idx = pos - 1;
    return this.next();
  }

  getPos() {
    return this.idx;
  }
}