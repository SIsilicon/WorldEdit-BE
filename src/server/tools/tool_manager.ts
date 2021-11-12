import { Player } from 'mojang-minecraft';
import { Tool } from './base_tool.js';

type toolConstruct = new (...args: any[]) => Tool;
class ToolBuilder {
    private tools = new Map<string, toolConstruct>();
    private pseudoTools = <Tool[]>[];
    
    register(toolClass: toolConstruct, name: string) {
        this.tools.set(name, toolClass);
        this.pseudoTools.push(new toolClass());
    }
    
    create(name: string, ...args: any[]): Tool {
        return new (this.tools.get(name))(...args);
    }
    
    unbindAll(player: Player) {
    	for (const tool of this.pseudoTools) {
    		tool.unbind(player);
    	}
    }
}
export const Tools = new ToolBuilder();