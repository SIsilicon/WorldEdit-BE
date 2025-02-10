/* eslint-disable @typescript-eslint/no-explicit-any */
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

export class Token {
    constructor(type: string, value: any, text: string, pos?: number, line?: number, column?: number);
    type: string;
    value: any;
    text: string;
    pos: number;
    line: number;
    column: number;
    toString(colorize?: (type: string, value: string) => string): string;
    isA(type: string, value?: any): boolean;
}

export class ParsingError extends Error {
    constructor(message: string, pos: number, line: number, column: number, input: string);
    name: string;
    message: string;
    pos: number;
    line: number;
    column: number;
    input: string;
    toString(): string;
}

export class ActionContext {
    constructor(tokenizr: Tokenizr);
    data(key: string, value?: any): any;
    info(): { line: number; column: number; pos: number; len: number };
    push(state: string): this;
    pop(): string;
    state(state: string): this;
    state(): string;
    tag(tag: string): this;
    tagged(tag: string): boolean;
    untag(tag: string): this;
    repeat(): this;
    reject(): this;
    ignore(): this;
    accept(type: string, value?: any): this;
    stop(): this;
}

type Action = (
    this: ActionContext,
    ctx: ActionContext,
    match: RegExpExecArray,
    rule: {
        state: string;
        pattern: RegExp;
        action: RuleAction;
        name: string;
    }
) => void;

type RuleAction = (this: ActionContext, ctx: ActionContext, found: RegExpExecArray) => void;

export class Tokenizr {
    constructor();
    reset(): this;
    error(message: string): ParsingError;
    debug(debug: boolean): this;
    input(input: string): this;
    push(state: string): this;
    pop(): string;
    state(state: string): this;
    state(): string;
    tag(tag: string): this;
    tagged(tag: string): boolean;
    untag(tag: string): this;
    before(action: Action): this;
    after(action: Action): this;
    finish(action: (this: ActionContext, ctx: ActionContext) => void): this;
    rule(state: string, pattern: RegExp, action: (this: ActionContext, ctx: ActionContext, match: string[]) => void, name?: string): this;
    rule(pattern: RegExp, action: (this: ActionContext, ctx: ActionContext, match: string[]) => void, name?: string): this;
    token(): Token;
    tokens(): Token[];
    peek(offset?: number): Token;
    skip(next?: number): this;
    consume(type: string, value?: string): Token;
    begin(): this;
    depth(): number;
    commit(): this;
    rollback(): this;
    alternatives(...alternatives: ((this: this) => any)[]): any;
    static readonly Token: typeof Token;
    static readonly ParsingError: typeof ParsingError;
    static readonly ActionContext: typeof ActionContext;
}
