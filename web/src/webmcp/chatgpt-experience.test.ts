import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import { CommandKernel } from "../commands/command-kernel";
import { createFreshWorkspace } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { createChatGptExperienceTools, type EvidencePresentation } from "./tools/chatgpt-experience";

const op = () => crypto.randomUUID();

function setup() {
  const store = new MemoryWorkspaceStore(createFreshWorkspace());
  const kernel = new CommandKernel(store);
  const participant = createParticipantCommandAdapter(kernel);
  const presentations: EvidencePresentation[] = [];
  const tools = createChatGptExperienceTools(createWebMcpCommandAdapter(kernel), new AbortController().signal, {
    loadWorkspace: () => store.load(),
    onEvidencePresented: (value) => { if (value) presentations.push(value); },
  });
  const invoke = (name: string, input: unknown) => tools.find((tool) => tool.name === name)!.execute(input) as Promise<Record<string, unknown>>;
  return { store, participant, tools, invoke, presentations };
}

function probe(expectedVersion: number, text: string, pole: "a" | "b") {
  return {
    operationId: op(), expectedVersion, template: "moment", uncertainty: "Whether shaping ambiguous work produces useful energy.",
    variables: ["ownership", "ambiguity"], changedVariable: "ownership", strengthensWhen: "the participant chooses That's me or I wish", weakensWhen: "the participant chooses Not me",
    scenarios: [{ text, axis: "making_deciding", pole, reasons: ["I want to shape the answer myself.", "The ambiguity gives me useful energy.", "I care about owning the finished result."] }],
  };
}

async function reachReviewedRevision(context: ReturnType<typeof setup>) {
  const swipeRefs: string[] = [];
  for (const [index, scenario] of [
    ["A vague brief lands at noon. By four, you have drawn the system everyone can use.", "a"],
    ["Two credible paths remain. The room waits while you choose the next reversible move.", "b"],
    ["The prototype finally clicks. You stay ten minutes longer to make the interaction feel right.", "a"],
  ].entries()) {
    await context.invoke("stage_probe", probe(context.store.load().stateVersion, scenario[0], scenario[1] as "a" | "b"));
    const cardRef = context.store.load().cards.find((card) => card.status === "dealt")!.ref;
    await context.participant.swipeCard({ operationId: op(), expectedVersion: context.store.load().stateVersion, cardRef, gesture: "me", dwell: index === 0 ? "slow" : "fast", flipped: false });
    swipeRefs.push(context.store.load().swipes.at(-1)!.ref);
  }
  await context.invoke("propose_hypothesis", { operationId: op(), expectedVersion: context.store.load().stateVersion, claim: "You gain energy from shaping ambiguous work, but may resist carrying the final decision alone.", axis: "making_deciding", supportingSwipeRefs: swipeRefs });
  const initialRef = context.store.load().tensions.at(-1)!.ref;
  await context.participant.resolveTension({ operationId: op(), expectedVersion: context.store.load().stateVersion, tensionRef: initialRef, resolution: "accept" });
  await context.invoke("stage_probe", {
    operationId: op(), expectedVersion: context.store.load().stateVersion, template: "variable_isolation", uncertainty: "Whether ownership, rather than ambiguity, causes the hesitation.", variables: ["ambiguity", "ownership"], changedVariable: "ownership", strengthensWhen: "the response becomes more negative with ownership", weakensWhen: "the response stays positive", falsifiesHypothesisRef: initialRef, expectedGesture: "not_me", reversalOfProbeRef: context.store.load().cards.at(-1)!.ref,
    scenarios: [{ text: "The brief stays ambiguous, but a trusted lead owns the final call while you shape the options.", axis: "making_deciding", pole: "b", reasons: ["I still get to shape the hard part.", "Shared ownership removes the heavy part.", "I would want the final decision after all."] }],
  });
  await context.participant.swipeCard({ operationId: op(), expectedVersion: context.store.load().stateVersion, cardRef: context.store.load().cards.find((card) => card.status === "dealt")!.ref, gesture: "me", dwell: "fast", flipped: false });
  const counterSwipeRef = context.store.load().swipes.at(-1)!.ref;
  await context.invoke("propose_hypothesis", { operationId: op(), expectedVersion: context.store.load().stateVersion, claim: "You gain energy from shaping ambiguous work; ownership is a condition to test, not a reason to avoid it.", axis: "making_deciding", supportingSwipeRefs: swipeRefs, contradictorySwipeRefs: [counterSwipeRef], supersedesHypothesisRef: initialRef, interpretation: "weakened" });
  const revisedRef = context.store.load().tensions.at(-1)!.ref;
  await context.participant.resolveTension({ operationId: op(), expectedVersion: context.store.load().stateVersion, tensionRef: revisedRef, resolution: "accept" });
  return revisedRef;
}

