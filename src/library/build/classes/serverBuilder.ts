import { Commands, World } from 'mojang-minecraft';
import { EventEmitter } from './eventEmitter.js';
import { dimension } from '../../@types/index';
import { runCommandReturn } from '../../@types/build/classes/ServerBuilder';

export class ServerBuilder extends EventEmitter {
    /**
    * Force shuts down the server
    * @example ServerBuilder.close()
    */
    close(): void {
        function crash() {
                while(true) {
                    crash();
                };
        };
        crash();
    };
    /**
    * Broadcast a message in chat
    * @param {string} text Message you want to broadcast in chat
    * @param {string} [player] Player you want to broadcast to
    * @returns {runCommandReturn}
    * @example ServerBuilder.broadcast('Hello World!');
    */
    broadcast(text: string, player?: string): runCommandReturn {
        return this.runCommand(`tellraw ${player ? `"${player}"` : '@a'} {"rawtext":[{"text":${JSON.stringify(text)}}]}`);
    };
    /**
    * Run a command in game
    * @param command The command you want to run
    * @returns {runCommandReturn}
    * @example ServerBuilder.runCommand('say Hello World!');
    */
    runCommand(command: string, dimension?: dimension): runCommandReturn {
        try {
                return { error: false, ...Commands.run(command, World.getDimension(dimension ?? 'overworld')) };
        } catch(error) {
                return { error: true };
        };
    };
    //TODO: Improve this
    /**
    * Run an array of commands
    * @param {Array<string>} commands Put '%' before your commands. It will make it so it only executes if all the commands thta came before it executed successfully!
    * @returns {{ error: boolean }}
    * @example runCommands([
    * 'clear "notbeer" diamond 0 0',
    * '%say notbeer has a Diamond!'
    * ]);
    */
    runCommands(commands: Array<string>): { error: boolean } {
        const conditionalRegex = /^%/;
        if(conditionalRegex.test(commands[0])) throw '[Server]: runCommands(): Error - First command in the Array CANNOT be Conditional';
        let error = false;
        commands.forEach(cmd => {
                if(error && conditionalRegex.test(cmd)) return;
                error = this.runCommand(cmd.replace(conditionalRegex, '')).error;
        });
        return { error: error };
    };
};
export const Server = new ServerBuilder();