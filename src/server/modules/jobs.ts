import { Server, RawText, contentLog, addTickingArea, removeTickingArea } from '@notbeer-api';
import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from 'server/sessions';

let jobId = 0;

interface job {
    stepCount: number,
    step: number,
    player: Player,
    message: string,
    percent: number,
    area: string
};

class JobHandler {
    private jobs = new Map<number, job>();

    constructor() {
        Server.on('tick', ev => {
            this.printJobs();
        });
    }

    public startJob(session: PlayerSession, steps: number, area: [BlockLocation, BlockLocation]) {
        const areaName = 'wedit:job_' + jobId;
        if (!area || !addTickingArea(...area, session.getPlayer().dimension, areaName, true)) {
            contentLog.warn('A ticking area could not be created for job #', jobId);
        }
        this.jobs.set(++jobId, {
            stepCount: steps,
            step: -1,
            player: session.getPlayer(),
            message: '',
            percent: 0,
            area: areaName
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
            this.jobs.get(jobId).percent = percent;
        }
    }

    public* perform<T, TReturn>(jobId: number, func: Generator<T, TReturn>, finishOnError=true): Generator<T, TReturn> {
        let val: IteratorResult<T, TReturn>;
        while (!val?.done) {
            try {
                val = func.next();
            } catch (err) {
                if (finishOnError) {
                    this.finishJob(jobId);
                }
                throw err;
            }
            if (typeof val.value == 'number') {
                this.setProgress(jobId, val.value);
            } else if (typeof val.value == 'string') {
                this.nextStep(jobId, val.value);
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
            job.message = 'Finished!'; // TODO: Localize
            removeTickingArea(job.area);

            this.printJobs();
            this.jobs.delete(jobId);
        }
    }
    
    private printJobs() {
        let progresses = new Map<Player, [string, number][]>();
    
        for (const job of this.jobs.values()) {
            if (!progresses.has(job.player)) {
                progresses.set(job.player, []);
            }
            const percent = (job.percent + job.step) / job.stepCount;
            progresses.get(job.player).push([job.message, percent]);
        }
        
        for (const [player, progress] of progresses.entries()) {
            let text: RawText;
            let i = 0;
            for (const [message, percent] of progress) {
                if (text) {
                    text.append('text', '\n');
                }
                
                let bar = '';
                for (let i = 0; i < 20; i++) {
                    bar += i / 20 <= percent ? '█' : '▒';
                }
    
                if (!text) {
                    text = new RawText();
                }
                if (progress.length > 1) {
                    text.append('text', `Job ${++i}: `);
                }
                text.append('translate', message).append('text', `\n${bar} ${(percent * 100).toFixed(2)}%`);
            }
            Server.runCommand(`titleraw @s actionbar ${text.toString()}`, player);
        }
    }    
}

export const Jobs = new JobHandler();
