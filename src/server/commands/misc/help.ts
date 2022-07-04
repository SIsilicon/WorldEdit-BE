import { Server } from '@notbeer-api';
import { getCommandInfo, registerCommand } from '../register_commands.js';
import { RawText } from '@notbeer-api';

const registerInformation = {
    name: 'help',
    permission: 'worldedit.help',
    description: 'commands.help.description',
    usage: [
        {
            subName: '_page',
            args: [
                {
                    name: 'page',
                    type: 'int',
                    default: 1
                }
            ] 
        },
        {
            subName: '_command',
            args: [
                {
                    name: 'command',
                    type: 'CommandName'
                }
            ] 
        }
    ],
    aliases: ['?']
};

registerCommand(registerInformation, function (session, builder, args) {
    const cmdList = Server.command.getAllRegistation();
    
    // Show a page of the list of available WorldEdit commands
    if (args.has('_page')) {
        const cmdInfo: [string, string][] = [];
        for (const cmd of cmdList) {
            const usages = Server.command.printCommandArguments(cmd.name, builder);
            for (const usage of usages) {
                cmdInfo.push([cmd.name, usage]);
                if (cmd.aliases) {
                    for (const alias of cmd.aliases) {
                        cmdInfo.push([alias, usage]);
                    }
                }
            }
        }
        
        // Sort commands by name and arguments
        cmdInfo.sort((a, b) => {
            if (a[0] < b[0]) {
                return -1;
            }
            if (a[0] > b[0]) {
                return 1;
            }
            if (a[1] < b[1]) {
                return -1;
            }
            return 1;
        });
        
        const PAGE_SIZE = 7;
        let totalPages = Math.ceil(cmdInfo.length / PAGE_SIZE);
        let page: number = Math.max(args.get('page'), 1);
        let pageOff = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
        
        let msg = RawText.text('§2').append('translate', 'commands.wedit:help.header').with(`${pageOff / PAGE_SIZE + 1}`).with(`${totalPages}`).append('text', '§r');
        for (let i = pageOff; i < Math.min(pageOff + PAGE_SIZE, cmdInfo.length); i++) {
            const cmd = cmdInfo[i];
            msg.append('text', `\n${Server.command.prefix}${cmd[0]} ${cmd[1]}`);
        }
        return msg;
    }
    
    const cmdInfo = getCommandInfo(args.get('command'));
    
    let info = RawText.text('\n§e');
    if (cmdInfo.aliases) {
        info.append('translate', 'commands.help.command.aliases').with(cmdInfo.name).with(cmdInfo.aliases.join(', '));
    } else {
        info.append('text', cmdInfo.name + ':');
    }
    if (cmdInfo.description) {
        info.append('text', '\n').append('translate', cmdInfo.description).append('text', '\n§r');
    }
    
    const cmdUsages = Server.command.printCommandArguments(cmdInfo.name);
    let usages = '';
    for (const usage of cmdUsages) {
            usages += `\n- ${Server.command.prefix}${cmdInfo.name} ${usage}`;
    }
    info.append('translate', 'commands.generic.usage').with(usages);
    
    return info;
});