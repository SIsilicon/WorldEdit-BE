import { Server } from '../../../library/Minecraft.js';

const registerInformation = {
    cancelMessage: true,
    name: 'help',
    description: 'Get list of all the commands available or input an argument to get information about that specific command',
    usage: '[command name]',
    example: [
        'help',
        'help copy'
    ]
};

Server.command.register(registerInformation, (data, args) => {
    const cmdList = Server.command.getAll();
    if(!args[0]) return Server.broadcast(`§bCustom Command prefix§f: §a${Server.command.prefix}\n§bType §a${Server.command.prefix}help §f[command name] §bfor more information on that command!\n§bCustom Command List: §l§c${cmdList.join(', ')}`, data.sender.nameTag);
    
    const cmdInfo = Server.command.getRegistration(args[0]);
    if(!cmdInfo) return Server.broadcast('§cI couldn\'t find the command...', data.sender.nameTag);
    
    let string = `\n§eCommand§f: §a${Server.command.prefix}§l§c${cmdInfo.name}§r\n`;
    if(cmdInfo.aliases) string += `§eAliases§f: §c${cmdInfo.aliases.join('§r, ')}§r\n`;
    if(cmdInfo.description) string += `§eDescription§f: ${cmdInfo.description}\n`;
    if(cmdInfo.usage) string += `§eUsage§f: §a${Server.command.prefix}§f${cmdInfo.name} ${cmdInfo.usage}\n`;
    if(cmdInfo.example) string += `§eExample§f: §a${Server.command.prefix}§f${cmdInfo.example.join(`\n${Server.command.prefix}§f`)}`;
    Server.broadcast(string, data.sender.nameTag);
});