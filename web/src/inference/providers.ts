import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, type LanguageModel } from "ai";
import {
  labAssistantDraftSchema,
  ROUTE_KINDS,
  type DraftRoute,
  type LabAssistantDraft,
  type LabAssistantInput,
} from "./schemas";

/**
 * Provider selection for the embedded lab assistant (D-014). Disabled by default; the live
 * provider is any OpenAI-compatible endpoint (OpenCode Go, a local server, a hosted gateway)
 * configured purely through environment variables. Providers are replaceable proposal sources:
 * they return a raw draft and nothing else.
 */

export const DEFAULT_LAB_ASSISTANT_LABEL = "Lab assistant";
export const FAKE_LAB_ASSISTANT_LABEL = "Lab assistant (test double)";
export const FAKE_MINIMUM_SIGNAL_CHARACTERS = 60;

export type LabAssistantProviderName = "disabled" | "openai_compatible" | "fake";

export interface LabAssistantDraftRequest {
  readonly system: string;
  readonly prompt: string;
  readonly input: LabAssistantInput;
}

export interface LabAssistantProvider {
  readonly name: Exclude<LabAssistantProviderName, "disabled">;
  readonly label: string;
  /** Returns an unvalidated draft. The caller validates the schema and grounds it. */
  draft(request: LabAssistantDraftRequest, options: { signal: AbortSignal }): Promise<unknown>;
}

export type LabAssistantProviderSelection =
  | { enabled: false; provider: "disabled"; label: string; reason: string }
  | { enabled: true; provider: "openai_compatible" | "fake"; label: string; instance: LabAssistantProvider };

export interface LabAssistantEnvironment {
  LAB_ASSISTANT_PROVIDER?: string;
  LAB_ASSISTANT_BASE_URL?: string;
  LAB_ASSISTANT_API_KEY?: string;
  LAB_ASSISTANT_MODEL?: string;
  LAB_ASSISTANT_LABEL?: string;
}

export function selectLabAssistantProvider(
  env: LabAssistantEnvironment = process.env as LabAssistantEnvironment,
): LabAssistantProviderSelection {
  const label = env.LAB_ASSISTANT_LABEL?.trim() || DEFAULT_LAB_ASSISTANT_LABEL;
  const provider = (env.LAB_ASSISTANT_PROVIDER ?? "disabled").trim().toLowerCase();

  if (provider === "" || provider === "disabled") {
    return { enabled: false, provider: "disabled", label, reason: "LAB_ASSISTANT_PROVIDER is disabled." };
  }
  if (provider === "fake") {
    const instance = createFakeLabAssistantProvider();
    return { enabled: true, provider: "fake", label: instance.label, instance };
  }
  if (provider === "openai_compatible") {
    const baseURL = env.LAB_ASSISTANT_BASE_URL?.trim();
    const model = env.LAB_ASSISTANT_MODEL?.trim();
    if (!baseURL || !model) {
      return {
        enabled: false,
        provider: "disabled",
        label,
        reason: "LAB_ASSISTANT_PROVIDER=openai_compatible needs LAB_ASSISTANT_BASE_URL and LAB_ASSISTANT_MODEL.",
      };
    }
    const instance = createOpenAICompatibleLabAssistantProvider({
      baseURL,
      apiKey: env.LAB_ASSISTANT_API_KEY?.trim() || undefined,
      model,
      label,
    });
    return { enabled: true, provider: "openai_compatible", label, instance };
  }
  return {
    enabled: false,
    provider: "disabled",
    label,
    reason: `Unknown LAB_ASSISTANT_PROVIDER "${provider}"; expected disabled, openai_compatible, or fake.`,
  };
}

export function createOpenAICompatibleLabAssistantProvider(settings: {
  baseURL: string;
  apiKey?: string;
  model: string;
  label?: string;
}): LabAssistantProvider {
  const provider = createOpenAICompatible({
    name: "lab-assistant",
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
  });
  return createModelLabAssistantProvider(provider.chatModel(settings.model), settings.label);
}

/**
 * Structured output through the AI SDK. Any `LanguageModel` works, which is how tests exercise the
 * exact same code path with a mock model and no network.
 */
