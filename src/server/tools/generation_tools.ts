import { Dimension, Player, Vector3, system } from "@minecraft/server";
import { PlayerUtil } from "@modules/player_util";
import { RawText, Server, Vector, regionBounds } from "@notbeer-api";
import { generateLine } from "server/commands/region/line";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";
import { print, snap } from "server/util";
import { Jobs } from "@modules/jobs";
import { SphereShape } from "server/shapes/sphere";
import { CylinderShape } from "server/shapes/cylinder";
import { PyramidShape } from "server/shapes/pyramid";
import { Shape } from "server/shapes/base_shape";

function trySpawnParticle(player: Player, type: string, location: Vector3) {
  try {
    player.spawnParticle(type, location);
  } catch {}
}

abstract class GeneratorTool extends Tool {
  protected posStart = new Map<PlayerSession, [Vector, string]>(); // [location, dimension type]

  protected baseUse(player: Player, session: PlayerSession, loc?: Vector) {
    if (player.isSneaking) {
      Server.uiForms.show("$selectGenMode", player);
      return true;
    }

    if (session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";
    if (!this.posStart.has(session)) {
      if (loc) this.posStart.set(session, [loc, player.dimension.id]);
      return true;
    }
    return false;
  };

  protected baseTick(player: Player, session: PlayerSession) {
    if (system.currentTick % 5 !== 0 || !this.posStart.has(session) || !session.drawOutlines || this.posStart.get(session)[1] !== player.dimension.id) {
      return true;
    }

    if (this.posStart.get(session)[1] !== player.dimension.id) {
      this.posStart.delete(session);
      return true;
    }
    return false;
  }

  protected traceForPos(player: Player) {
    return PlayerUtil.traceForBlock(player, 8);
  }

  protected getFirstPos(session: PlayerSession) {
    return this.posStart.get(session)[0];
  }

  protected clearFirstPos(session: PlayerSession) {
    return this.posStart.delete(session);
  }

  stopHold = function (self: GeneratorTool, _: Player, session: PlayerSession) {
    self.posStart.delete(session);
  };
  
  drop = function (self: GeneratorTool, _: Player, session: PlayerSession) {
    self.posStart.delete(session);
  };
}

class DrawLineTool extends GeneratorTool {
  permission = "worldedit.region.line";

  commonUse = function* (self: DrawLineTool, player: Player, session: PlayerSession, loc?: Vector) {
    if (self.baseUse(player, session, loc)) return;
    
    const pos1 = self.getFirstPos(session);
    const pos2 = self.traceForPos(player);
    const [start, end] = regionBounds([pos1, pos2]);
    self.clearFirstPos(session);

    const dim = player.dimension;
    const pattern = session.globalPattern;
    pattern.setContext(session, [start, end]);

    const history = session.getHistory();
    const record = history.record();
    let count: number;
    try {
      const points = (yield* generateLine(pos1, pos2)).map((p) => p.floor());
      history.addUndoStructure(record, start, end);
      count = 0;
      for (const point of points) {
        const block = dim.getBlock(point);
        if (session.globalMask.matchesBlock(block) && pattern.setBlock(block)) {
          count++;
        }
        yield;
      }

      history.recordSelection(record, session);
      history.addRedoStructure(record, start, end);
      history.commit(record);
    } catch (e) {
      history.cancel(record);
      throw e;
    }

    print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
  };

  tick = function* (self: DrawLineTool, player: Player, session: PlayerSession) {
    if (self.baseTick(player, session)) return;

    let lineStart = self.getFirstPos(session);
    const lineEnd = self.traceForPos(player);
    const length = lineEnd.sub(lineStart).length;
    if (length > 32) {
      lineStart = lineEnd
        .add(lineStart.sub(lineEnd).normalized().mul(32))
        .floor();
    }

    const genLine = generateLine(lineStart, lineEnd);
    let val: IteratorResult<void, Vector3[]>;
    while (!val?.done) val = genLine.next();
    val.value.forEach((p) => {
      trySpawnParticle(player, "wedit:selection_draw", p);
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [1, 0, 0]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [0, 1, 0]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [1, 1, 0]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [0, 0, 1]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [1, 0, 1]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [0, 1, 1]));
      trySpawnParticle(player, "wedit:selection_draw", Vector.add(p, [1, 1, 1]));
    });
  };
  
  useOn = this.commonUse;
  use = this.commonUse;
}
Tools.register(DrawLineTool, "draw_line", "wedit:draw_line");

class DrawSphereTool extends GeneratorTool {
  permission = "worldedit.generation.sphere";

