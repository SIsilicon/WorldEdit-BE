class ToolBuilder {
    constructor() {
        this.tools = new Map();
    }
    register(toolClass, name) {
        this.tools.set(name, toolClass);
    }
    create(name, ...args) {
        return new (this.tools.get(name))(args);
    }
}
export const Tools = new ToolBuilder();
