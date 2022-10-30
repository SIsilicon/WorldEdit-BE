import { PlayerSession } from "server/sessions";

export interface ConfigContext {
  session: PlayerSession,
  currentTool?: [string, number],
  editingBrush?: boolean
}