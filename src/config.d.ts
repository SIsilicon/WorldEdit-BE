declare const _default: {
    /**
     * Enables debug messages to content logs.
     */
    debug: boolean;
    /**
     * What character(s) to use to define the beginning of custom commands.
     */
    commandPrefix: string;
    /**
     * Whether the addon should use simpler methods to run operations faster.
     * This comes with the drawback of more limited capabilities.
     */
    performanceMode: boolean;
    /**
     * How many operations can be recorded in a player's history.
     */
    maxHistorySize: number;
    /**
     * Whether a player's outlines are drawn by default. Outlines include selections, brush influence and paste location
     */
    drawOutlines: boolean | "local";
    /**
     * How long (in ticks) until a previously active builder's session gets deleted.
     * This includes their undo/redo history.
     */
    ticksToDeleteSession: number;
    /**
     * Whether commands executed by items print their messages to the action bar or the chat.
     */
    printToActionBar: boolean;
    /**
     * The default item used for marking selection wand.
     */
    wandItem: string;
    /**
     * The default item used for the navigation wand.
     */
    navWandItem: string;
    /**
     * The distance the navigation wand, among other tools and commands, traces for a block of interest.
     */
    traceDistance: number;
    /**
     * The maximum brush radius allowed.
     */
    maxBrushRadius: number;
    /**
     * Whether blocks broken by the super pickaxe in "single" mode drop.
     */
    superPickaxeDrop: boolean;
    /**
     * Whether blocks broken by the super pickaxe in "area" and "recursive" mode drop.
     */
    superPickaxeManyDrop: boolean;
    /**
     * The default amount of blocks that can be "potentially" affected within a single operation.
     */
    defaultChangeLimit: number;
    /**
     * The absolute change limit that can be set from the ;limit command.
     * Bypassed with "worldedit.limit.unlimited" permission.
     */
    maxChangeLimit: number;
    /**
     * How long an async operation will run until giving Minecraft a chance to run.
     * The higher the value, the faster the operation, but the slower Minecraft takes to run.
     */
    asyncTimeBudget: number;
};
export default _default;

/**
 * WorldEdit version (do not change)
 */
export declare const VERSION: string;
