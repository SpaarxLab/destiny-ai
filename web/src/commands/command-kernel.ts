import {
  commandRequestIdentity,
  commandSchema,
  type ChooseRouteCommand,
  type Command,
  type CompensateRouteSetCommand,
  type ProposeRouteSetCommand,
  type ReviseRouteSetCommand,
  type RouteEdit,
  type SaveReflectionCommand,
} from "../domain/commands";
import { availableActions, routeSetActions } from "../domain/affordances";
import type {
  ChooseRouteResult,
  CommandError,
  CommandResult,
  CompensateRouteSetResult,
  ProposeRouteSetResult,
  ReviseRouteSetResult,
  SaveReflectionResult,
} from "../domain/results";
import {
  publicReceipt,
  workspaceSchema,
  type Hypothesis,
  type OperationRecord,
  type RoutePreview,
  type RouteProposalSet,
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

export class CommandKernel {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly environment: CommandEnvironment = defaultEnvironment,
  ) {}

  async execute(commandInput: SaveReflectionCommand): Promise<SaveReflectionResult>;
  async execute(commandInput: ProposeRouteSetCommand): Promise<ProposeRouteSetResult>;
  async execute(commandInput: ReviseRouteSetCommand): Promise<ReviseRouteSetResult>;
  async execute(commandInput: ChooseRouteCommand): Promise<ChooseRouteResult>;
  async execute(commandInput: CompensateRouteSetCommand): Promise<CompensateRouteSetResult>;
  async execute(commandInput: unknown): Promise<CommandResult>;
  async execute(commandInput: unknown): Promise<CommandResult> {
    let workspace: Workspace;
    try {
      workspace = this.store.load();
    } catch (error) {
      return storageFailure(error, 0);
    }

    const parsed = commandSchema.safeParse(commandInput);
    if (!parsed.success) {
      return failure(workspace, {
        code: "MALFORMED_INPUT",
        what: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "command"}: ${issue.message}`)
          .join("; "),
        retry: "NEVER",
        insteadDo: "Correct the input against the declared command schema.",
      }, "No state changed. Correct the command before trying again.");
    }

    const command = parsed.data;
    const replay = replayResult(workspace, command);
    if (replay) return replay;

    if (command.input.expectedVersion !== workspace.stateVersion) {
      return staleResult(workspace, command.input.expectedVersion, command.actor);
    }
    if (workspace.phase !== "EXPLORING") {
      return failure(workspace, {
        code: "WRONG_PHASE",
        what: `${command.name} is unavailable in ${workspace.phase}.`,
        retry: "NEVER",
        insteadDo: "Use an action declared for the current phase.",
      }, "No state changed because the live phase denied this command.", command.actor);
    }

    switch (command.name) {
      case "save_reflection":
        return this.saveReflection(workspace, command);
      case "propose_route_set":
        return this.proposeRouteSet(workspace, command);
      case "revise_route_set":
        return this.reviseRouteSet(workspace, command);
      case "choose_route":
        return this.chooseRoute(workspace, command);
      case "compensate_route_set":
        return this.compensateRouteSet(workspace, command);
    }
  }

  private async saveReflection(
    workspace: Workspace,
    command: SaveReflectionCommand,
  ): Promise<CommandResult> {
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const reflection = {
      id: this.environment.createId(),
      ref: `reflection-${afterVersion}`,
      availableActions: [],
      status: command.actor === "participant" ? "confirmed" as const : "proposed" as const,
      text: command.input.text,
      recordedBy: command.actor === "participant" ? "participant" as const : "agent_transcribed" as const,
      createdAt: at,
    };
    const operation = operationFor(workspace, command, afterVersion, at, [reflection.ref],
      command.actor === "participant" ? "APPLIED" : "PROPOSED");
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      reflections: [...workspace.reflections, reflection],
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { reflection },
      command.actor === "participant"
        ? "The participant reflection is confirmed and visible in the workspace."
        : "The agent transcription is a visible proposal awaiting participant review.");
  }

  private async proposeRouteSet(
    workspace: Workspace,
    command: ProposeRouteSetCommand,
  ): Promise<CommandResult> {
    const input = command.input;
    if (input.outcome === "insufficient_signal") {
      const badRef = input.reasonRefs.find((ref) =>
        !workspace.reflections.some((reflection) => reflection.ref === ref && reflection.status === "confirmed"));
      if (badRef) {
        return failure(workspace, unknownOrUnconfirmedRef(badRef),
          "No state changed because insufficient-signal reasons must cite confirmed reflections.", command.actor);
      }
      return {
        ok: false,
        data: {
          outcome: "insufficient_signal",
          followUpQuestion: input.followUpQuestion,
          reasonRefs: input.reasonRefs,
        },
        error: {
          code: "INSUFFICIENT_SIGNAL",
          what: "Three structurally grounded routes were not supplied.",
          retry: "NEVER",
          insteadDo: "Ask the focused follow-up question, confirm the answer, then use a new operationId.",
        },
        nextActions: availableActions(workspace, command.actor),
        stateVersion: workspace.stateVersion,
        guidance: "INSUFFICIENT_SIGNAL returned without a workspace mutation or receipt.",
      };
    }

    const authorError = validateProposalAuthor(command);
    if (authorError) return failure(workspace, authorError, "No state changed because proposal authorship was invalid.", command.actor);

    const activeSet = workspace.routeProposalSets.find((set) => set.status === "proposed");
    if (activeSet && input.supersedesRouteSetRef !== activeSet.ref) {
      return failure(workspace, {
        code: "WRONG_LIFECYCLE",
        what: `Route set ${activeSet.ref} is already awaiting participant action.`,
        retry: "NEVER",
        insteadDo: "Revise, choose, compensate, or explicitly supersede the active set.",
        changedRefs: [activeSet.ref],
      }, "No state changed because only one route set may be active.", command.actor);
    }

    let supersededIndex = -1;
    if (input.supersedesRouteSetRef) {
      supersededIndex = workspace.routeProposalSets.findIndex(
        (set) => set.ref === input.supersedesRouteSetRef,
      );
      const superseded = workspace.routeProposalSets[supersededIndex];
      if (!superseded) {
        return failure(workspace, unknownRef(input.supersedesRouteSetRef),
          "No state changed because the superseded set is not in this workspace.", command.actor);
      }
      if (superseded.status !== "proposed") {
        return failure(workspace, lifecycleError(superseded.ref, superseded.status),
          "No state changed because only an active proposal can be superseded.", command.actor);
      }
    }

    const afterVersion = workspace.stateVersion + 1;
    const routes = input.routes.map((route) => ({ ...route, status: "proposed" as const })) as [RoutePreview, RoutePreview, RoutePreview];
    const routeError = validateRoutes(workspace, routes, { allowExistingRefs: false });
    if (routeError) return failure(workspace, routeError, "No state changed because route validation failed.", command.actor);
    if (routes.some((route) => route.ref === `route-set-${afterVersion}`)) {
      return failure(workspace, policyDenied("A route ref cannot collide with its generated route-set ref."), "No state changed.", command.actor);
    }

    const at = this.environment.now();
    const routeSetRef = `route-set-${afterVersion}`;
    const routeSet: RouteProposalSet = {
      id: this.environment.createId(),
      ref: routeSetRef,
      availableActions: routeSetActions(routeSetRef),
      status: "proposed",
      routes,
      createdBy: input.createdBy,
      createdAt: at,
      ...(input.supersedesRouteSetRef
        ? { supersedesRouteSetRef: input.supersedesRouteSetRef }
        : {}),
    };
    const sets = workspace.routeProposalSets.map((set, index) =>
      index === supersededIndex ? { ...set, status: "superseded" as const, availableActions: [] } : set);
    sets.push(routeSet);
    const changedRefs = input.supersedesRouteSetRef
      ? [input.supersedesRouteSetRef, routeSet.ref]
      : [routeSet.ref];
    const operation = operationFor(workspace, command, afterVersion, at, changedRefs, "PROPOSED");
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      routeProposalSets: sets,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { outcome: "routes", routeSet },
      "Three grounded route previews are visible and await participant revision or choice.");
  }

  private async reviseRouteSet(
    workspace: Workspace,
    command: ReviseRouteSetCommand,
  ): Promise<CommandResult> {
    if (command.actor !== "participant") return wrongActor(workspace, command);
    const index = workspace.routeProposalSets.findIndex((set) => set.ref === command.input.routeSetRef);
    const current = workspace.routeProposalSets[index];
    if (!current) return failure(workspace, unknownRef(command.input.routeSetRef), "No state changed.", command.actor);
    if (current.status !== "proposed") return failure(workspace, lifecycleError(current.ref, current.status), "No state changed.", command.actor);

    const editRefs = command.input.edits.map((edit) => edit.routeRef);
    if (new Set(editRefs).size !== editRefs.length || new Set(command.input.rejectRouteRefs).size !== command.input.rejectRouteRefs.length) {
      return failure(workspace, policyDenied("Each route may be edited or rejected at most once per command."), "No state changed.", command.actor);
    }
    if (editRefs.some((ref) => command.input.rejectRouteRefs.includes(ref))) {
      return failure(workspace, policyDenied("One command cannot both edit and reject the same route."), "No state changed.", command.actor);
    }
    const requested = [...editRefs, ...command.input.rejectRouteRefs];
    const missing = requested.find((ref) => !current.routes.some((route) => route.ref === ref));
    if (missing) return failure(workspace, unknownRef(missing), "No state changed.", command.actor);

    const routes = current.routes.map((route) => {
      const edit = command.input.edits.find((candidate) => candidate.routeRef === route.ref);
      if (route.status === "rejected" && edit) return route;
      const edited = edit ? applyRouteEdit(route, edit) : route;
      return command.input.rejectRouteRefs.includes(route.ref)
        ? { ...edited, status: "rejected" as const }
        : edit ? { ...edited, status: "edited" as const } : edited;
    }) as [RoutePreview, RoutePreview, RoutePreview];
    if (command.input.edits.some((edit) => current.routes.find((route) => route.ref === edit.routeRef)?.status === "rejected")) {
      return failure(workspace, policyDenied("Rejected routes cannot be edited."), "No state changed.", command.actor);
    }
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
        ? "All routes were rejected. The set is resolved and no hypothesis was created."
        : "Participant edits and rejections were applied; the route set remains awaiting a choice.");
  }

  private async chooseRoute(
    workspace: Workspace,
    command: ChooseRouteCommand,
  ): Promise<CommandResult> {
    if (command.actor !== "participant") return wrongActor(workspace, command);
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
    const hypothesisRef = `hypothesis-${afterVersion}`;
    if (workspace.routeProposalSets.some((set) => set.routes.some((route) => route.ref === hypothesisRef))) {
      return failure(workspace, policyDenied("The generated hypothesis ref collides with an existing route ref."), "No state changed.", command.actor);
    }
    const hypothesis: Hypothesis = {
      id: this.environment.createId(),
      ref: hypothesisRef,
      availableActions: [],
      status: "accepted",
      claim: finalSelected.premise,
      originatingRouteSetRef: current.ref,
      originatingRouteRef: finalSelected.ref,
      sourceQuotes: finalSelected.sourceQuotes,
      influenceFlags: Array.from(new Set(command.input.influenceFlags)),
      confidence: command.input.confidence,
    };
    const routeSet: RouteProposalSet = {
      ...current,
      routes,
      status: "resolved",
      selectedRouteRef: finalSelected.ref,
      availableActions: [],
    };
    const at = this.environment.now();
    const operation = operationFor(workspace, command, afterVersion, at,
      [routeSet.ref, hypothesis.ref], "APPLIED");
    const sets = [...workspace.routeProposalSets];
    sets[index] = routeSet;
    const next = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      phase: "TESTING",
      routeProposalSets: sets,
      hypotheses: [...workspace.hypotheses, hypothesis],
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { routeSet, hypothesis },
      "The participant chose one route. One accepted hypothesis and its lineage were recorded atomically.");
  }

  private async compensateRouteSet(
    workspace: Workspace,
    command: CompensateRouteSetCommand,
  ): Promise<CommandResult> {
    if (command.actor !== "participant") return wrongActor(workspace, command);
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

  private async commit(
    before: Workspace,
    command: Command,
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

function validateProposalAuthor(command: ProposeRouteSetCommand): CommandError | null {
  if (command.input.outcome !== "routes") return null;
  const valid = command.actor === "participant"
    ? command.input.createdBy === "participant"
    : command.input.createdBy !== "participant";
  return valid ? null : {
    code: "WRONG_ACTOR",
    what: `${command.actor} cannot claim createdBy ${command.input.createdBy}.`,
    retry: "NEVER",
    insteadDo: "Use the proposal source that matches the authenticated command actor.",
  };
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

  const existingRefs = new Set([
    ...workspace.reflections.map((reflection) => reflection.ref),
    ...workspace.routeProposalSets.map((set) => set.ref),
    ...workspace.routeProposalSets.flatMap((set) => set.routes.map((route) => route.ref)),
    ...workspace.hypotheses.map((hypothesis) => hypothesis.ref),
  ]);
  if (!options.allowExistingRefs) {
    const collision = refs.find((ref) => existingRefs.has(ref));
    if (collision) return policyDenied(`Route ref ${collision} is already in use.`);
  }

  for (const route of routes) {
    const sourceIdentities = route.sourceQuotes.map((source) =>
      `${source.reflectionRef}\u0000${source.quote}`);
    if (new Set(sourceIdentities).size !== sourceIdentities.length) {
      return policyDenied(`${route.ref} repeats the same quote source.`);
    }
    if (route.test.maximumHours > workspace.participant.costCaps.hoursPerWeek) {
      return policyDenied(`${route.ref} exceeds the recorded weekly time cap.`);
    }
    if (route.test.maximumMoney > workspace.participant.costCaps.money ||
      route.test.currency !== workspace.participant.costCaps.currency) {
      return policyDenied(`${route.ref} exceeds or changes the recorded money cap.`);
    }
    for (const source of route.sourceQuotes) {
      const reflection = workspace.reflections.find((candidate) => candidate.ref === source.reflectionRef);
      if (!reflection) return unknownRef(source.reflectionRef);
      if (reflection.status !== "confirmed" || !reflection.text.includes(source.quote)) {
        return policyDenied(`Quote for ${source.reflectionRef} must be an exact substring of a confirmed reflection.`);
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
  command: Command,
  afterVersion: number,
  at: string,
  changedRefs: string[],
  effect: OperationRecord["effect"],
): OperationRecord {
  return {
    operationId: command.input.operationId,
    operationRef: `operation-${afterVersion}`,
    actor: command.actor,
    command: command.name,
    effect,
    beforeVersion: workspace.stateVersion,
    afterVersion,
    changedRefs,
    at,
    requestIdentity: commandRequestIdentity(command),
  };
}

function replayResult(workspace: Workspace, command: Command): CommandResult | null {
  const existing = workspace.operations.find((operation) => operation.operationId === command.input.operationId);
  if (!existing) return null;
  if (existing.requestIdentity !== commandRequestIdentity(command)) {
    return failure(workspace, {
      code: "OPERATION_CONFLICT",
      what: "This operationId already belongs to a different command intent.",
      retry: "NEVER",
      insteadDo: "Use a new operationId for the new intended effect.",
      changedRefs: existing.changedRefs,
    }, "The existing operation was preserved and no state changed.", command.actor);
  }

  const routeSet = workspace.routeProposalSets.find((set) => existing.changedRefs.includes(set.ref));
  const hypothesis = workspace.hypotheses.find((item) => existing.changedRefs.includes(item.ref));
  let data: MutationData | undefined;
  switch (existing.command) {
    case "save_reflection": {
      const reflection = workspace.reflections.find((item) => existing.changedRefs.includes(item.ref));
      if (reflection) data = { reflection };
      break;
    }
    case "propose_route_set":
      if (routeSet) data = { outcome: "routes", routeSet };
      break;
    case "revise_route_set":
    case "compensate_route_set":
      if (routeSet) data = { routeSet };
      break;
    case "choose_route":
      if (routeSet && hypothesis) data = { routeSet, hypothesis };
      break;
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

function staleResult(workspace: Workspace, expectedVersion: number, actor: Command["actor"]): CommandResult {
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
  actor: Command["actor"] = "agent",
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

function wrongActor(workspace: Workspace, command: Command): CommandResult {
  return failure(workspace, {
    code: "WRONG_ACTOR",
    what: `${command.name} is participant-only.`,
    retry: "NEVER",
    insteadDo: "Prepare the visible interaction and let the participant decide.",
  }, "No state changed because the participant-only boundary denied this command.", command.actor);
}

function unknownRef(ref: string): CommandError {
  return { code: "UNKNOWN_REF", what: `Ref ${ref} does not belong to this workspace.`, retry: "NEVER", insteadDo: "Reread current workspace refs." };
}

function unknownOrUnconfirmedRef(ref: string): CommandError {
  return { code: "UNKNOWN_REF", what: `Ref ${ref} is missing or is not participant-confirmed.`, retry: "NEVER", insteadDo: "Use a confirmed reflection ref." };
}

function lifecycleError(ref: string, status: string): CommandError {
  return { code: "WRONG_LIFECYCLE", what: `${ref} has lifecycle status ${status}.`, retry: "NEVER", insteadDo: "Reread the entity and use an available action." };
}

function policyDenied(what: string): CommandError {
  return { code: "POLICY_DENIED", what, retry: "NEVER", insteadDo: "Correct the proposal without loosening workspace policy." };
}
