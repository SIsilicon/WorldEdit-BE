export default {
  /**
   * Enables debug messages to content logs.
   */
  debug: true,
  /**
   * What character(s) to use to define the beginning of custom commands.
   */
  commandPrefix: ";",
  /**
   * Whether the addon should use simpler methods to run operations faster.
   * This comes with the drawback of more limited capabilities.
   */
  performanceMode: false,
  /**
   * How many operations can be recorded in a player's history.
   */
  maxHistorySize: 25,
  /**
   * Whether a player's selection is drawn by default.
   */
  drawSelection: true,
  /**
   * How long until a previously active builder's session gets deleted.
   * This includes their undo redo history.
   */
  ticksToDeleteSession: 12000, // 10 minutes
  /**
   * Whether commands executed by items print their messages to the action bar or the chat.
   */
  printToActionBar: true,
  /**
   * The default item used for marking selection wand.
   */
  wandItem: "minecraft:wooden_axe",
  /**
   * The default item used for the navigation wand.
   */
  navWandItem: "minecraft:ender_pearl",
  /**
   * The distance the navigation wand, among other tools and commands, traces for a block of interest.
   */
  navWandDistance: 128,
  /**
   * The maximum brush radius allowed.
   */
  maxBrushRadius: 6,
  /**
   * Whether to break blocks, instead of interacting with them while sneaking, to mark the first position (;pos1, ;hpos1).
   */
  useBlockBreaking: true,
  /**
   * The default amount of blocks that can be "potentially" affected within a single operation.
   */
  defaultChangeLimit: -1,
  /**
   * The absolute change limit that can be set from the ;limit command.
   * Bypassed with "worldedit.limit.unlimited" permission.
   */
  maxChangeLimit: -1,
  /**
   * How long an async operation will run until giving Minecraft a chance to run.
   * The higher the value, the faster the operation, but the slower Minecraft takes to run.
   */
  asyncTimeBudget: 150
} as const;

// The version of WorldEdit (do not change)
export const VERSION = "0.7.0.3 [BETA]";