import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "calculate",
    permission: "worldedit.utility.calc",
    description: "commands.wedit:calc.description",
    usage: [
        {
            name: "expr",
            type: "Expression"
        }
    ],
    aliases: ["calc", "eval", "evaluate", "solve"]
};

registerCommand(registerInformation, function (session, builder, args) {
    const expr = args.get("expr");
    const exprString = expr.stringObj;
    try {
        return `${exprString} = ${expr.compile([])()}`;
    } catch (error) {
        throw RawText.translate("commands.wedit:calc.invalid").with(exprString);
    }
});
