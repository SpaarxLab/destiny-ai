import type { Actor, AvailableAction, RouteProposalSet, Workspace } from "./workspace";

export function routeSetActions(routeSetRef: string): AvailableAction[] {
  return [
    {
      tool: "revise_route_set",
      targetRef: routeSetRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may edit or set aside route previews.",
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

export function followUpActions(followUpRef: string): AvailableAction[] {
  return [
    {
      tool: "save_reflection",
      targetRef: followUpRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may answer the agent's follow-up question in their own words.",
    },
    {
      tool: "skip_follow_up",
      targetRef: followUpRef,
      actor: "participant",
      effect: "PREPARE_UI",
      requiresHuman: true,
      reason: "Only the participant may skip the follow-up question.",
    },
  ];
}

export function proposedRouteSet(workspace: Workspace): RouteProposalSet | undefined {
  return workspace.routeProposalSets.find((set) => set.status === "proposed");
}

export function openFollowUp(workspace: Workspace) {
  return workspace.followUpQuestions.find((question) => question.status === "proposed");
}

/**
 * Describes why the agent may or may not propose right now. The WebMCP catalogue and the visible
 * room header both derive from this single answer, so a judge sees the same truth the agent sees.
 */
export type ProposalAvailability =
  | { available: true; mode: "fresh"; reason: string }
  | { available: true; mode: "replace_rejected"; reason: string; routeSetRef: string; rejectedRouteRefs: string[] }
  | { available: false; reason: string };

export function proposalAvailability(workspace: Workspace): ProposalAvailability {
  if (workspace.phase === "DECK") {
    return { available: false, reason: "Route proposals open after the participant keeps a Portrait from at least two resolved tensions." };
  }
  if (workspace.phase !== "EXPLORING") {
    return { available: false, reason: "The participant has chosen a direction. Proposals resume only if they reopen exploring." };
  }
  if (!workspace.reflections.some((reflection) => reflection.status === "confirmed")) {
    return { available: false, reason: "The participant has not confirmed any words yet." };
  }
  const waiting = openFollowUp(workspace);
  if (waiting) {
    return { available: false, reason: "Your follow-up question is waiting for the participant. Reread after they answer or skip it." };
  }
  const proposed = proposedRouteSet(workspace);
  if (!proposed) {
    return {
      available: true,
      mode: "fresh",
      reason: "Propose three grounded route previews, or ask one focused follow-up question if the confirmed words are not enough.",
    };
  }
  const rejected = proposed.routes.filter((route) => route.status === "rejected").map((route) => route.ref);
  if (rejected.length === 0) {
    return { available: false, reason: "Three routes are waiting for the participant. They must edit, set aside, or choose before a new proposal." };
  }
  return {
    available: true,
    mode: "replace_rejected",
    reason: "Replace only the route(s) the participant set aside; carry every kept route over unchanged with carryRouteRef.",
    routeSetRef: proposed.ref,
    rejectedRouteRefs: rejected,
  };
}

export function availableActions(
  workspace: Workspace,
  actor: Actor = "agent",
): AvailableAction[] {
  const actions: AvailableAction[] = [];
  if (actor === "agent") {
    if (workspace.phase === "DECK") {
      if (workspace.deck.dealsUnresolved < 5) actions.push({ tool: "deal_cards", targetRef: workspace.id, actor: "agent", effect: "PROPOSE", requiresHuman: true, reason: "Deal moment cards into the participant's visible tray." });
      if (workspace.swipes.length >= 3 && workspace.tensions.filter((tension) => tension.status === "proposed").length < 3) actions.push({ tool: "propose_tension", targetRef: workspace.id, actor: "agent", effect: "PROPOSE", requiresHuman: true, reason: "Propose one evidence-backed pull and counter-pull." });
      if (workspace.tensions.filter((tension) => ["accepted", "edited", "survived"].includes(tension.status)).length >= 2) actions.push({ tool: "propose_portrait", targetRef: workspace.id, actor: "agent", effect: "PROPOSE", requiresHuman: true, reason: "Propose a Portrait from two or three resolved tensions." });
      actions.push({ tool: "post_dealer_note", targetRef: workspace.id, actor: "agent", effect: "PROPOSE", requiresHuman: true, reason: "Leave one visible note of at most 240 characters." });
      return actions;
    }
    if (workspace.phase !== "EXPLORING") return actions;
    const availability = proposalAvailability(workspace);
    if (availability.available) {
      actions.push({
        tool: "propose_route_set",
        targetRef: availability.mode === "replace_rejected" ? availability.routeSetRef : workspace.id,
        actor: "agent",
        effect: "PROPOSE",
        requiresHuman: true,
        reason: availability.reason,
      });
    }
    return actions;
  }

  if (workspace.phase === "DECK") {
    for (const card of workspace.cards.filter((candidate) => candidate.status === "dealt")) {
      actions.push({ tool: "swipe_card", targetRef: card.ref, actor: "participant", effect: "PREPARE_UI", requiresHuman: true, reason: "Only the participant may place a card into a pile." });
    }
    for (const tension of workspace.tensions.filter((candidate) => candidate.status === "proposed")) {
      actions.push({ tool: "resolve_tension", targetRef: tension.ref, actor: "participant", effect: "PREPARE_UI", requiresHuman: true });
    }
    for (const portrait of workspace.portraits.filter((candidate) => candidate.status === "proposed")) {
      actions.push({ tool: "resolve_portrait", targetRef: portrait.ref, actor: "participant", effect: "PREPARE_UI", requiresHuman: true });
    }
    actions.push({ tool: "set_deck_settings", targetRef: workspace.id, actor: "participant", effect: "PREPARE_UI", requiresHuman: true });
    return actions;
  }
  if (workspace.phase === "TESTING") {
    const accepted = workspace.hypotheses.find((hypothesis) => hypothesis.status === "accepted");
    if (accepted) {
      actions.push({
        tool: "reopen_exploring",
        targetRef: accepted.ref,
        actor: "participant",
        effect: "PREPARE_UI",
        requiresHuman: true,
        reason: "Only the participant may park the chosen direction and return to exploring.",
      });
    }
    return actions;
  }
  if (workspace.phase !== "EXPLORING") return actions;

  actions.push({
    tool: "save_reflection",
    targetRef: workspace.id,
    actor: "participant",
    effect: "PROPOSE",
    requiresHuman: false,
  });
  actions.push({
    tool: "set_limits",
    targetRef: workspace.id,
    actor: "participant",
    effect: "PROPOSE",
    requiresHuman: false,
  });
  if (!proposedRouteSet(workspace)) {
    actions.push({
      tool: "propose_route_set",
      targetRef: workspace.id,
      actor: "participant",
      effect: "PROPOSE",
      requiresHuman: false,
    });
  }
  for (const routeSet of workspace.routeProposalSets.filter((set) => set.status === "proposed")) {
    actions.push(...routeSet.availableActions.filter((action) => action.actor === actor));
  }
  const followUp = openFollowUp(workspace);
  if (followUp) {
    actions.push(...followUp.availableActions.filter((action) => action.actor === actor));
  }
  return actions;
}
