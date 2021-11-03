import { Tool } from './base_tool.js';

type toolConstruct = new (...args: any[]) => Tool;
class ToolBuilder {
    private tools = new Map<string, toolConstruct>();
    
    register(toolClass: toolConstruct, name: string) {
        this.tools.set(name, toolClass);
    }
    
    create(name: string, ...args: any[]): Tool {
        return new (this.tools.get(name))(...args);
    }
}
export const Tools = new ToolBuilder();