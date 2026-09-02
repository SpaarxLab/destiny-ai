import { z } from "zod";

export const WORKSPACE_SCHEMA_VERSION = 4;
export const CONTRACT_VERSION = "2.0.0";

const refSchema = z.string().trim().min(1).max(128);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const phaseSchema = z.enum(["DECK", "EXPLORING", "TESTING", "REVIEWING"]);
export type Phase = z.infer<typeof phaseSchema>;

export const actorSchema = z.enum(["participant", "agent"]);
export type Actor = z.infer<typeof actorSchema>;

export const proposalSourceSchema = z.enum(["chatgpt_webmcp", "participant", "embedded_inference"]);
export type ProposalSource = z.infer<typeof proposalSourceSchema>;

export const availableActionSchema = z.strictObject({
  tool: z.string().min(1).max(64),
  targetRef: refSchema,
  actor: actorSchema,
  effect: z.enum(["READ", "PREPARE_UI", "PROPOSE"]),
  requiresHuman: z.boolean(),
  reason: z.string().min(1).max(240).optional(),
});
export type AvailableAction = z.infer<typeof availableActionSchema>;

export const reflectionSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "confirmed"]),
  text: z.string().min(1).max(2_000),
  recordedBy: z.enum(["participant", "agent_transcribed", "participant_tapped"]),
  createdAt: z.string().datetime({ offset: true }),
  answersFollowUpRef: refSchema.optional(),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const followUpQuestionSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "answered", "skipped", "withdrawn"]),
  question: boundedText(300),
  reasonRefs: z.array(refSchema).min(1).max(5),
  askedBy: z.enum(["chatgpt_webmcp", "embedded_inference"]),
  createdAt: z.string().datetime({ offset: true }),
  answerReflectionRef: refSchema.optional(),
});
export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;

export const quoteSourceSchema = z.strictObject({
  reflectionRef: refSchema,
  quote: boundedText(500),
});
export type QuoteSource = z.infer<typeof quoteSourceSchema>;

export const routeKindSchema = z.enum(["closest", "bridge", "probe"]);
export type RouteKind = z.infer<typeof routeKindSchema>;

export const routeTestSchema = z.strictObject({
  action: boundedText(500),
  maximumDays: z.number().int().min(1).max(7),
  maximumHours: z.number().nonnegative(),
  maximumMoney: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type RouteTest = z.infer<typeof routeTestSchema>;

export const routePreviewSchema = z.strictObject({
  ref: refSchema,
  kind: routeKindSchema,
  title: boundedText(120),
  premise: boundedText(600),
  sourceQuotes: z.array(quoteSourceSchema).max(5),
  tensionRef: refSchema.optional(),
  constraint: boundedText(300),
  learningQuestion: boundedText(300),
  test: routeTestSchema,
  strengthensWhen: boundedText(300),
  weakensWhen: boundedText(300),
  status: z.enum(["proposed", "edited", "rejected", "selected"]),
  carriedFromRouteRef: refSchema.optional(),
}).superRefine((route, context) => {
  if (route.sourceQuotes.length === 0 && route.tensionRef === undefined) {
    context.addIssue({ code: "custom", path: ["sourceQuotes"], message: "A route requires an exact quote or a resolved tension." });
  }
});
export type RoutePreview = z.infer<typeof routePreviewSchema>;

export const routeProposalSetSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "resolved", "superseded"]),
  routes: z.tuple([routePreviewSchema, routePreviewSchema, routePreviewSchema]),
  selectedRouteRef: refSchema.optional(),
  supersedesRouteSetRef: refSchema.optional(),
  createdBy: proposalSourceSchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type RouteProposalSet = z.infer<typeof routeProposalSetSchema>;

export const hypothesisSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum([
    "proposed", "accepted", "rejected", "superseded", "testing",
    "supported", "weakened", "refuted", "parked",
  ]),
  claim: boundedText(600),
  originatingRouteSetRef: refSchema,
  originatingRouteRef: refSchema,
  sourceQuotes: z.array(quoteSourceSchema).min(1).max(5),
  influenceFlags: z.array(z.enum(["peer", "trend", "parent", "prestige", "fear"])).max(5),
  confidence: z.number().min(0).max(1),
});
export type Hypothesis = z.infer<typeof hypothesisSchema>;

