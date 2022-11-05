import { Player } from "@minecraft/server";
import { Mask } from "@modules/mask";
import { Pattern } from "@modules/pattern";
import { MenuContext, UIFormName } from "library/@types/build/classes/uiFormBuilder";
import { Brush } from "server/brushes/base_brush";
import { PlayerSession } from "server/sessions";

export type ToolTypes = "selection_wand" | "far_selection_wand" | "navigation_wand" | "stacker_wand" | "brush"
export type BrushTypes = "sphere_brush" | "cylinder_brush" | "smooth_brush"

export interface ConfigContext {
  session: PlayerSession

  currentItem?: [string, number]
  editingBrush?: boolean

  creatingTool?: ToolTypes | BrushTypes
  toolData?: [number, Mask] | [Brush, Mask, number, Mask]

  deletingTools?: [string, number][]

  pickerData?: {
    return: UIFormName
    onFinish: (ctx: MenuContext<ConfigContext>, player: Player, mask: Mask, pattern: Pattern) => void
  }

  stashedMask?: Mask
  stashedPattern?: Pattern
}