describe("ChatGPT-only WebMCP experience", () => {
  it("registers only the six bounded tools and keeps participant actions absent", () => {
    const { tools } = setup();
    expect(tools.map((tool) => tool.name)).toEqual(["inspect_room", "stage_probe", "propose_hypothesis", "present_evidence", "stage_route_auditions", "propose_experiment"]);
    expect(tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["swipe_card", "resolve_tension", "choose_route", "set_limits"]));
  });

  it("reports connected ChatGPT provenance, no hidden inference, and readable participant evidence", async () => {
    const context = setup();
    const initial = await context.invoke("inspect_room", {});
    expect(initial).toMatchObject({
      ok: true,
      data: {
        agentProvenance: {
          conductor: "ChatGPT",
          source: "chatgpt_webmcp",
          connection: "external_agent_via_webmcp",
          hiddenInference: false,
          embeddedInference: false,
          fixtureInference: false,
          applicationModelCalls: 0,
          tokenUsage: { observable: false },
          observedWorkspaceSources: [],
          nonChatGptAuthoredEntitiesPresent: false,
        },
      },
    });

    await context.invoke("stage_probe", probe(0, "A messy product question lands and you turn it into one crisp test before lunch.", "a"));
    const card = context.store.load().cards.at(-1)!;
    expect(card.dealtBy).toMatchObject({ source: "chatgpt_webmcp", label: "ChatGPT" });
    await context.participant.swipeCard({ operationId: op(), expectedVersion: 1, cardRef: card.ref, gesture: "wish", dwell: "medium", flipped: true, tappedReasonIndex: 1 });

    const inspection = await context.invoke("inspect_room", {});
    expect(inspection).toMatchObject({
      data: {
        agentProvenance: {
          hiddenInference: false,
          applicationModelCalls: 0,
          observedWorkspaceSources: ["chatgpt_webmcp"],
          nonChatGptAuthoredEntitiesPresent: false,
        },
        confirmedEvidence: [{
          cardRef: card.ref,
          scenario: card.text,
          response: {
            code: "wish",
            meaning: "I want more of this in my future.",
            dwell: "medium",
            selectedReason: "The ambiguity gives me useful energy.",
            selectedReasonTrust: "PARTICIPANT_CONFIRMED_UNTRUSTED_EVIDENCE",
          },
          probe: {
            template: "moment",
            changedVariable: "ownership",
          },
          receiptRef: expect.any(String),
        }],
      },
    });
  });

  it("withholds route staging until the participant confirms usable experiment time", async () => {
    const context = setup();
    const revisedRef = await reachReviewedRevision(context);
    const before = context.store.load();

    const inspection = await context.invoke("inspect_room", {});
    expect(inspection).toMatchObject({
      data: {
        experimentLimits: { confirmed: false, hoursPerWeek: 0, money: 0, currency: null, receiptRef: null },
        openParticipantDecision: {
          kind: "SET_EXPERIMENT_LIMITS",
          requirement: { hoursPerWeek: { exclusiveMinimum: 0 }, money: { minimum: 0 } },
        },
        callableAgentActions: ["present_evidence", "inspect_room"],
      },
    });
    expect((inspection as { data: { callableAgentActions: string[] } }).data.callableAgentActions).not.toContain("stage_route_auditions");

    const denied = await context.invoke("stage_route_auditions", routeInput(before.stateVersion, revisedRef));
    expect(denied).toMatchObject({
      ok: false,
      outcome: "needs_more_evidence",
      error: {
        code: "EXPERIMENT_LIMITS_REQUIRED",
        retry: "AFTER_PARTICIPANT_RESPONSE",
      },
      data: {
        missingRequirements: ["EXPERIMENT_LIMITS"],
        validNextActions: ["present_evidence", "inspect_room"],
        openParticipantDecision: { kind: "SET_EXPERIMENT_LIMITS" },
      },
      stateVersion: before.stateVersion,
    });
    expect(context.store.load()).toEqual(before);
  });

  it("runs the recoverable probe, falsification, revision, evidence, and route-audition contract", async () => {
    const context = setup();
    const swipeRefs: string[] = [];
    await context.participant.setLimits({ operationId: op(), expectedVersion: 0, costCaps: { hoursPerWeek: 3, money: 0, currency: "USD" } });
    for (const [index, scenario] of [
      ["A vague brief lands at noon. By four, you have drawn the system everyone can use.", "a"],
      ["Two credible paths remain. The room waits while you choose the next reversible move.", "b"],
      ["The prototype finally clicks. You stay ten minutes longer to make the interaction feel right.", "a"],
    ].entries()) {
      const staged = await context.invoke("stage_probe", probe(context.store.load().stateVersion, scenario[0], scenario[1] as "a" | "b"));
      expect(staged).toMatchObject({ ok: true, outcome: "awaiting_participant", recovery: { tool: "inspect_room", stagedProbePreserved: true } });
      const cardRef = context.store.load().cards.find((card) => card.status === "dealt")!.ref;
      const response = await context.participant.swipeCard({ operationId: op(), expectedVersion: context.store.load().stateVersion, cardRef, gesture: "me", dwell: index === 0 ? "slow" : "fast", flipped: false });
      expect(response.ok).toBe(true);
      swipeRefs.push(context.store.load().swipes.at(-1)!.ref);
    }

    const hypothesis = await context.invoke("propose_hypothesis", { operationId: op(), expectedVersion: context.store.load().stateVersion, claim: "You gain energy from shaping ambiguous work, but may resist carrying the final decision alone.", axis: "making_deciding", supportingSwipeRefs: swipeRefs });
    expect(hypothesis).toMatchObject({ ok: true, outcome: "awaiting_participant", data: { hypothesis: { interpretation: "initial" } } });
    const initialRef = context.store.load().tensions.at(-1)!.ref;
    await context.participant.resolveTension({ operationId: op(), expectedVersion: context.store.load().stateVersion, tensionRef: initialRef, resolution: "accept" });

    const premature = await context.invoke("stage_route_auditions", routeInput(context.store.load().stateVersion, initialRef));
    expect(premature).toMatchObject({ ok: false, outcome: "needs_more_evidence", error: { code: "COUNTEREVIDENCE_REQUIRED", retry: "AFTER_PARTICIPANT_RESPONSE" } });

    await context.invoke("stage_probe", {
      operationId: op(), expectedVersion: context.store.load().stateVersion, template: "variable_isolation", uncertainty: "Whether ownership, rather than ambiguity, causes the hesitation.", variables: ["ambiguity", "ownership"], changedVariable: "ownership", strengthensWhen: "the response becomes more negative with ownership", weakensWhen: "the response stays positive", falsifiesHypothesisRef: initialRef, expectedGesture: "not_me", reversalOfProbeRef: context.store.load().cards.at(-1)!.ref,
      scenarios: [{ text: "The brief stays ambiguous, but a trusted lead owns the final call while you shape the options.", axis: "making_deciding", pole: "b", reasons: ["I still get to shape the hard part.", "Shared ownership removes the heavy part.", "I would want the final decision after all."] }],
    });
    const counterResponse = await context.participant.swipeCard({ operationId: op(), expectedVersion: context.store.load().stateVersion, cardRef: context.store.load().cards.find((card) => card.status === "dealt")!.ref, gesture: "me", dwell: "fast", flipped: false });
    expect(counterResponse).toMatchObject({ ok: true, data: { tension: { status: "falsified" } } });
    const counterSwipeRef = context.store.load().swipes.at(-1)!.ref;

    const revised = await context.invoke("propose_hypothesis", { operationId: op(), expectedVersion: context.store.load().stateVersion, claim: "You gain energy from shaping ambiguous work; ownership is a condition to test, not a reason to avoid it.", axis: "making_deciding", supportingSwipeRefs: swipeRefs, contradictorySwipeRefs: [counterSwipeRef], supersedesHypothesisRef: initialRef, interpretation: "weakened" });
    expect(revised).toMatchObject({ ok: true, data: { hypothesis: { interpretation: "weakened", supersedesTensionRef: initialRef } } });
    const revisedRef = context.store.load().tensions.at(-1)!.ref;
    await context.participant.resolveTension({ operationId: op(), expectedVersion: context.store.load().stateVersion, tensionRef: revisedRef, resolution: "accept" });

    const beforePresentation = context.store.load();
    const supportReceipt = beforePresentation.operations.find((operation) => operation.changedRefs.includes(swipeRefs[0]))!.operationRef;
    const counterReceipt = beforePresentation.operations.find((operation) => operation.changedRefs.includes(counterSwipeRef))!.operationRef;
    const presented = await context.invoke("present_evidence", { supportingReceiptRefs: [supportReceipt], contradictoryReceiptRefs: [counterReceipt], missingEvidence: ["Whether the energy lasts for a full week"], whatChangedChatGPTsMind: "The response stayed positive when final ownership moved to someone else." });
    expect(presented).toMatchObject({ ok: true, data: { persistentMutation: false } });
    expect(context.store.load()).toEqual(beforePresentation);
    expect(context.presentations).toHaveLength(1);

    const routes = await context.invoke("stage_route_auditions", routeInput(context.store.load().stateVersion, revisedRef));
    expect(routes).toMatchObject({ ok: true, outcome: "awaiting_participant", data: { outcome: "routes", routeSet: { routes: [{ sampleWeek: expect.any(Array) }, {}, {}] } } });
    expect(context.store.load().phase).toBe("EXPLORING");
    const experiment = await context.invoke("propose_experiment", { routeRef: context.store.load().routeProposalSets[0].routes[0].ref, whyThisTest: "It isolates ownership while keeping the work reversible and inside your limits." });
    expect(experiment).toMatchObject({ ok: true, outcome: "decision_ready", data: { participantDecision: "CHOOSE_OR_SET_ASIDE" } });
    expect(context.store.load().hypotheses).toHaveLength(0);
  });
});

