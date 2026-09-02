import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import { createFreshWorkspace, type AgentIdentity } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { CommandKernel } from "./command-kernel";

const dealer: AgentIdentity = { source: "fixture", role: "dealer", label: "Fixture dealer" };
const reader: AgentIdentity = { source: "fixture", role: "reader", label: "Fixture reader" };
const skeptic: AgentIdentity = { source: "other_webmcp", role: "skeptic", label: "Skeptic" };
const moment = (text: string, pole: "a" | "b" = "a") => ({ text, axis: "making_deciding" as const, pole, kind: "moment" as const, reasons: ["I want to make the thing.", "I notice the craft first.", "The finished object matters."] as [string, string, string] });
const op = () => crypto.randomUUID();

function setup() {
  const store = new MemoryWorkspaceStore(createFreshWorkspace());
  const kernel = new CommandKernel(store);
  return { store, kernel, participant: createParticipantCommandAdapter(kernel), agent: createWebMcpCommandAdapter(kernel) };
}

async function seedThreeSwipes(context: ReturnType<typeof setup>) {
  await context.agent.dealCards({ operationId: op(), expectedVersion: 0, role: "dealer", cards: [
    moment("It's 9 p.m. and you're still moving the colours around because it isn't right yet.", "a"),
    moment("Two good options, everyone waiting. You pick one and the room exhales.", "b"),
    moment("The draft is done. You read it once more just to enjoy it.", "a"),
  ] }, dealer);
  for (const [index, card] of context.store.load().cards.entries()) {
    await context.participant.swipeCard({ operationId: op(), expectedVersion: index + 1, cardRef: card.ref, gesture: "me", dwell: index === 0 ? "slow" : "fast", flipped: false });
  }
  return context.store.load().swipes.map((swipe) => swipe.ref);
}

