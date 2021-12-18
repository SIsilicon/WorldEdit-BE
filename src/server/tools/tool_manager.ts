import { Player } from 'mojang-minecraft';
import { Tool } from './base_tool.js';

type toolConstruct = new (...args: any[]) => Tool;
class ToolBuilder {
    private tools = new Map<string, toolConstruct>();
    private pseudoTools = new Map<string, Tool>();
    
    register(toolClass: toolConstruct, name: string) {
        this.tools.set(name, toolClass);
        this.pseudoTools.set(name, new toolClass());
    }
    
    create(name: string, ...args: any[]): Tool {
        return new (this.tools.get(name))(...args);
    }
    
    unbindAll(player: Player, active?: Map<string, Tool>) {
        for (const tool of this.pseudoTools) {
            if (!active || !active.has(tool[0])) tool[1].unbind(player);
        }
    }
}
export const Tools = new ToolBuilder();