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
  type Actor,
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
export type CommandExecutionContext =
  | { actor: "participant"; proposalSource: "participant" }
  | { actor: "agent"; proposalSource: "chatgpt_webmcp" | "embedded_inference" };

type Authorized<T extends Command = Command> = T & CommandExecutionContext;
type AuthorizedCommand = Authorized<Command>;

export class CommandKernel {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly environment: CommandEnvironment = defaultEnvironment,
  ) {}

  async execute(context: CommandExecutionContext, commandInput: SaveReflectionCommand): Promise<SaveReflectionResult>;
  async execute(context: CommandExecutionContext, commandInput: ProposeRouteSetCommand): Promise<ProposeRouteSetResult>;
  async execute(context: CommandExecutionContext, commandInput: ReviseRouteSetCommand): Promise<ReviseRouteSetResult>;
  async execute(context: CommandExecutionContext, commandInput: ChooseRouteCommand): Promise<ChooseRouteResult>;
  async execute(context: CommandExecutionContext, commandInput: CompensateRouteSetCommand): Promise<CompensateRouteSetResult>;
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
    if (workspace.phase !== "EXPLORING") {
      return failure(workspace, {
        code: "WRONG_PHASE",
        what: `${command.name} is unavailable in ${workspace.phase}.`,
        retry: "NEVER",
        insteadDo: "Do not repeat this request. Submit an action declared for the current phase as a new command with a new operationId.",
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
    command: Authorized<SaveReflectionCommand>,
  ): Promise<CommandResult> {
    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const reflectionRef = nextAvailableRef(workspace, "reflection", afterVersion);
    const reflection = {
      id: this.environment.createId(),
      ref: reflectionRef,
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
    command: Authorized<ProposeRouteSetCommand>,
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
        ok: true,
        data: {
          outcome: "insufficient_signal",
          followUpQuestion: input.followUpQuestion,
          reasonRefs: input.reasonRefs,
        },
        nextActions: availableActions(workspace, command.actor),
        stateVersion: workspace.stateVersion,
        guidance: "INSUFFICIENT_SIGNAL returned without a workspace mutation or receipt.",
      };
    }

    const predecessor = workspace.routeProposalSets.at(-1);
    if (predecessor && input.supersedesRouteSetRef !== predecessor.ref) {
      return failure(workspace, {
        code: "WRONG_LIFECYCLE",
        what: `Route set ${predecessor.ref} is the latest proposal history and must be cited as predecessor.`,
        retry: "NEVER",
        insteadDo: "Do not repeat this request. Cite the latest route set in a new command with a new operationId.",
        changedRefs: [predecessor.ref],
      }, "No state changed because route-set lineage must remain explicit.", command.actor);
    }

    let supersededIndex = -1;
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
      supersededIndex = superseded.status === "proposed" ? predecessorIndex : -1;
    }

    const afterVersion = workspace.stateVersion + 1;
    const routes = input.routes.map((route) => ({ ...route, status: "proposed" as const })) as [RoutePreview, RoutePreview, RoutePreview];
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
      createdBy: command.proposalSource,
      createdAt: at,
      ...(input.supersedesRouteSetRef
        ? { supersedesRouteSetRef: input.supersedesRouteSetRef }
        : {}),
    };
    const sets = workspace.routeProposalSets.map((set, index) =>
      index === supersededIndex ? { ...set, status: "superseded" as const, availableActions: [] } : set);
    sets.push(routeSet);
    const changedRefs = supersededIndex >= 0 && input.supersedesRouteSetRef
      ? [input.supersedesRouteSetRef, routeSet.ref]
      : [routeSet.ref];
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
      routeProposalSets: sets,
      operations: [...workspace.operations, operation],
    });
    return this.commit(workspace, command, next, operation, { outcome: "routes", routeSet },
      "Three grounded route previews are visible and await participant revision or choice.");
  }

  private async reviseRouteSet(
    workspace: Workspace,
    command: Authorized<ReviseRouteSetCommand>,
  ): Promise<CommandResult> {
    if (command.actor !== "participant") return wrongActor(workspace, command);
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
      return route !== undefined && sameRouteContent(route, applyRouteEdit(route, edit));
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
        ? "All routes were rejected. The set is resolved and no hypothesis was created."
        : "Participant edits and rejections were applied; the route set remains awaiting a choice.");
  }

  private async chooseRoute(
    workspace: Workspace,
    command: Authorized<ChooseRouteCommand>,
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
    command: Authorized<CompensateRouteSetCommand>,
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

  const existingRefs = new Set([
    workspace.id,
    ...workspace.reflections.map((reflection) => reflection.ref),
    ...workspace.routeProposalSets.map((set) => set.ref),
    ...workspace.routeProposalSets.flatMap((set) => set.routes.map((route) => route.ref)),
    ...workspace.hypotheses.map((hypothesis) => hypothesis.ref),
    ...workspace.operations.map((operation) => operation.operationRef),
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

function sameRouteContent(left: RoutePreview, right: RoutePreview): boolean {
  const { status: leftStatus, ...leftContent } = left;
  const { status: rightStatus, ...rightContent } = right;
  void leftStatus;
  void rightStatus;
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
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
      if (reflection) data = { reflection };
      break;
    }
    case "propose_route_set": {
      const routeSet = workspace.routeProposalSets.find(
        (set) => set.ref === existing.changedRefs.at(-1),
      );
      if (routeSet) data = { outcome: "routes", routeSet };
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
    insteadDo: "Do not repeat this request. Prepare the visible interaction and let the participant submit a new command with a new operationId.",
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
  afterVersion: number,
  reserved: string[] = [],
): string {
  const used = workspaceRefs(workspace);
  for (const ref of reserved) used.add(ref);
  const base = `${prefix}-${afterVersion}`;
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function workspaceRefs(workspace: Workspace): Set<string> {
  return new Set([
    workspace.id,
    ...workspace.reflections.map((reflection) => reflection.ref),
    ...workspace.routeProposalSets.map((set) => set.ref),
    ...workspace.routeProposalSets.flatMap((set) => set.routes.map((route) => route.ref)),
    ...workspace.hypotheses.map((hypothesis) => hypothesis.ref),
    ...workspace.operations.map((operation) => operation.operationRef),
  ]);
}

function isExecutionContext(context: unknown): context is CommandExecutionContext {
  if (typeof context !== "object" || context === null) return false;
  const keys = Object.keys(context).sort().join(",");
  if (keys !== "actor,proposalSource") return false;
  if (!("actor" in context) || !("proposalSource" in context)) return false;
  return context.actor === "participant"
    ? context.proposalSource === "participant"
    : context.actor === "agent" &&
        (context.proposalSource === "chatgpt_webmcp" ||
          context.proposalSource === "embedded_inference");
}
