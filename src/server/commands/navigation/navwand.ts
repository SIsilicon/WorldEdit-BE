import { CommandInfo, Server } from "@notbeer-api";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "navwand",
    permission: "worldedit.setwand",
    description: "commands.wedit:navwand.description",
};

registerCommand(registerInformation, function (session, builder) {
    let item = config.navWandItem;
    const boundItems = session.getTools("navigation_wand");
    if (boundItems.length && !boundItems.includes(item)) {
        item = boundItems[0];
    }
    Server.runCommand(`give @s ${item}`, builder);
    session.bindTool("navigation_wand", item);
    return RawText.translate("commands.wedit:navwand.explain");
});
