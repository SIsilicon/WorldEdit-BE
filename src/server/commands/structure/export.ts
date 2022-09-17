
import { assertCanBuildWithin, assertCuboidSelection } from "@modules/assert.js";
import { RawText, Server} from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "export",
  permission: "worldedit.structure.export",
  description: "commands.wedit:export.description",
  usage: [
    {
      "flag": "e"
    },
    {
      "name": "name",
      "type": "string"
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  assertCuboidSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());

  let name = args.get("name");
  name = "wedit:_exported_struct:" + name;
  Server.structure.save(name, ...session.selection.getRange(), builder.dimension, {
    saveToDisk: true,
    includeEntities: args.has("e")
  });

  return RawText.translate("commands.wedit:export.explain");
});
