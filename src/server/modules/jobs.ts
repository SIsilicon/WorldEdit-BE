import { Server, RawText } from '@notbeer-api';
import { Player } from 'mojang-minecraft';

let jobId = 0;

interface job {
    stepCount: number,
    step: number,
    player: Player,
    message: string,
    percent: number,
};

class JobHandler {
    private jobs = new Map<number, job>();

    constructor() {
        Server.on('tick', ev => {
            this.printJobs();
        });
    }

    startJob(player: Player, steps: number) {
        this.jobs.set(++jobId, {
            stepCount: steps,
            step: -1,
            player: player,
            message: '',
            percent: 0
        });
        return jobId;
    }
    
    nextStep(jobId: number, message: string) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.step++;
            job.percent = 0;
            job.message = message;
        }
    }

    setProgress(jobId: number, percent: number) {
        if (this.jobs.has(jobId)) {
            this.jobs.get(jobId).percent = percent;
        }
    }
    
    finishJob(jobId: number) {
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            job.percent = 1;
            job.step = job.stepCount - 1;

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
                text.append('translate', message).append('text', `\n${bar} ${(percent * 100).toFixed(2)}%`)
            }
            Server.runCommand(`titleraw @s actionbar ${text.toString()}`, player);
        }
    }    
}

export const Jobs = new JobHandler();
