import { Thread } from "@notbeer-api";
import { BeforeChatEvent, Player, Location } from "mojang-minecraft";

export type range = [number | null, number | null];

export interface commandArg {
    name: string,
    type: string,
    default?: any,
    range?: range
}
export interface commandFlag {
    flag: string,
    name?: string,
    type?: string,
}
export interface commandSubDef {
    subName: string,
    permission?: string,
    description?: string,
    args?: commandArgList
}

export type commandArgList = Array<commandArg | commandFlag | commandSubDef>;

export interface argParseResult {
    result: any,
    argIndex: number
}

export interface commandSyntaxError {
    isSyntaxError: true,
    idx: number,
    start?: number,
    end?: number,
    stack: string
}

export interface registerInformation {
    name: string,
    permission?: string,
    description: string,
    usage?: commandArgList,
    aliases?: Array<string>
}
export interface storedRegisterInformation extends registerInformation {
    callback: (data: BeforeChatEvent, args: Map<string, any>) => Thread
}