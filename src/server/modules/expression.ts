import { CustomArgType, commandSyntaxError, contentLog } from "@notbeer-api";
import { Token } from "./extern/tokenizr.js";
import { tokenize, throwTokenError, mergeTokens, AstNode, processOps } from "./parser.js";

/*
10: x++ x-- x!
9: --x ++x ~x -x !x
8: ^
7: * / %
6: + -
5: << >>
4: < <= > >=
3: == != ~=
2: && ||
1: = += -= *= /= %= ^=
*/

export class Expression implements CustomArgType {
  private root: ExpressionNode;
  private stringObj = "";

  constructor(expr = "") {
    if (expr) {
      const obj = Expression.parseArgs([expr]).result;
      this.stringObj = obj.stringObj;
    }
  }

  compile() {
    contentLog.debug(this.root.compile());
    return new Function("x", "y", "z", "return " + this.root.compile());
  }

  static parseArgs(args: Array<string>, index = 0) {
    const input = args[index];
    if (!input) {
      return {result: new Expression(), argIndex: index+1};
    }

    const tokens = tokenize(input);
    let token: Token;

    function processTokens(scope: null|"bracket"|"functionArg" = null) {
      const ops: ExpressionNode[] = [];
      const out: ExpressionNode[] = [];
      const start = tokens.curr();

      function nodeToken() {
        return mergeTokens(token, tokens.curr(), input);
      }

      // eslint-disable-next-line no-cond-assign
      while (token = tokens.next()) {
        if (token.type == "space") {
          continue;
        } else if (token.type == "number") {
          out.push(new NumberExpression(token));
        } else if (token.type == "id") {
          if (tokens.peek().value === "(") {
            tokens.next();
            const args = [];
            const t = token;
            while (tokens.curr().value === "(" || tokens.curr().value === ",") {
              args.push(processTokens("functionArg"));
            }
            token = t;

            const func = new FunctionExpression(nodeToken(), token.value);
            func.nodes = args;
            out.push(func);
          } else {
            out.push(new VariableExpression(token));
          }
        } else if (["+", "-", "*", "/", "^", "%", "=", "!", "~", ">", "<"].includes(token.value) && tokens.peek().value === "=") {
          // Assignment and equality operators
          tokens.next();
          processOps(out, ops, new BinaryOperator(nodeToken()));
        } else if ([">", "<", "&", "|"].includes(token.value)) {
          // Bit shift and logical operators
          if (tokens.peek().value === token.value) {
            tokens.next();
            processOps(out, ops, new BinaryOperator(nodeToken()));
          } else if (token.value === ">" || token.value === "<") {
            processOps(out, ops, new BinaryOperator(token));
          } else {
            throwTokenError(token);
          }
        } else if (["+", "-", "*", "/", "^", "%"].includes(token.value)) {
          // Arithmetic operators
          processOps(out, ops, new BinaryOperator(token));
        } else if (token.value === "(") {
          out.push(processTokens("bracket"));
        } else if (token.value === ")") {
          if (scope != "bracket" && scope != "functionArg") {
            throwTokenError(token);
          } else {
            processOps(out, ops);
            break;
          }
        } else if (token.value === ",") {
          if (scope != "functionArg") {
            throwTokenError(token);
          } else {
            processOps(out, ops);
            break;
          }
        } else if (token.type == "EOF") {
          if (scope) {
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

    let out: ExpressionNode;
    try {
      out = processTokens();
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

    const expression = new Expression();
    expression.stringObj = args[index];
    expression.root = out;

    return {result: expression, argIndex: index+1};
  }

  static clone(original: Expression) {
    const expression = new Expression();
    expression.root = original.root;
    expression.stringObj = original.stringObj;
    return expression;
  }

  toString() {
    return `[expression: ${this.stringObj}]`;
  }
}

abstract class ExpressionNode implements AstNode {
  public nodes: ExpressionNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    abstract compile(): string;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() {}
}

class NumberExpression extends ExpressionNode {
  readonly prec = -1;
  readonly opCount = 0;

  public value: number;

  constructor(token: Token) {
    super(token);
    this.value = token.value;
  }

  compile(): string {
    return this.value.toString();
  }
}

class VariableExpression extends ExpressionNode {
  readonly prec = -1;
  readonly opCount = 0;

  public id: string;

  constructor(token: Token) {
    super(token);
    this.id = token.value;
  }

  compile(): string {
    return this.id;
  }

  postProcess(): void {
    if (this.id.toLowerCase() == "pi") {
      this.id = Math.PI.toString();
    } else if (this.id.toLowerCase() == "e") {
      this.id = Math.E.toString();
    }
  }
}

class FunctionExpression extends ExpressionNode {
  readonly prec = -1;
  readonly opCount = 0;

  public id: string;

  constructor(token: Token, name: string) {
    super(token);
    this.id = name;
  }

  compile(): string {
    let js = this.id + "(";
    let addComma = false;
    for (const node of this.nodes) {
      js += (addComma ? "," : "") + node.compile();
      addComma = true;
    }
    return js + ")";
  }

  postProcess(): void {
    // TODO: Implement log10, rint, and other non Math functions
    if (this.id == "ln") {
      this.id = "log";
    }
    if (["abs", "acos", "asin", "atan2", "atan", "cbrt", "ceil", "cos", "cosh", "exp", "floor", "log", "max", "min", "round", "sin", "sinh", "sqrt", "tan", "tanh"].includes(this.id)) {
      this.id = "Math." + this.id;
    }

    for (const node of this.nodes) {
      node.postProcess();
    }
  }
}

class BinaryOperator extends ExpressionNode {
  readonly prec: number;
  readonly opCount = 2;
  readonly rightAssoc: boolean;

  readonly opType: string;

  readonly ops: {[key: string]: number} = {
    "=": 1, "+=": 1, "-=": 1, "*=": 1, "/=": 1, "%=": 1, "^=": 1,
    "&&": 2, "||": 2,
    "==": 3, "!=": 3, "~=": 3,
    "<": 4, "<=": 4, ">": 4, ">=": 4,
    "<<": 5, ">>": 5,
    "+": 6, "-": 6,
    "*": 7, "/": 7, "%": 7,
    "^": 8,
  };

  constructor(token: Token) {
    super(token);
    this.opType = token.value;
    this.prec = this.ops[token.value as string];
    this.rightAssoc = ["=", "+=", "-=", "*=", "/=", "%=", "^=", "^"].includes(token.value);
  }

  postProcess(): void {
    for (const node of this.nodes) {
      node.postProcess();
    }
  }

  compile(): string {
    if (this.opType.startsWith("^")) {
      const expr = `Math.pow(${this.nodes[0].compile()},${this.nodes[1].compile()})`;
      if (this.opType.endsWith("=")) {
        return this.nodes[0].compile() + "=" + expr;
      }
      return expr;
    } else {
      return `(${this.nodes[0].compile()}${this.opType}${this.nodes[1].compile()})`;
    }
  }
}