  commonUse = function* (self: DrawSphereTool, player: Player, session: PlayerSession, loc?: Vector) {
    if (self.baseUse(player, session, loc)) return;

    const center = self.getFirstPos(session);
    const radius = Math.floor(self.traceForPos(player).sub(center).length);
    const sphereShape = new SphereShape(radius);
    const pattern = session.globalPattern;
    pattern.setContext(session, sphereShape.getRegion(center));
    self.clearFirstPos(session);

    const job = Jobs.startJob(session, 2, sphereShape.getRegion(center));
    const count = yield* Jobs.perform(job, sphereShape.generate(center, pattern, null, session));
    Jobs.finishJob(job);
  
    print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
  };

  tick = function* (self: DrawSphereTool, player: Player, session: PlayerSession) {
    if (self.baseTick(player, session)) return;

    const center = self.getFirstPos(session);
    const radius = Math.floor(center.sub(self.traceForPos(player)).length) + 0.5;

    const axes: [typeof Vector.prototype.rotateX, Vector][] = [
      [Vector.prototype.rotateX, new Vector(0, 1, 0)],
      [Vector.prototype.rotateY, new Vector(1, 0, 0)],
      [Vector.prototype.rotateZ, new Vector(0, 1, 0)]
    ];
    const resolution = snap(Math.min(radius * 2*Math.PI, 36), 4);

    for (const [rotateBy, vec] of axes) {
      for (let i = 0; i < resolution; i++) {
        let point: Vector = rotateBy.call(vec, i / resolution * 360);
        point = point.mul(radius).add(center).add(0.5);
        trySpawnParticle(player, "wedit:selection_draw", point);
      }
    }
  };
  
  useOn = this.commonUse;
  use = this.commonUse;
}
Tools.register(DrawSphereTool, "draw_sphere", "wedit:draw_sphere");

class DrawCylinderTool extends GeneratorTool {
  permission = "worldedit.generation.cyl";

  commonUse = function* (self: DrawCylinderTool, player: Player, session: PlayerSession, loc?: Vector) {
    if (self.baseUse(player, session, loc)) return;

    const [shape, center] = self.getShape(player, session);
    const pattern = session.globalPattern;
    pattern.setContext(session, shape.getRegion(center));
    self.clearFirstPos(session);

    const job = Jobs.startJob(session, 2, shape.getRegion(center));
    const count = yield* Jobs.perform(job, shape.generate(center, pattern, null, session));
    Jobs.finishJob(job);
  
    print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
  };

  tick = function* (self: DrawCylinderTool, player: Player, session: PlayerSession) {
    if (self.baseTick(player, session)) return;

    const [shape, loc] = self.getShape(player, session);
    for (const particle of shape.getOutline(loc)) {
      trySpawnParticle(player, ...particle);
    }
  };
  
  getShape(player: Player, session: PlayerSession): [CylinderShape, Vector] {
    const center = this.getFirstPos(session).clone();
    const pos2 = this.traceForPos(player);
    const radius = Math.floor(pos2.sub(center).mul([1, 0, 1]).length);
    let height = pos2.y - center.y + 1;
    if (height < 1) {
      center.y += height;
      height = -height + 1;
    }
    return [new CylinderShape(height, radius), center];
  }

  useOn = this.commonUse;
  use = this.commonUse;
}
Tools.register(DrawCylinderTool, "draw_cylinder", "wedit:draw_cylinder");

class DrawPyramidTool extends GeneratorTool {
  permission = "worldedit.generation.pyramid";

  commonUse = function* (self: DrawPyramidTool, player: Player, session: PlayerSession, loc?: Vector) {
    if (self.baseUse(player, session, loc)) return;

    const [shape, center] = self.getShape(player, session);
    const pattern = session.globalPattern;
    pattern.setContext(session, shape.getRegion(center));
    self.clearFirstPos(session);

    const job = Jobs.startJob(session, 2, shape.getRegion(center));
    const count = yield* Jobs.perform(job, shape.generate(center, pattern, null, session));
    Jobs.finishJob(job);
  
    print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
  };

  tick = function* (self: DrawPyramidTool, player: Player, session: PlayerSession) {
    if (self.baseTick(player, session)) return;

    const [shape, loc] = self.getShape(player, session);
    for (const particle of shape.getOutline(loc)) {
      trySpawnParticle(player, ...particle);
    }
  };
  
  getShape(player: Player, session: PlayerSession): [PyramidShape, Vector] {
    const center = this.getFirstPos(session).clone();
    const pos2 = this.traceForPos(player);
    const size = Math.max(...pos2.sub(center).toArray().map((v, i) => i !== 1 ? Math.abs(v) : v)) + 1;
    return [new PyramidShape(size), center];
  }

  useOn = this.commonUse;
  use = this.commonUse;
}
Tools.register(DrawPyramidTool, "draw_pyramid", "wedit:draw_pyramid");
