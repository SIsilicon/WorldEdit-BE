import { BeforeChatEvent, Player, BlockLocation, Location } from "mojang-minecraft";
import { configuration } from "../configurations.js";
import { storedRegisterInformation, registerInformation, commandArgList, commandFlag, commandArg, commandSubDef, commandSyntaxError, argParseResult } from "@library/@types/build/classes/CommandBuilder";
import { RawText } from "@modules/rawtext.js";
import { Server } from "../../Minecraft.js";

//import { printDebug } from "@modules/../util.js"

export class CustomArgType {
    static parseArgs: (args: Array<string>, argIndex: number) => argParseResult;
    static clone: (argType: CustomArgType) => CustomArgType;
}

export class CommandPosition implements CustomArgType {
    x = 0;
    y = 0;
    z = 0;
    xRelative = true;
    yRelative = true;
    zRelative = true;
    
    static parseArgs(args: Array<string>, index: number) {
        const pos = new CommandPosition();
        for(let i = 0; i < 3; i++) {
            let arg = args[index];
            if(!args) {
                const err: commandSyntaxError = {
                    isSyntaxError: true,
                    stack: Error().stack,
                    idx: -1
                };
                throw err;
            }
            
            let relative = false;
            if (arg.includes('~')) {
                arg = arg.slice(1);
                relative = true;
            }
            const val = arg == '' ? 0 : parseFloat(arg);
            if(val != val || isNaN(val)) {
                throw RawText.translate('commands.generic.num.invalid').with(arg);
            }
            
            if (i == 0) {
                pos.x = val;
                pos.xRelative = relative;
            } else if(i == 1) {
                pos.y = val;
                pos.yRelative = relative;
            } else {
                pos.z = val;
                pos.zRelative = relative;
            }
            index++;
        }
        return {result: pos, argIndex: index};
    }
    
    static clone(original: CommandPosition) {
        const pos = new CommandPosition();
        pos.x = original.x;
        pos.y = original.y;
        pos.z = original.z;
        pos.xRelative = original.xRelative;
        pos.yRelative = original.yRelative;
        pos.zRelative = original.zRelative;
        return pos;
    }
    
    relativeTo(player: Player, isBlockLoc = false): BlockLocation|Location {
        const loc = isBlockLoc ? new BlockLocation(0, 0, 0) : new Location(0, 0, 0);
        let x = this.x + (this.xRelative ? player.location.x : 0);
        let y = this.y + (this.yRelative ? player.location.y : 0);
        let z = this.z + (this.zRelative ? player.location.z : 0);
        
        loc.x = isBlockLoc ? Math.floor(x) : x;
        loc.y = isBlockLoc ? Math.floor(y) : y;
        loc.z = isBlockLoc ? Math.floor(z) : z;
        return loc;
    }
}

export class CommandBuilder {
    public prefix: string = configuration.prefix;
    private _registrationInformation: Array<storedRegisterInformation> = [];
    private customArgTypes: Map<string, typeof CustomArgType> = new Map();

    /**
    * Register a command with a callback
    * @param {registerInformation} register An object of information needed to register the custom command
    * @param {(data: BeforeChatEvent, args: Array<string>) => void}callback Code you want to execute when the command is executed
    * @example import { Server } from "../../Minecraft";
    *  const server = new Server();
    *  server.commands.register({ name: 'ping' }, (data, args) => {
    *  server.broadcast('Pong!', data.sender.nameTag);
    * });
    */
    register(register: registerInformation, callback: (data: BeforeChatEvent, args: Map<string, any>) => void): void {
        this._registrationInformation.push({
            name: register.name.toLowerCase(),
            aliases: register.aliases ? register.aliases.map(v => v.toLowerCase()) : null,
            description: register.description,
            usage: register.usage ?? [] as commandArgList,
            permission: register.permission,
            callback
        });
    };
    /**
    * Get a list of registered commands
    * @returns {Array<string>}
    * @example getAll();
    */
    getAll(): Array<string> {
        const commands: Array<string> = [];
        this._registrationInformation.forEach(element => {
            commands.push(element.name);
        });
        return commands;
    };
    /**
    * Get all the registered informations
    * @returns {Array<storedRegisterInformation>}
    * @example getAllRegistration();
    */
    getAllRegistation(): Array<storedRegisterInformation> {
        return this._registrationInformation;
    };
    /**
    * Get registration information on a specific command
    * @param name The command name or alias you want to get information on
    * @returns {storedRegisterInformation}
    * @example getRegistration('ping');
    */
    getRegistration(name: string): storedRegisterInformation {
        const command = this._registrationInformation.some(element => element.name.toLowerCase() === name || element.aliases && element.aliases.includes(name));
        if(!command) return;
        let register;
        this._registrationInformation.forEach(element => {
            const eachCommand = element.name.toLowerCase() === name || element.aliases && element.aliases.includes(name);
            if(!eachCommand) return;
            register = element;
        });
        return register;
    };
    
