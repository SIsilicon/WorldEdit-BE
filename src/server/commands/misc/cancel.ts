import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation: CommandInfo = {
    name: "cancel",
    permission: "worldedit.cancel",
    description: "commands.wedit:cancel.description",
    usage: [{ name: "job", type: "int", default: -1 }],
};

registerCommand(registerInformation, function (session, builder, args) {
    const index = args.get("job");
    const jobs = Jobs.getJobsForSession(session);
    if (!jobs.length) throw "commands.wedit:cancel.none.all";
    if (index < 1) {
        for (const job of jobs) Jobs.cancelJob(job);
        return RawText.translate("commands.wedit:cancel.explain.all").with(jobs.length);
    } else if (jobs[index - 1]) {
        Jobs.cancelJob(jobs[index - 1]);
        return RawText.translate("commands.wedit:cancel.explain").with(index);
    } else {
        throw "commands.wedit:cancel.none";
    }
});
