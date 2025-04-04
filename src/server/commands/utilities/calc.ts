import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Expression } from "@modules/expression.js";

const registerInformation = {
    name: "calculate",
    permission: "worldedit.utility.calc",
    description: "commands.wedit:calc.description",
    usage: [
        {
            name: "expr",
            type: "Expression",
        },
    ],
    aliases: ["calc", "eval", "evaluate", "solve"],
};

registerCommand(registerInformation, function (session, builder, args) {
    const expr = args.get("expr") as Expression;
    const exprString = expr.toJSON();
    try {
        return `${exprString} = ${expr.compile([])()}`;
    } catch (error) {
        throw RawText.translate("commands.wedit:calc.invalid").with(exprString);
    }
});
