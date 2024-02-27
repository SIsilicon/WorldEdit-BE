import { Server, RawText } from "@notbeer-api";
import { Player, Dimension, Vector3, Block, world, GameMode } from "@minecraft/server";
import { PlayerSession } from "server/sessions";

// eslint-disable-next-line prefer-const
let globalJobIdCounter = 0;

type JobContext = number;

interface job {
    stepCount: number;
    step: number;
    player: Player;
    message: string;
    percent: number;
    dimension: Dimension;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobFunction = { readonly jobFunc: "nextStep" | "setProgress"; readonly data: any };

function cleanUpPlayer(player: Player) {
    if (player.getDynamicProperty("locationBeforeJob")) {
        player.teleport(<Vector3>player.getDynamicProperty("locationBeforeJob"), { dimension: world.getDimension(<string>player.getDynamicProperty("dimensionBeforeJob")) });
        player.setGameMode(<GameMode>player.getDynamicProperty("gamemodeBeforeJob"));
        player.camera.fade({ fadeTime: { fadeInTime: 0, holdTime: 0, fadeOutTime: 0.5 } });
        player.setDynamicProperty("locationBeforeJob", undefined);
        player.setDynamicProperty("dimensionBeforeJob", undefined);
        player.setDynamicProperty("gamemodeBeforeJob", undefined);
        player.runCommand("inputpermission set @s movement enabled");
    }
}
Server.addListener("playerLoaded", ({ player }) => cleanUpPlayer(player));
world.getAllPlayers().forEach((player) => cleanUpPlayer(player));

class JobHandler {
    private jobs = new Map<JobContext, job>();
    private current: JobContext;

    constructor() {
        Server.on("tick", () => this.printJobs());
    }

    public *run<T, TReturn>(session: PlayerSession, steps: number, func: Generator<T | JobFunction, TReturn> | (() => Generator<T | JobFunction, TReturn>)) {
        const jobId = ++globalJobIdCounter;
        const job = {
            stepCount: steps,
            step: -1,
            player: session.getPlayer(),
            message: "", // Jobs with no messages are not displayed.
            percent: 0,
            dimension: session.getPlayer().dimension,
        };
        this.jobs.set(jobId, job);

        const gen = "next" in func ? func : func();
        let val: IteratorResult<T | JobFunction, TReturn>;
        let lastPromise: unknown;
        while (!val?.done) {
            try {
                this.current = jobId;
                val = gen.next(lastPromise);
                this.current = undefined;
                lastPromise = undefined;

                const value = val.value;
                if ((<JobFunction>value)?.jobFunc === "setProgress") {
                    job.percent = Math.max(Math.min((<JobFunction>value).data, 1), 0);
                } else if ((<JobFunction>value)?.jobFunc === "nextStep") {
                    job.message = (<JobFunction>value).data;
                    job.percent = 0;
                    job.step++;
                } else if (val.value instanceof Promise) {
                    lastPromise = yield val.value;
                }
            } catch (err) {
                this.finishJob(jobId);
                throw err;
            }
            yield;
        }
        this.finishJob(jobId);
        return val.value;
    }

    public nextStep(message: string): JobFunction {
        if (this.current) return { jobFunc: "nextStep", data: message };
    }

    public setProgress(percent: number): JobFunction {
        if (this.current) return { jobFunc: "setProgress", data: percent };
    }

    public loadBlock(loc: Vector3, ctx?: JobContext): Block | undefined {
        const job = this.jobs.get(ctx ?? this.current);
        const block = job?.dimension.getBlock(loc);
        if ((ctx || !block) && job) {
            const player = job.player;
            if (!player.isValid()) return;
            if (!player.getDynamicProperty("locationBeforeJob")) {
                player.setDynamicProperty("locationBeforeJob", player.location);
                player.setDynamicProperty("dimensionBeforeJob", player.dimension.id);
                player.setDynamicProperty("gamemodeBeforeJob", player.getGameMode());
                player.runCommand("inputpermission set @s movement disabled");
                player.setGameMode(GameMode.spectator);
                player.camera.fade({ fadeTime: { fadeInTime: 0, holdTime: 1, fadeOutTime: 0 }, fadeColor: { red: 0, green: 0, blue: 0 } });
            }
            player.teleport(loc);
        }
        return block;
    }

    public inContext(): boolean {
        return !!this.current;
    }

    public getContext(): JobContext {
        return this.current;
    }

    public isContextValid(ctx: JobContext) {
        return this.jobs.has(ctx);
    }

    private finishJob(jobId: JobContext) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.percent = 1;
            job.step = job.stepCount - 1;
            if (job.message?.length) job.message = "Finished!"; // TODO: Localize
            if (job.player.isValid) cleanUpPlayer(job.player);
            this.printJobs();
            this.jobs.delete(jobId);
        }
    }

    private printJobs() {
        const progresses = new Map<Player, [string, number][]>();

        for (const job of this.jobs.values()) {
            if (job.message?.length) {
                if (!progresses.has(job.player)) progresses.set(job.player, []);
                const percent = (job.percent + job.step) / job.stepCount;
                progresses.get(job.player).push([job.message, Math.max(percent, 0)]);
            }

            if (job.player.isValid() && job.player.getDynamicProperty("locationBeforeJob")) {
                job.player.camera.fade({ fadeTime: { fadeInTime: 0.1, holdTime: 1, fadeOutTime: 0.1 } });
            }
        }

        for (const [player, progress] of progresses.entries()) {
            let text: RawText;
            let i = 0;
            for (const [message, percent] of progress) {
                if (text) {
                    text.append("text", "\n");
                }

                let bar = "";
                for (let i = 0; i < 20; i++) {
                    bar += i / 20 <= percent ? "█" : "▒";
                }

                if (!text) {
                    text = new RawText();
                }
                if (progress.length > 1) {
                    text.append("text", `Job ${++i}: `);
                }
                text.append("translate", message).append("text", `\n${bar} ${(percent * 100).toFixed(2)}%`);
            }
            Server.queueCommand(`titleraw @s actionbar ${text.toString()}`, player);
        }
    }
}

export const Jobs = new JobHandler();
