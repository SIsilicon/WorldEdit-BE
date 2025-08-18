import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, Vector2, Vector3 } from "@minecraft/server";
import { Databases, Server, sleep } from "@notbeer-api";

interface RecordedOperation {
    command: string;
    args: string[];
    position: Vector3;
    rotation: Vector2;
}

const recording = new Map<string, RecordedOperation[]>();

system.beforeEvents.startup.subscribe((ev) => {
    ev.customCommandRegistry.registerEnum("wedit:recordAction", ["start", "save", "stop", "replay"]);
    ev.customCommandRegistry.registerCommand(
        {
            name: "wedit:record",
            description: "Record a bunch of worldedit commands to repeat later",
            permissionLevel: CommandPermissionLevel.Admin,
            mandatoryParameters: [{ name: "wedit:recordAction", type: CustomCommandParamType.Enum }],
            optionalParameters: [{ name: "filename", type: CustomCommandParamType.String }],
        },
        (origin, action: string, filename: string) => {
            const player = origin.sourceEntity as Player;
            if (action === "start") startRecording(player);
            else if (action === "save") saveRecording(player, filename);
            else if (action === "stop") stopRecording(player);
            else if (action === "replay") replayRecording(player, filename);
            return { status: CustomCommandStatus.Success };
        }
    );
});

Server.command.on("runCommand", (player, command, args) => {
    if (!recording.has(player.id)) return;

    recording.get(player.id).push({
        command,
        args,
        position: player.location,
        rotation: player.getRotation(),
    });
});

function startRecording(player: Player) {
    if (recording.has(player.id)) throw "You are already recording!";
    recording.set(player.id, []);
    player.sendMessage("Started recording!");
}

function stopRecording(player: Player) {
    if (!recording.has(player.id)) throw "You are not recording!";
    recording.delete(player.id);
    player.sendMessage("Stopped recording!");
}

function saveRecording(player: Player, filename: string) {
    if (!recording.has(player.id)) throw "You are not recording!";
    if (!filename) throw "You must provide a filename to save to!";

    const operations = recording.get(player.id);
    recording.delete(player.id);

    const records = getRecordDatabase(player);
    records.data[filename] = operations;
    records.save();

    player.sendMessage(`Saved ${operations.length} operations to '${filename}'`);
}

async function replayRecording(player: Player, filename: string) {
    await sleep(1); // Wait a tick to get out of before event context
    if (!filename) throw "You must provide a filename to load from!";

    const records = getRecordDatabase(player);
    if (!(filename in records.data)) throw `No recording found with the name '${filename}'`;

    const operations = records.data[filename];
    player.sendMessage(`Replaying ${operations.length} operations from '${filename}'`);

    for (const op of operations) {
        player.teleport(op.position, { rotation: op.rotation });
        const thread = Server.command.callCommand(player, op.command, op.args);
        while (thread.isActive()) await sleep(1);
    }
}

function getRecordDatabase(player: Player) {
    return Databases.load<{ [filename: string]: RecordedOperation[] }>("recordings", player);
}
