import { system } from "@minecraft/server";

export function doOn(command: string, callback: () => void) {
    system.afterEvents.scriptEventReceive.subscribe(
        (ev) => {
            if (ev.id !== "dev:" + command) return;
            callback();
        },
        { namespaces: ["dev"] }
    );
}
