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
    type?: string
}
export interface commandSubDef {
    subName: string,
    args: commandArgList
}

export type commandArgList = Array<commandArg | commandFlag | commandSubDef>;

export interface argParseResult {
    result: any,
    argIndex: number
}

export interface registerInformation {
    name: string,
    description: string,
    usage?: commandArgList,
    aliases?: Array<string>
}
export interface storedRegisterInformation extends registerInformation {
    callback: (data: BeforeChatEvent, args: Array<string>) => void
}