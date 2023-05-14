import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "sphere",
  permission: "worldedit.generation.sphere",
  description: "commands.wedit:sphere.description",
  usage: [
    {
      flag: "h"
    }, {
      flag: "r"
    }, {
      name: "pattern",
      type: "Pattern"
    }, {
      subName: "_x",
      args: [
        {
          name: "radii",
          type: "float",
          range: [0.01, null] as [number, null]
        }
      ]
    }, {
      subName: "_xy",
      args: [
        {
          name: "radiiXZ",
          type: "float",
          range: [0.01, null] as [number, null]
        }, {
          name: "radiiY",
          type: "float",
          range: [0.01, null] as [number, null]
        }
      ]
    }, {
      subName: "_xyz",
      args: [
        {
          name: "radiiX",
          type: "float",
          range: [0.01, null] as [number, null]
        }, {
          name: "radiiY",
          type: "float",
          range: [0.01, null] as [number, null]
        }, {
          name: "radiiZ",
          type: "float",
          range: [0.01, null] as [number, null]
        }
      ]
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  const pattern: Pattern = args.get("pattern");
  let radii: [number, number, number];
  const isHollow = args.has("h");
  const isRaised = args.has("r");

  if (args.has("_x"))
    radii = [args.get("radii"), args.get("radii"), args.get("radii")];
  else if (args.has("_xy"))
    radii = [args.get("radiiXZ"), args.get("radiiY"), args.get("radiiXZ")];
  else
    radii = [args.get("radiiX"), args.get("radiiY"), args.get("radiiZ")];

  const loc = session.getPlacementPosition().offset(0, isRaised ? radii[1] : 0, 0);

  const sphereShape = new SphereShape(...radii);
  const job = Jobs.startJob(session, 2, sphereShape.getRegion(loc));
  const count = yield* Jobs.perform(job, sphereShape.generate(loc, pattern, null, session, {"hollow": isHollow}));
  Jobs.finishJob(job);

  return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
