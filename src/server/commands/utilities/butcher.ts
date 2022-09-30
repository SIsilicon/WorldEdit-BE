import { RawText } from "@notbeer-api";
import { EntityQueryOptions } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "butcher",
  permission: "worldedit.utility.butcher",
  description: "commands.wedit:butcher.description",
  usage: [
    {
      flag: "p" //	Also kill pets
    },
    {
      flag: "n" //	Also kill NPCs
    },
    {
      flag: "g" //	Also kill golems
    },
    {
      flag: "a" //	Also kill animals
    },
    {
      flag: "b" //	Also kill ambient mobs
    },
    {
      flag: "t" //	Also kill mobs with name tags
    },
    {
      flag: "r" //	Also destroy armor stands
    },
    {
      flag: "w" //	Also kill water mobs
    },
    {
      flag: "f" //	Also kill all friendly mobs (Applies the flags -abgnpt)
    },
    {
      name: "radius",
      type: "int",
      range: [1, null] as [number, null],
      default: -1
    }
  ]
};


const animals = [
  "minecraft:cow", "minecraft:pig",
  "minecraft:chicken", "minecraft:sheep",
  "minecraft:wolf", "minecraft:fox",
  "minecraft:rabbit", "minecraft:ocelot",
  "minecraft:cat", "minecraft:llama",
  "minecraft:goat", "minecraft:donkey",
  "minecraft:frog", "minecraft:horse",
  "minecraft:mooshroom", "minecraft:panda",
  "minecraft:parrot", "minecraft:polar_bear"
];

const ambientMobs = [
  "minecraft:bee", "minecraft:firefly", "minecraft:bat"
];

const waterMobs = [
  "minecraft:axolotl", "minecraft:turtle",
  "minecraft:cod", "minecraft:dolphin",
  "minecraft:drowned", "minecraft:pufferfish",
  "minecraft:salmon", "minecraft:tropicalfish",
  "minecraft:guardian", "minecraft:elder_guardian",

];

registerCommand(registerInformation, function (session, builder, args) {
  const dimension = builder.dimension;
  const radius: number = args.get("radius") < 0 ? Infinity : args.get("radius");

  const allFriendlies = args.has("f");
  const flags = {
    "p": args.has("p") || allFriendlies, "n": args.has("n") || allFriendlies,
    "g": args.has("g") || allFriendlies, "a": args.has("a") || allFriendlies,
    "b": args.has("b") || allFriendlies, "t": args.has("t") || allFriendlies,
    "w": args.has("w"), "r": args.has("r")
  };

  let allOff = true;
  for (const flag in flags) {
    if (flags[flag as keyof typeof flags]) {
      allOff = false;
    }
  }

  let entityCount = 0;
  const entityQuery: EntityQueryOptions = {
    excludeTypes: ["minecraft:player"],
    location: builder.location,
    maxDistance: radius
  };
  for (const entity of dimension.getEntities(entityQuery)) {
    let matches = false;

    if (allOff) matches = true;
    else if (flags.g && entity.typeId.match(/golem/)) matches = true;
    else if (flags.t && entity.nameTag) matches = true;
    else if (flags.r && entity.typeId == "minecraft:armor_stand") matches = true;
    else if (flags.n && entity.typeId.match(/(villager)|(wandering_trader)|(npc)/)) matches = true;
    else if (flags.p && entity.hasComponent("minecraft:is_tamed")) matches = true;
    else if (flags.a && animals.includes(entity.typeId)) matches = true;
    else if (flags.b && ambientMobs.includes(entity.typeId)) matches = true;
    else if (flags.w && waterMobs.includes(entity.typeId)) matches = true;

    if (matches) {
      try {
        entity.kill();
        //Server.runCommand('tp ~ -520 ~', entity);
        entityCount++;
      // eslint-disable-next-line no-empty
      } catch {}
    }
  }

  return RawText.translate("commands.wedit:butcher.explain").with(entityCount);
});
