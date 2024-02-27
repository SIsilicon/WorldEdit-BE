/* eslint-disable no-undef */
/* eslint-disable no-control-regex */
/*
 **  Tokenizr -- String Tokenization Library
 **  Copyright (c) 2015-2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
 **
 **  Permission is hereby granted, free of charge, to any person obtaining
 **  a copy of this software and associated documentation files (the
 **  "Software"), to deal in the Software without restriction, including
 **  without limitation the rights to use, copy, modify, merge, publish,
 **  distribute, sublicense, and/or sell copies of the Software, and to
 **  permit persons to whom the Software is furnished to do so, subject to
 **  the following conditions:
 **
 **  The above copyright notice and this permission notice shall be included
 **  in all copies or substantial portions of the Software.
 **
 **  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 **  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 **  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 **  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 **  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 **  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 **  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*  utility function: create a source excerpt  */
const excerpt = (txt, o) => {
    const l = txt.length;
    let b = o - 20;
    if (b < 0) b = 0;
    let e = o + 20;
    if (e > l) e = l;
    const hex = (ch) => ch.charCodeAt(0).toString(16).toUpperCase();
    const extract = (txt, pos, len) =>
        txt
            .substr(pos, len)
            .replace(/\\/g, "\\\\")
            .replace(/\x08/g, "\\b")
            .replace(/\t/g, "\\t")
            .replace(/\n/g, "\\n")
            .replace(/\f/g, "\\f")
            .replace(/\r/g, "\\r")
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, (ch) => "\\x0" + hex(ch))
            .replace(/[\x10-\x1F\x80-\xFF]/g, (ch) => "\\x" + hex(ch))
            .replace(/[\u0100-\u0FFF]/g, (ch) => "\\u0" + hex(ch))
            .replace(/[\u1000-\uFFFF]/g, (ch) => "\\u" + hex(ch));
    return {
        prologTrunc: b > 0,
        prologText: extract(txt, b, o - b),
        tokenText: extract(txt, o, 1),
        epilogText: extract(txt, o + 1, e - (o + 1)),
        epilogTrunc: e < l,
    };
};

/*  internal helper class for token representation  */
export class Token {
    constructor(type, value, text, pos = 0, line = 0, column = 0) {
        this.type = type;
        this.value = value;
        this.text = text;
        this.pos = pos;
        this.line = line;
        this.column = column;
    }
    toString(colorize = (type, text) => text) {
        return (
            `${colorize("type", this.type)} ` +
            `(value: ${colorize("value", JSON.stringify(this.value))}, ` +
            `text: ${colorize("text", JSON.stringify(this.text))}, ` +
            `pos: ${colorize("pos", this.pos)}, ` +
            `line: ${colorize("line", this.line)}, ` +
            `column: ${colorize("column", this.column)})`
        );
    }
    isA(type, value) {
        if (type !== this.type) return false;
        if (arguments.length === 2 && value !== this.value) return false;
        return true;
    }
}

/*  internal helper class for tokenization error reporting  */
export class ParsingError extends Error {
    /*  construct and initialize object  */
    constructor(message, pos, line, column, input) {
        super(message);
        this.name = "ParsingError";
        this.message = message;
        this.pos = pos;
        this.line = line;
        this.column = column;
        this.input = input;
    }

    /*  render a useful string representation  */
    toString() {
        const l = excerpt(this.input, this.pos);
        const prefix1 = `line ${this.line} (column ${this.column}): `;
        let prefix2 = "   ";
        for (let i = 0; i < prefix1.length + l.prologText.length; i++) prefix2 += " ";
        const msg = "Parsing Error: " + this.message + "\n" + prefix1 + l.prologText + l.tokenText + l.epilogText + "\n" + prefix2 + "^";
        return msg;
    }
}

/*  internal helper class for action context  */
class ActionContext {
    /*  construct and initialize the object  */
    constructor(tokenizr) {
        this._tokenizr = tokenizr;
        this._data = {};
        this._repeat = false;
        this._reject = false;
        this._ignore = false;
        this._match = null;
    }

    /*  store and retrieve user data attached to context  */
    data(key, value) {
        const valueOld = this._data[key];
        if (arguments.length === 2) this._data[key] = value;
        return valueOld;
    }

