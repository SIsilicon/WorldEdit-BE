import { Server, RawText, contentLog } from "@notbeer-api";
import { Vector3, Player, Dimension } from "@minecraft/server";
import { PlayerSession } from "server/sessions";
import { addTickingArea, removeTickingArea } from "server/util";

// eslint-disable-next-line prefer-const
let jobId = 0;

interface job {
    stepCount: number,
    step: number,
    player: Player,
    message: string,
    percent: number,
    area: string,
    dimension: Dimension
}

class JobHandler {
    private jobs = new Map<number, job>();

    constructor() {
        Server.on("tick", () => {
            this.printJobs();
        });
    }

    public startJob(session: PlayerSession, steps: number, area: [Vector3, Vector3]) {
        const areaName = "wedit:job_" + jobId;
        if (!area || addTickingArea(areaName, session.getPlayer().dimension, ...area)) {
            contentLog.warn("A ticking area could not be created for job #", jobId);
        }
        this.jobs.set(++jobId, {
            stepCount: steps,
            step: -1,
            player: session.getPlayer(),
            message: "",
            percent: 0,
            area: areaName,
            dimension: session.getPlayer().dimension
        });
        return jobId;
    }

    public nextStep(jobId: number, message: string) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.step++;
            job.percent = 0;
            job.message = message;
        }
    }

    public setProgress(jobId: number, percent: number) {
        if (this.jobs.has(jobId)) {
            this.jobs.get(jobId).percent = Math.max(Math.min(percent, 1), 0);
        }
    }

    public* perform<T, TReturn>(jobId: number, func: Generator<T, TReturn>, finishOnError=true): Generator<T | Promise<unknown>, TReturn> {
        let val: IteratorResult<T, TReturn>;
        let lastPromise: unknown;
        while (!val?.done) {
            try {
                val = func.next(lastPromise);
                lastPromise = undefined;
                if (typeof val.value == "number") {
                    this.setProgress(jobId, val.value);
                } else if (typeof val.value == "string") {
                    this.nextStep(jobId, val.value);
                } else if (val.value instanceof Promise) {
                    lastPromise = yield val.value;
                }
            } catch (err) {
                if (finishOnError) {
                    this.finishJob(jobId);
                }
                throw err;
            }
            yield;
        }
        return val.value;
    }

    public finishJob(jobId: number) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.percent = 1;
            job.step = job.stepCount - 1;
            job.message = "Finished!"; // TODO: Localize
            removeTickingArea(job.area, job.dimension);

            this.printJobs();
            this.jobs.delete(jobId);
        }
    }

    private printJobs() {
        const progresses = new Map<Player, [string, number][]>();

        for (const job of this.jobs.values()) {
            if (!progresses.has(job.player)) {
                progresses.set(job.player, []);
            }
            const percent = (job.percent + job.step) / job.stepCount;
            progresses.get(job.player).push([job.message, Math.max(percent, 0)]);
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
