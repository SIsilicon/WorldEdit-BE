class ToolBuilder {
    constructor() {
        this.tools = new Map();
        this.pseudoTools = new Map();
    }
    register(toolClass, name) {
        this.tools.set(name, toolClass);
        this.pseudoTools.set(name, new toolClass());
    }
    create(name, ...args) {
        return new (this.tools.get(name))(...args);
    }
    unbindAll(player, active) {
        for (const tool of this.pseudoTools) {
            if (!active || !active.has(tool[0]))
                tool[1].unbind(player);
        }
    }
}
export const Tools = new ToolBuilder();