    /*  retrieve information of current matching  */
    info() {
        return {
            line: this._tokenizr._line,
            column: this._tokenizr._column,
            pos: this._tokenizr._pos,
            len: this._match[0].length,
        };
    }

    /*  pass-through functions to attached tokenizer  */
    push(...args) {
        this._tokenizr.push(...args);
        return this;
    }
    pop(...args) {
        return this._tokenizr.pop(...args);
    }
    state(...args) {
        if (args.length > 0) {
            this._tokenizr.state(...args);
            return this;
        } else return this._tokenizr.state(...args);
    }
    tag(...args) {
        this._tokenizr.tag(...args);
        return this;
    }
    tagged(...args) {
        return this._tokenizr.tagged(...args);
    }
    untag(...args) {
        this._tokenizr.untag(...args);
        return this;
    }

    /*  mark current matching to be repeated from scratch  */
    repeat() {
        this._tokenizr._log("    REPEAT");
        this._repeat = true;
        return this;
    }

    /*  mark current matching to be rejected  */
    reject() {
        this._tokenizr._log("    REJECT");
        this._reject = true;
        return this;
    }

    /*  mark current matching to be ignored  */
    ignore() {
        this._tokenizr._log("    IGNORE");
        this._ignore = true;
        return this;
    }

    /*  accept current matching as a new token  */
    accept(type, value) {
        if (arguments.length < 2) value = this._match[0];
        this._tokenizr._log(`    ACCEPT: type: ${type}, value: ` + `${JSON.stringify(value)} (${typeof value}), text: "${this._match[0]}"`);
        this._tokenizr._pending.push(new Token(type, value, this._match[0], this._tokenizr._pos, this._tokenizr._line, this._tokenizr._column));
        return this;
    }

    /*  immediately stop tokenization  */
    stop() {
        this._tokenizr._stopped = true;
        return this;
    }
}

/*  external API class  */
export class Tokenizr {
    /*  construct and initialize the object  */
    constructor() {
        this._before = null;
        this._after = null;
        this._finish = null;
        this._rules = [];
        this._debug = false;
        this.reset();
    }

    /*  reset the internal state  */
    reset() {
        this._input = "";
        this._len = 0;
        this._eof = false;
        this._pos = 0;
        this._line = 1;
        this._column = 1;
        this._state = ["default"];
        this._tag = {};
        this._transaction = [];
        this._pending = [];
        this._stopped = false;
        this._ctx = new ActionContext(this);
        return this;
    }

    /*  create an error message for the current position  */
    error(message) {
        return new ParsingError(message, this._pos, this._line, this._column, this._input);
    }

    /*  configure debug operation  */
    debug(debug) {
        this._debug = debug;
        return this;
    }

    /*  output a debug message  */
    _log(msg) {
        /* eslint no-console: off */
        if (this._debug) console.log(`tokenizr: ${msg}`);
    }

    /*  provide (new) input string to tokenize  */
    input(input) {
        /*  sanity check arguments  */
        if (typeof input !== "string") throw new Error('parameter "input" not a String');

        /*  reset state and store new input  */
        this.reset();
        this._input = input;
        this._len = input.length;
        return this;
    }

    /*  push state  */
    push(state) {
        /*  sanity check arguments  */
        if (arguments.length !== 1) throw new Error("invalid number of arguments");
        if (typeof state !== "string") throw new Error('parameter "state" not a String');

        /*  push new state  */
        this._log("    STATE (PUSH): " + `old: <${this._state[this._state.length - 1]}>, ` + `new: <${state}>`);
        this._state.push(state);
        return this;
    }

    /*  pop state  */
    pop() {
        /*  sanity check arguments  */
        if (arguments.length !== 0) throw new Error("invalid number of arguments");
        if (this._state.length < 2) throw new Error("no more custom states to pop");

        /*  pop old state  */
        this._log("    STATE (POP): " + `old: <${this._state[this._state.length - 1]}>, ` + `new: <${this._state[this._state.length - 2]}>`);
        return this._state.pop();
    }

    /*  get/set state  */
    state(state) {
        if (arguments.length === 1) {
            /*  sanity check arguments  */
            if (typeof state !== "string") throw new Error('parameter "state" not a String');

            /*  change current state  */
            this._log("    STATE (SET): " + `old: <${this._state[this._state.length - 1]}>, ` + `new: <${state}>`);
            this._state[this._state.length - 1] = state;
            return this;
        } else if (arguments.length === 0) return this._state[this._state.length - 1];
        else throw new Error("invalid number of arguments");
    }

