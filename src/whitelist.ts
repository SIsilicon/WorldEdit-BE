import { system, world, Player } from "@minecraft/server";

function isWhitelistEnabled() {
    return <boolean>world.getDynamicProperty("whitelistEnabled") ?? true;
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "wedit:whitelist") return;
    const player = <Player | undefined>ev.sourceEntity;
    if (["true", "false"].includes(ev.message.toLowerCase())) {
        const value = ev.message.toLowerCase() === "true";
        if (value === isWhitelistEnabled()) return;

        world.setDynamicProperty("whitelistEnabled", isWhitelistEnabled());
        player?.sendMessage({ rawtext: [{ translate: isWhitelistEnabled() ? "worldedit.whitelist.enabled" : "worldedit.whitelist.disabled" }] });
    } else {
        player?.sendMessage({ rawtext: [{ translate: isWhitelistEnabled() ? "worldedit.whitelist.status.on" : "worldedit.whitelist.status.off" }] });
    }
});

export default isWhitelistEnabled;
