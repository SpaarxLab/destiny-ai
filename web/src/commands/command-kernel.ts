import {
  commandRequestIdentity,
  commandSchema,
  PARTICIPANT_ONLY_COMMANDS,
  type ChooseRouteCommand,
  type Command,
  type CompensateRouteSetCommand,
  type DealCardsCommand,
  type DismissDealCommand,
  type DismissNoteCommand,
  type PostDealerNoteCommand,
  type ProposePortraitCommand,
  type ProposeTensionCommand,
  type ProposeRouteSetCommand,
  type ReopenExploringCommand,
  type ReopenDeckCommand,
  type ResolvePortraitCommand,
  type ResolveTensionCommand,
  type ReviseRouteSetCommand,
  type RouteEdit,
  type RouteProposalInput,
  type SaveReflectionCommand,
  type SetLimitsCommand,
  type SetDeckSettingsCommand,
  type SkipFollowUpCommand,
  type SwipeCardCommand,
} from "../domain/commands";
import {
  availableActions,
  followUpActions,
  openFollowUp,
  routeSetActions,
} from "../domain/affordances";
import type {
  ChooseRouteResult,
  CommandError,
  CommandResult,
  CompensateRouteSetResult,
  ProposeRouteSetResult,
  ReopenExploringResult,
  ReviseRouteSetResult,
  SaveReflectionResult,
  SetLimitsResult,
  SkipFollowUpResult,
} from "../domain/results";
import {
  publicReceipt,
  routeContent,
  workspaceSchema,
  type Actor,
  type AgentIdentity,
  type Card,
  type DealerNote,
  type FollowUpQuestion,
  type Hypothesis,
  type OperationRecord,
  type Portrait,
  type RoutePreview,
  type RouteProposalSet,
  type Swipe,
  type Tension,
  type Workspace,
} from "../domain/workspace";
import { WorkspaceStoreError, type WorkspaceStore } from "../storage/workspace-store";

export interface CommandEnvironment {
  now(): string;
  createId(): string;
}

const defaultEnvironment: CommandEnvironment = {
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
};

type MutationData = NonNullable<CommandResult["data"]>;
export type CommandExecutionContext =
  | { actor: "participant"; proposalSource: "participant" }
  | {
      actor: "agent";
      proposalSource: "chatgpt_webmcp" | "gemini_webmcp" | "other_webmcp" | "embedded_inference" | "fixture";
      agentIdentity?: AgentIdentity;
    };

type Authorized<T extends Command = Command> = T & CommandExecutionContext;
type AuthorizedCommand = Authorized<Command>;