    /*  set a tag  */
    tag(tag) {
        /*  sanity check arguments  */
        if (arguments.length !== 1) throw new Error("invalid number of arguments");
        if (typeof tag !== "string") throw new Error('parameter "tag" not a String');

        /*  set tag  */
        this._log(`    TAG (ADD): ${tag}`);
        this._tag[tag] = true;
        return this;
    }

    /*  check whether tag is set  */
    tagged(tag) {
        /*  sanity check arguments  */
        if (arguments.length !== 1) throw new Error("invalid number of arguments");
        if (typeof tag !== "string") throw new Error('parameter "tag" not a String');

        /*  set tag  */
        return this._tag[tag] === true;
    }

    /*  unset a tag  */
    untag(tag) {
        /*  sanity check arguments  */
        if (arguments.length !== 1) throw new Error("invalid number of arguments");
        if (typeof tag !== "string") throw new Error('parameter "tag" not a String');

        /*  delete tag  */
        this._log(`    TAG (DEL): ${tag}`);
        delete this._tag[tag];
        return this;
    }

    /*  configure a tokenization before-rule callback  */
    before(action) {
        this._before = action;
        return this;
    }

    /*  configure a tokenization after-rule callback  */
    after(action) {
        this._after = action;
        return this;
    }

    /*  configure a tokenization finish callback  */
    finish(action) {
        this._finish = action;
        return this;
    }

