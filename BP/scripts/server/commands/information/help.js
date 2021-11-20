import { Server } from '../../../library/Minecraft.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';
const registerInformation = {
    cancelMessage: true,
    name: 'help',
    description: 'Get list of all the commands available or input an argument to get information about that specific command',
    usages: [
        '[command: CommandName]',
        '<page: int>'
    ],
    aliases: ['?'],
    example: [
        'help',
        'help copy'
    ]
};
commandList['help'] = [registerInformation, (session, builder, args) => {
        const cmdList = Server.command.getAllRegistation();
        // Show a page of the list of available WorldEdit commands
        if (!args[0] || Number(args[0]) == Number(args[0])) {
            const cmdInfo = [];
            for (const cmd of cmdList) {
                cmdInfo.push([cmd.name, cmd.usage]);
                if (cmd.aliases) {
                    for (const alias of cmd.aliases) {
                        cmdInfo.push([alias, cmd.usage]);
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
            let page = Number(args[0]);
            page = page == page ? page : 1;
            let pageOff = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
            let msg = RawText.text('§2').append('translate', 'worldedit.help.header').with(`${pageOff / PAGE_SIZE + 1}`).with(`${totalPages}`).append('text', '§r');
            for (let i = pageOff; i < Math.min(pageOff + PAGE_SIZE, cmdInfo.length); i++) {
                const cmd = cmdInfo[i];
                msg.append('text', `\n${Server.command.prefix}${cmd[0]} ${cmd[1]}`);
            }
            return msg;
        }
        const cmdBaseInfo = Server.command.getRegistration(args[0]);
        if (!cmdBaseInfo)
            throw RawText.translate('commands.generic.unknown').with(args[0]);
        const cmdInfo = commandList[cmdBaseInfo.name][0];
        let info = RawText.text('\n§e');
        if (cmdInfo.aliases) {
            info.append('translate', 'commands.help.command.aliases').with(cmdInfo.name).with(cmdInfo.aliases.join(', '));
        }
        else {
            info.append('text', cmdInfo.name + ':');
        }
        if (cmdInfo.description) {
            info.append('text', '\n').append('translate', cmdInfo.description).append('text', '\n§r');
        }
        if (cmdInfo.usage) {
            info.append('translate', 'commands.generic.usage').with(`\n- ${Server.command.prefix}${cmdInfo.name} ${cmdInfo.usage}`);
        }
        else if (cmdInfo.usages) {
            let usages = '';
            for (const usage of cmdInfo.usages) {
                usages += `\n- ${Server.command.prefix}${cmdInfo.name} ${usage}`;
            }
            info.append('translate', 'commands.generic.usage').with(usages);
        }
        return info;
    }];
