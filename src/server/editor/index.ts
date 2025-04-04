import { registerEditorExtension } from "@minecraft/server-editor";

registerEditorExtension(
    "WorldEdit: Bedrock Edition",
    () => {
        return [];
    },
    () => {},
    { toolGroupId: "worldedit" }
);
