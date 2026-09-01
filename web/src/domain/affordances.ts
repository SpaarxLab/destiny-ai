import type { Actor, AvailableAction, RouteProposalSet, Workspace } from "./workspace";

export function routeSetActions(routeSetRef: string): AvailableAction[] {
  return [
    {
      tool: "revise_route_set",
      targetRef: routeSetRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may edit or reject route previews.",
    },
    {
      tool: "choose_route",
      targetRef: routeSetRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may accept one route as a hypothesis.",
    },
    {
      tool: "compensate_route_set",
      targetRef: routeSetRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may resolve an unedited proposal as compensation.",
    },
  ];
}

export function availableActions(
  workspace: Workspace,
  actor: Actor = "agent",
): AvailableAction[] {
  if (workspace.phase !== "EXPLORING") {
    return [];
  }

  const actions: AvailableAction[] = [];
  if (actor === "agent") {
    actions.push({
      tool: "save_reflection",
      targetRef: workspace.id,
      actor: "agent",
      effect: "PROPOSE",
      requiresHuman: true,
      reason: "Agent-transcribed text remains proposed until the participant confirms it.",
    });
    if (
      workspace.reflections.some((reflection) => reflection.status === "confirmed") &&
      !workspace.routeProposalSets.some((set) => set.status === "proposed")
    ) {
      actions.push({
        tool: "propose_route_set",
        targetRef: workspace.id,
        actor: "agent",
        effect: "PROPOSE",
        requiresHuman: true,
        reason: "Route previews remain proposals until the participant chooses one.",
      });
    }
  } else {
    actions.push({
      tool: "save_reflection",
      targetRef: workspace.id,
      actor: "participant",
      effect: "PROPOSE",
      requiresHuman: false,
    });
    if (!workspace.routeProposalSets.some((set) => set.status === "proposed")) {
      actions.push({
        tool: "propose_route_set",
        targetRef: workspace.id,
        actor: "participant",
        effect: "PROPOSE",
        requiresHuman: false,
      });
    }
    for (const routeSet of workspace.routeProposalSets.filter(isParticipantActionable)) {
      actions.push(...routeSet.availableActions.filter((action) => action.actor === actor));
    }
  }

  return actions;
}

function isParticipantActionable(routeSet: RouteProposalSet): boolean {
  return routeSet.status === "proposed";
}
