export interface PanelState {
  left: boolean;
  right: boolean;
}

export type Side = "left" | "right";

export const DEFAULT_PANELS: PanelState = { left: true, right: true };

export function togglePanel(state: PanelState, side: Side): PanelState {
  return { ...state, [side]: !state[side] };
}
