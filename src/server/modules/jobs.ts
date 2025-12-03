import { Server, RawText, removeTickingArea, setTickingAreaCircle, Thread, getCurrentThread, regionCenter, sleep, whenReady } from "@notbeer-api";
import { Player, Dimension, Vector3, Block, system } from "@minecraft/server";
import { PlayerSession, getSession } from "server/sessions";
import { UnloadedChunksError } from "./assert";

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
    thread: Thread;
    tickingAreaUsageTime?: number;
    tickingAreaRequestTime?: number;
    tickingAreaSlot?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobFunction = { readonly jobFunc: "nextStep" | "setProgress"; readonly data: any };

class JobHandler {
    private jobs = new Map<JobContext, job>();
    private current: JobContext;
    private occupiedTickingAreaSlots = [false];

    constructor() {
        Server.on("tick", () => {
            this.manageTickingAreaSlots();
            this.printJobs();
        });
        for (let i = 0; i < 9; i++) whenReady(() => removeTickingArea("wedit:ticking_area_" + i));
    }

    public *run<T, TReturn, U>(session: PlayerSession, steps: number, func: Generator<T | JobFunction, TReturn> | ((this: U) => Generator<T | JobFunction, TReturn>), thisArg?: U) {
        const jobId = ++globalJobIdCounter;
        const job = {
            stepCount: steps,
            step: -1,
            player: session.player,
            message: "", // Jobs with no messages are not displayed.
            percent: 0,
            dimension: session.player.dimension,
            thread: getCurrentThread(),
        };
        this.jobs.set(jobId, job);

        const gen = "next" in func ? func : func.bind(thisArg || {})();
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
                    job.percent = Math.min((<JobFunction>value).data, 1);
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

    public *loadBlock(loc: Vector3, ctx: JobContext = this.current): Generator<Promise<void>, Block | undefined> {
        const job = this.jobs.get(ctx);
        while (true) {
            if (!Jobs.isContextValid(ctx)) return undefined;
            const block = job.dimension.getBlock(loc);
            if (block) return block;

            if (job.tickingAreaSlot === undefined) {
                if (!job.tickingAreaRequestTime) job.tickingAreaRequestTime = Date.now();
                yield sleep(1);
                continue;
            }

            if (setTickingAreaCircle(loc, 4, job.dimension, "wedit:ticking_area_" + job.tickingAreaSlot)) yield sleep(1);
            else throw new UnloadedChunksError("worldedit.error.tickArea");
        }
    }

    public *loadArea(start: Vector3, end: Vector3, ctx?: JobContext) {
        return !!(yield* this.loadBlock(regionCenter(start, end), ctx));
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

    public getRunner(ctx?: JobContext) {
        return this.jobs.get(ctx ?? this.getContext()).player;
    }

    public getJobsForSession(session: PlayerSession) {
        const jobs = [];
        const player = session.player;
        for (const [id, data] of this.jobs.entries()) {
            if (data.player === player) jobs.push(id);
        }
        return jobs;
    }

    public cancelJob(jobId: JobContext) {
        const job = this.jobs.get(jobId);
        const history = getSession(job.player).history;
        for (const point of history.getActivePointsInThread(job.thread)) history.cancel(point);
        job.thread.abort();
        this.finishJob(jobId);
    }

    private finishJob(jobId: JobContext) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.percent = 1;
            job.step = job.stepCount - 1;
            if (job.message?.length) job.message = "Finished!"; // TODO: Localize
            if (job.tickingAreaSlot !== undefined) {
                removeTickingArea("wedit:ticking_area_" + job.tickingAreaSlot, job.dimension);
                this.occupiedTickingAreaSlots[job.tickingAreaSlot] = false;
            }
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
                progresses.get(job.player).push([job.tickingAreaRequestTime ? "Loading Chunks..." : job.message, percent]);
            }
        }

        for (const [player, progress] of progresses.entries()) {
            let text: RawText;
            let i = 0;
            for (const [message, percent] of progress) {
                if (text) text.append("text", "\n");
                let bar = "";
                if (percent >= 0) for (let i = 0; i < 20; i++) bar += i / 20 <= percent ? "█" : "▒";
                else for (let i = 0; i < 20; i++) bar += (i - 2 * system.currentTick) % 20 > -5 ? "█" : "▒";

                if (!text) text = new RawText();
                if (progress.length > 1) text.append("text", `Job ${++i}: `);
                text.append("translate", message).append("text", `\n${bar} ${percent >= 0 ? (percent * 100).toFixed(2) : ". . . ."}%`);
            }
            Server.queueCommand(`titleraw @s actionbar ${text.toString()}`, player);
        }
    }

    private manageTickingAreaSlots() {
        const jobs = Array.from(this.jobs.values());
        const jobsRequestingArea = jobs.filter((job) => job.tickingAreaRequestTime).sort((a, b) => a.tickingAreaRequestTime - b.tickingAreaRequestTime);
        if (!jobsRequestingArea) return;

        const jobsUsingArea = jobs.filter((job) => job.tickingAreaUsageTime && job.tickingAreaUsageTime < Date.now() - 2000).sort((a, b) => a.tickingAreaUsageTime - b.tickingAreaUsageTime);
        for (const needy of jobsRequestingArea) {
            let slot = this.occupiedTickingAreaSlots.findIndex((slot) => !slot);
            if (slot === -1 && jobsUsingArea.length) {
                const donor = jobsUsingArea.shift();
                slot = donor.tickingAreaSlot;
                donor.tickingAreaSlot = undefined;
                donor.tickingAreaRequestTime = undefined;
                donor.tickingAreaUsageTime = undefined;
            }
            if (slot !== -1) {
                needy.tickingAreaRequestTime = undefined;
                needy.tickingAreaUsageTime = Date.now();
                needy.tickingAreaSlot = slot;
                this.occupiedTickingAreaSlots[slot] = true;
            }
        }
    }
}

export const Jobs = new JobHandler();