function routeInput(expectedVersion: number, tensionRef: string) {
  const kinds = ["closest", "bridge", "probe"] as const;
  return {
    operationId: op(), expectedVersion, outcome: "routes", routes: kinds.map((kind, index) => ({
      ref: `audition-${kind}`, kind, title: ["Shape one product slice", "Shadow a product lead", "Run a decision clinic"][index], premise: "A bounded audition of ambiguous product work without pretending it is a permanent identity.", sourceQuotes: [], tensionRef, constraint: "No outreach or irreversible commitment.", learningQuestion: ["Does daily shaping sustain energy?", "Does shared ownership improve the work?", "Does making decisions feel better with a tight scope?"][index],
      test: { action: ["Prototype one small workflow and log energy.", "Observe two planning sessions and recreate one decision memo.", "Facilitate one reversible decision with a friend."][index], maximumDays: 7, maximumHours: 2, maximumMoney: 0, currency: "USD" }, strengthensWhen: "Energy and curiosity remain after the novelty fades.", weakensWhen: "The work reliably drains energy or violates a confirmed limit.", sampleWeek: ["Day 1: set the question", "Day 3: do the work", "Day 7: review receipts"], responsibilities: ["Frame the bounded problem", "Produce one artifact"], decisions: ["Choose the smallest reversible next move"], collaborationShape: "One collaborator for feedback, no team commitment.", deepWorkShape: "Two protected 45-minute blocks.", majorTradeoff: "Less breadth in exchange for clearer evidence.", participantLimits: "At most 2 hours and 0 USD this week.", uncertainty: "Whether the attraction survives contact with the weekly work.", learningSignals: { success: "Energy rises and the artifact improves.", failure: "Avoidance persists after the first session.", learning: "Which part of the work created or drained energy." },
    })),
  };
}
