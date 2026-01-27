import { registerEditorExtension } from "@minecraft/server-editor";
import { HistoryModule } from "./modules/history";
import { SelectionModule } from "./modules/selection";
import { RegionOpModule } from "./modules/region_operations";
import { GradientsModule } from "./modules/gradients";

registerEditorExtension(
    "WorldEdit: Bedrock Edition",
    (session) => {
        return [new HistoryModule(session), new SelectionModule(session), new RegionOpModule(session), new GradientsModule(session)];
    },
    () => {},
    { toolGroupId: "worldedit" }
);
