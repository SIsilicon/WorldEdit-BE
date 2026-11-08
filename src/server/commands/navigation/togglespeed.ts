import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const speedArg = {
    name: "multiplier",
    type: "float",
    range: [0.1, 10] as [number, number],
};

const registerInformation: CommandInfo = {
    name: "togglespeed",
    aliases: ["ts"],
    permission: "worldedit.navigation.togglespeed",
    description: "commands.wedit:togglespeed.description",
    usage: [
        { subName: "on" },
        { subName: "off" },
        {
            subName: "speed",
            args: [speedArg],
        },
        {
            subName: "_toggle",
            args: [
                {
                    ...speedArg,
                    default: -1,
                },
            ],
        },
    ],
};

registerCommand(registerInformation, function (session, _builder, args) {
    // Change the multiplier without toggling speed mode.
    if (args.has("speed")) {
        const speed = args.get("multiplier") as number;

        session.speedMultiplier = speed;

        return RawText.translate("commands.wedit:togglespeed.changed").with(`${speed}`);
    }

    // Explicitly enable speed mode.
    if (args.has("on")) {
        session.speedMode = true;

        return RawText.translate("commands.wedit:togglespeed.enabled");
    }

    // Explicitly disable speed mode.
    if (args.has("off")) {
        session.speedMode = false;

        return RawText.translate("commands.wedit:togglespeed.disabled");
    }

    // Toggle speed mode.
    const enabled = session.toggleSpeed();

    // Ignore the supplied multiplier when turning speed off.
    if (!enabled) {
        return RawText.translate("commands.wedit:togglespeed.disabled");
    }

    // Apply the optional multiplier only when turning speed on.
    const speed = args.get("multiplier") as number;

    if (speed !== -1) {
        session.speedMultiplier = speed;

        return RawText.translate("commands.wedit:togglespeed.set").with(`${speed}`);
    }

    return RawText.translate("commands.wedit:togglespeed.enabled");
});
