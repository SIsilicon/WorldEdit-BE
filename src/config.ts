import { TicksPerSecond } from 'mojang-minecraft';

// Enables `printDebug` messages and operation timers.
export const DEBUG: boolean = true;

// What character(s) to use to define the beginning of custom commands.
export const COMMAND_PREFIX: string = ';';

// How many operations can be recorded in a player's history.
export const MAX_HISTORY_SIZE: number = 20;

// Whether a player's selection is drawn by default.
export const DRAW_SELECTION: boolean = true;

// 0 - DISABLED    - Undo and redo will be disabled.
// 1 - FAST     - The cuboid region of each operation will be recorded.
// 2 - ACCURATE    - Individual blocks in each operation will be recorded.
export const HISTORY_MODE: 0|1|2 = 2; // How to handle general undo and redo
export const BRUSH_HISTORY_MODE: 0|1|2 = 1; // How to handle brush undo and redo

// How long until a previously active builder's session gets deleted.
// This includes their undo redo history.
export const TICKS_TO_DELETE_SESSION: number = 600 * TicksPerSecond;

// Whether commands executed by items print their messages to the action bar or the chat.
export const PRINT_TO_ACTION_BAR: boolean = true;

// The version of WorldEdit (do not change)
export const VERSION: string = '0.5.1 [beta]';