import type { AvailableAction, Workspace } from "./workspace";

export function availableActions(workspace: Workspace): AvailableAction[] {
  if (workspace.phase !== "EXPLORING") {
    return [];
  }

  return [
    {
      tool: "save_reflection",
      targetRef: workspace.id,
      effect: "PROPOSE",
      requiresHuman: true,
      reason: "Agent-transcribed text remains proposed until the participant confirms it.",
    },
  ];
}