export class CommandKernel {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly environment: CommandEnvironment = defaultEnvironment,
  ) {}

  async execute(context: CommandExecutionContext, commandInput: SaveReflectionCommand): Promise<SaveReflectionResult>;
  async execute(context: CommandExecutionContext, commandInput: SetLimitsCommand): Promise<SetLimitsResult>;
  async execute(context: CommandExecutionContext, commandInput: ProposeRouteSetCommand): Promise<ProposeRouteSetResult>;
  async execute(context: CommandExecutionContext, commandInput: ReviseRouteSetCommand): Promise<ReviseRouteSetResult>;
  async execute(context: CommandExecutionContext, commandInput: ChooseRouteCommand): Promise<ChooseRouteResult>;
  async execute(context: CommandExecutionContext, commandInput: CompensateRouteSetCommand): Promise<CompensateRouteSetResult>;
  async execute(context: CommandExecutionContext, commandInput: SkipFollowUpCommand): Promise<SkipFollowUpResult>;
  async execute(context: CommandExecutionContext, commandInput: ReopenExploringCommand): Promise<ReopenExploringResult>;
  async execute(context: CommandExecutionContext, commandInput: unknown): Promise<CommandResult>;
  async execute(context: CommandExecutionContext, commandInput: unknown): Promise<CommandResult> {
    let workspace: Workspace;
    try {
      workspace = this.store.load();
    } catch (error) {
      return storageFailure(error, 0);
    }

    if (!isExecutionContext(context)) {
      return failure(workspace, {
        code: "MALFORMED_INPUT",
        what: "The trusted command execution context is invalid.",
        retry: "NEVER",
        insteadDo: "Do not repeat this invocation. Invoke the command through a product-owned participant or agent adapter.",
      }, "No state changed because adapter authority was invalid.");
    }

    const parsed = commandSchema.safeParse(commandInput);
    if (!parsed.success) {
      return failure(workspace, {
        code: "MALFORMED_INPUT",
        what: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "command"}: ${issue.message}`)
          .join("; "),
        retry: "NEVER",
        insteadDo: "Do not repeat this request. Correct the input and submit a new command with a new operationId.",
      }, "No state changed because the command was malformed.");
    }

    const command = { ...parsed.data, ...context } as AuthorizedCommand;
    const replay = replayResult(workspace, command);
    if (replay) return replay;

    if (command.input.expectedVersion !== workspace.stateVersion) {
      return staleResult(workspace, command.input.expectedVersion, command.actor);
    }
    if (!phaseAllows(workspace, command)) {
      return failure(workspace, {
        code: "WRONG_PHASE",
        what: `${command.name} is unavailable in ${workspace.phase}.`,
        retry: "NEVER",
        insteadDo: "Do not repeat this request. Submit an action declared for the current phase as a new command with a new operationId.",
      }, "No state changed because the live phase denied this command.", command.actor);
    }
    if (command.actor !== "participant" && command.name === "swipe_card") {
      return deckDenied(workspace, command, "NO_SWIPE_TOOL", "There is no agent swipe capability.", "Wait for the participant to swipe the visible card.", { actor: "participant" });
    }
    if (command.actor !== "participant" && PARTICIPANT_ONLY_COMMANDS.includes(command.name)) {
      return wrongActor(workspace, command);
    }

    switch (command.name) {
      case "save_reflection":
        return this.saveReflection(workspace, command);
      case "set_limits":
        return this.setLimits(workspace, command);
      case "propose_route_set":
        return this.proposeRouteSet(workspace, command);
      case "revise_route_set":
        return this.reviseRouteSet(workspace, command);
      case "choose_route":
        return this.chooseRoute(workspace, command);
      case "compensate_route_set":
        return this.compensateRouteSet(workspace, command);
      case "skip_follow_up":
        return this.skipFollowUp(workspace, command);
      case "reopen_exploring":
        return this.reopenExploring(workspace, command);
      case "deal_cards":
        return this.dealCards(workspace, command);
      case "dismiss_deal":
        return this.dismissDeal(workspace, command);
      case "swipe_card":
        return this.swipeCard(workspace, command);
      case "set_deck_settings":
        return this.setDeckSettings(workspace, command);
      case "propose_tension":
        return this.proposeTension(workspace, command);
      case "resolve_tension":
        return this.resolveTension(workspace, command);
      case "propose_portrait":
        return this.proposePortrait(workspace, command);
      case "resolve_portrait":
        return this.resolvePortrait(workspace, command);
      case "post_dealer_note":
        return this.postDealerNote(workspace, command);
      case "dismiss_note":
        return this.dismissNote(workspace, command);
      case "reopen_deck":
        return this.reopenDeck(workspace, command);
    }
  }

  private async saveReflection(
    workspace: Workspace,
    command: Authorized<SaveReflectionCommand>,
  ): Promise<CommandResult> {
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const reflectionRef = nextAvailableRef(workspace, "reflection", afterVersion);
    let answered: FollowUpQuestion | undefined;
    if (command.input.answersFollowUpRef !== undefined) {
      if (command.actor !== "participant") {
        return failure(workspace, policyDenied("Only the participant can answer a follow-up question."),
          "No state changed because an agent cannot answer on the participant's behalf.", command.actor);
      }
      const question = workspace.followUpQuestions.find((candidate) => candidate.ref === command.input.answersFollowUpRef);
      if (!question) return failure(workspace, unknownRef(command.input.answersFollowUpRef), "No state changed.", command.actor);
      if (question.status !== "proposed") {
        return failure(workspace, lifecycleError(question.ref, question.status), "No state changed.", command.actor);
      }
      answered = { ...question, status: "answered", answerReflectionRef: reflectionRef, availableActions: [] };
    }
    const reflection = {
      id: this.environment.createId(),
      ref: reflectionRef,
      availableActions: [],
      status: command.actor === "participant" ? "confirmed" as const : "proposed" as const,
      text: command.input.text,
      recordedBy: command.actor === "participant" ? "participant" as const : "agent_transcribed" as const,
      createdAt: at,
      ...(answered ? { answersFollowUpRef: answered.ref } : {}),
    };
    const changedRefs = answered ? [reflection.ref, answered.ref] : [reflection.ref];
    const operation = operationFor(workspace, command, afterVersion, at, changedRefs,
      command.actor === "participant" ? "APPLIED" : "PROPOSED");
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      reflections: [...workspace.reflections, reflection],
      followUpQuestions: workspace.followUpQuestions.map((question) =>
        answered && question.ref === answered.ref ? answered : question),
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation,
      answered ? { reflection, answeredFollowUp: answered } : { reflection },
      answered
        ? "The participant answered the follow-up question; the answer is a confirmed reflection the agent may quote."
        : command.actor === "participant"
          ? "The participant reflection is confirmed and visible in the workspace."
          : "The agent transcription is a visible proposal awaiting participant review.");
  }

  private async setLimits(
    workspace: Workspace,
    command: Authorized<SetLimitsCommand>,
  ): Promise<CommandResult> {
    const caps = command.input.costCaps;
    const proposed = workspace.routeProposalSets.find((set) => set.status === "proposed");
    const breaking = proposed?.routes.find((route) =>
      route.test.maximumHours > caps.hoursPerWeek ||
      route.test.maximumMoney > caps.money ||
      route.test.currency !== caps.currency);
    if (proposed && breaking) {
      return failure(workspace, {
        ...policyDenied(`Route ${breaking.ref} in the proposed set would exceed the new limits.`),
        changedRefs: [proposed.ref],
      }, "No state changed because proposed routes must stay inside the current limits.", command.actor);
    }
    const participant = {
      ...workspace.participant,
      costCaps: caps,
      ...(command.input.focusQuestion !== undefined ? { focusQuestion: command.input.focusQuestion } : {}),
    };
    if (JSON.stringify(participant) === JSON.stringify(workspace.participant)) {
      return failure(workspace, policyDenied("The limits are already recorded exactly like this."),
        "No state changed because no-op limit updates do not create receipts.", command.actor);
    }
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at, [workspace.id], "APPLIED");
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      participant,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { participant },
      "The participant limits are recorded. Every proposal must now stay inside them.");
  }

  private async proposeRouteSet(
    workspace: Workspace,
    command: Authorized<ProposeRouteSetCommand>,
  ): Promise<CommandResult> {
    const input = command.input;
    const proposed = workspace.routeProposalSets.find((set) => set.status === "proposed");
    const open = openFollowUp(workspace);

    if (input.outcome === "insufficient_signal") {
      if (command.actor !== "agent") {
        return failure(workspace, policyDenied("Only an agent can ask a follow-up question."),
          "No state changed because the participant supplies words directly.", command.actor);
      }
      const badRef = input.reasonRefs.find((ref) =>
        !workspace.reflections.some((reflection) => reflection.ref === ref && reflection.status === "confirmed"));
      if (badRef) {
        return failure(workspace, unknownOrUnconfirmedRef(badRef),
          "No state changed because insufficient-signal reasons must cite confirmed reflections.", command.actor);
      }
      if (proposed) {
        return failure(workspace, {
          ...lifecycleError(proposed.ref, "proposed"),
          what: `Route set ${proposed.ref} is still waiting for the participant; a follow-up question cannot be asked now.`,
          changedRefs: [proposed.ref],
        }, "No state changed because a proposed route set must be resolved first.", command.actor);
      }
      if (open) {
        return failure(workspace, {
          ...lifecycleError(open.ref, "proposed"),
          what: `Follow-up ${open.ref} is still open; wait for the participant to answer or skip it.`,
          changedRefs: [open.ref],
        }, "No state changed because only one follow-up question may be open.", command.actor);
      }
      const afterVersion = workspace.stateVersion + 1;
      const at = this.environment.now();
      const ref = nextAvailableRef(workspace, "question", afterVersion);
      const followUp: FollowUpQuestion = {
        id: this.environment.createId(),
        ref,
        availableActions: followUpActions(ref),
        status: "proposed",
        question: input.followUpQuestion,
        reasonRefs: input.reasonRefs,
        askedBy: command.proposalSource === "embedded_inference" ? "embedded_inference" : "chatgpt_webmcp",
        createdAt: at,
      };
      const operation = operationFor(workspace, command, afterVersion, at, [followUp.ref], "PROPOSED");
      const next = workspaceSchema.parse({
        ...workspace,
        stateVersion: afterVersion,
        followUpQuestions: [...workspace.followUpQuestions, followUp],
        operations: [...workspace.operations, operation],
      });
      return this.commit(workspace, command, next, operation, { outcome: "insufficient_signal", followUp },
        "The follow-up question is visible to the participant. Reread after they answer or skip it; do not propose routes until then.");
    }

    const predecessor = workspace.routeProposalSets.at(-1);
    if (predecessor && input.supersedesRouteSetRef !== predecessor.ref) {
      return failure(workspace, {
        code: "WRONG_LIFECYCLE",
        what: `Route set ${predecessor.ref} is the latest proposal history and must be cited as supersedesRouteSetRef.`,
        retry: "NEVER",
        insteadDo: "Do not repeat this request. Cite the latest route set in a new command with a new operationId.",
        changedRefs: [predecessor.ref],
      }, "No state changed because route-set lineage must remain explicit.", command.actor);
    }

    let supersededIndex = -1;
    let liveSupersession: RouteProposalSet | undefined;
    if (input.supersedesRouteSetRef) {
      const predecessorIndex = workspace.routeProposalSets.findIndex(
        (set) => set.ref === input.supersedesRouteSetRef,
      );
      const superseded = workspace.routeProposalSets[predecessorIndex];
      if (!superseded) {
        return failure(workspace, unknownRef(input.supersedesRouteSetRef),
          "No state changed because the superseded set is not in this workspace.", command.actor);
      }
      if (superseded.status !== "proposed" && superseded.status !== "resolved") {
        return failure(workspace, lifecycleError(superseded.ref, superseded.status),
          "No state changed because this historical set cannot be a direct predecessor.", command.actor);
      }
      if (superseded.status === "proposed") {
        supersededIndex = predecessorIndex;
        liveSupersession = superseded;
      }
    }

    const carries = input.routes.filter((slot): slot is { carryRouteRef: string } => "carryRouteRef" in slot);
    const fresh = input.routes.filter((slot): slot is RouteProposalInput => !("carryRouteRef" in slot));
    if (liveSupersession) {
      const kept = liveSupersession.routes.filter((route) => route.status !== "rejected");
      const rejected = liveSupersession.routes.filter((route) => route.status === "rejected");
      if (rejected.length === 0) {
        return failure(workspace, {
          ...policyDenied(`Route set ${liveSupersession.ref} still has three live routes; the participant must edit, set aside, or choose before any replacement.`),
          changedRefs: [liveSupersession.ref],
        }, "No state changed because the participant has not set any route aside.", command.actor);
      }
      const keptRefs = kept.map((route) => route.ref);
      const carriedRefs = carries.map((carry) => carry.carryRouteRef);
      const missingCarry = keptRefs.find((ref) => !carriedRefs.includes(ref));
      if (missingCarry) {
        return failure(workspace, {
          ...policyDenied(`Route ${missingCarry} was kept by the participant and must be carried over unchanged with carryRouteRef.`),
          changedRefs: keptRefs,
        }, "No state changed because only routes the participant set aside may be replaced.", command.actor);
      }
      const badCarry = carriedRefs.find((ref) => !keptRefs.includes(ref));
      if (badCarry) {
        return failure(workspace, {
          ...policyDenied(`Route ${badCarry} cannot be carried: it is not a kept route of ${liveSupersession.ref}.`),
          changedRefs: [liveSupersession.ref],
        }, "No state changed because carried routes must be kept routes of the superseded set.", command.actor);
      }
      const rejectedKinds = rejected.map((route) => route.kind).sort();
      const freshKinds = fresh.map((route) => route.kind).sort();
      if (JSON.stringify(rejectedKinds) !== JSON.stringify(freshKinds)) {
        return failure(workspace, {
          ...policyDenied(`Replacement routes must cover exactly the set-aside kinds: ${rejectedKinds.join(", ")}.`),
          changedRefs: rejected.map((route) => route.ref),
        }, "No state changed because each set-aside route needs one replacement of the same kind.", command.actor);
      }
    } else if (carries.length > 0) {
      return failure(workspace, policyDenied("carryRouteRef is only valid when replacing set-aside routes of a still-proposed set."),
        "No state changed because there is no live route set to carry routes from.", command.actor);
    }

    const afterVersion = workspace.stateVersion + 1;
    const reserved = fresh.map((route) => route.ref);
    const routes = input.routes.map((slot) => {
      if ("carryRouteRef" in slot) {
        const origin = liveSupersession!.routes.find((route) => route.ref === slot.carryRouteRef)!;
        const ref = nextAvailableRef(workspace, origin.ref, undefined, reserved);
        reserved.push(ref);
        return { ...origin, ref, carriedFromRouteRef: origin.ref };
      }
      return { ...slot, status: "proposed" as const };
    }) as [RoutePreview, RoutePreview, RoutePreview];
    const routeError = validateRoutes(workspace, routes, { allowExistingRefs: false });
    if (routeError) return failure(workspace, routeError, "No state changed because route validation failed.", command.actor);
    const at = this.environment.now();
    const routeSetRef = nextAvailableRef(
      workspace,
      "route-set",
      afterVersion,
      routes.map((route) => route.ref),
    );
    const routeSet: RouteProposalSet = {
      id: this.environment.createId(),
      ref: routeSetRef,
      availableActions: routeSetActions(routeSetRef),
      status: "proposed",
      routes,
        createdBy: command.proposalSource === "participant" || command.proposalSource === "embedded_inference"
          ? command.proposalSource
          : "chatgpt_webmcp",
      createdAt: at,
      ...(input.supersedesRouteSetRef
        ? { supersedesRouteSetRef: input.supersedesRouteSetRef }
        : {}),
    };
    const sets = workspace.routeProposalSets.map((set, index) =>
      index === supersededIndex ? { ...set, status: "superseded" as const, availableActions: [] } : set);
    sets.push(routeSet);
    const withdrawn = open ? { ...open, status: "withdrawn" as const, availableActions: [] } : undefined;
    const changedRefs = [
      ...(withdrawn ? [withdrawn.ref] : []),
      ...(supersededIndex >= 0 && input.supersedesRouteSetRef ? [input.supersedesRouteSetRef] : []),
      routeSet.ref,
    ];
    const operation = operationFor(
      workspace,
      command,
      afterVersion,
      at,
      changedRefs,
      "PROPOSED",
      routes.map((route) => route.ref),
    );
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      followUpQuestions: workspace.followUpQuestions.map((question) =>
        withdrawn && question.ref === withdrawn.ref ? withdrawn : question),
      routeProposalSets: sets,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { outcome: "routes", routeSet },
      liveSupersession
        ? "The set-aside route(s) were replaced and the kept routes carried over. The participant decides next."
        : "Three grounded route previews are visible and await participant revision or choice.");
  }

  private async reviseRouteSet(
    workspace: Workspace,
    command: Authorized<ReviseRouteSetCommand>,
  ): Promise<CommandResult> {
    const index = workspace.routeProposalSets.findIndex((set) => set.ref === command.input.routeSetRef);
    const current = workspace.routeProposalSets[index];
    if (!current) return failure(workspace, unknownRef(command.input.routeSetRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);

    const edits = command.input.edits ?? [];
    const rejectRouteRefs = command.input.rejectRouteRefs ?? [];
    const editRefs = edits.map((edit) => edit.routeRef);
    if (new Set(editRefs).size !== editRefs.length || new Set(rejectRouteRefs).size !== rejectRouteRefs.length) {
      return failure(workspace, policyDenied("Each route may be edited or rejected at most once per command."), "No state changed.", command.actor);
    }
    if (editRefs.some((ref) => rejectRouteRefs.includes(ref))) {
      return failure(workspace, policyDenied("One command cannot both edit and reject the same route."), "No state changed.", command.actor);
    }
    const requested = [...editRefs, ...rejectRouteRefs];
    const missing = requested.find((ref) => !current.routes.some((route) => route.ref === ref));
    if (missing) return failure(workspace, unknownRef(missing), "No state changed.", command.actor);
    const alreadyRejected = rejectRouteRefs.find((ref) =>
      current.routes.some((route) => route.ref === ref && route.status === "rejected"));
    if (alreadyRejected) {
      return failure(workspace, lifecycleError(alreadyRejected, "already rejected"),
        "No state changed because the requested rejection was already authoritative.", command.actor);
    }
    const rejectedEdit = edits.find((edit) =>
      current.routes.some((route) => route.ref === edit.routeRef && route.status === "rejected"));
    if (rejectedEdit) {
      return failure(workspace, policyDenied("Rejected routes cannot be edited."), "No state changed.", command.actor);
    }
    const unchangedEdit = edits.find((edit) => {
      const route = current.routes.find((candidate) => candidate.ref === edit.routeRef);
      return route !== undefined && routeContent(route) === routeContent(applyRouteEdit(route, edit));
    });
    if (unchangedEdit) {
      return failure(workspace, policyDenied(`Edit for ${unchangedEdit.routeRef} does not change route content.`),
        "No state changed because no-op revisions do not create receipts.", command.actor);
    }

    const routes = current.routes.map((route) => {
      const edit = edits.find((candidate) => candidate.routeRef === route.ref);
      const edited = edit ? applyRouteEdit(route, edit) : route;
      return rejectRouteRefs.includes(route.ref)
        ? { ...edited, status: "rejected" as const }
        : edit ? { ...edited, status: "edited" as const } : edited;
    }) as [RoutePreview, RoutePreview, RoutePreview];
    const routeError = validateRoutes(workspace, routes, { allowExistingRefs: true });
    if (routeError) return failure(workspace, routeError, "No state changed because route validation failed.", command.actor);

    const allRejected = routes.every((route) => route.status === "rejected");
    const routeSet: RouteProposalSet = {
      ...current,
      routes,
      status: allRejected ? "resolved" : "proposed",
      availableActions: allRejected ? [] : current.availableActions,
    };
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at, [routeSet.ref], "APPLIED");
    const sets = [...workspace.routeProposalSets];
    sets[index] = routeSet;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      routeProposalSets: sets,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { routeSet },
      allRejected
        ? "All routes were set aside. The set is resolved and no hypothesis was created."
        : "Participant edits and rejections were applied; the route set remains awaiting a choice.");
  }

  private async chooseRoute(
    workspace: Workspace,
    command: Authorized<ChooseRouteCommand>,
  ): Promise<CommandResult> {
    const index = workspace.routeProposalSets.findIndex((set) => set.ref === command.input.routeSetRef);
    const current = workspace.routeProposalSets[index];
    if (!current) return failure(workspace, unknownRef(command.input.routeSetRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    const selectedIndex = current.routes.findIndex((route) => route.ref === command.input.routeRef);
    const selected = current.routes[selectedIndex];
    if (!selected) return failure(workspace, unknownRef(command.input.routeRef), "No state changed.", command.actor);
    if (selected.status === "rejected") return failure(workspace, lifecycleError(selected.ref, selected.status), "No state changed.", command.actor);
    if (command.input.finalEdit && command.input.finalEdit.routeRef !== selected.ref) {
      return failure(workspace, policyDenied("The final edit must target the selected route."), "No state changed.", command.actor);
    }

    const finalSelected = command.input.finalEdit ? applyRouteEdit(selected, command.input.finalEdit) : selected;
    const routes = current.routes.map((route, routeIndex) =>
      routeIndex === selectedIndex ? { ...finalSelected, status: "selected" as const } : route,
    ) as [RoutePreview, RoutePreview, RoutePreview];
    const routeError = validateRoutes(workspace, routes, { allowExistingRefs: true });
    if (routeError) return failure(workspace, routeError, "No state changed because the final route edit was invalid.", command.actor);

    const afterVersion = workspace.stateVersion + 1;
    const hypothesisRef = nextAvailableRef(workspace, "hypothesis", afterVersion);
    const hypothesis: Hypothesis = {
      id: this.environment.createId(),
      ref: hypothesisRef,
      availableActions: [],
      status: "accepted",
      claim: finalSelected.premise,
      originatingRouteSetRef: current.ref,
      originatingRouteRef: finalSelected.ref,
      sourceQuotes: finalSelected.sourceQuotes,
      influenceFlags: Array.from(new Set(command.input.influenceFlags ?? [])),
      confidence: command.input.confidence ?? 0.5,
    };
    const routeSet: RouteProposalSet = {
      ...current,
      routes,
      status: "resolved",
      selectedRouteRef: finalSelected.ref,
      availableActions: [],
    };
    const at = this.environment.now();
    const open = openFollowUp(workspace);
    const withdrawn = open ? { ...open, status: "withdrawn" as const, availableActions: [] } : undefined;
    const operation = operationFor(workspace, command, afterVersion, at,
      [routeSet.ref, hypothesis.ref, ...(withdrawn ? [withdrawn.ref] : [])], "APPLIED");
    const sets = [...workspace.routeProposalSets];
    sets[index] = routeSet;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      phase: "TESTING",
      followUpQuestions: workspace.followUpQuestions.map((question) =>
        withdrawn && question.ref === withdrawn.ref ? withdrawn : question),
      routeProposalSets: sets,
      hypotheses: [...workspace.hypotheses, hypothesis],
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { routeSet, hypothesis },
      "The participant chose one route. One accepted hypothesis and its lineage were recorded atomically.");
  }

  private async compensateRouteSet(
    workspace: Workspace,
    command: Authorized<CompensateRouteSetCommand>,
  ): Promise<CommandResult> {
    const index = workspace.routeProposalSets.findIndex((set) => set.ref === command.input.routeSetRef);
    const current = workspace.routeProposalSets[index];
    if (!current) return failure(workspace, unknownRef(command.input.routeSetRef), "No state changed.", command.actor);
    const targetOperation = workspace.operations.find((operation) =>
      operation.command === "propose_route_set" && operation.changedRefs.at(-1) === current.ref);
    if (!targetOperation) return failure(workspace, unknownRef(command.input.routeSetRef), "No state changed.", command.actor);
    if (targetOperation.command !== "propose_route_set" || targetOperation.effect !== "PROPOSED") {
      return failure(workspace, policyDenied("Only an uncompensated route-set proposal can be compensated here."), "No state changed.", command.actor);
    }
    if (workspace.operations.some((operation) => operation.compensatesOperationRef === targetOperation.operationRef)) {
      return failure(workspace, lifecycleError(targetOperation.operationRef, "already compensated"), "No state changed.", command.actor);
    }
    const laterChange = workspace.operations.find((operation) =>
      operation.afterVersion > targetOperation.afterVersion && operation.changedRefs.includes(current.ref));
    if (current.status !== "proposed" || laterChange) {
      return failure(workspace, policyDenied("A revised, superseded, chosen, or already resolved route set cannot be compensated."), "No state changed.", command.actor);
    }

    const routeSet: RouteProposalSet = { ...current, status: "resolved", availableActions: [] };
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const operation = {
      ...operationFor(workspace, command, afterVersion, at, [routeSet.ref], "COMPENSATED"),
      compensatesOperationRef: targetOperation.operationRef,
    };
    const sets = [...workspace.routeProposalSets];
    sets[index] = routeSet;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      routeProposalSets: sets,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { routeSet },
      "The proposal was resolved by a compensating operation; proposal and receipt history remain intact.");
  }

  private async skipFollowUp(
    workspace: Workspace,
    command: Authorized<SkipFollowUpCommand>,
  ): Promise<CommandResult> {
    const index = workspace.followUpQuestions.findIndex((question) => question.ref === command.input.followUpRef);
    const current = workspace.followUpQuestions[index];
    if (!current) return failure(workspace, unknownRef(command.input.followUpRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    const followUp: FollowUpQuestion = { ...current, status: "skipped", availableActions: [] };
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at, [followUp.ref], "APPLIED");
    const questions = [...workspace.followUpQuestions];
    questions[index] = followUp;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      followUpQuestions: questions,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { followUp },
      "The participant skipped the follow-up question. The agent may propose from the confirmed words as they stand.");
  }

  private async reopenExploring(
    workspace: Workspace,
    command: Authorized<ReopenExploringCommand>,
  ): Promise<CommandResult> {
    const index = workspace.hypotheses.findIndex((hypothesis) => hypothesis.ref === command.input.hypothesisRef);
    const current = workspace.hypotheses[index];
    if (!current) return failure(workspace, unknownRef(command.input.hypothesisRef), "No state changed.", command.actor);
    if (current.status !== "accepted") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    const hypothesis: Hypothesis = { ...current, status: "parked" };
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at, [hypothesis.ref], "APPLIED");
    const hypotheses = [...workspace.hypotheses];
    hypotheses[index] = hypothesis;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      phase: "EXPLORING",
      hypotheses,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { hypothesis },
      "The chosen direction is parked, not erased. The workspace is exploring again and a new proposal must cite the last route set.");
  }

  private async dealCards(workspace: Workspace, command: Authorized<DealCardsCommand>): Promise<CommandResult> {
    if (command.actor !== "agent") return wrongActor(workspace, command);
    if (workspace.deck.dealsUnresolved + command.input.cards.length > 5) {
      return deckDenied(workspace, command, "TRAY_FULL", "The deal tray can hold at most five unresolved cards.",
        "Wait for the participant to swipe or dismiss cards, then reread dealAvailability.", { maximum: 5 });
    }
    const label = command.input.cards.find((card) => looksLikeLabel(card.text));
    if (label) return deckDenied(workspace, command, "CARD_IS_A_LABEL", "A card describes or labels the person instead of showing one moment.",
      "Write one second-person present-tense scene with a concrete detail.", { text: "The thing is broken and nobody knows why. They come and get you." });
    const duelGroups = new Map<number, typeof command.input.cards>();
    for (const card of command.input.cards) {
      if (card.kind === "duel") {
        if (card.pairIndex === undefined) return deckDenied(workspace, command, "DUEL_NEEDS_PAIR", "A duel card requires a paired opposite-pole card in the same deal.", "Send both duel cards with the same pairIndex.", { pairIndex: 0 });
        duelGroups.set(card.pairIndex, [...(duelGroups.get(card.pairIndex) ?? []), card]);
      }
      if (card.kind === "falsification" && (!card.falsifiesTensionRef || !card.expectedGesture)) {
        return deckDenied(workspace, command, "FALSIFICATION_NEEDS_TARGET", "A falsification card requires a tension target and expected gesture.", "Cite the tension and the gesture that would support it.", { expectedGesture: "not_me" });
      }
    }
    for (const group of duelGroups.values()) {
      if (group.length !== 2 || group[0]?.axis !== group[1]?.axis || group[0]?.pole === group[1]?.pole) {
        return deckDenied(workspace, command, "DUEL_NEEDS_PAIR", "Duel cards must be one matched opposite-pole pair on the same axis.", "Send exactly two cards with the same pairIndex and opposite poles.", { pairIndex: 0 });
      }
    }
    const identity = identityFor(command);
    for (const input of command.input.cards.filter((card) => card.kind === "falsification")) {
      const tension = workspace.tensions.find((candidate) => candidate.ref === input.falsifiesTensionRef);
      if (!tension) return failure(workspace, unknownRef(input.falsifiesTensionRef!), "No state changed.", command.actor);
      if (sameAgent(identity, tension.proposedBy)) {
        return deckDenied(workspace, command, "SELF_FALSIFICATION", "The agent that proposed a tension cannot be its skeptic.", "Ask a different source or role to deal the falsification cards.", { role: "skeptic" });
      }
    }
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const dealRef = nextAvailableRef(workspace, "deal", afterVersion);
    const reserved: string[] = [];
    const cards: Card[] = command.input.cards.map((input, index) => {
      const ref = input.ref ?? nextAvailableRef(workspace, `card-${afterVersion}-${index + 1}`, undefined, reserved);
      reserved.push(ref);
      return {
        id: this.environment.createId(), ref, dealRef, availableActions: [], text: input.text,
        axis: input.axis, pole: input.pole, kind: input.kind, status: "dealt", dealtBy: identity, createdAt: at,
        ...(input.reversalOfRef ? { reversalOfRef: input.reversalOfRef } : {}),
        ...(input.falsifiesTensionRef ? { falsifiesTensionRef: input.falsifiesTensionRef } : {}),
        ...(input.expectedGesture ? { expectedGesture: input.expectedGesture } : {}),
        ...(input.reasons ? { reasons: input.reasons } : {}),
      };
    });
    for (const [pairIndex, inputs] of duelGroups.entries()) {
      const indexes = command.input.cards.map((card, index) => card.kind === "duel" && card.pairIndex === pairIndex ? index : -1).filter((index) => index >= 0);
      if (indexes.length === 2) {
        cards[indexes[0]] = { ...cards[indexes[0]], pairWithRef: cards[indexes[1]].ref };
        cards[indexes[1]] = { ...cards[indexes[1]], pairWithRef: cards[indexes[0]].ref };
      }
      void inputs;
    }
    const changedRefs = cards.map((card) => card.ref);
    const operation = operationFor(workspace, command, afterVersion, at, changedRefs, "PROPOSED");
    const next = workspaceSchema.parse({ ...workspace, stateVersion: afterVersion, cards: [...workspace.cards, ...cards], deck: { ...workspace.deck, dealsUnresolved: workspace.deck.dealsUnresolved + cards.length }, operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, { cards, dealRef }, "The cards are visible proposals. Only the participant can swipe them.");
  }

  private async dismissDeal(workspace: Workspace, command: Authorized<DismissDealCommand>): Promise<CommandResult> {
    const targets = workspace.cards.filter((card) => card.dealRef === command.input.dealRef && card.status === "dealt");
    if (targets.length === 0) return failure(workspace, unknownRef(command.input.dealRef), "No unresolved cards were dismissed.", command.actor);
    const refs = new Set(targets.map((card) => card.ref));
    const cards = workspace.cards.map((card) => refs.has(card.ref) ? { ...card, status: "dismissed" as const } : card);
    return this.commitDeckMutation(workspace, command, { cards, changedRefs: [...refs], data: { cards: cards.filter((card) => refs.has(card.ref)) }, guidance: "The participant dismissed this deal. The cards remain in history." });
  }

  private async swipeCard(workspace: Workspace, command: Authorized<SwipeCardCommand>): Promise<CommandResult> {
    if (command.actor !== "participant") return deckDenied(workspace, command, "NO_SWIPE_TOOL", "There is no agent swipe capability.", "Wait for the participant to swipe the visible card.", { actor: "participant" });
    const cardIndex = workspace.cards.findIndex((card) => card.ref === command.input.cardRef);
    const current = workspace.cards[cardIndex];
    if (!current) return failure(workspace, unknownRef(command.input.cardRef), "No state changed.", command.actor);
    if (current.status !== "dealt") return failure(workspace, lifecycleError(current.ref, current.status), "A card can be swiped once.", command.actor);
    if (command.input.tappedReasonIndex !== undefined && !current.reasons?.[command.input.tappedReasonIndex]) {
      return failure(workspace, policyDenied("The selected reason does not exist on this card."), "No state changed.", command.actor);
    }
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const swipeRef = nextAvailableRef(workspace, "swipe", afterVersion);
    let reflection: Workspace["reflections"][number] | undefined;
    const reason = command.input.tappedReasonIndex === undefined ? undefined : current.reasons?.[command.input.tappedReasonIndex];
    if (reason) {
      reflection = { id: this.environment.createId(), ref: nextAvailableRef(workspace, "reflection", afterVersion), availableActions: [], status: "confirmed", text: reason, recordedBy: "participant_tapped", createdAt: at };
    }
    const swipe: Swipe = { id: this.environment.createId(), ref: swipeRef, availableActions: [], cardRef: current.ref, gesture: command.input.gesture, dwell: workspace.deck.dwellTracking ? command.input.dwell : "off", flipped: command.input.flipped, at,
      ...(command.input.tappedReasonIndex !== undefined ? { tappedReasonIndex: command.input.tappedReasonIndex } : {}),
      ...(reflection ? { tappedReasonReflectionRef: reflection.ref } : {}) };
    const card: Card = { ...current, status: "swiped" };
    const cards = [...workspace.cards]; cards[cardIndex] = card;
    let tension: Tension | undefined;
    let tensions = workspace.tensions;
    if (current.kind === "falsification" && current.falsifiesTensionRef && current.expectedGesture) {
      const index = workspace.tensions.findIndex((candidate) => candidate.ref === current.falsifiesTensionRef);
      const existing = workspace.tensions[index];
      if (existing) {
        tension = { ...existing, status: command.input.gesture === current.expectedGesture ? "survived" : "falsified" };
        tensions = [...workspace.tensions]; tensions[index] = tension;
      }
    }
    const changedRefs = [card.ref, swipe.ref, ...(reflection ? [reflection.ref] : []), ...(tension ? [tension.ref] : [])];
    const operation = operationFor(workspace, command, afterVersion, at, changedRefs, "APPLIED");
    const next = workspaceSchema.parse({ ...workspace, stateVersion: afterVersion, cards, swipes: [...workspace.swipes, swipe], tensions, reflections: reflection ? [...workspace.reflections, reflection] : workspace.reflections, deck: { ...workspace.deck, dealsUnresolved: workspace.deck.dealsUnresolved - 1 }, operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, { swipe, card, ...(reflection ? { reflection } : {}), ...(tension ? { tension } : {}) }, tension ? `The participant swipe ${tension.status} the tension.` : "The participant swipe is recorded as the ground truth.");
  }

  private async setDeckSettings(workspace: Workspace, command: Authorized<SetDeckSettingsCommand>): Promise<CommandResult> {
    const deck = { ...workspace.deck, ...(command.input.dwellTracking !== undefined ? { dwellTracking: command.input.dwellTracking } : {}), ...(command.input.consentEmbedded !== undefined ? { consentEmbedded: command.input.consentEmbedded } : {}) };
    if (JSON.stringify(deck) === JSON.stringify(workspace.deck)) return failure(workspace, policyDenied("Those deck settings are already active."), "No state changed.", command.actor);
    return this.commitDeckMutation(workspace, command, { deck, changedRefs: [workspace.id], data: { deck }, guidance: deck.consentEmbedded ? "Embedded roles may receive the bounded swipe projection." : "Embedded roles are off; the fixture deck and visiting agents still work." });
  }

  private async proposeTension(workspace: Workspace, command: Authorized<ProposeTensionCommand>): Promise<CommandResult> {
    if (command.actor !== "agent") return wrongActor(workspace, command);
    if (looksLikeLabel(command.input.claim)) return deckDenied(workspace, command, "CLAIM_IS_A_LABEL", "A tension claim labels the person.", "Name a pull and a counter-pull in plain words.", { claim: "You light up at fixing broken things and go cold at owning them afterwards." });
    const swipes = command.input.evidenceSwipeRefs.map((ref) => workspace.swipes.find((swipe) => swipe.ref === ref));
    if (swipes.some((swipe) => !swipe)) return failure(workspace, unknownRef(command.input.evidenceSwipeRefs[swipes.findIndex((swipe) => !swipe)]!), "No state changed.", command.actor);
    const evidence = swipes as Swipe[];
    if (!hasEvidenceBar(workspace, evidence)) return deckDenied(workspace, command, "TENSION_UNDER_EVIDENCED", "A tension needs three swipes plus a slow swipe or contradiction pair.", "Read more swipes or deal cards on the unresolved axis.", { minimumSwipes: 3 });
    if (workspace.tensions.filter((tension) => tension.status === "proposed").length >= 3) return failure(workspace, policyDenied("Three tensions are already waiting for the participant."), "No state changed.", command.actor);
    const afterVersion = workspace.stateVersion + 1; const at = this.environment.now();
    const ref = nextAvailableRef(workspace, "tension", afterVersion);
    const tension: Tension = { id: this.environment.createId(), ref, availableActions: [], status: "proposed", claim: command.input.claim, axis: command.input.axis, evidenceSwipeRefs: command.input.evidenceSwipeRefs, falsificationCardRefs: [], proposedBy: identityFor(command), createdAt: at };
    const operation = operationFor(workspace, command, afterVersion, at, [ref], "PROPOSED");
    const next = workspaceSchema.parse({ ...workspace, stateVersion: afterVersion, tensions: [...workspace.tensions, tension], operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, { tension }, "The tension is visible with its evidence. The participant must accept, edit, or reject it.");
  }

  private async resolveTension(workspace: Workspace, command: Authorized<ResolveTensionCommand>): Promise<CommandResult> {
    const index = workspace.tensions.findIndex((tension) => tension.ref === command.input.tensionRef); const current = workspace.tensions[index];
    if (!current) return failure(workspace, unknownRef(command.input.tensionRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    if (command.input.resolution === "edit" && (!command.input.claim || looksLikeLabel(command.input.claim))) return deckDenied(workspace, command, "CLAIM_IS_A_LABEL", "An edited tension must be a plain pull and counter-pull, not a label.", "Write both sides in one sentence.", { claim: current.claim });
    const tension: Tension = { ...current, status: command.input.resolution === "accept" ? "accepted" : command.input.resolution === "edit" ? "edited" : "rejected", ...(command.input.resolution === "edit" ? { claim: command.input.claim! } : {}) };
    const tensions = [...workspace.tensions]; tensions[index] = tension;
    return this.commitDeckMutation(workspace, command, { tensions, changedRefs: [tension.ref], data: { tension }, guidance: `The participant ${tension.status} the tension.` });
  }

  private async proposePortrait(workspace: Workspace, command: Authorized<ProposePortraitCommand>): Promise<CommandResult> {
    if (command.actor !== "agent") return wrongActor(workspace, command);
    const unique = [...new Set(command.input.tensionRefs)];
    if (unique.length < 2) return deckDenied(workspace, command, "PORTRAIT_NEEDS_TWO", "A Portrait needs two or three distinct resolved tensions.", "Resolve another grounded tension first.", { minimum: 2 });
    for (const ref of unique) {
      const tension = workspace.tensions.find((candidate) => candidate.ref === ref);
      if (!tension) return failure(workspace, unknownRef(ref), "No state changed.", command.actor);
      if (!["accepted", "edited", "survived"].includes(tension.status)) return deckDenied(workspace, command, "TENSION_NOT_RESOLVED", `Tension ${ref} is not accepted, edited, or survived.`, "Wait for the participant or the falsification result.", { tensionRef: ref });
    }
    const portraits = workspace.portraits.map((portrait) => portrait.status === "proposed" ? { ...portrait, status: "superseded" as const } : portrait);
    const afterVersion = workspace.stateVersion + 1; const at = this.environment.now(); const ref = nextAvailableRef(workspace, "portrait", afterVersion);
    const portrait: Portrait = { id: this.environment.createId(), ref, availableActions: [], status: "proposed", tensionRefs: unique, proposedBy: identityFor(command), createdAt: at };
    const superseded = workspace.portraits.filter((candidate) => candidate.status === "proposed").map((candidate) => candidate.ref);
    const operation = operationFor(workspace, command, afterVersion, at, [...superseded, ref], "PROPOSED");
    const next = workspaceSchema.parse({ ...workspace, stateVersion: afterVersion, portraits: [...portraits, portrait], operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, { portrait }, "The Portrait is visible. Only the participant can keep it or ask for more cards.");
  }

  private async resolvePortrait(workspace: Workspace, command: Authorized<ResolvePortraitCommand>): Promise<CommandResult> {
    const index = workspace.portraits.findIndex((portrait) => portrait.ref === command.input.portraitRef); const current = workspace.portraits[index];
    if (!current) return failure(workspace, unknownRef(command.input.portraitRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    const portrait: Portrait = { ...current, status: command.input.resolution === "accept" ? "accepted" : "rejected" };
    const portraits = [...workspace.portraits]; portraits[index] = portrait;
    return this.commitDeckMutation(workspace, command, { portraits, phase: command.input.resolution === "accept" ? "EXPLORING" : "DECK", changedRefs: [portrait.ref], data: { portrait }, guidance: command.input.resolution === "accept" ? "The participant kept the Portrait. The room is ready for limits and tension-grounded routes." : "The Portrait was rejected; the table stays open for more cards." });
  }

  private async postDealerNote(workspace: Workspace, command: Authorized<PostDealerNoteCommand>): Promise<CommandResult> {
    if (command.actor !== "agent") return wrongActor(workspace, command);
    const afterVersion = workspace.stateVersion + 1; const at = this.environment.now(); const ref = nextAvailableRef(workspace, "note", afterVersion);
    const note: DealerNote = { id: this.environment.createId(), ref, availableActions: [], text: command.input.text, status: "visible", postedBy: identityFor(command), createdAt: at };
    const operation = operationFor(workspace, command, afterVersion, at, [ref], "PROPOSED");
    const next = workspaceSchema.parse({ ...workspace, stateVersion: afterVersion, dealerNotes: [...workspace.dealerNotes, note], operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, { note }, "The note is visible and the participant may dismiss it.");
  }

  private async dismissNote(workspace: Workspace, command: Authorized<DismissNoteCommand>): Promise<CommandResult> {
    const index = workspace.dealerNotes.findIndex((note) => note.ref === command.input.noteRef); const current = workspace.dealerNotes[index];
    if (!current) return failure(workspace, unknownRef(command.input.noteRef), "No state changed.", command.actor);
    const note: DealerNote = { ...current, status: "dismissed" }; const dealerNotes = [...workspace.dealerNotes]; dealerNotes[index] = note;
    return this.commitDeckMutation(workspace, command, { dealerNotes, changedRefs: [note.ref], data: { note }, guidance: "The note was dismissed and remains in the ledger." });
  }

  private async reopenDeck(workspace: Workspace, command: Authorized<ReopenDeckCommand>): Promise<CommandResult> {
    const index = workspace.portraits.findIndex((portrait) => portrait.ref === command.input.portraitRef); const current = workspace.portraits[index];
    if (!current) return failure(workspace, unknownRef(command.input.portraitRef), "No state changed.", command.actor);
    if (current.status !== "accepted") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);
    const portrait: Portrait = { ...current, status: "superseded" }; const portraits = [...workspace.portraits]; portraits[index] = portrait;
    return this.commitDeckMutation(workspace, command, { portraits, phase: "DECK", changedRefs: [portrait.ref], data: { portrait }, guidance: "The Portrait is parked and the Deck is open again." });
  }

  private async commitDeckMutation(
    workspace: Workspace,
    command: AuthorizedCommand,
    change: Partial<Workspace> & { changedRefs: string[]; data: MutationData; guidance: string },
  ): Promise<CommandResult> {
    const afterVersion = workspace.stateVersion + 1; const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at, change.changedRefs, command.actor === "agent" ? "PROPOSED" : "APPLIED");
    const { data, guidance, ...fieldsWithRefs } = change;
    const fields: Partial<Workspace> = { ...fieldsWithRefs };
    delete (fields as Partial<Workspace> & { changedRefs?: string[] }).changedRefs;
    const next = workspaceSchema.parse({ ...workspace, ...fields, stateVersion: afterVersion, operations: [...workspace.operations, operation] });
    return this.commit(workspace, command, next, operation, data, guidance);
  }

  private async commit(
    before: Workspace,
    command: AuthorizedCommand,
    next: Workspace,
    operation: OperationRecord,
    data: MutationData,
    guidance: string,
  ): Promise<CommandResult> {
    try {
      await this.store.save(before.stateVersion, next);
    } catch (error) {
      if (error instanceof WorkspaceStoreError && error.code === "STALE_WRITE") {
        let current: Workspace;
        try {
          current = this.store.load();
        } catch (reloadError) {
          return storageFailure(reloadError, before.stateVersion);
        }
        return replayResult(current, command) ?? staleResult(current, command.input.expectedVersion, command.actor);
      }
      return storageFailure(error, before.stateVersion);
    }
    return {
      ok: true,
      data,
      receipt: publicReceipt(operation),
      nextActions: availableActions(next, command.actor),
      stateVersion: next.stateVersion,
      guidance,
    } as CommandResult;
  }
}

function validateRoutes(
  workspace: Workspace,
  routes: [RoutePreview, RoutePreview, RoutePreview],
  options: { allowExistingRefs: boolean },
): CommandError | null {
  const refs = routes.map((route) => route.ref);
  if (new Set(refs).size !== 3) return policyDenied("Route refs must be unique.");
  const kinds = routes.map((route) => route.kind);
  if (new Set(kinds).size !== 3 || !["closest", "bridge", "probe"].every((kind) => kinds.includes(kind as RoutePreview["kind"]))) {
    return policyDenied("Routes must contain exactly one closest, bridge, and probe preview.");
  }
  if (new Set(routes.map((route) => route.learningQuestion)).size !== 3) {
    return policyDenied("Every route must ask a distinct learning question.");
  }
  if (new Set(routes.map((route) => JSON.stringify(route.test))).size !== 3) {
    return policyDenied("Every route must propose a distinct test.");
  }

  const existingRefs = workspaceRefs(workspace);
  if (!options.allowExistingRefs) {
    const collision = refs.find((ref) => existingRefs.has(ref));
    if (collision) return policyDenied(`Route ref ${collision} is already in use. Choose a new ref for every new route.`);
  }

  for (const route of routes) {
    if (route.sourceQuotes.length === 0 && route.tensionRef === undefined) {
      return { code: "ROUTE_UNGROUNDED", what: `${route.ref} has neither an exact quote nor a tensionRef.`, retry: "NEVER", insteadDo: "Ground the route in a confirmed reflection quote or an accepted, edited, or survived tension.", example: { tensionRef: "tension-12" } };
    }
    if (route.tensionRef !== undefined) {
      const tension = workspace.tensions.find((candidate) => candidate.ref === route.tensionRef);
      if (!tension) return unknownRef(route.tensionRef);
      if (!["accepted", "edited", "survived"].includes(tension.status)) {
        return { code: "TENSION_NOT_RESOLVED", what: `Tension ${route.tensionRef} cannot ground a route while ${tension.status}.`, retry: "NEVER", insteadDo: "Use an accepted, edited, or survived tension.", example: { tensionRef: route.tensionRef } };
      }
    }
    const sourceIdentities = route.sourceQuotes.map((source) =>
      `${source.reflectionRef} ${source.quote}`);
    if (new Set(sourceIdentities).size !== sourceIdentities.length) {
      return policyDenied(`${route.ref} repeats the same quote source.`);
    }
    if (route.test.maximumHours > workspace.participant.costCaps.hoursPerWeek) {
      return policyDenied(`${route.ref} exceeds the recorded weekly time limit of ${workspace.participant.costCaps.hoursPerWeek} hours.`);
    }
    if (route.test.maximumMoney > workspace.participant.costCaps.money ||
      route.test.currency !== workspace.participant.costCaps.currency) {
      return policyDenied(`${route.ref} exceeds or changes the recorded money limit of ${workspace.participant.costCaps.money} ${workspace.participant.costCaps.currency}.`);
    }
    for (const source of route.sourceQuotes) {
      const reflection = workspace.reflections.find((candidate) => candidate.ref === source.reflectionRef);
      if (!reflection) return unknownRef(source.reflectionRef);
      if (reflection.status !== "confirmed" || !reflection.text.includes(source.quote)) {
        return policyDenied(`Quote for ${source.reflectionRef} must be an exact substring of that confirmed reflection.`);
      }
    }
  }
  return null;
}

function applyRouteEdit(route: RoutePreview, edit: RouteEdit): RoutePreview {
  const { routeRef, ...changes } = edit;
  void routeRef;
  return { ...route, ...changes };
}

function operationFor(
  workspace: Workspace,
  command: AuthorizedCommand,
  afterVersion: number,
  at: string,
  changedRefs: string[],
  effect: OperationRecord["effect"],
  prospectiveRefs: string[] = [],
): OperationRecord {
  return {
    operationId: command.input.operationId,
    operationRef: nextAvailableRef(
      workspace,
      "operation",
      afterVersion,
      [...changedRefs, ...prospectiveRefs],
    ),
    actor: command.actor,
    command: command.name,
    effect,
    beforeVersion: workspace.stateVersion,
    afterVersion,
    changedRefs,
    at,
    requestIdentity: commandRequestIdentity(command, command.actor, command.proposalSource),
  };
}

function replayResult(workspace: Workspace, command: AuthorizedCommand): CommandResult | null {
  const existing = workspace.operations.find((operation) => operation.operationId === command.input.operationId);
  if (!existing) return null;
  if (existing.requestIdentity !== commandRequestIdentity(
    command,
    command.actor,
    command.proposalSource,
  )) {
    return failure(workspace, {
      code: "OPERATION_CONFLICT",
      what: "This operationId already belongs to a different command intent.",
      retry: "NEVER",
      insteadDo: "Use a new operationId for the new intended effect.",
      changedRefs: existing.changedRefs,
    }, "The existing operation was preserved and no state changed.", command.actor);
  }

  let data: MutationData | undefined;
  switch (existing.command) {
    case "save_reflection": {
      const reflection = workspace.reflections.find((item) => existing.changedRefs.includes(item.ref));
      const answered = workspace.followUpQuestions.find((item) => existing.changedRefs.includes(item.ref));
      if (reflection) data = answered ? { reflection, answeredFollowUp: answered } : { reflection };
      break;
    }
    case "set_limits": {
      data = { participant: workspace.participant };
      break;
    }
    case "propose_route_set": {
      const target = existing.changedRefs.at(-1);
      const routeSet = workspace.routeProposalSets.find((set) => set.ref === target);
      const followUp = workspace.followUpQuestions.find((question) => question.ref === target);
      if (routeSet) data = { outcome: "routes", routeSet };
      else if (followUp) data = { outcome: "insufficient_signal", followUp };
      break;
    }
    case "revise_route_set":
    case "compensate_route_set": {
      const routeSet = workspace.routeProposalSets.find(
        (set) => set.ref === existing.changedRefs[0],
      );
      if (routeSet) data = { routeSet };
      break;
    }
    case "choose_route": {
      const routeSet = workspace.routeProposalSets.find(
        (set) => set.ref === existing.changedRefs[0],
      );
      const hypothesis = workspace.hypotheses.find(
        (item) => item.ref === existing.changedRefs[1],
      );
      if (routeSet && hypothesis) data = { routeSet, hypothesis };
      break;
    }
    case "skip_follow_up": {
      const followUp = workspace.followUpQuestions.find((item) => item.ref === existing.changedRefs[0]);
      if (followUp) data = { followUp };
      break;
    }
    case "reopen_exploring": {
      const hypothesis = workspace.hypotheses.find((item) => item.ref === existing.changedRefs[0]);
      if (hypothesis) data = { hypothesis };
      break;
    }
    case "deal_cards": {
      const cards = workspace.cards.filter((item) => existing.changedRefs.includes(item.ref));
      if (cards.length) data = { cards, dealRef: cards[0].dealRef };
      break;
    }
    case "dismiss_deal": {
      const cards = workspace.cards.filter((item) => existing.changedRefs.includes(item.ref));
      if (cards.length) data = { cards };
      break;
    }
    case "swipe_card": {
      const card = workspace.cards.find((item) => existing.changedRefs.includes(item.ref));
      const swipe = workspace.swipes.find((item) => existing.changedRefs.includes(item.ref));
      const reflection = workspace.reflections.find((item) => existing.changedRefs.includes(item.ref));
      const tension = workspace.tensions.find((item) => existing.changedRefs.includes(item.ref));
      if (card && swipe) data = { card, swipe, ...(reflection ? { reflection } : {}), ...(tension ? { tension } : {}) };
      break;
    }
    case "set_deck_settings": data = { deck: workspace.deck }; break;
    case "propose_tension":
    case "resolve_tension": {
      const tension = workspace.tensions.find((item) => existing.changedRefs.includes(item.ref));
      if (tension) data = { tension };
      break;
    }
    case "propose_portrait":
    case "resolve_portrait":
    case "reopen_deck": {
      const portrait = workspace.portraits.find((item) => existing.changedRefs.includes(item.ref));
      if (portrait) data = { portrait };
      break;
    }
    case "post_dealer_note":
    case "dismiss_note": {
      const note = workspace.dealerNotes.find((item) => existing.changedRefs.includes(item.ref));
      if (note) data = { note };
      break;
    }
  }
  if (!data) return storageFailure(new WorkspaceStoreError(
    "CORRUPT_WORKSPACE", "The replay receipt no longer points to its changed entities.", workspace.stateVersion,
  ), workspace.stateVersion);
  return {
    ok: true,
    data,
    receipt: publicReceipt(existing),
    nextActions: availableActions(workspace, command.actor),
    stateVersion: workspace.stateVersion,
    guidance: "Replay detected. The original receipt was returned without a new effect.",
  } as CommandResult;
}

function staleResult(workspace: Workspace, expectedVersion: number, actor: Actor): CommandResult {
  const changedRefs = Array.from(new Set(workspace.operations
    .filter((operation) => operation.afterVersion > expectedVersion)
    .flatMap((operation) => operation.changedRefs)));
  return failure(workspace, {
    code: "STALE_STATE",
    what: `Expected workspace version ${expectedVersion}, but current version is ${workspace.stateVersion}.`,
    retry: "REREAD_THEN_NEW_OPERATION",
    insteadDo: "Reread the workspace, reconsider the new state, then use a new operationId.",
    changedRefs,
  }, "No state changed because this command was based on stale state.", actor);
}

function failure(
  workspace: Workspace,
  error: CommandError,
  guidance: string,
  actor: Actor = "agent",
): CommandResult {
  return { ok: false, error, nextActions: availableActions(workspace, actor), stateVersion: workspace.stateVersion, guidance };
}

function storageFailure(error: unknown, stateVersion: number): CommandResult {
  return {
    ok: false,
    error: {
      code: "STORAGE_FAILURE",
      what: error instanceof Error ? error.message : "The workspace could not be read or written.",
      retry: "SAME_OPERATION_ID",
      insteadDo: "Preserve the current data and retry only after storage is available.",
    },
    nextActions: [],
    stateVersion,
    guidance: "Storage did not confirm a new authoritative state.",
  };
}

function wrongActor(workspace: Workspace, command: AuthorizedCommand): CommandResult {
  return failure(workspace, {
    code: "WRONG_ACTOR",
    what: `${command.name} is participant-only.`,
    retry: "NEVER",
    insteadDo: "Do not repeat this request. Tell the participant what is waiting for them in the Route Room and reread after they act.",
  }, "No state changed because the participant-only boundary denied this command.", command.actor);
}

function unknownRef(ref: string): CommandError {
  return { code: "UNKNOWN_REF", what: `Ref ${ref} does not belong to this workspace.`, retry: "NEVER", insteadDo: "Do not repeat this request. Reread current workspace refs, then submit a new command with a new operationId." };
}

function unknownOrUnconfirmedRef(ref: string): CommandError {
  return { code: "UNKNOWN_REF", what: `Ref ${ref} is missing or is not participant-confirmed.`, retry: "NEVER", insteadDo: "Do not repeat this request. Use a confirmed reflection ref in a new command with a new operationId." };
}

function lifecycleError(ref: string, status: string): CommandError {
  return { code: "WRONG_LIFECYCLE", what: `${ref} has lifecycle status ${status}.`, retry: "NEVER", insteadDo: "Do not repeat this request. Reread the entity and submit an available action as a new command with a new operationId." };
}

function policyDenied(what: string): CommandError {
  return { code: "POLICY_DENIED", what, retry: "NEVER", insteadDo: "Do not repeat this request. Correct the proposal without loosening workspace policy, then submit a new command with a new operationId." };
}

function nextAvailableRef(
  workspace: Workspace,
  prefix: string,
  afterVersion: number | undefined,
  reserved: string[] = [],
): string {
  const used = workspaceRefs(workspace);
  for (const ref of reserved) used.add(ref);
  const base = afterVersion === undefined ? prefix : `${prefix}-${afterVersion}`;
  if (afterVersion !== undefined && !used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = afterVersion === undefined ? `${base}-v${suffix}` : `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function workspaceRefs(workspace: Workspace): Set<string> {
  return new Set([
    workspace.id,
    ...workspace.reflections.map((reflection) => reflection.ref),
    ...workspace.followUpQuestions.map((question) => question.ref),
    ...workspace.routeProposalSets.map((set) => set.ref),
    ...workspace.routeProposalSets.flatMap((set) => set.routes.map((route) => route.ref)),
    ...workspace.hypotheses.map((hypothesis) => hypothesis.ref),
    ...workspace.cards.map((card) => card.ref),
    ...workspace.swipes.map((swipe) => swipe.ref),
    ...workspace.tensions.map((tension) => tension.ref),
    ...workspace.portraits.map((portrait) => portrait.ref),
    ...workspace.dealerNotes.map((note) => note.ref),
    ...workspace.operations.map((operation) => operation.operationRef),
  ]);
}

function isExecutionContext(context: unknown): context is CommandExecutionContext {
  if (typeof context !== "object" || context === null) return false;
  if (!("actor" in context) || !("proposalSource" in context)) return false;
  return context.actor === "participant"
    ? context.proposalSource === "participant"
    : context.actor === "agent" &&
        (context.proposalSource === "chatgpt_webmcp" ||
          context.proposalSource === "gemini_webmcp" ||
          context.proposalSource === "other_webmcp" ||
          context.proposalSource === "fixture" ||
          context.proposalSource === "embedded_inference");
}

function phaseAllows(workspace: Workspace, command: AuthorizedCommand): boolean {
  if (command.name === "set_deck_settings" || command.name === "post_dealer_note" || command.name === "dismiss_note") return true;
  if (command.name === "reopen_exploring") return workspace.phase === "TESTING";
  if (command.name === "reopen_deck") return workspace.phase === "EXPLORING";
  if (["deal_cards", "dismiss_deal", "swipe_card", "propose_tension", "resolve_tension", "propose_portrait", "resolve_portrait"].includes(command.name)) {
    return workspace.phase === "DECK" || ((command.name === "deal_cards" || command.name === "swipe_card") && workspace.phase === "TESTING");
  }
  return workspace.phase === "EXPLORING";
}

function identityFor(command: AuthorizedCommand): AgentIdentity {
  if (command.actor === "agent" && command.agentIdentity) return command.agentIdentity;
  const source = command.actor === "agent" ? command.proposalSource : "fixture";
  const role = "input" in command && "role" in command.input && command.input.role ? command.input.role : "unspecified";
  return { source, role, label: source === "embedded_inference" ? "Embedded role" : source === "fixture" ? "Fixture dealer" : "Visiting agent" };
}

function sameAgent(left: AgentIdentity, right: AgentIdentity): boolean {
  return left.source === right.source && left.role === right.role;
}

const LABEL_PATTERNS = [
  /\byou are\b/i, /\byou're a\b/i, /\b(intj|enfp|istp|infj|entp|esfj|isfp|estj)\b/i,
  /\b(manager|engineer|designer|nurse|teacher|founder|analyst|consultant|developer|lawyer|doctor|marketer|accountant)\b/i,
  /\b(introvert|extrovert|perfectionist|leader|creative|analytical|empath)\b/i,
  /\bshould\b/i, /\bcareer\b/i,
];

function looksLikeLabel(text: string): boolean {
  return LABEL_PATTERNS.some((pattern) => pattern.test(text));
}

function hasEvidenceBar(workspace: Workspace, swipes: Swipe[]): boolean {
  if (swipes.length < 3) return false;
  if (swipes.some((swipe) => swipe.dwell === "slow")) return true;
  for (let leftIndex = 0; leftIndex < swipes.length; leftIndex += 1) {
    const left = swipes[leftIndex]; const leftCard = workspace.cards.find((card) => card.ref === left.cardRef);
    if (!leftCard) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < swipes.length; rightIndex += 1) {
      const right = swipes[rightIndex]; const rightCard = workspace.cards.find((card) => card.ref === right.cardRef);
      if (!rightCard || leftCard.axis !== rightCard.axis || leftCard.pole === rightCard.pole) continue;
      if ((left.gesture === "me" && right.gesture === "me") ||
          (left.gesture === "me" && right.gesture === "wish") ||
          (left.gesture === "wish" && right.gesture === "me")) return true;
    }
  }
  return false;
}

function deckDenied(
  workspace: Workspace,
  command: AuthorizedCommand,
  code: CommandError["code"],
  what: string,
  insteadDo: string,
  example: unknown,
): CommandResult {
  return failure(workspace, { code, what, retry: "NEVER", insteadDo, example }, "No state changed because the Deck contract denied the command.", command.actor);
}
