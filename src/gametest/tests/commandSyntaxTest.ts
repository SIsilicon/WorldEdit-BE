import { registerAsync } from "@minecraft/server-gametest";
import { Server, Vector } from "@notbeer-api";
import { spawnWorldEditPlayer } from "gametest/utils";
import { commandArgList } from "library/@types/classes/CommandBuilder";

function getTestValue(type: string) {
    type = type?.replace("...", "");
    switch (type) {
        case "int":
            return ["1"];
        case "float":
            return ["1.0"];
        case "string":
            return ["test"];
        case "xyz":
            return ["0", "0", "0"];
        case "xz":
            return ["0", "0"];
        case "Mask":
            return ["stone"];
        case "Pattern":
            return ["stone"];
        case "CommandName":
            return ["worldedit"];
        case "Direction":
            return ["up"];
        case "Expression":
            return ["x>y"];
        case "Biome":
            return ["plains"];
        default:
            if (type) throw "Unknown type for command syntax test: " + type;
            return [];
    }
}

function getPermutations(usage: commandArgList, index = 0): string[][] {
    if (!usage[index]) return [[]];

    const arg = usage[index];
    const nextPerms = getPermutations(usage, index + 1);

    if ("flag" in arg) {
        return [...nextPerms, ...nextPerms.map((perm) => [`-${arg.flag}`, ...getTestValue(arg.type), ...perm])];
    } else if ("subName" in arg) {
        const subName = arg.subName.startsWith("_") ? [] : [arg.subName];
        const subPerms = getPermutations(arg.args ?? []);
        return [...subPerms.map((perm) => [...subName, ...perm]), ...nextPerms].filter((perm) => perm.length);
    } else if (arg.default !== undefined) {
        return [[], ...nextPerms.map((perm) => [...getTestValue(arg.type), ...perm])];
    } else {
        const value = "range" in arg ? [`${arg.range[0] ?? arg.range[1]}`] : getTestValue(arg.type);
        return nextPerms.map((perm) => [...value, ...perm]);
    }
}

registerAsync("worldedit", "commandSyntaxTest", async (test) => {
    const player = await spawnWorldEditPlayer(test, Vector.ZERO, "commandSyntaxTestPlayer");
    const errors = [];
    for (const command of Server.command.getAllRegistation()) {
        const permutations = getPermutations(command.usage ?? []);
        for (const args of permutations) {
            try {
                Server.command.callCommand(player, command.name, args.join(" "), { noCallback: true });
            } catch (e) {
                errors.push(`Command "${command.name}" with args "${command.name} ${args.join(" ")}" failed: ${e}`);
            }
        }
    }

    if (errors.length) test.fail(errors.join("\n"));
    else test.succeed();
})
    .maxTicks(20)
    .structureName("worldedit:scripts");
