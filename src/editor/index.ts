import { registerEditorExtension } from "@minecraft/server-editor";
import { HistoryModule } from "./modules/history";
import { SelectionModule } from "./modules/selection";

registerEditorExtension(
    "WorldEdit: Bedrock Edition",
    (session) => {
        return [new HistoryModule(session), new SelectionModule(session)];
    },
    () => {},
    { toolGroupId: "worldedit" }
);
