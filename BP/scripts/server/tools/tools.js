class ToolBuilder {
    constructor() {
        this.tools = new Map();
    }
    register(toolClass, name) {
        tools.put(name, toolClass);
    }
    create(name, ...args) {
        return tools.get(name).new(args);
    }
}
export const Tools = new ToolBuilder();
