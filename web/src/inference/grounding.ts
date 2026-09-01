import { routeProposalInputSchema, type RouteProposalInput, type RouteSlotInput } from "../domain/commands";
import type { RouteKind } from "../domain/workspace";
import { ROUTE_KINDS, type DraftRoute, type LabAssistantInput } from "./schemas";

/**
 * Deterministic post-validator for anything a model drafts. It mirrors the command kernel's
 * proposal rules so that a bad draft is refused here, before it ever reaches the browser, and
 * so a good draft is handed over already in the shape `propose_route_set` accepts.
 *
 * It never trusts model refs: every fresh route receives a server-generated
 * `route-<kind>-<8 hex>` ref that cannot collide with any ref the input mentions.
 */

export type GroundingResult =
  | { ok: true; routes: [RouteSlotInput, RouteSlotInput, RouteSlotInput] }
  | { ok: false; code: "GROUNDING_FAILED"; reasons: string[] };

export interface GroundingOptions {
  /** Injectable for deterministic tests. Must return 8 lowercase hex characters. */
  randomHex?: () => string;
}

const ROUTE_REF_PATTERN = /^route-(closest|bridge|probe)-[0-9a-f]{8}$/;

export function defaultRandomHex(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function freshRouteRef(kind: RouteKind, randomHex: () => string = defaultRandomHex): string {
  return `route-${kind}-${randomHex()}`;
}

export function isGeneratedRouteRef(ref: string): boolean {
  return ROUTE_REF_PATTERN.test(ref);
}

/** Every ref the input already knows about; a fresh ref must not be any of these. */
export function reservedRefs(input: LabAssistantInput): Set<string> {
  return new Set([
    ...input.confirmedWords.map((words) => words.ref),
    ...input.carryRouteRefs,
    ...(input.keptRoutes ?? []).map((route) => route.ref),
    ...(input.supersedesRouteSetRef ? [input.supersedesRouteSetRef] : []),
  ]);
}

export function groundDraftRoutes(
  input: LabAssistantInput,
  draftRoutes: readonly DraftRoute[],
  options: GroundingOptions = {},
): GroundingResult {
  const reasons: string[] = [];
  const caps = input.costCaps;

  const draftKinds = draftRoutes.map((route) => route.kind);
  const expectedKinds = [...input.replaceKinds].sort();
  if (new Set(draftKinds).size !== draftKinds.length) {
    reasons.push("Fresh routes repeat a kind; closest, bridge, and probe must each appear at most once.");
  }
  if (JSON.stringify([...draftKinds].sort()) !== JSON.stringify(expectedKinds)) {
    reasons.push(`Fresh routes must cover exactly these kinds: ${expectedKinds.join(", ")}.`);
  }

  if (new Set(draftRoutes.map((route) => route.learningQuestion.trim())).size !== draftRoutes.length) {
    reasons.push("Every route must ask a distinct learning question.");
  }
  if (new Set(draftRoutes.map((route) => JSON.stringify(route.test))).size !== draftRoutes.length) {
    reasons.push("Every route must propose a distinct test.");
  }

  const wordsByRef = new Map(input.confirmedWords.map((words) => [words.ref, words.text]));
  draftRoutes.forEach((route, index) => {
    const label = `${route.kind} route (${index + 1})`;
    const identities = route.sourceQuotes.map((source) => `${source.reflectionRef} ${source.quote}`);
    if (new Set(identities).size !== identities.length) {
      reasons.push(`${label} repeats the same quote source.`);
    }
    for (const source of route.sourceQuotes) {
      const text = wordsByRef.get(source.reflectionRef);
      if (text === undefined) {
        reasons.push(`${label} cites ${source.reflectionRef}, which is not among the confirmed words.`);
      } else if (!text.includes(source.quote)) {
        reasons.push(`${label} quote is not an exact substring of ${source.reflectionRef}.`);
      }
    }
    const { test } = route;
    if (!Number.isInteger(test.maximumDays) || test.maximumDays < 1 || test.maximumDays > 7) {
      reasons.push(`${label} test must take between 1 and 7 days.`);
    }
    if (test.maximumHours > caps.hoursPerWeek) {
      reasons.push(`${label} test exceeds the weekly time limit of ${caps.hoursPerWeek} hours.`);
    }
    if (test.maximumMoney > caps.money) {
      reasons.push(`${label} test exceeds the money limit of ${caps.money} ${caps.currency}.`);
    }
    if (test.currency !== caps.currency) {
      reasons.push(`${label} test must use ${caps.currency}.`);
    }
  });

  if (reasons.length > 0) return { ok: false, code: "GROUNDING_FAILED", reasons };

  const reserved = reservedRefs(input);
  const randomHex = options.randomHex ?? defaultRandomHex;
  const fresh: RouteProposalInput[] = [];
  for (const route of draftRoutes) {
    let ref = freshRouteRef(route.kind, randomHex);
    for (let attempt = 0; reserved.has(ref) && attempt < 8; attempt += 1) {
      ref = freshRouteRef(route.kind, randomHex);
    }
    if (reserved.has(ref) || !isGeneratedRouteRef(ref)) {
      return { ok: false, code: "GROUNDING_FAILED", reasons: ["Could not allocate a fresh route ref."] };
    }
    reserved.add(ref);
    const { ref: _untrustedRef, ...fields } = route as DraftRoute & { ref?: unknown };
    void _untrustedRef;
    const parsed = routeProposalInputSchema.safeParse({ ...fields, ref });
    if (!parsed.success) {
      return {
        ok: false,
        code: "GROUNDING_FAILED",
        reasons: parsed.error.issues.map((issue) => `${route.kind} route ${issue.path.join(".")}: ${issue.message}`),
      };
    }
    fresh.push(parsed.data);
  }

  return { ok: true, routes: arrangeSlots(input, fresh) };
}

/**
 * Slots are ordered closest, bridge, probe when the kept routes' kinds are known; otherwise
 * carried slots come first. The kernel does not depend on order, only on the set.
 */
function arrangeSlots(
  input: LabAssistantInput,
  fresh: RouteProposalInput[],
): [RouteSlotInput, RouteSlotInput, RouteSlotInput] {
  const slots: RouteSlotInput[] = [];
  if (input.keptRoutes && input.keptRoutes.length === input.carryRouteRefs.length) {
    for (const kind of ROUTE_KINDS) {
      const kept = input.keptRoutes.find((route) => route.kind === kind);
      if (kept) {
        slots.push({ carryRouteRef: kept.ref });
        continue;
      }
      const route = fresh.find((candidate) => candidate.kind === kind);
      if (route) slots.push(route);
    }
  } else {
    slots.push(...input.carryRouteRefs.map((carryRouteRef) => ({ carryRouteRef })));
    for (const kind of ROUTE_KINDS) {
      const route = fresh.find((candidate) => candidate.kind === kind);
      if (route) slots.push(route);
    }
  }
  if (slots.length !== 3) {
    throw new Error(`Grounding produced ${slots.length} slots; expected exactly three.`);
  }
  return slots as [RouteSlotInput, RouteSlotInput, RouteSlotInput];
}

export type InsufficientSignalGrounding =
  | { ok: true; followUpQuestion: string; reasonRefs: string[] }
  | { ok: false; code: "GROUNDING_FAILED"; reasons: string[] };

export function groundInsufficientSignal(
  input: LabAssistantInput,
  draft: { followUpQuestion: string | null; reasonRefs: string[] },
): InsufficientSignalGrounding {
  const reasons: string[] = [];
  const question = draft.followUpQuestion?.trim() ?? "";
  if (question.length === 0 || question.length > 300) {
    reasons.push("insufficient_signal needs one follow-up question of at most 300 characters.");
  }
  const known = new Set(input.confirmedWords.map((words) => words.ref));
  const reasonRefs = [...new Set(draft.reasonRefs)];
  const unknown = reasonRefs.filter((ref) => !known.has(ref));
  if (unknown.length > 0) {
    reasons.push(`reasonRefs cite refs that are not among the confirmed words: ${unknown.join(", ")}.`);
  }
  if (reasonRefs.length === 0) {
    reasons.push("insufficient_signal must cite at least one confirmed words ref.");
  }
  if (reasons.length > 0) return { ok: false, code: "GROUNDING_FAILED", reasons };
  return { ok: true, followUpQuestion: question, reasonRefs: reasonRefs.slice(0, 5) };
}