export function createModelLabAssistantProvider(
  model: LanguageModel,
  label: string = DEFAULT_LAB_ASSISTANT_LABEL,
): LabAssistantProvider {
  return {
    name: "openai_compatible",
    label,
    async draft(request, { signal }) {
      const result = await generateObject({
        model,
        schema: labAssistantDraftSchema,
        schemaName: "route_proposal_draft",
        schemaDescription: "A Destiny.AI route proposal draft grounded in the participant's exact confirmed words.",
        system: request.system,
        prompt: request.prompt,
        abortSignal: signal,
        maxRetries: 1,
        temperature: 0.2,
      });
      return result.object;
    },
  };
}

/**
 * Deterministic in-process double for tests and local demos. It has no model behind it; it builds
 * three distinct grounded routes from the supplied words, or asks a follow-up question when the
 * words are thin. It goes through the same schema and grounding checks as a live provider.
 */
export function createFakeLabAssistantProvider(): LabAssistantProvider {
  return {
    name: "fake",
    label: FAKE_LAB_ASSISTANT_LABEL,
    async draft(request) {
      return buildFakeLabAssistantDraft(request.input);
    },
  };
}

const FAKE_ROUTE_PLANS: Record<
  (typeof ROUTE_KINDS)[number],
  { title: string; premise: string; learningQuestion: string; action: string; days: number; hours: number; money: number }
> = {
  closest: {
    title: "Stay close to what you already said",
    premise: "Test the direction that sits nearest to the confirmed words, without adding anything new.",
    learningQuestion: "Does doing more of what the words describe create energy worth repeating?",
    action: "Spend one bounded session doing the thing the quoted words describe and note how it felt.",
    days: 3,
    hours: 1,
    money: 0,
  },
  bridge: {
    title: "Bridge the words to one adjacent problem",
    premise: "Combine the confirmed strength with one nearby problem the words hint at, still reversible.",
    learningQuestion: "Does connecting the words to an adjacent problem reveal a direction worth a second step?",
    action: "Pick one adjacent problem, apply the quoted strength to it for a short session, and write down what surprised you.",
    days: 5,
    hours: 2,
    money: 10,
  },
  probe: {
    title: "Probe a less familiar expression",
    premise: "Try the confirmed strength in an unfamiliar setting as a small reversible probe.",
    learningQuestion: "Does an unfamiliar setting for the quoted strength produce curiosity or drain?",
    action: "Make one tiny artifact that uses the quoted strength in a new setting and record the reaction.",
    days: 7,
    hours: 3,
    money: 20,
  },
};

export function buildFakeLabAssistantDraft(input: LabAssistantInput): LabAssistantDraft {
  const totalCharacters = input.confirmedWords.reduce((sum, words) => sum + words.text.trim().length, 0);
  if (totalCharacters < FAKE_MINIMUM_SIGNAL_CHARACTERS) {
    return {
      outcome: "insufficient_signal",
      routes: [],
      followUpQuestion: "What is one recent moment when this felt true, and what exactly were you doing?",
      reasonRefs: input.confirmedWords.map((words) => words.ref).slice(0, 5),
    };
  }

  const caps = input.costCaps;
  const routes: DraftRoute[] = input.replaceKinds.map((kind, index) => {
    const plan = FAKE_ROUTE_PLANS[kind];
    const words = input.confirmedWords[index % input.confirmedWords.length];
    const quote = exactQuote(words.text);
    return {
      kind,
      title: plan.title,
      premise: plan.premise,
      sourceQuotes: [{ reflectionRef: words.ref, quote }],
      constraint: `Stay within ${caps.hoursPerWeek} hours and ${caps.money} ${caps.currency} this week.`,
      learningQuestion: plan.learningQuestion,
      test: {
        action: plan.action,
        maximumDays: plan.days,
        maximumHours: Math.min(caps.hoursPerWeek, plan.hours),
        maximumMoney: Math.min(caps.money, plan.money),
        currency: caps.currency,
      },
      strengthensWhen: "The bounded test creates energy and a clear wish to repeat the work.",
      weakensWhen: "The bounded test drains energy or produces no useful learning.",
    };
  });

  return { outcome: "routes", routes, followUpQuestion: null, reasonRefs: [] };
}

/** An exact substring of the text, bounded to the quote limit, never trimmed at the edges into a non-substring. */
function exactQuote(text: string): string {
  const trimmed = text.trim();
  const source = trimmed.length > 0 ? trimmed : text;
  return source.length <= 500 ? source : source.slice(0, 500);
}