    addCustomArgType(name: string, argType: typeof CustomArgType) {
        this.customArgTypes.set(name, argType);
    }
    
    printCommandArguments(name: string, player?: Player): Array<string> {
        const register = this.getRegistration(name);
        if(!register) return;
        
        const usages: Array<string> = [];
        
        function accumulate(base: Array<string>, args: commandArgList, subName = '_') {
            const text = [...base];
            let hasSubCommand = false;
            let flagText: string;
            
            if(subName.charAt(0) != '_') {
                text.push(subName);
            }
            
            args?.forEach(arg => {
                if((!('flag' in arg) || arg.flag && arg.name) && flagText) {
                    text.push(flagText + ']');
                    flagText = null;
                }
                
                if('subName' in arg) {
                    hasSubCommand = true;
                    if (player && !Server.player.hasPermission(player, arg.permission)) {
                        return;
                    }
                    accumulate(text, arg.args, arg.subName);
                } else if('flag' in arg) {
                    if(!flagText) flagText = '[-';
                    
                    flagText += arg.flag;
                    if(arg.name) {
                        text.push(flagText + ` <${arg.name}: ${arg.type}>]`);
                        flagText = null;
                    }
                } else {
                    let argText = arg.default ? '[' : '<';
                    argText += arg.name + ': ';
                    if(arg.range && typeof(arg.range[0]) == 'number' && typeof(arg.range[1]) == 'number')
                        argText += arg.range[0] + '..' + arg.range[1];
                    else
                        argText += arg.type;
                    
                    text.push(argText + (arg.default ? ']' : '>'));
                }
            });
            
            if(flagText) {
                text.push(flagText + ']');
                flagText = null;
            }
            
            if(!hasSubCommand) {
                usages.push(text.join(' '));
            }
        }
        
        if (player && !Server.player.hasPermission(player, register.permission)) {
            return [];
        }
        
        if(!register.usage.length) return [''];
        accumulate([], register.usage);
        
        return usages;
    }
    
