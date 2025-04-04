import { Player, Vector3, system } from "@minecraft/server";
import { PlayerUtil } from "@modules/player_util";
import { RawText, Server, Vector, axis, regionBounds } from "@notbeer-api";
import { plotCurve, plotLine } from "server/commands/region/paths_func";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";
import { print, snap } from "server/util";
import { Jobs } from "@modules/jobs";
import { SphereShape } from "server/shapes/sphere";
import { CylinderShape } from "server/shapes/cylinder";
import { PyramidShape } from "server/shapes/pyramid";

function trySpawnParticle(player: Player, type: string, location: Vector3) {
    try {
        player.spawnParticle(type, location);
    } catch {
        /* pass */
    }
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
    }

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
        const pattern = session.globalPattern.withContext(session, [start, end]);
        const mask = session.globalMask.withContext(session);

        const history = session.history;
        const record = history.record();
        let count: number;
        try {
            yield* history.trackRegion(record, start, end);
            count = 0;
            for (const point of plotLine(pos1, pos2)) {
                const block = dim.getBlock(point) ?? (yield* Jobs.loadBlock(point));
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield;
            }
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawLineTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;

        let lineStart = self.getFirstPos(session);
        const lineEnd = self.traceForPos(player);
        const length = lineEnd.sub(lineStart).length;
        if (length > 32) lineStart = lineEnd.add(lineStart.sub(lineEnd).normalized().mul(32)).floor();

        for (const point of plotLine(lineStart, lineEnd)) {
            trySpawnParticle(player, "wedit:selection_draw", point);
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 0, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 1, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 1, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 0, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 0, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 1, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 1, 1]));
        }
    };

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawLineTool, "draw_line", "wedit:draw_line");

class DrawCurveTool extends GeneratorTool {
    permission = "worldedit.region.curve";

    paths = new Map<PlayerSession, Vector[]>();

    commonUse = function* (self: DrawCurveTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        if (!self.paths.has(session)) self.paths.set(session, []);
        const points = self.paths.get(session);

        const nextPoint = self.traceForPos(player);
        if (!points.length || !Vector.equals(points[points.length - 1], nextPoint)) {
            points.push(nextPoint);
            return;
        }

        points.unshift(self.getFirstPos(session));
        self.clearFirstPos(session);
        self.paths.delete(session);

        const dim = player.dimension;

        const history = session.history;
        const record = history.record();
        let count: number;
        try {
            const blocks = yield* plotCurve(points);
            const [start, end] = regionBounds(blocks);

            const pattern = session.globalPattern.withContext(session, [start, end]);
            const mask = session.globalMask.withContext(session);

            yield* history.trackRegion(record, start, end);
            count = 0;
            for (const point of blocks) {
                const block = dim.getBlock(point) ?? (yield* Jobs.loadBlock(point));
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield;
            }
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawCurveTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;
        if (self.paths.has(session) && !self.getFirstPos(session)) self.paths.delete(session);

        const points = self.paths.get(session)?.slice() ?? [];
        const nextPoint = self.traceForPos(player);
        if (!points.length || !Vector.equals(points[points.length - 1], nextPoint)) points.push(nextPoint);
        points.unshift(self.getFirstPos(session));

        for (const point of plotCurve(points)) {
            trySpawnParticle(player, "wedit:selection_draw", point);
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 0, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 1, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 1, 0]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 0, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 0, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [0, 1, 1]));
            trySpawnParticle(player, "wedit:selection_draw", Vector.add(point, [1, 1, 1]));
        }
    };

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawCurveTool, "draw_curve", "wedit:draw_curve");

class DrawSphereTool extends GeneratorTool {
    permission = "worldedit.generation.sphere";

    commonUse = function* (self: DrawSphereTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        const center = self.getFirstPos(session);
        const radius = Math.floor(self.traceForPos(player).sub(center).length);
        const sphereShape = new SphereShape(radius);
        const pattern = session.globalPattern.withContext(session, sphereShape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, sphereShape.generate(center, pattern, null, session));
        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawSphereTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;

        const center = self.getFirstPos(session);
        const radius = Math.floor(center.sub(self.traceForPos(player)).length) + 0.5;

        const axes: [Vector, axis][] = [
            [new Vector(0, 1, 0), "x"],
            [new Vector(1, 0, 0), "y"],
            [new Vector(0, 1, 0), "z"],
        ];
        const resolution = snap(Math.min(radius * 2 * Math.PI, 36), 4);

        for (const [vec, axis] of axes) {
            for (let i = 0; i < resolution; i++) {
                let point: Vector = vec.rotate((i / resolution) * 360, axis);
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
        const pattern = session.globalPattern.withContext(session, shape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, shape.generate(center, pattern, null, session));

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawCylinderTool, player: Player, session: PlayerSession) {
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
        return [new CylinderShape(height * 2, radius), center];
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
        const pattern = session.globalPattern.withContext(session, shape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, shape.generate(center, pattern, null, session));

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawPyramidTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;

        const [shape, loc] = self.getShape(player, session);
        for (const particle of shape.getOutline(loc)) {
            trySpawnParticle(player, ...particle);
        }
    };

    getShape(player: Player, session: PlayerSession): [PyramidShape, Vector] {
        const center = this.getFirstPos(session).clone();
        const pos2 = this.traceForPos(player);
        const size =
            Math.max(
                ...pos2
                    .sub(center)
                    .toArray()
                    .map((v, i) => (i !== 1 ? Math.abs(v) : v))
            ) + 1;
        return [new PyramidShape(size), center];
    }

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawPyramidTool, "draw_pyramid", "wedit:draw_pyramid");
