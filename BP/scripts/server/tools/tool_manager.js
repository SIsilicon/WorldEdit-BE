class ToolBuilder {
    constructor() {
        this.tools = new Map();
        this.pseudoTools = [];
    }
    register(toolClass, name) {
        this.tools.set(name, toolClass);
        this.pseudoTools.push(new toolClass());
    }
    create(name, ...args) {
        return new (this.tools.get(name))(...args);
    }
    unbindAll(player) {
        for (const tool of this.pseudoTools) {
            tool.unbind(player);
        }
    }
}
export const Tools = new ToolBuilder();