export const gestureSchema = z.enum(["me", "not_me", "wish", "used_to"]);
export type Gesture = z.infer<typeof gestureSchema>;
export const dwellSchema = z.enum(["fast", "medium", "slow", "off"]);
export type Dwell = z.infer<typeof dwellSchema>;
export const axisSchema = z.enum([
  "autonomy_belonging", "depth_breadth", "making_deciding",
  "visible_hidden", "stability_risk", "people_things",
]);
export type Axis = z.infer<typeof axisSchema>;
export const poleSchema = z.enum(["a", "b"]);
export type Pole = z.infer<typeof poleSchema>;
export const agentSourceSchema = z.enum([
  "chatgpt_webmcp", "gemini_webmcp", "other_webmcp", "embedded_inference", "fixture",
]);
export const agentRoleSchema = z.enum(["dealer", "reader", "skeptic", "routemaker", "scout", "coach", "unspecified"]);
export const agentIdentitySchema = z.strictObject({
  source: agentSourceSchema,
  role: agentRoleSchema,
  label: boundedText(80),
  model: boundedText(120).optional(),
});
export type AgentIdentity = z.infer<typeof agentIdentitySchema>;

const addressableFields = {
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
};

export const cardSchema = z.strictObject({
  ...addressableFields,
  dealRef: refSchema,
  text: z.string().min(20).max(140),
  axis: axisSchema,
  pole: poleSchema,
  kind: z.enum(["moment", "duel", "reversal", "falsification"]),
  pairWithRef: refSchema.optional(),
  reversalOfRef: refSchema.optional(),
  falsifiesTensionRef: refSchema.optional(),
  expectedGesture: gestureSchema.optional(),
  reasons: z.tuple([boundedText(90), boundedText(90), boundedText(90)]).optional(),
  status: z.enum(["dealt", "swiped", "dismissed"]),
  dealtBy: agentIdentitySchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type Card = z.infer<typeof cardSchema>;

export const swipeSchema = z.strictObject({
  ...addressableFields,
  cardRef: refSchema,
  gesture: gestureSchema,
  dwell: dwellSchema,
  flipped: z.boolean(),
  tappedReasonIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  tappedReasonReflectionRef: refSchema.optional(),
  at: z.string().datetime({ offset: true }),
});
export type Swipe = z.infer<typeof swipeSchema>;

export const tensionSchema = z.strictObject({
  ...addressableFields,
  status: z.enum(["proposed", "accepted", "edited", "rejected", "superseded", "falsified", "survived"]),
  claim: z.string().min(20).max(160),
  axis: axisSchema,
  evidenceSwipeRefs: z.array(refSchema).min(3).max(12),
  falsificationCardRefs: z.array(refSchema).max(2),
  influence: z.strictObject({
    flag: z.enum(["peer", "parent", "prestige", "fear"]),
    reversalPairRefs: z.tuple([refSchema, refSchema]),
    status: z.enum(["proposed", "accepted", "rejected"]),
  }).optional(),
  proposedBy: agentIdentitySchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type Tension = z.infer<typeof tensionSchema>;

export const portraitSchema = z.strictObject({
  ...addressableFields,
  status: z.enum(["proposed", "accepted", "rejected", "superseded"]),
  tensionRefs: z.array(refSchema).min(2).max(3),
  proposedBy: agentIdentitySchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type Portrait = z.infer<typeof portraitSchema>;

export const dealerNoteSchema = z.strictObject({
  ...addressableFields,
  text: boundedText(240),
  status: z.enum(["visible", "dismissed"]),
  postedBy: agentIdentitySchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type DealerNote = z.infer<typeof dealerNoteSchema>;

export const operationReceiptSchema = z.strictObject({
  operationId: z.string().uuid(),
  operationRef: refSchema,
  actor: actorSchema,
  command: z.string().min(1).max(64),
  effect: z.enum(["APPLIED", "PROPOSED", "AWAITING_HUMAN", "COMPENSATED"]),
  beforeVersion: z.number().int().nonnegative(),
  afterVersion: z.number().int().nonnegative(),
  changedRefs: z.array(refSchema),
  at: z.string().datetime({ offset: true }),
  compensatesOperationRef: refSchema.optional(),
});
export type OperationReceipt = z.infer<typeof operationReceiptSchema>;

export const operationRecordSchema = operationReceiptSchema.extend({
  requestIdentity: z.string().min(1),
});
export type OperationRecord = z.infer<typeof operationRecordSchema>;

export const costCapsSchema = z.strictObject({
  hoursPerWeek: z.number().nonnegative(),
  money: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type CostCaps = z.infer<typeof costCapsSchema>;

export const participantSchema = z.strictObject({
  displayName: z.string().max(120),
  focusQuestion: z.string().max(500),
  costCaps: costCapsSchema,
});

const notImplementedCollectionSchema = z.array(z.never()).length(0);

export const workspaceObjectSchema = z.strictObject({
  id: z.string().uuid(),
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  contractVersion: z.literal(CONTRACT_VERSION),
  stateVersion: z.number().int().nonnegative(),
  phase: phaseSchema,
  participant: participantSchema,
  reflections: z.array(reflectionSchema),
  followUpQuestions: z.array(followUpQuestionSchema),
  routeProposalSets: z.array(routeProposalSetSchema),
  hypotheses: z.array(hypothesisSchema),
  cards: z.array(cardSchema),
  swipes: z.array(swipeSchema),
  tensions: z.array(tensionSchema),
  portraits: z.array(portraitSchema),
  dealerNotes: z.array(dealerNoteSchema),
  deck: z.strictObject({
    dwellTracking: z.boolean(),
    consentEmbedded: z.boolean(),
    dealsUnresolved: z.number().int().nonnegative().max(5),
  }),
  experiments: notImplementedCollectionSchema,
  evidence: notImplementedCollectionSchema,
  revisions: notImplementedCollectionSchema,
  planItems: notImplementedCollectionSchema,
  outbox: notImplementedCollectionSchema,
  teachings: notImplementedCollectionSchema,
  operations: z.array(operationRecordSchema),
});

export function routeContent(route: RoutePreview): string {
  const { ref, status, carriedFromRouteRef, ...content } = route;
  void ref;
  void status;
  void carriedFromRouteRef;
  return JSON.stringify(content);
}

export const workspaceSchema = workspaceObjectSchema.superRefine((workspace, context) => {
  const addressableRefs = [
    { ref: workspace.id, path: ["id"] },
    ...workspace.reflections.map((entity, index) => ({ ref: entity.ref, path: ["reflections", index, "ref"] })),
    ...workspace.followUpQuestions.map((entity, index) => ({ ref: entity.ref, path: ["followUpQuestions", index, "ref"] })),
    ...workspace.routeProposalSets.map((entity, index) => ({ ref: entity.ref, path: ["routeProposalSets", index, "ref"] })),
    ...workspace.routeProposalSets.flatMap((set, setIndex) =>
      set.routes.map((route, routeIndex) => ({
        ref: route.ref,
        path: ["routeProposalSets", setIndex, "routes", routeIndex, "ref"],
      }))),
    ...workspace.hypotheses.map((entity, index) => ({ ref: entity.ref, path: ["hypotheses", index, "ref"] })),
    ...workspace.cards.map((entity, index) => ({ ref: entity.ref, path: ["cards", index, "ref"] })),
    ...workspace.swipes.map((entity, index) => ({ ref: entity.ref, path: ["swipes", index, "ref"] })),
    ...workspace.tensions.map((entity, index) => ({ ref: entity.ref, path: ["tensions", index, "ref"] })),
    ...workspace.portraits.map((entity, index) => ({ ref: entity.ref, path: ["portraits", index, "ref"] })),
    ...workspace.dealerNotes.map((entity, index) => ({ ref: entity.ref, path: ["dealerNotes", index, "ref"] })),
    ...workspace.operations.map((entity, index) => ({ ref: entity.operationRef, path: ["operations", index, "operationRef"] })),
  ];
  const seen = new Set<string>();
  for (const entry of addressableRefs) {
    if (seen.has(entry.ref)) {
      context.addIssue({ code: "custom", path: entry.path, message: `Addressable ref ${entry.ref} is not unique.` });
    }
    seen.add(entry.ref);
  }
  for (const [operationIndex, operation] of workspace.operations.entries()) {
    for (const [changedRefIndex, changedRef] of operation.changedRefs.entries()) {
      if (!seen.has(changedRef)) {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "changedRefs", changedRefIndex],
          message: `Changed ref ${changedRef} does not point to an addressable workspace entity.`,
        });
      }
    }
  }

  const operationIds = new Set<string>();
  const compensatedTargets = new Set<string>();
  let expectedBeforeVersion = 0;
  for (const [operationIndex, operation] of workspace.operations.entries()) {
    if (operationIds.has(operation.operationId)) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "operationId"],
        message: `Operation id ${operation.operationId} is not unique.`,
      });
    }
    operationIds.add(operation.operationId);

    if (
      operation.beforeVersion !== expectedBeforeVersion ||
      operation.afterVersion !== operation.beforeVersion + 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex],
        message: "Operation versions must form an ordered contiguous chain.",
      });
    }
    expectedBeforeVersion = operation.afterVersion;

    const compensationRef = operation.compensatesOperationRef;
    if (compensationRef === undefined) {
      if (operation.effect === "COMPENSATED" || operation.command === "compensate_route_set") {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "compensatesOperationRef"],
          message: "A compensating route-set operation must name its target proposal operation.",
        });
      }
      continue;
    }

    if (operation.effect !== "COMPENSATED" || operation.command !== "compensate_route_set") {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "Only a COMPENSATED compensate_route_set operation may carry a compensation ref.",
      });
    }
    const targetIndex = workspace.operations.findIndex(
      (candidate) => candidate.operationRef === compensationRef,
    );
    const target = workspace.operations[targetIndex];
    if (targetIndex < 0 || targetIndex >= operationIndex) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A compensation target must be an earlier existing operation.",
      });
      continue;
    }
    if (
      target.command !== "propose_route_set" || target.effect !== "PROPOSED" ||
      target.changedRefs.at(-1) !== operation.changedRefs[0] || operation.changedRefs.length !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "Compensation must target a PROPOSED route-set operation for the same route set.",
      });
    }
    const targetRouteSetRef = target.changedRefs.at(-1);
    const interveningChange = targetRouteSetRef !== undefined && workspace.operations
      .slice(targetIndex + 1, operationIndex)
      .some((candidate) => candidate.changedRefs.includes(targetRouteSetRef));
    if (interveningChange) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A route-set proposal cannot be compensated after an intervening change to that set.",
      });
    }
    if (compensatedTargets.has(compensationRef)) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A route-set proposal operation may be compensated only once.",
      });
    }
    compensatedTargets.add(compensationRef);
  }
  if (expectedBeforeVersion !== workspace.stateVersion) {
    context.addIssue({
      code: "custom",
      path: ["stateVersion"],
      message: "Workspace stateVersion must equal the end of its contiguous operation ledger.",
    });
  }

  const proposedSets = workspace.routeProposalSets.filter((set) => set.status === "proposed");
  if (proposedSets.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["routeProposalSets"],
      message: "At most one route set may be proposed at a time.",
    });
  }

  const openFollowUps = workspace.followUpQuestions.filter((question) => question.status === "proposed");
  if (openFollowUps.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["followUpQuestions"],
      message: "At most one follow-up question may be open at a time.",
    });
  }
  for (const [questionIndex, question] of workspace.followUpQuestions.entries()) {
    for (const reasonRef of question.reasonRefs) {
      const reflection = workspace.reflections.find((candidate) => candidate.ref === reasonRef);
      if (!reflection || reflection.status !== "confirmed") {
        context.addIssue({
          code: "custom",
          path: ["followUpQuestions", questionIndex, "reasonRefs"],
          message: "Follow-up reasons must cite confirmed reflections.",
        });
      }
    }
    const answer = question.answerReflectionRef === undefined
      ? undefined
      : workspace.reflections.find((candidate) => candidate.ref === question.answerReflectionRef);
    if (question.status === "answered") {
      if (!answer || answer.status !== "confirmed" || answer.answersFollowUpRef !== question.ref) {
        context.addIssue({
          code: "custom",
          path: ["followUpQuestions", questionIndex, "answerReflectionRef"],
          message: "An answered follow-up must point to the confirmed reflection that answers it.",
        });
      }
    } else if (question.answerReflectionRef !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["followUpQuestions", questionIndex, "answerReflectionRef"],
        message: "Only an answered follow-up may name an answer reflection.",
      });
    }
  }
  for (const [reflectionIndex, reflection] of workspace.reflections.entries()) {
    if (reflection.answersFollowUpRef === undefined) continue;
    const question = workspace.followUpQuestions.find((candidate) => candidate.ref === reflection.answersFollowUpRef);
    if (!question || question.answerReflectionRef !== reflection.ref) {
      context.addIssue({
        code: "custom",
        path: ["reflections", reflectionIndex, "answersFollowUpRef"],
        message: "A reflection may only answer the follow-up that names it back.",
      });
    }
  }

  for (const [setIndex, set] of workspace.routeProposalSets.entries()) {
    let predecessor: RouteProposalSet | undefined;
    if (set.supersedesRouteSetRef) {
      const targetIndex = workspace.routeProposalSets.findIndex(
        (candidate) => candidate.ref === set.supersedesRouteSetRef,
      );
      if (targetIndex < 0 || targetIndex >= setIndex) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "supersedesRouteSetRef"],
          message: "A supersession target must be an earlier route set in this workspace.",
        });
      } else {
        predecessor = workspace.routeProposalSets[targetIndex];
      }
    }

    const selected = set.routes.filter((route) => route.status === "selected");
    if (set.selectedRouteRef === undefined) {
      if (selected.length !== 0) {
        context.addIssue({ code: "custom", path: ["routeProposalSets", setIndex, "routes"], message: "Selected routes require selectedRouteRef." });
      }
    } else if (
      set.status !== "resolved" ||
      selected.length !== 1 ||
      selected[0]?.ref !== set.selectedRouteRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "selectedRouteRef"],
        message: "A resolved selected set must point to exactly one selected route.",
      });
    }
    if (set.status !== "resolved" && set.selectedRouteRef !== undefined) {
      context.addIssue({ code: "custom", path: ["routeProposalSets", setIndex, "status"], message: "Only a resolved set may have a selected route." });
    }
    if (set.status === "proposed" && set.routes.every((route) => route.status === "rejected")) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "status"],
        message: "A proposed route set must retain at least one non-rejected route.",
      });
    }
    if (set.status === "resolved" && set.selectedRouteRef === undefined) {
      const allRejected = set.routes.every((route) => route.status === "rejected");
      const compensated = workspace.operations.some(
        (operation) => operation.effect === "COMPENSATED" && operation.changedRefs.includes(set.ref),
      );
      if (!allRejected && !compensated) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "status"],
          message: "A resolved unselected set must be all-rejected or have a compensation receipt.",
        });
      }
    }

    const kinds = new Set(set.routes.map((route) => route.kind));
    const questions = new Set(set.routes.map((route) => route.learningQuestion));
    const tests = new Set(set.routes.map((route) => JSON.stringify(route.test)));
    if (kinds.size !== 3 || questions.size !== 3 || tests.size !== 3) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "routes"],
        message: "Stored routes must retain unique kinds, learning questions, and tests.",
      });
    }
    for (const [routeIndex, route] of set.routes.entries()) {
      if (
        set.status === "proposed" && (
        route.test.maximumHours > workspace.participant.costCaps.hoursPerWeek ||
        route.test.maximumMoney > workspace.participant.costCaps.money ||
        route.test.currency !== workspace.participant.costCaps.currency)
      ) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "routes", routeIndex, "test"],
          message: "Proposed route tests must stay within the current participant time, money, and currency limits.",
        });
      }
      for (const source of route.sourceQuotes) {
        const reflection = workspace.reflections.find(
          (candidate) => candidate.ref === source.reflectionRef,
        );
        if (!reflection || reflection.status !== "confirmed" || !reflection.text.includes(source.quote)) {
          context.addIssue({
            code: "custom",
            path: ["routeProposalSets", setIndex, "routes", routeIndex, "sourceQuotes"],
            message: "Stored route quotes must exactly cite confirmed reflections.",
          });
        }
      }
      if (route.tensionRef !== undefined) {
        const tension = workspace.tensions.find((candidate) => candidate.ref === route.tensionRef);
        if (!tension || !["accepted", "edited", "survived"].includes(tension.status)) {
          context.addIssue({
            code: "custom",
            path: ["routeProposalSets", setIndex, "routes", routeIndex, "tensionRef"],
            message: "A route tension must point to an accepted, edited, or survived tension.",
          });
        }
      }
      if (route.carriedFromRouteRef !== undefined) {
        const origin = predecessor?.routes.find((candidate) => candidate.ref === route.carriedFromRouteRef);
        if (!origin || origin.kind !== route.kind || routeContent(origin) !== routeContent(route)) {
          context.addIssue({
            code: "custom",
            path: ["routeProposalSets", setIndex, "routes", routeIndex, "carriedFromRouteRef"],
            message: "A carried route must copy a route of the same kind from the superseded set unchanged.",
          });
        }
      }
    }
  }

  for (const [hypothesisIndex, hypothesis] of workspace.hypotheses.entries()) {
    if (hypothesis.status !== "accepted") continue;
    const set = workspace.routeProposalSets.find(
      (candidate) => candidate.ref === hypothesis.originatingRouteSetRef,
    );
    const route = set?.routes.find(
      (candidate) => candidate.ref === hypothesis.originatingRouteRef,
    );
    if (
      !set || !route || set.status !== "resolved" ||
      set.selectedRouteRef !== route.ref || route.status !== "selected" ||
      hypothesis.claim !== route.premise ||
      JSON.stringify(hypothesis.sourceQuotes) !== JSON.stringify(route.sourceQuotes)
    ) {
      context.addIssue({
        code: "custom",
        path: ["hypotheses", hypothesisIndex],
        message: "An accepted hypothesis must agree with its selected originating route and set.",
      });
    }
  }
  const acceptedCount = workspace.hypotheses.filter((hypothesis) => hypothesis.status === "accepted").length;
  if (workspace.phase === "TESTING" && acceptedCount !== 1) {
    context.addIssue({
      code: "custom",
      path: ["phase"],
      message: "The TESTING phase requires exactly one accepted hypothesis.",
    });
  }
  if (workspace.phase === "EXPLORING" && acceptedCount !== 0) {
    context.addIssue({
      code: "custom",
      path: ["phase"],
      message: "The EXPLORING phase cannot hold an accepted hypothesis.",
    });
  }
  if (workspace.deck.dealsUnresolved !== workspace.cards.filter((card) => card.status === "dealt").length) {
    context.addIssue({ code: "custom", path: ["deck", "dealsUnresolved"], message: "Unresolved deal count must match dealt cards." });
  }
  if (workspace.portraits.filter((portrait) => portrait.status === "proposed").length > 1) {
    context.addIssue({ code: "custom", path: ["portraits"], message: "At most one Portrait may be open." });
  }
});
export type Workspace = z.infer<typeof workspaceSchema>;