    /*  configure a tokenization rule  */
    rule(state, pattern, action, name = "unknown") {
        /*  support optional states  */
        if (arguments.length === 2 && typeof pattern === "function") {
            [pattern, action] = [state, pattern];
            state = "*";
        } else if (arguments.length === 3 && typeof pattern === "function") {
            [pattern, action, name] = [state, pattern, action];
            state = "*";
        }

        /*  sanity check arguments  */
        if (typeof state !== "string") throw new Error('parameter "state" not a String');
        if (!(typeof pattern === "object" && pattern instanceof RegExp)) throw new Error('parameter "pattern" not a RegExp');
        if (typeof action !== "function") throw new Error('parameter "action" not a Function');
        if (typeof name !== "string") throw new Error('parameter "name" not a String');

        /*  post-process state  */
        state = state.split(/\s*,\s*/g).map((entry) => {
            const items = entry.split(/\s+/g);
            const states = items.filter((item) => item.match(/^#/) === null);
            const tags = items.filter((item) => item.match(/^#/) !== null).map((tag) => tag.replace(/^#/, ""));
            if (states.length !== 1) throw new Error("exactly one state required");
            return { state: states[0], tags: tags };
        });

        /*  post-process pattern  */
        let flags = "g"; /* ECMAScript <= 5 */
        try {
            const regexp = new RegExp("", "y");
            if (typeof regexp.sticky === "boolean") flags = "y"; /* ECMAScript >= 2015 */
        } catch (ex) {
            /*  no-op  */
        }
        if (typeof pattern.multiline === "boolean" && pattern.multiline) flags += "m";
        if (typeof pattern.dotAll === "boolean" && pattern.dotAll) flags += "s";
        if (typeof pattern.ignoreCase === "boolean" && pattern.ignoreCase) flags += "i";
        if (typeof pattern.unicode === "boolean" && pattern.unicode) flags += "u";
        pattern = new RegExp(pattern.source, flags);

        /*  store rule  */
        this._log(`rule: configure rule (state: ${state}, pattern: ${pattern.source})`);
        this._rules.push({ state, pattern, action, name });

        return this;
    }

    /*  progress the line/column counter  */
    _progress(from, until) {
        const line = this._line;
        const column = this._column;
        const s = this._input;
        for (let i = from; i < until; i++) {
            const c = s.charAt(i);
            if (c === "\r") this._column = 1;
            else if (c === "\n") {
                this._line++;
                this._column = 1;
            } else if (c === "\t") this._column += 8 - (this._column % 8);
            else this._column++;
        }
        this._log(`    PROGRESS: characters: ${until - from}, ` + `from: <line ${line}, column ${column}>, ` + `to: <line ${this._line}, column ${this._column}>`);
    }

    /*  determine and return the next token  */
    _tokenize() {
        /*  helper function for finishing parsing  */
        const finish = () => {
            if (!this._eof) {
                if (this._finish !== null) this._finish.call(this._ctx, this._ctx);
                this._eof = true;
                this._pending.push(new Token("EOF", "", "", this._pos, this._line, this._column));
            }
        };

        /*  tokenize only as long as we were not stopped and there is input left  */
        if (this._stopped || this._pos >= this._len) {
            finish();
            return;
        }

        /*  loop...  */
        let continued = true;
        while (continued) {
            continued = false;

            /*  some optional debugging context  */
            if (this._debug) {
                const e = excerpt(this._input, this._pos);
                const tags = Object.keys(this._tag)
                    .map((tag) => `#${tag}`)
                    .join(" ");
                this._log(
                    `INPUT: state: <${this._state[this._state.length - 1]}>, tags: <${tags}>, text: ` +
                        (e.prologTrunc ? "..." : '"') +
                        `${e.prologText}<${e.tokenText}>${e.epilogText}` +
                        (e.epilogTrunc ? "..." : '"') +
                        `, at: <line ${this._line}, column ${this._column}>`
                );
            }

            /*  iterate over all rules...  */
            for (let i = 0; i < this._rules.length; i++) {
                if (this._debug) {
                    const state = this._rules[i].state
                        .map((item) => {
                            let output = item.state;
                            if (item.tags.length > 0) output += " " + item.tags.map((tag) => `#${tag}`).join(" ");
                            return output;
                        })
                        .join(", ");
                    this._log(`  RULE: state(s): <${state}>, ` + `pattern: ${this._rules[i].pattern.source}`);
                }

                /*  one of rule's states (and all of its tags) has to match  */
                let matches = false;
                const states = this._rules[i].state.map((item) => item.state);
                let idx = states.indexOf("*");
                if (idx < 0) idx = states.indexOf(this._state[this._state.length - 1]);
                if (idx >= 0) {
                    matches = true;
                    let tags = this._rules[i].state[idx].tags;
                    tags = tags.filter((tag) => !this._tag[tag]);
                    if (tags.length > 0) matches = false;
                }
                if (!matches) continue;

                /*  match pattern at the last position  */
                this._rules[i].pattern.lastIndex = this._pos;
                let found = this._rules[i].pattern.exec(this._input);
                this._rules[i].pattern.lastIndex = this._pos;
                if ((found = this._rules[i].pattern.exec(this._input)) !== null && found.index === this._pos) {
                    if (this._debug) this._log("    MATCHED: " + JSON.stringify(found));

                    /*  pattern found, so give action a chance to operate
                        on it and act according to its results  */
                    this._ctx._match = found;
                    this._ctx._repeat = false;
                    this._ctx._reject = false;
                    this._ctx._ignore = false;
                    if (this._before !== null) this._before.call(this._ctx, this._ctx, found, this._rules[i]);
                    this._rules[i].action.call(this._ctx, this._ctx, found);
                    if (this._after !== null) this._after.call(this._ctx, this._ctx, found, this._rules[i]);
                    if (this._ctx._reject)
                        /*  reject current action, continue matching  */
                        continue;
                    else if (this._ctx._repeat) {
                        /*  repeat matching from scratch  */
                        continued = true;
                        break;
                    } else if (this._ctx._ignore) {
                        /*  ignore token  */
                        this._progress(this._pos, this._rules[i].pattern.lastIndex);
                        this._pos = this._rules[i].pattern.lastIndex;
                        if (this._pos >= this._len) {
                            finish();
                            return;
                        }
                        continued = true;
                        break;
                    } else if (this._pending.length > 0) {
                        /*  accept token(s)  */
                        this._progress(this._pos, this._rules[i].pattern.lastIndex);
                        this._pos = this._rules[i].pattern.lastIndex;
                        if (this._pos >= this._len) finish();
                        return;
                    } else throw new Error('action of pattern "' + this._rules[i].pattern.source + '" neither rejected nor accepted any token(s)');
                }
            }
        }

        /*  no pattern matched at all  */
        throw this.error("token not recognized");
    }

    /*  determine and return next token  */
    token() {
        /*  if no more tokens are pending, try to determine a new one  */
        if (this._pending.length === 0) this._tokenize();

        /*  return now potentially pending token  */
        if (this._pending.length > 0) {
            const token = this._pending.shift();
            if (this._transaction.length > 0) this._transaction[0].push(token);
            this._log(`TOKEN: ${token.toString()}`);
            return token;
        }

        /*  no more tokens  */
        return null;
    }

    /*  determine and return all tokens  */
    tokens() {
        const result = [];
        let token;
        while ((token = this.token()) !== null) result.push(token);
        return result;
    }

    /*  peek at the next token or token at particular offset  */
    peek(offset) {
        if (typeof offset === "undefined") offset = 0;
        for (let i = 0; i < this._pending.length + offset; i++) this._tokenize();
        if (offset >= this._pending.length) throw new Error("not enough tokens available for peek operation");
        this._log(`PEEK: ${this._pending[offset].toString()}`);
        return this._pending[offset];
    }

    /*  skip one or more tokens  */
    skip(len) {
        if (typeof len === "undefined") len = 1;
        for (let i = 0; i < this._pending.length + len; i++) this._tokenize();
        if (len > this._pending.length) throw new Error("not enough tokens available for skip operation");
        while (len-- > 0) this.token();
        return this;
    }

    /*  consume the current token (by expecting it to be a particular symbol)  */
    consume(type, value) {
        for (let i = 0; i < this._pending.length + 1; i++) this._tokenize();
        if (this._pending.length === 0) throw new Error("not enough tokens available for consume operation");
        const token = this.token();
        this._log(`CONSUME: ${token.toString()}`);
        const raiseError = () => {
            throw new ParsingError(
                `expected: <type: ${type}, value: ${JSON.stringify(value)} (${typeof value})>, ` + `found: <type: ${token.type}, value: ${JSON.stringify(token.value)} (${typeof token.value})>`,
                token.pos,
                token.line,
                token.column,
                this._input
            );
        };
        if (arguments.length === 2 && !token.isA(type, value)) raiseError(JSON.stringify(value), typeof value);
        else if (!token.isA(type)) raiseError("*", "any");
        return token;
    }

    /*  open tokenization transaction  */
    begin() {
        this._log(`BEGIN: level ${this._transaction.length}`);
        this._transaction.unshift([]);
        return this;
    }

    /*  determine depth of still open tokenization transaction  */
    depth() {
        if (this._transaction.length === 0) throw new Error("cannot determine depth -- no active transaction");
        return this._transaction[0].length;
    }

    /*  close (successfully) tokenization transaction  */
    commit() {
        if (this._transaction.length === 0) throw new Error("cannot commit transaction -- no active transaction");

        /*  remove current transaction  */
        const committed = this._transaction.shift();

        /*  in case we were a nested transaction, still remember the tokens  */
        if (this._transaction.length > 0) this._transaction[0] = this._transaction[0].concat(committed);

        this._log(`COMMIT: level ${this._transaction.length}`);
        return this;
    }

    /*  close (unsuccessfully) tokenization transaction  */
    rollback() {
        if (this._transaction.length === 0) throw new Error("cannot rollback transaction -- no active transaction");

        /*  remove current transaction  */
        const rolledback = this._transaction.shift();

        /*  make the tokens available again, as new pending tokens  */
        this._pending = rolledback.concat(this._pending);

        this._log(`ROLLBACK: level ${this._transaction.length}`);
        return this;
    }

    /*  execute multiple alternative callbacks  */
    alternatives(...alternatives) {
        let result = null;
        let depths = [];
        for (let i = 0; i < alternatives.length; i++) {
            try {
                this.begin();
                result = alternatives[i].call(this);
                this.commit();
                break;
            } catch (ex) {
                this._log(`EXCEPTION: ${ex.toString()}`);
                depths.push({ ex: ex, depth: this.depth() });
                this.rollback();
                continue;
            }
        }
        if (result === null && depths.length > 0) {
            depths = depths.sort((a, b) => a.depth - b.depth);
            throw depths[0].ex;
        }
        return result;
    }
}

/*  expose the utility classes, too  */
Tokenizr.Token = Token;
Tokenizr.ParsingError = ParsingError;
Tokenizr.ActionContext = ActionContext;

/*  export the API class  */
//module.exports = Tokenizr