describe("Deck command authority", () => {
  it("deals visible proposals with a receipt and replays once", async () => {
    const { store, agent } = setup();
    const operationId = op();
    const input = { operationId, expectedVersion: 0, role: "dealer" as const, cards: [moment("The thing is broken and nobody knows why. They come and get you.")] };
    const first = await agent.dealCards(input, dealer);
    const replay = await agent.dealCards(input, dealer);
    expect(first).toMatchObject({ ok: true, receipt: { command: "deal_cards", effect: "PROPOSED", afterVersion: 1 } });
    expect(replay.receipt).toEqual(first.receipt);
    expect(store.load().cards).toHaveLength(1);
  });

  it("rejects labels and a sixth unresolved card with actionable codes", async () => {
    const { agent } = setup();
    const label = await agent.dealCards({ operationId: op(), expectedVersion: 0, role: "dealer", cards: [moment("You are a natural product manager who always knows the answer.")] }, dealer);
    expect(label).toMatchObject({ ok: false, error: { code: "CARD_IS_A_LABEL", insteadDo: expect.any(String), example: expect.anything() } });
    const five = Array.from({ length: 5 }, (_, index) => moment(`The clock says ${index + 1} and you keep moving the same plain wooden block.`));
    const accepted = await agent.dealCards({ operationId: op(), expectedVersion: 0, role: "dealer", cards: five }, dealer);
    expect(accepted.ok).toBe(true);
    const full = await agent.dealCards({ operationId: op(), expectedVersion: 1, role: "dealer", cards: [moment("You close the lid and the room finally goes quiet around you.")] }, dealer);
    expect(full).toMatchObject({ ok: false, error: { code: "TRAY_FULL" } });
  });

  it("never lets an agent swipe and does not change state", async () => {
    const { store, kernel, agent } = setup();
    await agent.dealCards({ operationId: op(), expectedVersion: 0, cards: [moment("Your hands are dirty and the shelf finally stands straight.")] }, dealer);
    const cardRef = store.load().cards[0].ref;
    const denied = await kernel.execute({ actor: "agent", proposalSource: "other_webmcp", agentIdentity: skeptic }, { name: "swipe_card", input: { operationId: op(), expectedVersion: 1, cardRef, gesture: "me", dwell: "fast", flipped: false } });
    expect(denied).toMatchObject({ ok: false, error: { code: "NO_SWIPE_TOOL" }, stateVersion: 1 });
    expect(store.load().cards[0].status).toBe("dealt");
  });

  it("atomically records a tapped reason as participant-confirmed words", async () => {
    const { store, participant, agent } = setup();
    await agent.dealCards({ operationId: op(), expectedVersion: 0, cards: [moment("Your hands are dirty and the shelf finally stands straight.")] }, dealer);
    const cardRef = store.load().cards[0].ref;
    const result = await participant.swipeCard({ operationId: op(), expectedVersion: 1, cardRef, gesture: "me", dwell: "slow", flipped: true, tappedReasonIndex: 1 });
    expect(result).toMatchObject({ ok: true, data: { reflection: { recordedBy: "participant_tapped", status: "confirmed" } }, receipt: { changedRefs: expect.arrayContaining([cardRef]) } });
    expect(store.load().deck.dealsUnresolved).toBe(0);
  });

  it("requires three swipes and a slow or contradiction before proposing a tension", async () => {
    const context = setup();
    const thin = await context.agent.proposeTension({ operationId: op(), expectedVersion: 0, role: "reader", claim: "You want to make the thing but hesitate when everyone waits for a decision.", axis: "making_deciding", evidenceSwipeRefs: ["one", "two", "three"] }, reader);
    expect(thin).toMatchObject({ ok: false, error: { code: "UNKNOWN_REF" } });
    const refs = await seedThreeSwipes(context);
    const good = await context.agent.proposeTension({ operationId: op(), expectedVersion: 4, role: "reader", claim: "You want to make the thing but hesitate when everyone waits for a decision.", axis: "making_deciding", evidenceSwipeRefs: refs }, reader);
    expect(good).toMatchObject({ ok: true, data: { tension: { evidenceSwipeRefs: refs } } });
  });

  it("denies self-falsification and lets a different skeptic settle the tension", async () => {
    const context = setup();
    const refs = await seedThreeSwipes(context);
    await context.agent.proposeTension({ operationId: op(), expectedVersion: 4, role: "reader", claim: "You want to make the thing but hesitate when everyone waits for a decision.", axis: "making_deciding", evidenceSwipeRefs: refs }, reader);
    const tensionRef = context.store.load().tensions[0].ref;
    const falsification = { ...moment("Everyone asks you to decide, and you feel lighter before you say a word.", "b"), kind: "falsification" as const, falsifiesTensionRef: tensionRef, expectedGesture: "me" as const };
    const denied = await context.agent.dealCards({ operationId: op(), expectedVersion: 5, role: "reader", cards: [falsification] }, reader);
    expect(denied).toMatchObject({ ok: false, error: { code: "SELF_FALSIFICATION" } });
    const dealt = await context.agent.dealCards({ operationId: op(), expectedVersion: 5, role: "skeptic", cards: [falsification] }, skeptic);
    expect(dealt.ok).toBe(true);
    const cardRef = context.store.load().cards.at(-1)!.ref;
    const swiped = await context.participant.swipeCard({ operationId: op(), expectedVersion: 6, cardRef, gesture: "me", dwell: "fast", flipped: false });
    expect(swiped).toMatchObject({ ok: true, data: { tension: { status: "survived" } } });
  });

  it("keeps Portrait acceptance as the single participant gate into EXPLORING", async () => {
    const context = setup();
    const refs = await seedThreeSwipes(context);
    for (const claim of ["You want to make the thing but hesitate when everyone waits for a decision.", "You enjoy the quiet craft yet wish the room could feel the result with you."]) {
      const version = context.store.load().stateVersion;
      const proposed = await context.agent.proposeTension({ operationId: op(), expectedVersion: version, role: "reader", claim, axis: "making_deciding", evidenceSwipeRefs: refs }, reader);
      const tensionRef = proposed.data && "tension" in proposed.data ? proposed.data.tension.ref : "";
      await context.participant.resolveTension({ operationId: op(), expectedVersion: version + 1, tensionRef, resolution: "accept" });
    }
    const tensions = context.store.load().tensions.map((tension) => tension.ref);
    const portrait = await context.agent.proposePortrait({ operationId: op(), expectedVersion: 8, role: "reader", tensionRefs: tensions }, reader);
    const portraitRef = portrait.data && "portrait" in portrait.data ? portrait.data.portrait.ref : "";
    const accepted = await context.participant.resolvePortrait({ operationId: op(), expectedVersion: 9, portraitRef, resolution: "accept" });
    expect(accepted.ok).toBe(true);
    expect(context.store.load().phase).toBe("EXPLORING");
    expect(accepted.nextActions.map((action) => action.tool)).toContain("set_limits");
  });
});
