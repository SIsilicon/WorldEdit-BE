import { TicksPerSecond } from 'mojang-minecraft';

// Enables `printDebug` messages and operation timers.
export const DEBUG: boolean = true;

// How many operations can be recorded in a player's history.
export const MAX_HISTORY_SIZE: number = 20;

// 0 - DISABLED	- Undo and redo will be disabled.
// 1 - FAST 	- The cuboid region of each operation will be recorded.
// 2 - ACCURATE	- Individual blocks in each operation will be recorded.
export const HISTORY_MODE: 0|1|2 = 2; // How to handle general undo and redo
export const BRUSH_HISTORY_MODE: 0|1|2 = 1; // How to handle brush undo and redo

// How long until a previously active builder's session gets deleted.
// This includes their undo redo history.
export const TICKS_TO_DELETE_SESSION: number = 600 * TicksPerSecond;

// Assumed height of players.
export const PLAYER_HEIGHT: number = 1.61;