import { Server } from "@notbeer-api";
import { Cardinal } from "@modules/directions.js";
import { Expression } from "@modules/expression.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Biome } from "@modules/biome_data.js";

Server.command.addCustomArgType("Mask", Mask);
Server.command.addCustomArgType("Pattern", Pattern);
Server.command.addCustomArgType("Direction", Cardinal);
Server.command.addCustomArgType("Expression", Expression);
Server.command.addCustomArgType("Biome", Biome);
Server.command.prefix = config.commandPrefix;

import "./misc/help.js";
import "./misc/worldedit.js";
import "./misc/limit.js";
import "./misc/kit.js";
import "./misc/toggleplace.js";
import "./misc/blockid.js";
import "./misc/cancel.js";

import "./selection/pos1.js";
import "./selection/pos2.js";
import "./selection/hpos1.js";
import "./selection/hpos2.js";
import "./selection/chunk.js";
import "./selection/drawsel.js";
import "./selection/desel.js";
import "./selection/wand.js";
import "./selection/contract.js";
import "./selection/expand.js";
import "./selection/shift.js";
import "./selection/outset.js";
import "./selection/inset.js";
import "./selection/trim.js";

import "./selection/count.js";
import "./selection/distr.js";

import "./clipboard/cut.js";
import "./clipboard/copy.js";
import "./clipboard/paste.js";
import "./clipboard/clearclipboard.js";

import "./generation/hsphere.js";
import "./generation/sphere.js";
import "./generation/cyl.js";
import "./generation/hcyl.js";
import "./generation/pyramid.js";
import "./generation/hpyramid.js";
import "./generation/torus.js";
import "./generation/htorus.js";
import "./generation/gen.js";
import "./generation/gradient.js";

import "./region/gmask.js";
import "./region/set.js";
import "./region/replace.js";
import "./region/move.js";
import "./region/stack.js";
import "./region/revolve.js";
import "./region/rotate.js";
import "./region/flip.js";
import "./region/scale.js";
import "./region/wall.js";
import "./region/smooth.js";
import "./region/faces.js";
import "./region/hollow.js";
import "./region/line.js";
import "./region/curve.js";
import "./region/path.js";
import "./region/center.js";

import "./utilities/fill.js";
import "./utilities/fillr.js";
import "./utilities/removeabove.js";
import "./utilities/removebelow.js";
import "./utilities/removenear.js";
import "./utilities/replacenear.js";
import "./utilities/drain.js";
import "./utilities/fixwater.js";
import "./utilities/fixlava.js";
import "./utilities/snow.js";
import "./utilities/thaw.js";
import "./utilities/green.js";
import "./utilities/extinguish.js";
import "./utilities/calc.js";

import "./navigation/navwand.js";
import "./navigation/up.js";
import "./navigation/unstuck.js";
import "./navigation/jumpto.js";
import "./navigation/thru.js";
import "./navigation/ascend.js";
import "./navigation/descend.js";
import "./navigation/ceil.js";

import "./tool/tool.js";
import "./tool/superpickaxe.js";

import "./brush/brush.js";
import "./brush/mask.js";
import "./brush/tracemask.js";
import "./brush/size.js";
import "./brush/range.js";
import "./brush/material.js";

import "./history/undo.js";
import "./history/redo.js";
import "./history/clearhistory.js";

import "./structure/export.js";
import "./structure/import.js";

import "./biome/biomeinfo.js";
import "./biome/setbiome.js";
import config from "config.js";
