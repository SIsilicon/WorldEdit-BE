/* eslint-disable @typescript-eslint/no-explicit-any */
import { Thread } from "@notbeer-api";
import { Player } from "@minecraft/server";

export type range = [number | null, number | null];

export interface commandArg {
    name: string;
    type: string;
    default?: any;
}
export interface commandNum extends commandArg {
    type: "int" | "float";
    range?: range;
}
export interface commandEnum extends commandArg {
    type: "enum";
    values: Array<string>;
}
export interface commandFlag {
    flag: string;
    name?: string;
    type?: string;
}
export interface commandSubDef {
    subName: string;
    permission?: string;
    description?: string;
    args?: commandArgList;
}

export type commandArgList = Array<commandNum | commandEnum | commandArg | commandFlag | commandSubDef>;

export interface argParseResult<T> {
    result: T;
    argIndex: number;
}

export interface commandSyntaxError {
    isSyntaxError: true;
    idx: number;
    start?: number;
    end?: number;
    stack: string;
}

export interface registerInformation {
    name: string;
    permission?: string;
    description: string;
    usage?: commandArgList;
    aliases?: Array<string>;
}
export interface storedRegisterInformation extends registerInformation {
    callback: (player: Player, msg: string, args: Map<string, any>) => Thread<any[]>;
}