export function createEmptyWorkspace(
  id = "00000000-0000-4000-8000-000000000001",
  phase: Phase = "EXPLORING",
): Workspace {
  return workspaceSchema.parse({
    id,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    stateVersion: 0,
    phase,
    participant: {
      displayName: "",
      focusQuestion: "",
      costCaps: { hoursPerWeek: 0, money: 0, currency: "XXX" },
    },
    reflections: [],
    followUpQuestions: [],
    routeProposalSets: [],
    hypotheses: [],
    cards: [],
    swipes: [],
    tensions: [],
    portraits: [],
    dealerNotes: [],
    deck: { dwellTracking: true, consentEmbedded: false, dealsUnresolved: 0 },
    experiments: [],
    evidence: [],
    revisions: [],
    planItems: [],
    outbox: [],
    teachings: [],
    operations: [],
  });
}

/** New user workspaces enter the Deck; the phase parameter on createEmptyWorkspace is retained for deterministic legacy fixtures. */
export function createFreshWorkspace(id = "00000000-0000-4000-8000-000000000001"): Workspace {
  return createEmptyWorkspace(id, "DECK");
}

export function publicReceipt(record: OperationRecord): OperationReceipt {
  return operationReceiptSchema.parse({
    operationId: record.operationId,
    operationRef: record.operationRef,
    actor: record.actor,
    command: record.command,
    effect: record.effect,
    beforeVersion: record.beforeVersion,
    afterVersion: record.afterVersion,
    changedRefs: record.changedRefs,
    at: record.at,
    compensatesOperationRef: record.compensatesOperationRef,
  });
}