    parseArgs(comnand: string, args: Array<string>): Map<string, any> {
        const self = this;
        const result = new Map<string, any>();
        const argDefs = this.getRegistration(comnand)?.usage;
        if(argDefs == undefined) return;
        
        function processArg(idx: number, def: commandArg, result: Map<string, any>) {
            if(def.type == 'int') {
                if(!/^[-+]?(\d+)$/.test(args[idx])) {
                    throw RawText.translate('commands.generic.num.invalid').with(args[idx]);
                }
                
                const val = Number(args[idx]);
                if(def.range) {
                    const less = val < (def.range[0] ?? -Infinity);
                    const greater = val > (def.range[1] ?? Infinity);
                    
                    if(less) {
                        throw RawText.translate('commands.generic.wedit:tooSmall').with(val).with(def.range[0]);
                    } else if(greater) {
                        throw RawText.translate('commands.generic.wedit:tooBig').with(val).with(def.range[1]);
                    }
                }
                
                idx++;
                result.set(def.name, val);
            } else if(def.type == 'float') {
                const val = parseFloat(args[idx]);
                if(val != val || isNaN(val)) {
                    throw RawText.translate('commands.generic.num.invalid').with(args[idx]);
                }
                
                if(def.range) {
                    const less = val < (def.range[0] ?? -Infinity);
                    const greater = val > (def.range[1] ?? Infinity);
                    
                    if(less) {
                        throw RawText.translate('commands.generic.tooSmall').with(val).with(def.range[0]);
                    } else if(greater) {
                        throw RawText.translate('commands.generic.tooBig').with(val).with(def.range[1]);
                    }
                }
                
                idx++;
                result.set(def.name, val);
            } else if(def.type == 'xyz') {
                const parse = CommandPosition.parseArgs(args, idx);
                idx = parse.argIndex;
                result.set(def.name, parse.result);
            } else if(def.type == 'CommandName') {
                const cmdBaseInfo = self.getRegistration(args[idx]);
                if(!cmdBaseInfo) throw RawText.translate('commands.generic.unknown').with(args[idx]);
                idx++;
                result.set(def.name, cmdBaseInfo.name);
            } else if(def.type == 'any') {
                result.set(def.name, args[idx++]);
            } else if(self.customArgTypes.has(def.type)) {
                try {
                    const parse = self.customArgTypes.get(def.type).parseArgs(args, idx);
                    idx = parse.argIndex;
                    result.set(def.name, parse.result);
                } catch(error) {
                    if(error.isSyntaxError) {
                        error.idx = idx;
                    }
                    throw error;
                }
            } else {
                throw `Unknown argument type: ${def.type}`;
            }
            return idx;
        }
        
        function processList(currIdx: number, argDefs: commandArgList, result: Map<string, any>) {
            
            let defIdx = 0;
            let hasNamedSubCmd = false;
            const flagDefs = new Map<string, commandFlag>();
            argDefs?.forEach(argDef => {
                if('flag' in argDef && !flagDefs.has(argDef.flag)) {
                    flagDefs.set(argDef.flag, argDef);
                }
            });
            
            function processSubCmd(idx: number, arg: string) {
                let processed = false;
                let unnamedSubs: Array<commandSubDef> = [];
                
                // process named sub-commands and collect unnamed ones
                while(defIdx < argDefs.length && ('subName' in argDefs[defIdx])) {
                    const argDef = <commandSubDef>argDefs[defIdx];
                    if(!processed) {
                        if(argDef.subName.startsWith('_')) {
                            unnamedSubs.push(argDef);
                        } else {
                            hasNamedSubCmd = true;
                            if(argDef.subName == arg) {
                                idx = processList(idx+1, argDef.args, result);
                                result.set(argDef.subName, true);
                                processed = true;
                                unnamedSubs = [];
                            }
                        }
                    }
                    defIdx++;
                }
                
                // Unknown subcommand
                if(!processed && hasNamedSubCmd && !unnamedSubs.length) {
                    const err: commandSyntaxError = {
                        isSyntaxError: true,
                        stack: Error().stack,
                        idx: i
                    };
                    throw err;
                }
                
                // process unnamed sub-commands
                const fails: Array<string> = [];
                for(const sub of unnamedSubs) {
                    try {
                        const subResult = new Map<string, any>();
                        idx = processList(i, sub.args, subResult);
                        result.set(sub.subName, true);
                        subResult.forEach((v, k) => result.set(k, v));
                        break;
                    } catch(e) {
                        fails.push(e);
                    }
                }
                
                if(fails.length != 0 && fails.length == unnamedSubs.length) {
                    throw fails[0];
                }
                
                return idx;
            }
            
            const numList = ['0','1','2','3','4','5','6','7','8','9'];
            for(var i = currIdx; i < args.length; i++) {
                let arg = args[i];
                
                if(arg.startsWith('-') && !numList.includes(arg.charAt(1))) {
                    for(const f of arg) {
                        if(f == '-') continue;
                        if(flagDefs.has(f)) {
                            result.set(f, true);
                            const argDef = flagDefs.get(f);
                            if (argDef.type != undefined) {
                                i = processArg(i+1, {
                                    name: argDef.flag + '-' + argDef.name,
                                    type: argDef.type
                                }, result);
                            }
                        } else {
                            throw RawText.translate('commands.generic.wedit:invalidFlag').with(f);
                        }
                    }
                    continue;
                }
                
                let argDef: commandArg | commandSubDef;
                while(defIdx < (argDefs?.length ?? 0)) {
                    if(!('flag' in argDefs[defIdx])) {
                        argDef = <typeof argDef>argDefs[defIdx];
                        break;
                    }
                    defIdx++;
                }
                
                // Leftover arguments
                if(!argDef) {
                    const err: commandSyntaxError = {
                        isSyntaxError: true,
                        stack: Error().stack,
                        idx: i
                    };
                    throw err;
                }
                
                if('type' in argDef && !('flag' in argDef)) {
                    i = processArg(i, argDef, result) - 1;
                    defIdx++;
                } else if('subName' in argDef) {
                    i = processSubCmd(i, arg) - 1;
                }
            }
            
            // Process optional arguments (and throw if some are required)
            while(defIdx < (argDefs?.length ?? 0)) {
                const argDef = argDefs[defIdx];
                if(!('flag' in argDef)) {
                    if('type' in argDef && argDef?.default != undefined && !('subName' in argDef)) {
                        // TODO: use clone command of customArgType here
                        result.set(argDef.name, argDef.default);
                    } else if('subName' in argDef) {
                        processSubCmd(i, '');
                    } else {
                        // Required arguments not specified
                        const err: commandSyntaxError = {
                            isSyntaxError: true,
                            stack: Error().stack,
                            idx: -1
                        };
                        throw err;
                    }
                }
                defIdx++;
            }
            
            return i;
        }
        
        processList(0, argDefs, result);
        return result;
    }
};
export const Command = new CommandBuilder();