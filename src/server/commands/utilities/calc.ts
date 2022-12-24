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

registerCommand(registerInformation, function* (session, builder, args) {
  return args.get("expr").compile()().toString();
});
